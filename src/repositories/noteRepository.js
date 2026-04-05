import fs from "node:fs/promises";
import path from "node:path";
import { notesDir } from "../config/paths.js";

export async function saveNotes(recordingId, payload) {
  const filePath = path.join(notesDir, `${recordingId}.json`);
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
  return filePath;
}
