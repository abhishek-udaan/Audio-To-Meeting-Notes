import { answerQuestionAcrossRecordings, listKnowledgeRecords } from "../services/knowledgeService.js";

export async function getKnowledgeRecords(req, res) {
  const records = await listKnowledgeRecords(req.user.id);
  return res.json({
    ok: true,
    records
  });
}

export async function askKnowledgeQuestion(req, res) {
  const { question } = req.body;
  const result = await answerQuestionAcrossRecordings(req.user.id, question);
  return res.json({
    ok: true,
    ...result
  });
}
