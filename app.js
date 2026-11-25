const $ = id => document.getElementById(id);

const MAX_RECORDING_MS = 20000;
const API_ENDPOINT = "/.netlify/functions/translate-turn";

let mediaStream = null;
let mediaRecorder = null;
let recordedChunks = [];
let recordingTimer = null;
let recordingMimeType = "audio/webm";
let lastAudioUrl = null;
let isProcessing = false;

function setStatus(message, micOn = false) {
  $("status").textContent = "● " + message;
  $("micstatus").textContent = micOn ? "MIC ON" : "MIC OFF";
}

function setHint(message) {
  $("hint").textContent = message;
}

function setRecordingUi(recording) {
  $("start").disabled = recording || isProcessing;
  $("test").disabled = !recording || isProcessing;
  $("stop").disabled = !mediaStream && !recording;
  $("start").innerHTML = recording
    ? "<span>🎙</span><strong>RECORDING</strong>"
    : "<span>🎙</span><strong>RECORD TURN</strong>";
  $("start").classList.toggle("active", recording);
}

function releaseMicrophone() {
  if (recordingTimer) {
    clearTimeout(recordingTimer);
    recordingTimer = null;
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }
  mediaRecorder = null;
  setRecordingUi(false);
}

function getPreferredMimeType() {
  if (!window.MediaRecorder) return "";
  const choices = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return choices.find(type => MediaRecorder.isTypeSupported(type)) || "";
}

async function startRecording() {
  if (mediaStream || isProcessing) return;

  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    setHint("This browser does not support microphone recording. Open the site in current Chrome over HTTPS.");
    return;
  }

  if (!$("accessCode").value.trim()) {
    setHint("Enter the private app access code first.");
    $("accessCode").focus();
    return;
  }

  try {
    setStatus("Requesting microphone");
    setHint("Allow microphone access if Chrome asks.");
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    });

    recordingMimeType = getPreferredMimeType() || "audio/webm";
    mediaRecorder = new MediaRecorder(mediaStream, recordingMimeType ? { mimeType: recordingMimeType } : undefined);
    recordedChunks = [];
    mediaRecorder.addEventListener("dataavailable", event => {
      if (event.data && event.data.size) recordedChunks.push(event.data);
    });
    mediaRecorder.addEventListener("stop", handleRecordingStopped, { once: true });
    mediaRecorder.start(500);

    setStatus("Recording", true);
    setHint("Recording this speaker's turn. Tap Finish & translate when the sentence is complete.");
    setRecordingUi(true);
    recordingTimer = setTimeout(() => {
      if (mediaRecorder?.state === "recording") {
        setHint("20-second recording limit reached. Processing this turn.");
        mediaRecorder.stop();
      }
    }, MAX_RECORDING_MS);
  } catch (error) {
    releaseMicrophone();
    setStatus("Ready");
    if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
      setHint("Microphone permission denied. Allow microphone access in Chrome site settings.");
    } else {
      setHint(error.message || "Could not start microphone recording.");
    }
  }
}

function finishRecording() {
  if (mediaRecorder?.state === "recording") {
    mediaRecorder.stop();
    setStatus("Preparing audio");
    setHint("Recording stopped. Preparing your translation…");
  }
}

function endSession() {
  if (mediaRecorder?.state === "recording") {
    mediaRecorder.removeEventListener("stop", handleRecordingStopped);
    mediaRecorder.stop();
  }
  releaseMicrophone();
  recordedChunks = [];
  setStatus("Ready");
  setHint("Session ended. Your microphone is off.");
}

function blobToBase64(blob) {
  return blob.arrayBuffer().then(buffer => {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  });
}

async function handleRecordingStopped() {
  if (recordingTimer) {
    clearTimeout(recordingTimer);
    recordingTimer = null;
  }
  const mimeType = mediaRecorder?.mimeType || recordingMimeType;
  const audioBlob = new Blob(recordedChunks, { type: mimeType });
  releaseMicrophone();
  recordedChunks = [];

  if (!audioBlob.size) {
    setStatus("Ready");
    setHint("No audio was captured. Please try again.");
    return;
  }

  await sendForTranslation(audioBlob, mimeType);
}

async function sendForTranslation(audioBlob, mimeType) {
  isProcessing = true;
  $("start").disabled = true;
  $("test").disabled = true;
  $("stop").disabled = true;
  setStatus("Translating");
  setHint("Sending this short audio turn securely for speech recognition and translation…");

  try {
    const isReply = $("direction").value === "reply";
    const sourceLanguage = isReply ? $("target").value : $("source").value;
    const targetLanguage = isReply ? $("source").value : $("target").value;
    const audioBase64 = await blobToBase64(audioBlob);

    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-access-code": $("accessCode").value.trim()
      },
      body: JSON.stringify({ audioBase64, mimeType, sourceLanguage, targetLanguage })
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("AI backend is not deployed on this website yet. The Netlify deployment is the next setup step.");
      }
      throw new Error(result.error || "Translation request failed.");
    }

    $("original").textContent = result.originalText;
    $("translated").textContent = result.translatedText;
    $("original").classList.remove("muted");
    $("translated").classList.remove("muted");

    if (lastAudioUrl) URL.revokeObjectURL(lastAudioUrl);
    const audioBytes = Uint8Array.from(atob(result.audioBase64), char => char.charCodeAt(0));
    const audioBlobResult = new Blob([audioBytes], { type: result.audioMimeType || "audio/mpeg" });
    lastAudioUrl = URL.createObjectURL(audioBlobResult);
    $("play").disabled = false;

    setStatus("Translation ready");
    setHint("Translation complete. Tap Play translation to hear the generated voice.");
    await playTranslation();
  } catch (error) {
    setStatus("Ready");
    setHint(error.message || "Could not complete this translation.");
  } finally {
    isProcessing = false;
    $("start").disabled = false;
    $("test").disabled = true;
    $("stop").disabled = true;
  }
}

async function playTranslation() {
  if (!lastAudioUrl) return;
  try {
    const audio = new Audio(lastAudioUrl);
    await audio.play();
  } catch {
    setHint("Translation is ready. Tap Play translation to start audio playback.");
  }
}

$("start").addEventListener("click", startRecording);
$("test").addEventListener("click", finishRecording);
$("stop").addEventListener("click", endSession);
$("play").addEventListener("click", playTranslation);

$("clear").addEventListener("click", () => {
  $("original").textContent = "Waiting for speech…";
  $("translated").textContent = "Translation will appear here.";
  $("original").classList.add("muted");
  $("translated").classList.add("muted");
  $("play").disabled = true;
  if (lastAudioUrl) {
    URL.revokeObjectURL(lastAudioUrl);
    lastAudioUrl = null;
  }
});

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(error => {
      console.warn("Service worker registration failed:", error);
    });
  });
}
