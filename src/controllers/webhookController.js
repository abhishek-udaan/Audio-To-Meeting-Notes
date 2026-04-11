import { processRecording } from "../services/pipelineService.js";
import {
  resolveAudioFromWhatsappPayload,
  verifyWhatsappChallenge
} from "../services/whatsappService.js";

export async function verifyWhatsappWebhook(req, res) {
  const challenge = verifyWhatsappChallenge(req.query);
  if (!challenge) {
    return res.status(403).json({ error: "Webhook verification failed." });
  }

  return res.status(200).send(challenge);
}

export async function receiveWhatsappWebhook(req, res) {
  const audio = await resolveAudioFromWhatsappPayload(req.body);

  if (!audio) {
    return res.status(202).json({
      ok: true,
      message: "Webhook received, but no audio attachment or direct audioUrl was found."
    });
  }

  const result = await processRecording({
    userId: "",
    filePath: audio.filePath,
    title: req.body.title || audio.title,
    source: req.body.source || audio.source,
    participants: req.body.participants,
    occurredAt: req.body.occurredAt
  });

  return res.status(200).json({
    ok: true,
    ...result
  });
}
