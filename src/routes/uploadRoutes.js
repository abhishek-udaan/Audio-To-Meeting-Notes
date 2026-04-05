import path from "node:path";
import multer from "multer";
import { Router } from "express";
import { uploadAudio } from "../controllers/ingestController.js";
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

router.post("/audio", upload.single("audio"), asyncHandler(uploadAudio));

export default router;
