import { randomUUID } from "node:crypto";

const jobs = new Map();
const JOB_TTL_MS = 1000 * 60 * 60 * 6;

function nowIso() {
  return new Date().toISOString();
}

function sanitizeProgress(value) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function scheduleCleanup(jobId) {
  const timeout = setTimeout(() => {
    jobs.delete(jobId);
  }, JOB_TTL_MS);

  if (typeof timeout.unref === "function") {
    timeout.unref();
  }
}

export function createProgressJob({ userId, fileName = "" }) {
  const jobId = randomUUID();
  const job = {
    id: jobId,
    userId,
    fileName,
    status: "queued",
    progress: 0,
    stage: "queued",
    message: "Upload queued.",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    result: null,
    error: null
  };

  jobs.set(jobId, job);
  scheduleCleanup(jobId);
  return job;
}

export function updateProgressJob(jobId, patch = {}) {
  const job = jobs.get(jobId);
  if (!job) return null;

  if (patch.progress != null) {
    job.progress = sanitizeProgress(patch.progress);
  }

  if (patch.stage) {
    job.stage = patch.stage;
  }

  if (patch.message) {
    job.message = patch.message;
  }

  if (patch.status) {
    job.status = patch.status;
  }

  if (patch.result !== undefined) {
    job.result = patch.result;
  }

  if (patch.error !== undefined) {
    job.error = patch.error;
  }

  job.updatedAt = nowIso();
  return job;
}

export function completeProgressJob(jobId, result) {
  return updateProgressJob(jobId, {
    status: "completed",
    progress: 100,
    stage: "completed",
    message: "Everything is ready.",
    result,
    error: null
  });
}

export function failProgressJob(jobId, error) {
  return updateProgressJob(jobId, {
    status: "failed",
    stage: "failed",
    message: error?.message || "Processing failed.",
    error: error?.message || "Processing failed."
  });
}

export function getProgressJob(jobId) {
  return jobs.get(jobId) || null;
}
