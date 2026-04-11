import { loadKnowledgeRecords } from "../repositories/knowledgeRepository.js";

function countItems(items = []) {
  return Array.isArray(items) ? items.length : 0;
}

export async function listUserNotes(userId) {
  const records = await loadKnowledgeRecords(userId);

  return records
    .map((record) => ({
      recordingId: record.recordingId,
      title: record.title,
      participants: record.participants,
      source: record.source,
      occurredAt: record.occurredAt,
      summary: record.summary,
      decisions: record.decisions,
      followUps: record.followUps,
      actionItems: record.actionItems,
      actionItemCount: countItems(record.actionItems),
      decisionCount: countItems(record.decisions),
      followUpCount: countItems(record.followUps),
      transcriptUrl: `/api/notes/${record.recordingId}/transcript`,
      notesUrl: `/api/notes/${record.recordingId}/notes`,
      notionUrl: record.notionUrl || ""
    }))
    .sort((a, b) => (b.occurredAt || "").localeCompare(a.occurredAt || ""));
}
