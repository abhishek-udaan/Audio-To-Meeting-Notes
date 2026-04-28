import path from "node:path";
import multer from "multer";
import { Router } from "express";
import {
  createRecordingSessionController,
  finalizeRecordingSessionController,
  getUploadJobStatus,
  uploadAudio,
  uploadAudioAsync,
  uploadRecordingChunkController
} from "../controllers/ingestController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { env } from "../config/env.js";
import { uploadsDir } from "../config/paths.js";

const router = Router();

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename(req, file, cb) {
    const safeName = `${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`;
    cb(null, safeName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: env.maxUploadMb * 1024 * 1024
  }
});

const chunkUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Math.min(env.maxUploadMb, 25) * 1024 * 1024
  }
});

router.post("/audio", requireAuth, upload.single("audio"), asyncHandler(uploadAudio));
router.post("/audio/async", requireAuth, upload.single("audio"), asyncHandler(uploadAudioAsync));
router.get("/jobs/:jobId", requireAuth, asyncHandler(getUploadJobStatus));
router.post("/recording-sessions", requireAuth, asyncHandler(createRecordingSessionController));
router.post(
  "/recording-sessions/:sessionId/chunks",
  requireAuth,
  chunkUpload.single("chunk"),
  asyncHandler(uploadRecordingChunkController)
);
router.post("/recording-sessions/:sessionId/finalize", requireAuth, asyncHandler(finalizeRecordingSessionController));

export default router;
