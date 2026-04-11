import dotenv from "dotenv";

dotenv.config();

function required(name, fallback = "") {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name, fallback = "") {
  return process.env[name] ?? fallback;
}

function number(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be a number.`);
  }
  return parsed;
}

export const env = {
  port: number("PORT", 3000),
  nodeEnv: optional("NODE_ENV", "development"),
  appBaseUrl: optional("APP_BASE_URL", "http://localhost:3000"),
  storageDir: optional("STORAGE_DIR", "storage"),
  googleClientId: optional("GOOGLE_CLIENT_ID"),
  sessionCookieName: optional("SESSION_COOKIE_NAME", "meeting_notes_session"),
  openAiApiKey: required("OPENAI_API_KEY"),
  openAiTranscriptionModel: optional("OPENAI_TRANSCRIPTION_MODEL", "gpt-4o-transcribe"),
  transcriptionChunkSeconds: number("TRANSCRIPTION_CHUNK_SECONDS", 1200),
  openAiNotesModel: optional("OPENAI_NOTES_MODEL", "gpt-5"),
  openAiReasoningEffort: optional("OPENAI_REASONING_EFFORT", "low"),
  openAiTranscriptionPrompt: optional(
    "OPENAI_TRANSCRIPTION_PROMPT",
    "Transcribe this meeting recording accurately. Preserve speaker changes, decisions, deadlines, and named entities when audible."
  ),
  notionApiToken: required("NOTION_API_TOKEN"),
  notionVersion: optional("NOTION_VERSION", "2025-09-03"),
  notionDataSourceId: optional("NOTION_DATA_SOURCE_ID"),
  notionDatabaseId: optional("NOTION_DATABASE_ID"),
  notionTitleProperty: optional("NOTION_TITLE_PROPERTY", "Name"),
  notionSourceProperty: optional("NOTION_SOURCE_PROPERTY", "Source"),
  notionSourcePropertyType: optional("NOTION_SOURCE_PROPERTY_TYPE", "rich_text"),
  notionStatusProperty: optional("NOTION_STATUS_PROPERTY", "Status"),
  notionStatusPropertyType: optional("NOTION_STATUS_PROPERTY_TYPE", "rich_text"),
  notionProcessedProperty: optional("NOTION_PROCESSED_PROPERTY", "Processed"),
  notionProcessedPropertyType: optional("NOTION_PROCESSED_PROPERTY_TYPE", "rich_text"),
  notionDateProperty: optional("NOTION_DATE_PROPERTY", "Processed At"),
  notionDatePropertyType: optional("NOTION_DATE_PROPERTY_TYPE", "date"),
  notionPageIcon: optional("NOTION_PAGE_ICON", "📝"),
  whatsappVerifyToken: optional("WHATSAPP_VERIFY_TOKEN"),
  whatsappAccessToken: optional("WHATSAPP_ACCESS_TOKEN"),
  whatsappGraphVersion: optional("WHATSAPP_GRAPH_VERSION", "v22.0"),
  maxUploadMb: number("MAX_UPLOAD_MB", 150)
};

if (!env.notionDataSourceId && !env.notionDatabaseId) {
  throw new Error("Provide NOTION_DATA_SOURCE_ID or NOTION_DATABASE_ID.");
}
