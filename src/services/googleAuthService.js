import { OAuth2Client } from "google-auth-library";
import { env } from "../config/env.js";

let client = null;

function getClient() {
  if (!env.googleClientId) {
    throw new Error("GOOGLE_CLIENT_ID is required for Google login.");
  }

  if (!client) {
    client = new OAuth2Client(env.googleClientId);
  }

  return client;
}

export async function verifyGoogleCredential(credential) {
  const ticket = await getClient().verifyIdToken({
    idToken: credential,
    audience: env.googleClientId
  });

  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) {
    throw new Error("Google login did not return a valid user profile.");
  }

  return {
    id: payload.sub,
    email: payload.email,
    name: payload.name || payload.email,
    picture: payload.picture || "",
    emailVerified: Boolean(payload.email_verified)
  };
}
