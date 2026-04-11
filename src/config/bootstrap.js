import fs from "node:fs/promises";
import { authDir, notesDir, rawDir, storageRoot, transcriptsDir, uploadsDir, usersRootDir } from "./paths.js";

export async function ensureAppDirectories() {
  await Promise.all([
    fs.mkdir(storageRoot, { recursive: true }),
    fs.mkdir(authDir, { recursive: true }),
    fs.mkdir(usersRootDir, { recursive: true }),
    fs.mkdir(uploadsDir, { recursive: true }),
    fs.mkdir(rawDir, { recursive: true }),
    fs.mkdir(transcriptsDir, { recursive: true }),
    fs.mkdir(notesDir, { recursive: true })
  ]);
}
