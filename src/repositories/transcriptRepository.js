import fs from "node:fs/promises";
import path from "node:path";
import { getUserTranscriptsDir, transcriptsDir } from "../config/paths.js";

export async function saveTranscript(userId, recordingId, payload) {
  const targetDir = userId ? getUserTranscriptsDir(userId) : transcriptsDir;
  await fs.mkdir(targetDir, { recursive: true });
  const filePath = path.join(targetDir, `${recordingId}.json`);
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
  return filePath;
}
