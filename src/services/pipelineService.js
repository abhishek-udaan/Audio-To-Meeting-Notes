import { randomUUID } from "node:crypto";
import { saveTranscript } from "../repositories/transcriptRepository.js";
import { saveNotes } from "../repositories/noteRepository.js";
import { transcribeAudio } from "./transcriptionService.js";
import { generateMeetingNotes } from "./noteGenerationService.js";
import { deliverToNotion } from "./notionDeliveryService.js";
import { createProgressReporter } from "../utils/progress.js";

export async function processRecording({ userId = "", filePath, title, source, participants, occurredAt, onProgress }) {
  const progress = createProgressReporter(onProgress);
  const recordingId = randomUUID();
  const recording = {
    id: recordingId,
    userId,
    title: title || `Recording ${recordingId}`,
    source: source || "upload",
    participants: participants || "",
    occurredAt: occurredAt || "",
    filePath
  };

  progress({
    progress: 8,
    stage: "queued",
    status: "processing",
    message: "Upload finished. Starting processing pipeline."
  });

  const transcription = await transcribeAudio(filePath, { onProgress: progress });
  progress({
    progress: 62,
    stage: "saving-transcript",
    status: "processing",
    message: "Transcript complete. Saving transcript."
  });

  const transcriptPayload = {
    recording,
    transcript: transcription.text,
    transcriptionModel: transcription.model,
    createdAt: new Date().toISOString()
  };

  const transcriptPath = await saveTranscript(userId, recordingId, transcriptPayload);
  progress({
    progress: 70,
    stage: "generating-notes",
    status: "processing",
    message: "Generating structured meeting notes with AI."
  });

  const notesResult = await generateMeetingNotes({
    title: recording.title,
    source: recording.source,
    participants: recording.participants,
    occurredAt: recording.occurredAt,
    transcript: transcription.text
  });

  const notesPayload = {
    recording,
    notes: notesResult.structured,
    noteModel: notesResult.model,
    rawModelOutput: notesResult.raw,
    createdAt: new Date().toISOString()
  };

  const notesPath = await saveNotes(userId, recordingId, notesPayload);
  progress({
    progress: 86,
    stage: "sending-to-notion",
    status: "processing",
    message: "Notes are ready. Sending full results to Notion."
  });

  const notionResult = await deliverToNotion({
    recording,
    notes: notesResult.structured,
    transcript: transcription.text
  });

  await saveNotes(userId, recordingId, {
    ...notesPayload,
    notion: notionResult
  });
  progress({
    progress: 96,
    stage: "finalizing",
    status: "processing",
    message: "Finishing storage and packaging links."
  });

  return {
    recordingId,
    transcriptPath,
    notesPath,
    notion: notionResult,
    notes: notesResult.structured
  };
}
