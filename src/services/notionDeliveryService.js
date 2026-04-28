import { env } from "../config/env.js";
import { fetchJson } from "../utils/http.js";
import { toSentenceList, truncate } from "../utils/text.js";

const notionBaseUrl = "https://api.notion.com/v1";
const NOTION_RICH_TEXT_LIMIT = 1900;
const NOTION_MAX_CHILDREN_PER_REQUEST = 100;

function notionHeaders() {
  return {
    Authorization: `Bearer ${env.notionApiToken}`,
    "Notion-Version": env.notionVersion,
    "Content-Type": "application/json"
  };
}

async function resolveNotionParent() {
  if (env.notionDataSourceId) {
    return {
      type: "data_source_id",
      data_source_id: env.notionDataSourceId
    };
  }

  return {
    type: "database_id",
    database_id: env.notionDatabaseId
  };
}

function buildProperties({ title, source, processedAt }) {
  const processedLabel = "Processed";
  const properties = {
    [env.notionTitleProperty]: {
      title: [{ text: { content: truncate(title || "Untitled recording", 180) } }]
    }
  };

  if (env.notionSourceProperty) {
    properties[env.notionSourceProperty] = buildTextLikeProperty(
      env.notionSourcePropertyType,
      truncate(source || "upload", 180)
    );
  }

  if (env.notionStatusProperty) {
    properties[env.notionStatusProperty] = buildTextLikeProperty(
      env.notionStatusPropertyType,
      processedLabel
    );
  }

  if (env.notionProcessedProperty) {
    properties[env.notionProcessedProperty] = buildTextLikeProperty(
      env.notionProcessedPropertyType,
      "Yes"
    );
  }

  if (env.notionDateProperty) {
    properties[env.notionDateProperty] = buildDateLikeProperty(
      env.notionDatePropertyType,
      processedAt
    );
  }

  return properties;
}

function buildTextLikeProperty(type, value) {
  if (type === "select") {
    return { select: { name: value } };
  }

  if (type === "status") {
    return { status: { name: value } };
  }

  return {
    rich_text: [{ text: { content: value } }]
  };
}

function buildDateLikeProperty(type, value) {
  if (type === "date") {
    return {
      date: { start: value }
    };
  }

  return {
    rich_text: [{ text: { content: value } }]
  };
}

function paragraphBlock(text) {
  return {
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: [
        {
          type: "text",
          text: { content: truncate(text, 1900) }
        }
      ]
    }
  };
}

function headingBlock(text) {
  return {
    object: "block",
    type: "heading_2",
    heading_2: {
      rich_text: [
        {
          type: "text",
          text: { content: truncate(text, 200) }
        }
      ]
    }
  };
}

function bulletedListBlocks(items = []) {
  return items
    .filter(Boolean)
    .map((item) => ({
      object: "block",
      type: "bulleted_list_item",
      bulleted_list_item: {
        rich_text: [
          {
            type: "text",
            text: { content: truncate(item, 1900) }
          }
        ]
      }
    }));
}

function buildActionItemText(item) {
  const segments = [
    item.task || "Unspecified task",
    item.owner ? `Owner: ${item.owner}` : null,
    item.deadline ? `Deadline: ${item.deadline}` : null,
    item.status ? `Status: ${item.status}` : null,
    item.confidence ? `Confidence: ${item.confidence}` : null
  ].filter(Boolean);

  return segments.join(" | ");
}

function chunkText(value, maxLength = NOTION_RICH_TEXT_LIMIT) {
  if (!value) return [];

  const normalized = String(value).replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const chunks = [];
  let remaining = normalized;

  while (remaining.length > maxLength) {
    let splitAt = remaining.lastIndexOf("\n\n", maxLength);
    if (splitAt < Math.floor(maxLength * 0.5)) {
      splitAt = remaining.lastIndexOf("\n", maxLength);
    }
    if (splitAt < Math.floor(maxLength * 0.5)) {
      splitAt = remaining.lastIndexOf(" ", maxLength);
    }
    if (splitAt <= 0) {
      splitAt = maxLength;
    }

    const piece = remaining.slice(0, splitAt).trim();
    if (piece) chunks.push(piece);
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

function transcriptBlocks(transcriptText) {
  const parts = chunkText(transcriptText);
  if (!parts.length) {
    return [paragraphBlock("Transcript unavailable.")];
  }

  return parts.map((part) => paragraphBlock(part));
}

function buildChildrenBlocks(notes) {
  return [
    headingBlock("Summary"),
    paragraphBlock(notes.summary || "No summary generated."),
    headingBlock("Detailed Notes"),
    ...bulletedListBlocks(notes.detailedNotes),
    headingBlock("Action Items"),
    ...bulletedListBlocks((notes.actionItems || []).map(buildActionItemText)),
    headingBlock("Decisions"),
    ...bulletedListBlocks(notes.decisions),
    headingBlock("Follow-Ups"),
    ...bulletedListBlocks(notes.followUps),
    headingBlock("Open Questions"),
    ...bulletedListBlocks(notes.openQuestions),
    headingBlock("Risks"),
    ...bulletedListBlocks(notes.risks)
  ];
}

function chunkBlocks(blocks, chunkSize = NOTION_MAX_CHILDREN_PER_REQUEST) {
  const chunks = [];
  for (let index = 0; index < blocks.length; index += chunkSize) {
    chunks.push(blocks.slice(index, index + chunkSize));
  }
  return chunks;
}

async function appendBlockChildren(blockId, children) {
  if (!children.length) return;

  for (const batch of chunkBlocks(children)) {
    await fetchJson(`${notionBaseUrl}/blocks/${blockId}/children`, {
      method: "PATCH",
      headers: notionHeaders(),
      body: JSON.stringify({ children: batch })
    });
  }
}

export async function deliverToNotion({ recording, notes, transcript }) {
  const parent = await resolveNotionParent();
  const processedAt = new Date().toISOString();
  const transcriptSection = [headingBlock("Transcript"), ...transcriptBlocks(transcript)];
  const noteBlocks = buildChildrenBlocks(notes);
  const initialChildren = [...noteBlocks, ...transcriptSection].slice(0, NOTION_MAX_CHILDREN_PER_REQUEST);
  const remainingChildren = [...noteBlocks, ...transcriptSection].slice(NOTION_MAX_CHILDREN_PER_REQUEST);

  const payload = {
    parent,
    icon: {
      type: "emoji",
      emoji: env.notionPageIcon
    },
    properties: buildProperties({
      title: recording.title,
      source: recording.source,
      processedAt
    }),
    children: initialChildren
  };

  const createdPage = await fetchJson(`${notionBaseUrl}/pages`, {
    method: "POST",
    headers: notionHeaders(),
    body: JSON.stringify(payload)
  });

  await appendBlockChildren(createdPage.id, remainingChildren);

  return {
    pageId: createdPage.id,
    url: createdPage.url,
    processedAt,
    summaryPreview: toSentenceList(notes.decisions || [])
  };
}
