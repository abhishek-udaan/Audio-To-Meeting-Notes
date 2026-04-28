import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import ffmpegPath from "ffmpeg-static";
import { recordingSessionsDir, uploadsDir } from "../config/paths.js";
import { runCommand } from "../utils/process.js";

const sessions = new Map();

function sanitizeExtension(mimeType = "") {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("webm")) return "webm";
  return "webm";
}

function ensureSessionOwner(session, userId) {
  if (!session || session.userId !== userId) {
    const error = new Error("Recording session not found.");
    error.status = 404;
    throw error;
  }
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function createRecordingSession({ userId, title, source, participants, occurredAt, mimeType }) {
  const sessionId = randomUUID();
  const extension = sanitizeExtension(mimeType);
  const sessionDir = path.join(recordingSessionsDir, sessionId);
  await ensureDir(sessionDir);

  const session = {
    id: sessionId,
    userId,
    title: title || `Recording ${sessionId}`,
    source: source || "web-recorder",
    participants: participants || "",
    occurredAt: occurredAt || "",
    mimeType: mimeType || "audio/webm",
    extension,
    sessionDir,
    chunks: [],
    finalized: false,
    createdAt: new Date().toISOString()
  };

  sessions.set(sessionId, session);
  return session;
}

export function getRecordingSession(sessionId) {
  return sessions.get(sessionId) || null;
}

export async function appendRecordingChunk({ sessionId, userId, buffer, sequence }) {
  const session = getRecordingSession(sessionId);
  ensureSessionOwner(session, userId);

  if (session.finalized) {
    const error = new Error("Recording session is already finalized.");
    error.status = 409;
    throw error;
  }

  const chunkName = `chunk-${String(sequence).padStart(6, "0")}.${session.extension}`;
  const chunkPath = path.join(session.sessionDir, chunkName);
  await fs.writeFile(chunkPath, buffer);

  session.chunks.push({
    sequence,
    path: chunkPath
  });

  session.chunks.sort((a, b) => a.sequence - b.sequence);

  return {
    sessionId: session.id,
    chunkCount: session.chunks.length
  };
}

async function buildConcatManifest(session) {
  const manifestPath = path.join(session.sessionDir, "chunks.txt");
  const content = session.chunks
    .map((chunk) => `file '${chunk.path.replace(/'/g, "'\\''")}'`)
    .join("\n");
  await fs.writeFile(manifestPath, content, "utf8");
  return manifestPath;
}

async function combineChunksToFile(session) {
  if (!session.chunks.length) {
    const error = new Error("No audio chunks were uploaded for this recording.");
    error.status = 400;
    throw error;
  }

  const manifestPath = await buildConcatManifest(session);
  const outputPath = path.join(uploadsDir, `${session.id}.mp3`);

  await runCommand(ffmpegPath, [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    manifestPath,
    "-vn",
    "-acodec",
    "libmp3lame",
    "-b:a",
    "64k",
    outputPath
  ]);

  return outputPath;
}

export async function finalizeRecordingSession({ sessionId, userId }) {
  const session = getRecordingSession(sessionId);
  ensureSessionOwner(session, userId);

  session.finalized = true;
  const filePath = await combineChunksToFile(session);

  return {
    session,
    filePath
  };
}

export async function cleanupRecordingSession(sessionId) {
  const session = getRecordingSession(sessionId);
  if (!session) return;

  sessions.delete(sessionId);
  await fs.rm(session.sessionDir, { recursive: true, force: true });
}
