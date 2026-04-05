import fs from "node:fs/promises";
import { notesDir, rawDir, storageRoot, transcriptsDir, uploadsDir } from "./paths.js";

export async function ensureAppDirectories() {
  await Promise.all([
    fs.mkdir(storageRoot, { recursive: true }),
    fs.mkdir(uploadsDir, { recursive: true }),
    fs.mkdir(rawDir, { recursive: true }),
    fs.mkdir(transcriptsDir, { recursive: true }),
    fs.mkdir(notesDir, { recursive: true })
  ]);
}
