const form = document.getElementById("upload-form");
const audioInput = document.getElementById("audio");
const fileLabel = document.getElementById("file-label");
const submitButton = document.getElementById("submit-button");
const recordButton = document.getElementById("record-button");
const recordingState = document.getElementById("recording-state");
const recordingTimer = document.getElementById("recording-timer");
const recordingPreview = document.getElementById("recording-preview");
const statusBadge = document.getElementById("status-badge");
const statusCopy = document.getElementById("status-copy");
const result = document.getElementById("result");
const transcriptLink = document.getElementById("transcript-link");
const notesLink = document.getElementById("notes-link");
const notionLink = document.getElementById("notion-link");
const summaryText = document.getElementById("summary-text");
const actionItems = document.getElementById("action-items");
const decisions = document.getElementById("decisions");

let mediaRecorder = null;
let mediaStream = null;
let recordingChunks = [];
let recordingStartedAt = null;
let timerInterval = null;
let recordedBlob = null;

function toBrowserFileUrl(filePath) {
  if (!filePath) return "#";

  const normalized = filePath.replaceAll("\\", "/");

  if (normalized.includes("/storage/transcripts/")) {
    return `/files/transcripts/${normalized.split("/").pop()}`;
  }

  if (normalized.includes("/storage/notes/")) {
    return `/files/notes/${normalized.split("/").pop()}`;
  }

  return "#";
}

function setStatus(type, message) {
  statusBadge.className = `status-badge ${type}`;
  statusBadge.textContent = type === "loading" ? "Processing" : type.charAt(0).toUpperCase() + type.slice(1);
  statusCopy.textContent = message;
}

function formatDuration(totalSeconds) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
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

async function submitAudio(file) {
  const formData = new FormData(form);
  formData.set("audio", file);

  submitButton.disabled = true;
  recordButton.disabled = true;
  result.classList.add("hidden");
  setStatus("loading", "Uploading audio, transcribing, generating notes, and sending the result to Notion.");

  try {
    const response = await fetch("/api/uploads/audio", {
      method: "POST",
      body: formData
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Upload failed.");
    }

    transcriptLink.href = toBrowserFileUrl(payload.transcriptPath);
    notesLink.href = toBrowserFileUrl(payload.notesPath);
    notionLink.href = payload.notion?.url || "#";
    summaryText.textContent = payload.notes?.summary || "No summary returned.";

    renderList(actionItems, payload.notes?.actionItems, (item) =>
      `${item.task} • ${item.owner || "Unassigned"} • ${item.deadline || "No deadline"}`
    );
    renderList(decisions, payload.notes?.decisions);

    result.classList.remove("hidden");
    setStatus("success", "Finished. Your transcript, notes, and Notion page are ready.");
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
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    setStatus("error", "This browser does not support in-browser audio recording.");
    return;
  }

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordingChunks = [];
    recordedBlob = null;
    recordingPreview.classList.add("hidden");
    recordingPreview.removeAttribute("src");

    mediaRecorder = new MediaRecorder(mediaStream);

    mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) {
        recordingChunks.push(event.data);
      }
    });

    mediaRecorder.addEventListener("stop", async () => {
      stopTimer();

      const mimeType = mediaRecorder.mimeType || "audio/webm";
      recordedBlob = new Blob(recordingChunks, { type: mimeType });
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
    setStatus("error", "Microphone access was denied or unavailable.");
    setRecordingUi({ isRecording: false, stateText: "Microphone idle" });
  }
}

audioInput.addEventListener("change", () => {
  const file = audioInput.files?.[0];
  fileLabel.textContent = file ? `${file.name} • ${Math.round(file.size / 1024)} KB` : "M4A, MP3, WAV, OGG, MP4";
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
