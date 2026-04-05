import fs from "node:fs";
import { openai } from "../config/openai.js";
import { env } from "../config/env.js";

export async function transcribeAudio(filePath) {
  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream(filePath),
    model: env.openAiTranscriptionModel,
    prompt: env.openAiTranscriptionPrompt
  });

  return {
    model: env.openAiTranscriptionModel,
    text: transcription.text?.trim() || ""
  };
}
