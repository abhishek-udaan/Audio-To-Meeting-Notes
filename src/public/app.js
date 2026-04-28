const authPanel = document.getElementById("auth-panel");
const authStatus = document.getElementById("auth-status");
const authCopy = document.getElementById("auth-copy");
const googleSignin = document.getElementById("google-signin");
const workspace = document.getElementById("workspace");
const userChip = document.getElementById("user-chip");
const userAvatar = document.getElementById("user-avatar");
const userName = document.getElementById("user-name");
const userEmail = document.getElementById("user-email");
const logoutButton = document.getElementById("logout-button");

const form = document.getElementById("upload-form");
const audioInput = document.getElementById("audio");
const fileLabel = document.getElementById("file-label");
const submitButton = document.getElementById("submit-button");
const recordButton = document.getElementById("record-button");
const recordingState = document.getElementById("recording-state");
const recordingTimer = document.getElementById("recording-timer");
const recordingPreview = document.getElementById("recording-preview");
const recorderHelp = document.getElementById("recorder-help");
const statusBadge = document.getElementById("status-badge");
const statusCopy = document.getElementById("status-copy");
const progressPanel = document.getElementById("progress-panel");
const progressLabel = document.getElementById("progress-label");
const progressStage = document.getElementById("progress-stage");
const progressPercent = document.getElementById("progress-percent");
const progressFill = document.getElementById("progress-fill");
const stepUpload = document.getElementById("step-upload");
const stepTranscription = document.getElementById("step-transcription");
const stepNotes = document.getElementById("step-notes");
const stepNotion = document.getElementById("step-notion");
const result = document.getElementById("result");
const transcriptLink = document.getElementById("transcript-link");
const notesLink = document.getElementById("notes-link");
const notionLink = document.getElementById("notion-link");
const summaryText = document.getElementById("summary-text");
const actionItems = document.getElementById("action-items");
const decisions = document.getElementById("decisions");

const notesGrid = document.getElementById("notes-grid");
const notesCount = document.getElementById("notes-count");
const notesEmpty = document.getElementById("notes-empty");
const noteViewer = document.getElementById("note-viewer");
const viewerClose = document.getElementById("viewer-close");
const viewerTitle = document.getElementById("viewer-title");
const viewerMeta = document.getElementById("viewer-meta");
const viewerSummary = document.getElementById("viewer-summary");
const viewerDetailedNotes = document.getElementById("viewer-detailed-notes");
const viewerActionItems = document.getElementById("viewer-action-items");
const viewerDecisions = document.getElementById("viewer-decisions");
const viewerFollowUps = document.getElementById("viewer-follow-ups");
const viewerOpenQuestions = document.getElementById("viewer-open-questions");
const viewerRisks = document.getElementById("viewer-risks");

const askForm = document.getElementById("ask-form");
const questionInput = document.getElementById("question-input");
const askButton = document.getElementById("ask-button");
const knowledgeCount = document.getElementById("knowledge-count");
const chatThread = document.getElementById("chat-thread");
const chatLauncher = document.getElementById("chat-launcher");
const chatPopup = document.getElementById("chat-popup");
const chatClose = document.getElementById("chat-close");

const state = {
  authConfig: null,
  user: null,
  notes: []
};

let mediaRecorder = null;
let mediaStream = null;
let recordingChunks = [];
let recordingStartedAt = null;
let timerInterval = null;
let activeJobPoller = null;
let activeRecordingSessionId = null;
let pendingChunkUploadChain = Promise.resolve();
let chunkSequence = 0;
let manualStopRequested = false;
let wakeLockSentinel = null;
let recordingFinalizeInFlight = false;

function supportsRecording() {
  return Boolean(window.isSecureContext && navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
}

function getPreferredMimeType() {
  const candidates = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg"];

  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return "";
  }

  return candidates.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) || "";
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload.error || "Request failed.");
    error.status = response.status;
    throw error;
  }

  return payload;
}

function uploadAudioWithProgress(url, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.responseType = "json";
    xhr.withCredentials = true;

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      onProgress?.(event.loaded / event.total);
    });

    xhr.addEventListener("load", () => {
      const payload = xhr.response || {};
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(payload);
        return;
      }

      const error = new Error(payload.error || "Upload failed.");
      error.status = xhr.status;
      reject(error);
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Network error while uploading audio."));
    });

    xhr.send(formData);
  });
}

