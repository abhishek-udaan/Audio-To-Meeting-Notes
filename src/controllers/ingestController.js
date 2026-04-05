import { processRecording } from "../services/pipelineService.js";

export async function uploadAudio(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: "Expected multipart form-data field `audio`." });
  }

  const result = await processRecording({
    filePath: req.file.path,
    title: req.body.title,
    source: req.body.source || "phone-upload",
    participants: req.body.participants,
    occurredAt: req.body.occurredAt
  });

  return res.status(201).json({
    ok: true,
    ...result
  });
}
