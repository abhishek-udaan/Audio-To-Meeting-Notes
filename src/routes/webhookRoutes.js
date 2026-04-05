import { Router } from "express";
import {
  receiveWhatsappWebhook,
  verifyWhatsappWebhook
} from "../controllers/webhookController.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/whatsapp", verifyWhatsappWebhook);
router.post("/whatsapp", asyncHandler(receiveWhatsappWebhook));

export default router;
