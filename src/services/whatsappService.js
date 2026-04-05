import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { rawDir } from "../config/paths.js";
import { fetchJson } from "../utils/http.js";

function whatsappHeaders() {
  if (!env.whatsappAccessToken) {
    throw new Error("WHATSAPP_ACCESS_TOKEN is required for WhatsApp media retrieval.");
  }

  return {
    Authorization: `Bearer ${env.whatsappAccessToken}`
  };
}

export function verifyWhatsappChallenge(query) {
  const mode = query["hub.mode"];
  const token = query["hub.verify_token"];
  const challenge = query["hub.challenge"];

  if (mode === "subscribe" && token && token === env.whatsappVerifyToken) {
    return challenge;
  }

  return null;
}

function extractWhatsappMessages(payload) {
  return (payload.entry || []).flatMap((entry) =>
    (entry.changes || []).flatMap((change) => change.value?.messages || [])
  );
}

async function getWhatsappMediaMetadata(mediaId) {
  return fetchJson(`https://graph.facebook.com/${env.whatsappGraphVersion}/${mediaId}`, {
    headers: whatsappHeaders()
  });
}

async function downloadWhatsappMediaFile(url, extension = "bin") {
  const response = await fetch(url, {
    headers: whatsappHeaders()
  });

  if (!response.ok) {
    throw new Error(`Unable to download WhatsApp media: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const filename = `${randomUUID()}.${extension}`;
  const targetPath = path.join(rawDir, filename);
  await fs.writeFile(targetPath, buffer);
  return targetPath;
}

function extensionFromMimeType(mimeType = "") {
  if (mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a";
  return "bin";
}

export async function resolveAudioFromWhatsappPayload(payload) {
  if (payload.audioUrl) {
    const response = await fetch(payload.audioUrl);
    if (!response.ok) {
      throw new Error(`Unable to fetch direct audioUrl: ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const targetPath = path.join(rawDir, `${randomUUID()}.bin`);
    await fs.writeFile(targetPath, buffer);

    return {
      filePath: targetPath,
      title: payload.title || "WhatsApp audio trigger",
      source: payload.source || "whatsapp-direct-url"
    };
  }

  const messages = extractWhatsappMessages(payload);

  for (const message of messages) {
    const mediaId = message.audio?.id || message.document?.id;
    const mimeType = message.audio?.mime_type || message.document?.mime_type || "";

    if (!mediaId) {
      continue;
    }

    const metadata = await getWhatsappMediaMetadata(mediaId);
    const filePath = await downloadWhatsappMediaFile(
      metadata.url,
      extensionFromMimeType(mimeType || metadata.mime_type)
    );

    return {
      filePath,
      title: payload.title || `WhatsApp message ${message.id || randomUUID()}`,
      source: "whatsapp-webhook"
    };
  }

  return null;
}
