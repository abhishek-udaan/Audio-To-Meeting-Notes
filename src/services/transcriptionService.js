import fs from "node:fs";
import fsPromises from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import { openai } from "../config/openai.js";
import { env } from "../config/env.js";
import { runCommand } from "../utils/process.js";

async function getAudioDurationWithAfinfo(filePath) {
  const { stdout } = await runCommand("/usr/bin/afinfo", [filePath]);
  const match = stdout.match(/estimated duration:\s*([0-9.]+)\s*sec/i);

  if (!match) {
    throw new Error("Could not determine audio duration from afinfo.");
  }

  const duration = Number.parseFloat(match[1]);
  if (Number.isNaN(duration)) {
    throw new Error("afinfo returned an invalid audio duration.");
  }

  return duration;
}

async function getAudioDurationSeconds(filePath) {
  if (process.platform === "darwin") {
    try {
      return await getAudioDurationWithAfinfo(filePath);
    } catch (error) {
      if (error?.errno !== -86 && error?.code !== -86) {
        throw error;
      }
    }
  }

  const { stdout } = await runCommand(ffprobe.path, [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath
  ]);

  const duration = Number.parseFloat(stdout.trim());
  if (Number.isNaN(duration)) {
    throw new Error("Could not determine audio duration.");
  }

  return duration;
}

async function splitAudioIntoChunks(filePath, chunkSeconds) {
  const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "meeting-audio-chunks-"));
  const outputPattern = path.join(tempDir, "chunk-%03d.mp3");

  await runCommand(ffmpegPath, [
    "-i",
    filePath,
    "-f",
    "segment",
    "-segment_time",
    String(chunkSeconds),
    "-c:a",
    "libmp3lame",
    "-b:a",
    "64k",
    outputPattern
  ]);

  const files = await fsPromises.readdir(tempDir);
  const chunkPaths = files
    .filter((filename) => filename.endsWith(".mp3"))
    .sort()
    .map((filename) => path.join(tempDir, filename));

  if (!chunkPaths.length) {
    throw new Error("Audio splitting completed but no chunks were created.");
  }

  return {
    tempDir,
    chunkPaths
  };
}

async function cleanupChunkDirectory(tempDir) {
  if (!tempDir) return;
  await fsPromises.rm(tempDir, { recursive: true, force: true });
}

async function transcribeSingleFile(filePath) {
  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream(filePath),
    model: env.openAiTranscriptionModel,
    prompt: env.openAiTranscriptionPrompt
  });

  return transcription.text?.trim() || "";
}

export async function transcribeAudio(filePath) {
  const durationSeconds = await getAudioDurationSeconds(filePath);

  if (durationSeconds <= env.transcriptionChunkSeconds) {
    return {
      model: env.openAiTranscriptionModel,
      text: await transcribeSingleFile(filePath)
    };
  }

  const { tempDir, chunkPaths } = await splitAudioIntoChunks(filePath, env.transcriptionChunkSeconds);

  try {
    const chunkTexts = [];

    for (const chunkPath of chunkPaths) {
      const chunkText = await transcribeSingleFile(chunkPath);
      if (chunkText) {
        chunkTexts.push(chunkText);
      }
    }

    return {
      model: env.openAiTranscriptionModel,
      text: chunkTexts.join("\n\n")
    };
  } finally {
    await cleanupChunkDirectory(tempDir);
  }
}
