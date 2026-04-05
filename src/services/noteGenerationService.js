import {
  buildMeetingNotesUserPrompt,
  meetingNotesSystemPrompt
} from "../prompts/meetingNotesPrompt.js";
import { openai } from "../config/openai.js";
import { env } from "../config/env.js";

function parseNotesJson(outputText) {
  try {
    return JSON.parse(outputText);
  } catch (error) {
    const parsingError = new Error("OpenAI note response was not valid JSON.");
    parsingError.cause = error;
    parsingError.outputText = outputText;
    throw parsingError;
  }
}

export async function generateMeetingNotes(context) {
  const response = await openai.responses.create({
    model: env.openAiNotesModel,
    reasoning: { effort: env.openAiReasoningEffort },
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: meetingNotesSystemPrompt
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: buildMeetingNotesUserPrompt(context)
          }
        ]
      }
    ]
  });

  const outputText = response.output_text?.trim();
  if (!outputText) {
    throw new Error("OpenAI note generation returned empty output.");
  }

  return {
    model: env.openAiNotesModel,
    raw: outputText,
    structured: parseNotesJson(outputText)
  };
}
