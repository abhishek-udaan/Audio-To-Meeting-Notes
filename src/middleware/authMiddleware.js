import { env } from "../config/env.js";
import { parseCookies } from "../utils/cookies.js";
import { findSessionById, findUserById } from "../repositories/authRepository.js";

export async function attachUser(req, res, next) {
  try {
    const cookies = parseCookies(req.headers.cookie || "");
    const sessionId = cookies[env.sessionCookieName];

    if (!sessionId) {
      req.user = null;
      return next();
    }

    const session = await findSessionById(sessionId);
    if (!session) {
      req.user = null;
      return next();
    }

    const user = await findUserById(session.userId);
    req.user = user || null;
    req.session = session;
    return next();
  } catch (error) {
    return next(error);
  }
}

export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: "Authentication required."
    });
  }

  return next();
}
