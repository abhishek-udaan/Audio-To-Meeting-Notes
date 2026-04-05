import { openai } from "../config/openai.js";
import { env } from "../config/env.js";
import { buildMeetingQaUserPrompt, meetingQaSystemPrompt } from "../prompts/meetingQaPrompt.js";
import { loadKnowledgeRecords } from "../repositories/knowledgeRepository.js";

function tokenize(text) {
  return (text.toLowerCase().match(/[a-z0-9]+/g) || []).filter((token) => token.length > 1);
}

function scoreRecord(questionTokens, record) {
  let score = 0;

  for (const token of questionTokens) {
    if (record.searchableText.includes(token)) {
      score += 1;
    }

    if (record.title.toLowerCase().includes(token)) {
      score += 3;
    }

    if ((record.summary || "").toLowerCase().includes(token)) {
      score += 2;
    }
  }

  return score;
}

function parseAnswerPayload(outputText) {
  try {
    return JSON.parse(outputText);
  } catch (error) {
    const parsingError = new Error("OpenAI meeting Q&A response was not valid JSON.");
    parsingError.cause = error;
    parsingError.outputText = outputText;
    throw parsingError;
  }
}

function toPublicFileUrl(filePath, kind) {
  const filename = filePath.split("/").pop();
  return `/files/${kind}/${filename}`;
}

export async function listKnowledgeRecords() {
  const records = await loadKnowledgeRecords();

  return records.map((record) => ({
    recordingId: record.recordingId,
    title: record.title,
    participants: record.participants,
    source: record.source,
    occurredAt: record.occurredAt,
    summary: record.summary,
    transcriptUrl: toPublicFileUrl(record.transcriptPath, "transcripts"),
    notesUrl: toPublicFileUrl(record.notesPath, "notes"),
    notionUrl: record.notionUrl || ""
  }));
}

export async function answerQuestionAcrossRecordings(question, options = {}) {
  const normalizedQuestion = question?.trim();

  if (!normalizedQuestion) {
    throw new Error("Question is required.");
  }

  const records = await loadKnowledgeRecords();
  if (!records.length) {
    return {
      answer: "No processed recordings are available yet.",
      confidence: "low",
      matches: [],
      supportingRecordings: []
    };
  }

  const questionTokens = tokenize(normalizedQuestion);
  const rankedMatches = records
    .map((record) => ({
      ...record,
      score: scoreRecord(questionTokens, record)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, options.limit || 5);

  if (!rankedMatches.length || rankedMatches[0].score <= 0) {
    return {
      answer: "I could not find any saved recording that clearly answers that question yet.",
      confidence: "low",
      matches: [],
      supportingRecordings: []
    };
  }

  const response = await openai.responses.create({
    model: env.openAiNotesModel,
    reasoning: { effort: env.openAiReasoningEffort },
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: meetingQaSystemPrompt }]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: buildMeetingQaUserPrompt({
              question: normalizedQuestion,
              matches: rankedMatches
            })
          }
        ]
      }
    ]
  });

  const outputText = response.output_text?.trim();
  if (!outputText) {
    throw new Error("OpenAI meeting Q&A returned empty output.");
  }

  const parsed = parseAnswerPayload(outputText);

  return {
    answer: parsed.answer,
    confidence: parsed.confidence,
    matches: rankedMatches.map((match) => ({
      recordingId: match.recordingId,
      title: match.title,
      summary: match.summary,
      transcriptUrl: toPublicFileUrl(match.transcriptPath, "transcripts"),
      notesUrl: toPublicFileUrl(match.notesPath, "notes"),
      notionUrl: match.notionUrl || ""
    })),
    supportingRecordings: parsed.supportingRecordings || []
  };
}
