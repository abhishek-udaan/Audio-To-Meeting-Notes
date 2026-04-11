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

function setStatus(type, message) {
  statusBadge.className = `status-badge ${type}`;
  statusBadge.textContent = type === "loading" ? "Processing" : type.charAt(0).toUpperCase() + type.slice(1);
  statusCopy.textContent = message;
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

function createRecordedFile(blob) {
  const extension = getRecordedFileExtension(blob.type);
  return new File([blob], `recording-${Date.now()}.${extension}`, {
    type: blob.type || "audio/webm"
  });
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
    recorderHelp.textContent = "Tap start to grant microphone access, then stop to upload automatically.";
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

async function submitAudio(file) {
  const formData = new FormData(form);
  formData.set("audio", file);

  submitButton.disabled = true;
  recordButton.disabled = true;
  result.classList.add("hidden");
  setStatus("loading", "Uploading audio, transcribing, generating notes, and sending the result to Notion.");

  try {
    const payload = await fetchJson("/api/uploads/audio", {
      method: "POST",
      body: formData
    });

    transcriptLink.href = `/api/notes/${payload.recordingId}/transcript`;
    notesLink.href = `/api/notes/${payload.recordingId}/notes`;
    notionLink.href = payload.notion?.url || "#";
    summaryText.textContent = payload.notes?.summary || "No summary returned.";

    renderList(actionItems, payload.notes?.actionItems, (item) =>
      `${item.task} • ${item.owner || "Unassigned"} • ${item.deadline || "No deadline"}`
    );
    renderList(decisions, payload.notes?.decisions);

    result.classList.remove("hidden");
    setStatus("success", "Finished. Your transcript, notes, and Notion page are ready.");
    await loadNotes();
  } catch (error) {
    setStatus("error", error.message);
  } finally {
    submitButton.disabled = false;
    recordButton.disabled = false;
  }
}

async function stopRecordingAndUpload() {
  if (!mediaRecorder || mediaRecorder.state !== "recording") {
    return;
  }

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
    recordingPreview.classList.add("hidden");
    recordingPreview.removeAttribute("src");

    const mimeType = getPreferredMimeType();
    mediaRecorder = mimeType ? new MediaRecorder(mediaStream, { mimeType }) : new MediaRecorder(mediaStream);

    mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) {
        recordingChunks.push(event.data);
      }
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
        return;
      }

      const previewUrl = URL.createObjectURL(recordedBlob);
      recordingPreview.src = previewUrl;
      recordingPreview.classList.remove("hidden");

      mediaStream?.getTracks().forEach((track) => track.stop());
      mediaStream = null;

      setRecordingUi({ isRecording: false, stateText: "Recording stopped. Uploading automatically..." });
      await submitAudio(createRecordedFile(recordedBlob));
      setRecordingUi({ isRecording: false, stateText: "Microphone idle" });
    });

    mediaRecorder.start();
    setRecordingUi({ isRecording: true, stateText: "Recording in progress..." });
    startTimer();
  } catch (error) {
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

chatLauncher.addEventListener("click", () => {
  chatPopup.classList.remove("hidden");
  questionInput.focus();
});

chatClose.addEventListener("click", () => {
  chatPopup.classList.add("hidden");
});