function setStatus(type, message) {
  statusBadge.className = `status-badge ${type}`;
  statusBadge.textContent = type === "loading" ? "Processing" : type.charAt(0).toUpperCase() + type.slice(1);
  statusCopy.textContent = message;
}

function prettifyStage(stage) {
  return String(stage || "processing")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function setProgressStepState(element, state) {
  element.classList.remove("is-pending", "is-active", "is-complete");
  element.classList.add(state);
}

function updateProgressUi({ percent = 0, label = "", stage = "", phase = "processing" } = {}) {
  progressPanel.classList.remove("hidden");
  progressPanel.dataset.phase = phase;
  progressLabel.textContent = label || "Processing your recording";
  progressStage.textContent = stage || "Working through the pipeline";
  progressPercent.textContent = `${Math.max(0, Math.min(100, Math.round(percent)))}%`;
  progressFill.style.width = `${Math.max(0, Math.min(100, percent))}%`;

  const uploadState = percent >= 8 ? "is-complete" : "is-active";
  const transcriptionState = percent >= 62 ? "is-complete" : percent >= 15 ? "is-active" : "is-pending";
  const notesState = percent >= 86 ? "is-complete" : percent >= 70 ? "is-active" : "is-pending";
  const notionState = percent >= 100 ? "is-complete" : percent >= 86 ? "is-active" : "is-pending";

  setProgressStepState(stepUpload, uploadState);
  setProgressStepState(stepTranscription, transcriptionState);
  setProgressStepState(stepNotes, notesState);
  setProgressStepState(stepNotion, notionState);
}

function resetProgressUi() {
  progressPanel.classList.add("hidden");
  progressPanel.dataset.phase = "idle";
  progressLabel.textContent = "Waiting to start";
  progressStage.textContent = "Idle";
  progressPercent.textContent = "0%";
  progressFill.style.width = "0%";
  [stepUpload, stepTranscription, stepNotes, stepNotion].forEach((step) => setProgressStepState(step, "is-pending"));
}

function stopJobPolling() {
  if (activeJobPoller) {
    window.clearTimeout(activeJobPoller);
    activeJobPoller = null;
  }
}

async function createRemoteRecordingSession(mimeType) {
  const metadata = buildRecordingMetadata();
  const payload = await fetchJson("/api/uploads/recording-sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      ...metadata,
      mimeType
    })
  });

  return payload.sessionId;
}

async function uploadRecordingChunk(sessionId, blob, sequence, attempt = 0) {
  const formData = new FormData();
  formData.set("chunk", new File([blob], `chunk-${sequence}.${getRecordedFileExtension(blob.type)}`, { type: blob.type }));
  formData.set("sequence", String(sequence));

  try {
    await fetchJson(`/api/uploads/recording-sessions/${sessionId}/chunks`, {
      method: "POST",
      body: formData
    });
  } catch (error) {
    if (attempt < 2) {
      await new Promise((resolve) => window.setTimeout(resolve, 600 * (attempt + 1)));
      return uploadRecordingChunk(sessionId, blob, sequence, attempt + 1);
    }

    throw error;
  }
}

function queueRecordingChunkUpload(blob) {
  const sessionId = activeRecordingSessionId;
  if (!sessionId || !blob?.size) return Promise.resolve();

  const sequence = chunkSequence++;
  pendingChunkUploadChain = pendingChunkUploadChain.then(() => uploadRecordingChunk(sessionId, blob, sequence));
  return pendingChunkUploadChain;
}

