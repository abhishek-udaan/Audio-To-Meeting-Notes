import { Router } from "express";
import { getAuthConfig, getCurrentUser, signInWithGoogle, signOut } from "../controllers/authController.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/config", asyncHandler(getAuthConfig));
router.get("/me", asyncHandler(getCurrentUser));
router.post("/google", asyncHandler(signInWithGoogle));
router.post("/logout", asyncHandler(signOut));

export default router;
