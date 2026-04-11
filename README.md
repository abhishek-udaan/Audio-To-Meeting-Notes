# Meeting Notes Agent

Phone-first Node.js backend for turning recordings into structured meeting notes.

It supports:

- direct audio uploads from an iPhone/Android share sheet via HTTP
- WhatsApp-triggered processing through a webhook endpoint
- OpenAI transcription and note generation
- local transcript/note storage for traceability
- Notion delivery with one page per processed recording

## Architecture

The app is split into three clear stages:

1. Transcript storage
   - raw uploads are saved under `storage/uploads/`
   - generated transcripts are written to `storage/transcripts/`
2. Note generation
   - transcript text is sent to OpenAI for structured meeting notes
   - generated notes are written to `storage/notes/`
3. Delivery
   - a Notion page is created for each processed recording
   - the page contains summary sections, action items, decisions, follow-ups, and metadata

## Requirements

- Node.js 18.17+ (Node 20+ recommended)
- an OpenAI API key
- a Notion internal integration token
- a Notion data source ID
  - preferred: `NOTION_DATA_SOURCE_ID`
  - fallback: `NOTION_DATABASE_ID` for older setups
- optional WhatsApp Cloud API credentials if you want inbound voice-note processing

## Environment Variables

Copy `.env.example` to `.env` and fill in the secrets.

Required:

- `OPENAI_API_KEY`
- `NOTION_API_TOKEN`
- `NOTION_DATA_SOURCE_ID` or `NOTION_DATABASE_ID`

Recommended:

- `OPENAI_TRANSCRIPTION_MODEL=gpt-4o-transcribe`
- `OPENAI_NOTES_MODEL=gpt-5`
- `NOTION_VERSION=2025-09-03`

Optional WhatsApp secrets:

- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_GRAPH_VERSION`

## Notion Setup

Create a Notion database/data source and share it with your integration. The service expects these properties to exist:

- `Name` as a title property
- `Source` as a rich text, select, or status field you want to use for origin labels
- `Status` as a rich text, select, or status field for processed state
- `Processed At` as a date field

You can rename them, but then update:

- `NOTION_TITLE_PROPERTY`
- `NOTION_SOURCE_PROPERTY`
- `NOTION_SOURCE_PROPERTY_TYPE`
- `NOTION_STATUS_PROPERTY`
- `NOTION_STATUS_PROPERTY_TYPE`
- `NOTION_PROCESSED_PROPERTY`
- `NOTION_PROCESSED_PROPERTY_TYPE`
- `NOTION_DATE_PROPERTY`
- `NOTION_DATE_PROPERTY_TYPE`

## Install

```bash
cd "/Users/abhishek.kumar/Documents/New project"
npm install
```

## Run

Development:

```bash
npm run dev
```

Production:

```bash
npm start
```

Health check:

```bash
curl http://localhost:3000/health
```

## Phone Upload Endpoint

Upload a recording with multipart form-data using the `audio` field:

```bash
curl -X POST http://localhost:3000/api/uploads/audio \
  -F "audio=@/path/to/meeting.m4a" \
  -F "title=Weekly staff sync" \
  -F "source=iphone-share-sheet" \
  -F "participants=Alex, Priya, Sam"
```

Suggested share-sheet behavior:

- send a `POST` request to `/api/uploads/audio`
- include the file as `audio`
- optionally send `title`, `source`, `participants`, and `occurredAt`

## WhatsApp Webhook

Verification endpoint:

- `GET /api/webhooks/whatsapp`

Inbound processing endpoint:

- `POST /api/webhooks/whatsapp`

The webhook handler supports two paths:

- WhatsApp Cloud API audio/document messages using `WHATSAPP_ACCESS_TOKEN`
- custom trigger payloads that provide a direct `audioUrl`

Example direct trigger payload:

```json
{
  "audioUrl": "https://example.com/meeting-note.m4a",
  "title": "Voice note from WhatsApp",
  "source": "whatsapp-manual"
}
```

## API Summary

- `GET /health`
- `POST /api/uploads/audio`
- `GET /api/webhooks/whatsapp`
- `POST /api/webhooks/whatsapp`
- `GET /api/knowledge/recordings`
- `POST /api/knowledge/ask`

## Web UI

Open the app in a browser at `/` to use the phone-first recording UI.

- tap `Start Recording`
- allow microphone access
- tap `Stop Recording`
- the app uploads automatically and processes the recording

Fallback:

- upload an existing audio file from the same page

Saved transcript and note JSON files are also exposed under `/files/...`.

The same UI also supports asking questions across all processed recordings. It searches saved note/transcript JSON, sends the top matching records to OpenAI, and returns an answer with supporting recordings.

Example questions:

- `What did we decide about the mobile upload flow?`
- `What action items were assigned to Priya?`
- `Which meetings mentioned budget updates?`

## Custom GPT Action

An OpenAPI schema for the searchable meeting-memory endpoints is available at:

- `/openapi.json`

That can be used later in a Custom GPT Action so ChatGPT can call:

- `GET /api/knowledge/recordings`
- `POST /api/knowledge/ask`

## Deploy Publicly

This repo is prepared for Render deployment with:

- [`render.yaml`](/Users/abhishek.kumar/Documents/New%20project/render.yaml)
- [`Dockerfile`](/Users/abhishek.kumar/Documents/New%20project/Dockerfile)

Important:

- production file storage is configured through `STORAGE_DIR`
- the Render blueprint mounts a persistent disk at `/data`
- without persistent disk, uploaded audio and generated JSON files may be lost on redeploy or restart

### Render Steps

1. Push this project to a GitHub repo.
2. In Render, choose `New +` -> `Blueprint`.
3. Connect the GitHub repo and select this project.
4. Fill in these required env vars in Render:
   - `APP_BASE_URL`
   - `OPENAI_API_KEY`
   - `NOTION_API_TOKEN`
   - `NOTION_DATA_SOURCE_ID`
5. Deploy.
6. Open the public Render URL on your phone and use the web UI.

### After Deploy

- update `APP_BASE_URL` to your actual public URL, such as `https://meeting-notes-agent.onrender.com`
- verify `GET /health`
- test one real microphone recording from your phone
- rotate any secrets that were previously exposed in chat or local files

## Output Shape

Each recording produces:

- a transcript JSON file in `storage/transcripts/`
- a notes JSON file in `storage/notes/`
- a Notion page with formatted content blocks

The generated notes include:

- detailed meeting notes
- action items
- decisions
- follow-ups
- a concise summary

## Notes On Current API Patterns

This project uses current official OpenAI patterns by:

- using the `openai` Node SDK
- using the `audio.transcriptions.create(...)` API for speech-to-text
- using the `responses.create(...)` API for note generation
- automatically splitting long recordings into smaller transcription chunks before sending them to OpenAI

For Notion, the implementation prefers `data_source_id` under the newer API model and can fall back to `database_id` if needed. Text-like fields can be configured as `rich_text`, `select`, or `status`, and the date/timestamp field can be configured as either `date` or `rich_text`.

## Limitations

- `npm install` and runtime verification were not performed automatically if Node/npm are unavailable on the host machine.
- For very large files, you may want to replace local disk storage with object storage.
- For production WhatsApp setups, validate signatures and deploy behind HTTPS.
- Default upload size is configured for files up to 150 MB through `MAX_UPLOAD_MB`.
- Long recordings are chunked automatically before transcription. The default chunk size is `1200` seconds and can be changed with `TRANSCRIPTION_CHUNK_SECONDS`.
