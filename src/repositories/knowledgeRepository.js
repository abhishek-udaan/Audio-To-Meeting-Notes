import fs from "node:fs/promises";
import path from "node:path";
import { getUserNotesDir, getUserTranscriptsDir, notesDir, transcriptsDir } from "../config/paths.js";

async function readJsonIfExists(filePath) {
  try {
    const contents = await fs.readFile(filePath, "utf8");
    return JSON.parse(contents);
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

function summarizeTranscript(text = "", maxLength = 1200) {
  if (!text) return "";
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function buildSearchableText(record) {
  const fields = [
    record.title,
    record.participants,
    record.source,
    record.summary,
    ...(record.detailedNotes || []),
    ...(record.decisions || []),
    ...(record.followUps || []),
    ...(record.openQuestions || []),
    ...(record.risks || []),
    ...(record.actionItems || []).map((item) =>
      [item.task, item.owner, item.deadline, item.status, item.confidence].filter(Boolean).join(" ")
    ),
    record.transcript
  ];

  return fields.filter(Boolean).join(" ").toLowerCase();
}

export async function loadKnowledgeRecords(userId = "") {
  const currentNotesDir = userId ? getUserNotesDir(userId) : notesDir;
  const currentTranscriptsDir = userId ? getUserTranscriptsDir(userId) : transcriptsDir;

  let noteFiles = [];
  try {
    noteFiles = await fs.readdir(currentNotesDir);
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const jsonFiles = noteFiles.filter((filename) => filename.endsWith(".json"));

  const records = await Promise.all(
    jsonFiles.map(async (filename) => {
      const recordingId = path.basename(filename, ".json");
      const notePath = path.join(currentNotesDir, filename);
      const transcriptPath = path.join(currentTranscriptsDir, filename);
      const notePayload = await readJsonIfExists(notePath);
      const transcriptPayload = await readJsonIfExists(transcriptPath);

      if (!notePayload) {
        return null;
      }

      const notes = notePayload.notes || {};
      const recording = notePayload.recording || {};
      const transcript = transcriptPayload?.transcript || "";
      const notion = notePayload.notion || null;

      return {
        recordingId,
        title: recording.title || `Recording ${recordingId}`,
        participants: recording.participants || "",
        source: recording.source || "",
        occurredAt: recording.occurredAt || "",
        transcript,
        transcriptPath,
        notesPath: notePath,
        notionUrl: notion?.url || "",
        summary: notes.summary || "",
        detailedNotes: notes.detailedNotes || [],
        actionItems: notes.actionItems || [],
        decisions: notes.decisions || [],
        followUps: notes.followUps || [],
        openQuestions: notes.openQuestions || [],
        risks: notes.risks || [],
        transcriptExcerpt: summarizeTranscript(transcript),
        searchableText: buildSearchableText({
          ...recording,
          ...notes,
          transcript
        })
      };
    })
  );

  return records.filter(Boolean).sort((a, b) => a.title.localeCompare(b.title));
}
