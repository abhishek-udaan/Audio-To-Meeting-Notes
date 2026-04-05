import { Router } from "express";
import { askKnowledgeQuestion, getKnowledgeRecords } from "../controllers/knowledgeController.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/recordings", asyncHandler(getKnowledgeRecords));
router.post("/ask", asyncHandler(askKnowledgeQuestion));

export default router;
