import fs from "node:fs/promises";
import path from "node:path";
import { getUserNotesDir, getUserTranscriptsDir, notesDir } from "../config/paths.js";

async function saveJsonFile(directory, recordingId, payload) {
  await fs.mkdir(directory, { recursive: true });
  const filePath = path.join(directory, `${recordingId}.json`);
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
  return filePath;
}

export async function saveNotes(userId, recordingId, payload) {
  const targetDir = userId ? getUserNotesDir(userId) : notesDir;
  return saveJsonFile(targetDir, recordingId, payload);
}

export async function getNoteFileForUser(userId, recordingId) {
  const filePath = path.join(getUserNotesDir(userId), `${recordingId}.json`);

  try {
    await fs.access(filePath);
    return filePath;
  } catch {
    return null;
  }
}

export async function getTranscriptFileForUser(userId, recordingId) {
  const filePath = path.join(getUserTranscriptsDir(userId), `${recordingId}.json`);

  try {
    await fs.access(filePath);
    return filePath;
  } catch {
    return null;
  }
}
