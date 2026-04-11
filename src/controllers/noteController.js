import { listUserNotes } from "../services/noteLibraryService.js";
import { getNoteFileForUser, getTranscriptFileForUser } from "../repositories/noteRepository.js";

export async function getUserNotes(req, res) {
  const notes = await listUserNotes(req.user.id);
  return res.json({
    ok: true,
    notes
  });
}

export async function getUserRecordingFile(req, res) {
  const { recordingId, kind } = req.params;
  if (!["transcript", "notes"].includes(kind)) {
    return res.status(400).json({
      error: "Invalid recording file type."
    });
  }

  const filePath =
    kind === "transcript"
      ? await getTranscriptFileForUser(req.user.id, recordingId)
      : await getNoteFileForUser(req.user.id, recordingId);

  if (!filePath) {
    return res.status(404).json({
      error: "Recording file not found."
    });
  }

  return res.sendFile(filePath);
}
