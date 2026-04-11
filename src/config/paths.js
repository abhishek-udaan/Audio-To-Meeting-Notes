import path from "node:path";
import { env } from "./env.js";

export const storageRoot = path.resolve(process.cwd(), env.storageDir);
export const authDir = path.join(storageRoot, "auth");
export const usersRootDir = path.join(storageRoot, "users");
export const uploadsDir = path.join(storageRoot, "uploads");
export const rawDir = path.join(storageRoot, "raw");
export const transcriptsDir = path.join(storageRoot, "transcripts");
export const notesDir = path.join(storageRoot, "notes");

export function getUserDir(userId) {
  return path.join(usersRootDir, userId);
}

export function getUserNotesDir(userId) {
  return path.join(getUserDir(userId), "notes");
}

export function getUserTranscriptsDir(userId) {
  return path.join(getUserDir(userId), "transcripts");
}
