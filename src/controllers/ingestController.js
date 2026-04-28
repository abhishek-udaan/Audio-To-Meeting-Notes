import { processRecording } from "../services/pipelineService.js";
import {
  completeProgressJob,
  createProgressJob,
  failProgressJob,
  getProgressJob,
  updateProgressJob
} from "../services/progressJobService.js";
import {
  appendRecordingChunk,
  cleanupRecordingSession,
  createRecordingSession,
  finalizeRecordingSession
} from "../services/recordingSessionService.js";

export async function uploadAudio(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: "Expected multipart form-data field `audio`." });
  }

  const result = await processRecording({
    userId: req.user.id,
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

export async function uploadAudioAsync(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: "Expected multipart form-data field `audio`." });
  }

  const job = createProgressJob({
    userId: req.user.id,
    fileName: req.file.originalname
  });

  updateProgressJob(job.id, {
    status: "processing",
    progress: 5,
    stage: "uploaded",
    message: "Audio uploaded. Preparing AI pipeline."
  });

  processRecording({
    userId: req.user.id,
    filePath: req.file.path,
    title: req.body.title,
    source: req.body.source || "phone-upload",
    participants: req.body.participants,
    occurredAt: req.body.occurredAt,
    onProgress: (payload) => updateProgressJob(job.id, payload)
  })
    .then((result) => {
      completeProgressJob(job.id, {
        ok: true,
        ...result
      });
    })
    .catch((error) => {
      console.error(error);
      failProgressJob(job.id, error);
    });

  return res.status(202).json({
    ok: true,
    jobId: job.id,
    statusUrl: `/api/uploads/jobs/${job.id}`
  });
}

export async function getUploadJobStatus(req, res) {
  const job = getProgressJob(req.params.jobId);

  if (!job || job.userId !== req.user.id) {
    return res.status(404).json({ error: "Upload job not found." });
  }

  return res.json({
    ok: true,
    job: {
      id: job.id,
      status: job.status,
      progress: job.progress,
      stage: job.stage,
      message: job.message,
      result: job.result,
      error: job.error,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt
    }
  });
}

export async function createRecordingSessionController(req, res) {
  const session = await createRecordingSession({
    userId: req.user.id,
    title: req.body.title,
    source: req.body.source || "web-recorder",
    participants: req.body.participants,
    occurredAt: req.body.occurredAt,
    mimeType: req.body.mimeType
  });

  return res.status(201).json({
    ok: true,
    sessionId: session.id
  });
}

export async function uploadRecordingChunkController(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: "Expected multipart form-data field `chunk`." });
  }

  const sequence = Number.parseInt(req.body.sequence || "0", 10);
  if (!Number.isInteger(sequence) || sequence < 0) {
    return res.status(400).json({ error: "Chunk sequence must be a non-negative integer." });
  }

  const result = await appendRecordingChunk({
    sessionId: req.params.sessionId,
    userId: req.user.id,
    buffer: req.file.buffer,
    sequence
  });

  return res.status(202).json({
    ok: true,
    ...result
  });
}

export async function finalizeRecordingSessionController(req, res) {
  const { session, filePath } = await finalizeRecordingSession({
    sessionId: req.params.sessionId,
    userId: req.user.id
  });

  const job = createProgressJob({
    userId: req.user.id,
    fileName: `${session.id}.mp3`
  });

  updateProgressJob(job.id, {
    status: "processing",
    progress: 10,
    stage: "uploaded",
    message: "Recording finalized. Preparing AI pipeline."
  });

  processRecording({
    userId: req.user.id,
    filePath,
    title: session.title,
    source: session.source,
    participants: session.participants,
    occurredAt: session.occurredAt,
    onProgress: (payload) => updateProgressJob(job.id, payload)
  })
    .then(async (result) => {
      completeProgressJob(job.id, {
        ok: true,
        ...result
      });
      await cleanupRecordingSession(session.id);
    })
    .catch(async (error) => {
      console.error(error);
      failProgressJob(job.id, error);
      await cleanupRecordingSession(session.id);
    });

  return res.status(202).json({
    ok: true,
    jobId: job.id,
    statusUrl: `/api/uploads/jobs/${job.id}`
  });
}
