import { randomUUID } from "node:crypto";
import { saveTranscript } from "../repositories/transcriptRepository.js";
import { saveNotes } from "../repositories/noteRepository.js";
import { transcribeAudio } from "./transcriptionService.js";
import { generateMeetingNotes } from "./noteGenerationService.js";
import { deliverToNotion } from "./notionDeliveryService.js";

export async function processRecording({ filePath, title, source, participants, occurredAt }) {
  const recordingId = randomUUID();
  const recording = {
    id: recordingId,
    title: title || `Recording ${recordingId}`,
    source: source || "upload",
    participants: participants || "",
    occurredAt: occurredAt || "",
    filePath
  };

  const transcription = await transcribeAudio(filePath);

  const transcriptPayload = {
    recording,
    transcript: transcription.text,
    transcriptionModel: transcription.model,
    createdAt: new Date().toISOString()
  };

  const transcriptPath = await saveTranscript(recordingId, transcriptPayload);

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

  const notesPath = await saveNotes(recordingId, notesPayload);

  const notionResult = await deliverToNotion({
    recording,
    notes: notesResult.structured,
    transcript: transcription.text
  });

  return {
    recordingId,
    transcriptPath,
    notesPath,
    notion: notionResult,
    notes: notesResult.structured
  };
}
