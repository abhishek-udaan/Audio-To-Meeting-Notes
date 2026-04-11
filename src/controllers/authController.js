import { createSession, deleteSession, upsertUser } from "../repositories/authRepository.js";
import { env } from "../config/env.js";
import { verifyGoogleCredential } from "../services/googleAuthService.js";
import { serializeCookie } from "../utils/cookies.js";

function sessionCookie(value, maxAge = 60 * 60 * 24 * 30) {
  return serializeCookie(env.sessionCookieName, value, {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: "Lax",
    path: "/",
    maxAge
  });
}

export async function getAuthConfig(req, res) {
  return res.json({
    ok: true,
    googleClientId: env.googleClientId || "",
    authEnabled: Boolean(env.googleClientId)
  });
}

export async function getCurrentUser(req, res) {
  return res.json({
    ok: true,
    user: req.user || null
  });
}

export async function signInWithGoogle(req, res) {
  const { credential } = req.body;
  if (!credential) {
    return res.status(400).json({
      error: "Google credential is required."
    });
  }

  const profile = await verifyGoogleCredential(credential);
  const user = await upsertUser(profile);
  const session = await createSession(user.id);

  res.setHeader("Set-Cookie", sessionCookie(session.id));
  return res.status(201).json({
    ok: true,
    user
  });
}

export async function signOut(req, res) {
  if (req.session?.id) {
    await deleteSession(req.session.id);
  }

  res.setHeader("Set-Cookie", sessionCookie("", 0));
  return res.json({
    ok: true
  });
}