async function finalizeRemoteRecordingSession(sessionId) {
  return fetchJson(`/api/uploads/recording-sessions/${sessionId}/finalize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({})
  });
}

function setRecordingUi({ isRecording, stateText }) {
  recordButton.classList.toggle("recording", isRecording);
  recordButton.textContent = isRecording ? "Stop Recording" : "Start Recording";
  recordingState.textContent = stateText;
}

function stopTimer() {
  window.clearInterval(timerInterval);
  timerInterval = null;
}

function formatDuration(totalSeconds) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function startTimer() {
  recordingStartedAt = Date.now();
  recordingTimer.textContent = "00:00";
  stopTimer();
  timerInterval = window.setInterval(() => {
    const elapsedSeconds = Math.floor((Date.now() - recordingStartedAt) / 1000);
    recordingTimer.textContent = formatDuration(elapsedSeconds);
  }, 1000);
}

function getRecordedFileExtension(mimeType = "") {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("webm")) return "webm";
  return "webm";
}

function buildRecordingMetadata() {
  const data = new FormData(form);
  return {
    title: data.get("title") || "",
    participants: data.get("participants") || "",
    source: data.get("source") || "web-ui-recorder"
  };
}

function createRecordedFile(blob) {
  const extension = getRecordedFileExtension(blob.type);
  return new File([blob], `recording-${Date.now()}.${extension}`, {
    type: blob.type || "audio/webm"
  });
}

async function requestWakeLock() {
  if (!("wakeLock" in navigator) || wakeLockSentinel || document.hidden) return;

  try {
    wakeLockSentinel = await navigator.wakeLock.request("screen");
    wakeLockSentinel.addEventListener("release", () => {
      wakeLockSentinel = null;
    });
  } catch {
    recorderHelp.textContent =
      "Screen wake lock is not available here. Keep the screen awake and avoid switching apps while recording.";
  }
}

async function releaseWakeLock() {
  if (!wakeLockSentinel) return;

  try {
    await wakeLockSentinel.release();
  } catch {
    // no-op
  } finally {
    wakeLockSentinel = null;
  }
}

function renderList(element, items, formatter = (item) => item) {
  element.innerHTML = "";
  (items || []).forEach((item) => {
    const li = document.createElement("li");
    li.textContent = formatter(item);
    element.appendChild(li);
  });
}

function addChatMessage(role, content, options = {}) {
  const wrapper = document.createElement("div");
  wrapper.className = `chat-message ${role}`;

  const bubble = document.createElement("div");
  bubble.className = "chat-bubble";
  bubble.textContent = content;
  wrapper.appendChild(bubble);

  if (options.supportingRecordings?.length) {
    const support = document.createElement("div");
    support.className = "chat-support";

    options.supportingRecordings.forEach((item) => {
      const supportItem = document.createElement("div");
      supportItem.className = "chat-support-item";
      supportItem.textContent = `${item.title || item.recordingId} • ${item.reason || "Referenced"}`;
      support.appendChild(supportItem);
    });

    wrapper.appendChild(support);
  }

  chatThread.appendChild(wrapper);
  chatThread.scrollTop = chatThread.scrollHeight;
}

function setRecorderAvailability() {
  if (supportsRecording()) {
    recorderHelp.textContent =
      "Tap start to grant microphone access. Best results come from keeping the screen on and staying in this browser tab while recording.";
    recordButton.disabled = false;
    return;
  }

  if (!window.isSecureContext) {
    recorderHelp.textContent = "Recording needs a secure HTTPS page. Use your deployed app URL.";
  } else if (!navigator.mediaDevices?.getUserMedia) {
    recorderHelp.textContent = "This browser cannot access the microphone. Use Safari on iPhone or Chrome on Android.";
  } else {
    recorderHelp.textContent = "This browser does not support in-browser recording. Upload a file instead.";
  }

  recordButton.disabled = true;
  setRecordingUi({ isRecording: false, stateText: "Recording unavailable" });
}

function renderUser() {
  if (!state.user) {
    userChip.classList.add("hidden");
    workspace.classList.add("hidden");
    chatLauncher.classList.add("hidden");
    chatPopup.classList.add("hidden");
    authPanel.classList.remove("hidden");
    return;
  }

  userName.textContent = state.user.name || "Signed in";
  userEmail.textContent = state.user.email || "";
  userAvatar.src = state.user.picture || "";
  userAvatar.alt = state.user.name || "User avatar";
  userChip.classList.remove("hidden");
  workspace.classList.remove("hidden");
  chatLauncher.classList.remove("hidden");
  authPanel.classList.add("hidden");
}

function renderNotes() {
  notesGrid.innerHTML = "";
  const notes = state.notes || [];

  notesCount.textContent = `${notes.length} note${notes.length === 1 ? "" : "s"}`;
  knowledgeCount.textContent = `${notes.length} recording${notes.length === 1 ? "" : "s"} searchable`;
  notesEmpty.classList.toggle("hidden", notes.length > 0);

  notes.forEach((note) => {
    const card = document.createElement("article");
    card.className = "note-card";

    const heading = document.createElement("div");
    heading.className = "note-card-header";

    const title = document.createElement("h4");
    title.textContent = note.title;

    const meta = document.createElement("p");
    meta.className = "note-meta";
    meta.textContent = [note.participants, note.source].filter(Boolean).join(" • ") || "No extra metadata";

    heading.appendChild(title);
    heading.appendChild(meta);

    const summary = document.createElement("p");
    summary.className = "note-summary";
    summary.textContent = note.summary || "No summary available.";

    const stats = document.createElement("div");
    stats.className = "note-stats";
    ["actionItems", "decisions", "followUps"].forEach((key) => {
      const stat = document.createElement("span");
      const labelMap = {
        actionItems: "Actions",
        decisions: "Decisions",
        followUps: "Follow-ups"
      };
      const countMap = {
        actionItems: note.actionItemCount,
        decisions: note.decisionCount,
        followUps: note.followUpCount
      };
      stat.textContent = `${countMap[key]} ${labelMap[key]}`;
      stats.appendChild(stat);
    });

    const links = document.createElement("div");
    links.className = "note-links";

    const viewButton = document.createElement("button");
    viewButton.type = "button";
    viewButton.className = "note-view-button";
    viewButton.textContent = "Open in app";
    viewButton.addEventListener("click", () => openNoteViewer(note));

    links.appendChild(viewButton);

    [
      { href: note.transcriptUrl, label: "Transcript" },
      { href: note.notesUrl, label: "JSON Notes" },
      { href: note.notionUrl, label: "Notion" }
    ]
      .filter((item) => item.href)
      .forEach((item) => {
        const anchor = document.createElement("a");
        anchor.href = item.href;
        anchor.target = "_blank";
        anchor.rel = "noreferrer";
        anchor.textContent = item.label;
        links.appendChild(anchor);
      });

    card.appendChild(heading);
    card.appendChild(summary);
    card.appendChild(stats);
    card.appendChild(links);
    notesGrid.appendChild(card);
  });
}

function renderEmptyList(element, items, formatter = (item) => item) {
  element.innerHTML = "";

  if (!items?.length) {
    const li = document.createElement("li");
    li.textContent = "Nothing captured here.";
    element.appendChild(li);
    return;
  }

  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = formatter(item);
    element.appendChild(li);
  });
}

function openNoteViewer(note) {
  viewerTitle.textContent = note.title || "Meeting note";
  viewerMeta.textContent = [note.participants, note.source].filter(Boolean).join(" • ");
  viewerSummary.textContent = note.summary || "No summary available.";
  renderEmptyList(viewerDetailedNotes, note.detailedNotes);
  renderEmptyList(
    viewerActionItems,
    note.actionItems,
    (item) => `${item.task} • ${item.owner || "Unassigned"} • ${item.deadline || "No deadline"}`
  );
  renderEmptyList(viewerDecisions, note.decisions);
  renderEmptyList(viewerFollowUps, note.followUps);
  renderEmptyList(viewerOpenQuestions, note.openQuestions);
  renderEmptyList(viewerRisks, note.risks);
  noteViewer.classList.remove("is-closing");
  noteViewer.classList.remove("hidden");
  requestAnimationFrame(() => {
    noteViewer.classList.add("is-visible");
  });
  document.body.classList.add("modal-open");
}

function closeNoteViewer() {
  if (noteViewer.classList.contains("hidden")) return;

  noteViewer.classList.remove("is-visible");
  noteViewer.classList.add("is-closing");
  document.body.classList.remove("modal-open");

  window.setTimeout(() => {
    noteViewer.classList.add("hidden");
    noteViewer.classList.remove("is-closing");
  }, 260);
}

async function loadNotes() {
  if (!state.user) return;

  try {
    const payload = await fetchJson("/api/notes");
    state.notes = payload.notes || [];
    renderNotes();
  } catch (error) {
    notesCount.textContent = "Could not load notes";
    knowledgeCount.textContent = "Unavailable";
  }
}

async function loadAuthState() {
  const [config, me] = await Promise.all([fetchJson("/api/auth/config"), fetchJson("/api/auth/me")]);
  state.authConfig = config;
  state.user = me.user;

  if (!config.authEnabled) {
    authCopy.textContent = "Add GOOGLE_CLIENT_ID in the backend environment to enable Google sign-in.";
    authStatus.textContent = "Google login is not configured yet.";
    googleSignin.innerHTML = "";
  } else if (!state.user) {
    authStatus.textContent = "Sign in to access your private notes, uploads, and meeting assistant.";
    await renderGoogleButton(config.googleClientId);
  } else {
    authStatus.textContent = "Signed in.";
  }

  renderUser();

  if (state.user) {
    await loadNotes();
    setRecorderAvailability();
  }
}

function loadGoogleScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function renderGoogleButton(clientId) {
  try {
    await loadGoogleScript();
    googleSignin.innerHTML = "";
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async ({ credential }) => {
        try {
          await fetchJson("/api/auth/google", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ credential })
          });
          authStatus.textContent = "Signed in successfully.";
          await loadAuthState();
        } catch (error) {
          authStatus.textContent = error.message;
        }
      }
    });

    window.google.accounts.id.renderButton(googleSignin, {
      theme: "outline",
      size: "large",
      shape: "pill",
      width: Math.min(window.innerWidth - 64, 360)
    });
  } catch {
    authStatus.textContent = "Could not load Google sign-in right now.";
  }
}

function populateResult(payload) {
  transcriptLink.href = `/api/notes/${payload.recordingId}/transcript`;
  notesLink.href = `/api/notes/${payload.recordingId}/notes`;
  notionLink.href = payload.notion?.url || "#";
  summaryText.textContent = payload.notes?.summary || "No summary returned.";

  renderList(actionItems, payload.notes?.actionItems, (item) =>
    `${item.task} • ${item.owner || "Unassigned"} • ${item.deadline || "No deadline"}`
  );
  renderList(decisions, payload.notes?.decisions);

  result.classList.remove("hidden");
}

async function pollUploadJob(jobId) {
  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const payload = await fetchJson(`/api/uploads/jobs/${jobId}`);
        const job = payload.job;

        updateProgressUi({
          percent: job.progress,
          label: job.message || "Processing your recording",
          stage: prettifyStage(job.stage),
          phase: job.status === "failed" ? "error" : job.status === "completed" ? "success" : "processing"
        });

        if (job.status === "completed") {
          resolve(job);
          return;
        }

        if (job.status === "failed") {
          reject(new Error(job.error || job.message || "Processing failed."));
          return;
        }

        activeJobPoller = window.setTimeout(poll, 1200);
      } catch (error) {
        reject(error);
      }
    };

    poll();
  });
}

async function finalizeRecordedSessionFlow({ interrupted = false } = {}) {
  if (!activeRecordingSessionId || recordingFinalizeInFlight) return;

  recordingFinalizeInFlight = true;
  const sessionId = activeRecordingSessionId;
  activeRecordingSessionId = null;

  setStatus(
    "loading",
    interrupted
      ? "Recording was interrupted. Finalizing the chunks already uploaded to the server."
      : "Recording stopped. Finalizing uploaded chunks and starting the AI pipeline."
  );
  updateProgressUi({
    percent: 8,
    label: interrupted ? "Recovering interrupted recording" : "Finalizing recording",
    stage: interrupted ? "Using the chunks already saved on the server" : "Joining uploaded chunks on the server",
    phase: "processing"
  });

  try {
    await pendingChunkUploadChain;
    const kickoff = await finalizeRemoteRecordingSession(sessionId);
    const job = await pollUploadJob(kickoff.jobId);
    populateResult(job.result);
    setStatus("success", "Finished. Your transcript, notes, and Notion page are ready.");
    updateProgressUi({
      percent: 100,
      label: "All done",
      stage: "Transcript, notes, and Notion page are ready",
      phase: "success"
    });
    await loadNotes();
  } catch (error) {
    setStatus("error", error.message || "Recording finalization failed.");
    updateProgressUi({
      percent: 100,
      label: "Recording recovery failed",
      stage: error.message || "Chunk finalization failed",
      phase: "error"
    });
  } finally {
    recordingFinalizeInFlight = false;
    pendingChunkUploadChain = Promise.resolve();
    chunkSequence = 0;
    manualStopRequested = false;
    submitButton.disabled = false;
    recordButton.disabled = false;
    await releaseWakeLock();
  }
}

async function submitAudio(file) {
  const formData = new FormData(form);
  formData.set("audio", file);

  stopJobPolling();
  submitButton.disabled = true;
  recordButton.disabled = true;
  result.classList.add("hidden");
  setStatus("loading", "Uploading audio and preparing the AI pipeline.");
  updateProgressUi({
    percent: 0,
    label: "Uploading audio",
    stage: "Sending the file to the server",
    phase: "processing"
  });

  try {
    const kickoff = await uploadAudioWithProgress("/api/uploads/audio/async", formData, (fraction) => {
      updateProgressUi({
        percent: Math.max(1, Math.round(fraction * 8)),
        label: "Uploading audio",
        stage: "Sending the file to the server",
        phase: "processing"
      });
    });

    setStatus("loading", "Upload complete. Transcribing audio, generating notes, and sending everything to Notion.");

    const job = await pollUploadJob(kickoff.jobId);
    populateResult(job.result);
    setStatus("success", "Finished. Your transcript, notes, and Notion page are ready.");
    updateProgressUi({
      percent: 100,
      label: "All done",
      stage: "Transcript, notes, and Notion page are ready",
      phase: "success"
    });
    await loadNotes();
  } catch (error) {
    setStatus("error", error.message);
    updateProgressUi({
      percent: 100,
      label: "Processing failed",
      stage: error.message,
      phase: "error"
    });
  } finally {
    stopJobPolling();
    submitButton.disabled = false;
    recordButton.disabled = false;
  }
}

async function stopRecordingAndUpload() {
  if (!mediaRecorder || mediaRecorder.state !== "recording") {
    return;
  }

  manualStopRequested = true;
  setRecordingUi({ isRecording: false, stateText: "Finishing recording..." });
  mediaRecorder.stop();
}

async function startRecording() {
  if (!supportsRecording()) {
    setStatus("error", "This browser cannot record audio here. Try file upload instead.");
    return;
  }

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordingChunks = [];
    pendingChunkUploadChain = Promise.resolve();
    chunkSequence = 0;
    manualStopRequested = false;
    recordingFinalizeInFlight = false;
    recordingPreview.classList.add("hidden");
    recordingPreview.removeAttribute("src");

    const mimeType = getPreferredMimeType();
    mediaRecorder = mimeType ? new MediaRecorder(mediaStream, { mimeType }) : new MediaRecorder(mediaStream);
    activeRecordingSessionId = await createRemoteRecordingSession(mediaRecorder.mimeType || mimeType || "audio/webm");
    await requestWakeLock();

    mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) {
        recordingChunks.push(event.data);
        queueRecordingChunkUpload(event.data).catch((error) => {
          setStatus("error", `Chunk upload failed: ${error.message}`);
          setRecordingUi({ isRecording: false, stateText: "Upload interrupted" });
          if (mediaRecorder?.state === "recording") {
            manualStopRequested = false;
            mediaRecorder.stop();
          }
        });
      }
    });

    mediaRecorder.addEventListener("pause", () => {
      setStatus(
        "loading",
        document.hidden
          ? "Recording is paused because the browser is in the background. Return to this tab to resume."
          : "Recording paused unexpectedly. Attempting to resume."
      );

      if (!document.hidden && mediaRecorder?.state === "paused") {
        try {
          mediaRecorder.resume();
        } catch {
          // no-op
        }
      }
    });

    mediaRecorder.addEventListener("resume", () => {
      setStatus("loading", "Recording resumed. Chunks continue uploading while the tab stays active.");
      setRecordingUi({ isRecording: true, stateText: "Recording in progress..." });
    });

    mediaRecorder.addEventListener("error", () => {
      stopTimer();
      setStatus("error", "Recording failed in the browser. Try file upload if this keeps happening.");
      setRecordingUi({ isRecording: false, stateText: "Recording failed" });
    });

    mediaRecorder.addEventListener("stop", async () => {
      stopTimer();
      const mimeType = mediaRecorder.mimeType || "audio/webm";
      const recordedBlob = new Blob(recordingChunks, { type: mimeType });

      if (!recordedBlob.size) {
        setStatus("error", "No audio was captured. Please try again or use file upload.");
        setRecordingUi({ isRecording: false, stateText: "No recording captured" });
        submitButton.disabled = false;
        recordButton.disabled = false;
        await releaseWakeLock();
        return;
      }

      const previewUrl = URL.createObjectURL(recordedBlob);
      recordingPreview.src = previewUrl;
      recordingPreview.classList.remove("hidden");

      mediaStream?.getTracks().forEach((track) => track.stop());
      mediaStream = null;

      setRecordingUi({
        isRecording: false,
        stateText: manualStopRequested ? "Recording stopped. Finalizing..." : "Recording interrupted. Recovering..."
      });
      await finalizeRecordedSessionFlow({ interrupted: !manualStopRequested });
      setRecordingUi({ isRecording: false, stateText: "Microphone idle" });
    });

    mediaRecorder.start(10000);
    submitButton.disabled = true;
    recordButton.disabled = false;
    setRecordingUi({ isRecording: true, stateText: "Recording in progress..." });
    setStatus(
      "loading",
      "Recording is live. Chunks are being uploaded as you speak. For best reliability, keep the screen awake and stay in this browser tab."
    );
    startTimer();
  } catch (error) {
    activeRecordingSessionId = null;
    mediaStream?.getTracks().forEach((track) => track.stop());
    mediaStream = null;
    stopTimer();
    submitButton.disabled = false;
    recordButton.disabled = false;
    await releaseWakeLock();
    setStatus("error", "Microphone access was unavailable. You can still upload a file.");
    setRecordingUi({ isRecording: false, stateText: "Microphone idle" });
  }
}

audioInput.addEventListener("change", () => {
  const file = audioInput.files?.[0];
  fileLabel.textContent = file ? `${file.name} • ${Math.round(file.size / 1024)} KB` : "M4A, MP3, WAV, OGG, MP4 up to 150 MB";
});

recordButton.addEventListener("click", async () => {
  if (mediaRecorder?.state === "recording") {
    await stopRecordingAndUpload();
    return;
  }

  await startRecording();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!audioInput.files?.length) {
    setStatus("error", "Choose an audio file before submitting.");
    return;
  }

  await submitAudio(audioInput.files[0]);
});

askForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const question = questionInput.value.trim();
  if (!question) return;

  addChatMessage("user", question);
  questionInput.value = "";
  askButton.disabled = true;

  try {
    const payload = await fetchJson("/api/knowledge/ask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ question })
    });

    addChatMessage("assistant", payload.answer || "No answer returned.", {
      supportingRecordings: payload.supportingRecordings
    });
  } catch (error) {
    addChatMessage("assistant", error.message || "Search failed.");
  } finally {
    askButton.disabled = false;
  }
});

logoutButton.addEventListener("click", async () => {
  await fetchJson("/api/auth/logout", { method: "POST" });
  state.user = null;
  state.notes = [];
  chatPopup.classList.add("hidden");
  chatLauncher.classList.add("hidden");
  renderUser();
  notesGrid.innerHTML = "";
  chatThread.innerHTML = `
    <div class="chat-message assistant">
      <div class="chat-bubble">Ask about decisions, action items, owners, or follow-ups across your meetings.</div>
    </div>
  `;
  await loadAuthState();
});

loadAuthState().catch(() => {
  authStatus.textContent = "The app could not initialize. Please refresh and try again.";
});

resetProgressUi();

document.addEventListener("visibilitychange", async () => {
  if (!mediaRecorder || mediaRecorder.state === "inactive") return;

  if (document.hidden) {
    recorderHelp.textContent =
      "Background recording is limited by mobile browsers. Chunks already uploaded are safe, but keep the tab open and the screen awake for best reliability.";
    return;
  }

  recorderHelp.textContent =
    "Tap start to grant microphone access. Best results come from keeping the screen on and staying in the browser tab while recording.";
  await requestWakeLock();

  if (mediaRecorder.state === "paused") {
    try {
      mediaRecorder.resume();
    } catch {
      // no-op
    }
  }
});

chatLauncher.addEventListener("click", () => {
  chatPopup.classList.remove("hidden");
  questionInput.focus();
});

chatClose.addEventListener("click", () => {
  chatPopup.classList.add("hidden");
});

viewerClose.addEventListener("click", closeNoteViewer);
noteViewer.addEventListener("click", (event) => {
  if (event.target.classList.contains("note-viewer") || event.target.classList.contains("note-viewer-backdrop")) {
    closeNoteViewer();
  }
});
