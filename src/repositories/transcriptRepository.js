import fs from "node:fs/promises";
import path from "node:path";
import { transcriptsDir } from "../config/paths.js";

export async function saveTranscript(recordingId, payload) {
  const filePath = path.join(transcriptsDir, `${recordingId}.json`);
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
  return filePath;
}
