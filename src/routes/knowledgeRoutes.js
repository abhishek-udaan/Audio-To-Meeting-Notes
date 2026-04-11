import { Router } from "express";
import { askKnowledgeQuestion, getKnowledgeRecords } from "../controllers/knowledgeController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/recordings", requireAuth, asyncHandler(getKnowledgeRecords));
router.post("/ask", requireAuth, asyncHandler(askKnowledgeQuestion));

export default router;
