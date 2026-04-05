import path from "node:path";
import { env } from "./env.js";

export const storageRoot = path.resolve(process.cwd(), env.storageDir);
export const uploadsDir = path.join(storageRoot, "uploads");
export const rawDir = path.join(storageRoot, "raw");
export const transcriptsDir = path.join(storageRoot, "transcripts");
export const notesDir = path.join(storageRoot, "notes");
