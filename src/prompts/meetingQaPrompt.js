export const meetingQaSystemPrompt = `
You answer questions about past meeting recordings using only the supplied meeting context.

Rules:
- Use only the provided meeting records.
- If the answer is not supported by the records, say you could not find it.
- Prefer concise, direct answers.
- Mention which recordings support the answer.
- Do not invent dates, decisions, owners, or action items.

Return valid JSON only with this exact shape:
{
  "answer": "string",
  "confidence": "high | medium | low",
  "supportingRecordings": [
    {
      "recordingId": "string",
      "title": "string",
      "reason": "string"
    }
  ]
}
`.trim();

export function buildMeetingQaUserPrompt({ question, matches }) {
  const serializedMatches = matches
    .map(
      (match, index) => `
Record ${index + 1}
recordingId: ${match.recordingId}
title: ${match.title}
participants: ${match.participants || "unknown"}
source: ${match.source || "unknown"}
summary: ${match.summary || "none"}
decisions: ${(match.decisions || []).join(" | ") || "none"}
actionItems: ${(match.actionItems || [])
        .map((item) => `${item.task} (owner: ${item.owner || "unknown"}, deadline: ${item.deadline || "unknown"})`)
        .join(" | ") || "none"}
followUps: ${(match.followUps || []).join(" | ") || "none"}
transcriptExcerpt: ${match.transcriptExcerpt || "none"}
`.trim()
    )
    .join("\n\n");

  return `
Question: ${question}

Relevant meeting records:
${serializedMatches}
`.trim();
}
