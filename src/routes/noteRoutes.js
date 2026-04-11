import { Router } from "express";
import { getUserNotes, getUserRecordingFile } from "../controllers/noteController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/", requireAuth, asyncHandler(getUserNotes));
router.get("/:recordingId/:kind", requireAuth, asyncHandler(getUserRecordingFile));

export default router;
