const $ = id => document.getElementById(id);

let stream = null;
let audioContext = null;
let analyser = null;
let animationFrame = null;
let starting = false;

function setState(isOn, message) {
  const micButton = $("start");
  $("status").textContent = "● " + message;
  $("micstatus").textContent = isOn ? "MIC ON" : "MIC OFF";
  micButton.classList.toggle("active", isOn);
  micButton.innerHTML = isOn
    ? "<span>🎙</span><strong>LISTENING</strong>"
    : "<span>🎙</span><strong>START</strong>";
  $("stop").disabled = !isOn;
  $("start").disabled = starting || isOn;
  $("test").disabled = starting || isOn;
}

function stopAudioResources() {
  if (animationFrame !== null) {
    cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }

  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }

  analyser = null;

  if (audioContext) {
    const contextToClose = audioContext;
    audioContext = null;
    contextToClose.close().catch(() => {});
  }

  $("start").style.transform = "";
}

async function start() {
  if (starting || stream) return;

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    $("hint").textContent = "Microphone access requires HTTPS and a supported browser.";
    return;
  }

  starting = true;
  $("start").disabled = true;
  $("test").disabled = true;
  $("hint").textContent = "Requesting microphone permission…";

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error("This browser does not support audio analysis.");
    }

    audioContext = new AudioContextClass();
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);

    setState(true, "Listening");
    $("hint").textContent = "Microphone active. Speak to test the input meter.";
    updateMeter();
  } catch (error) {
    stopAudioResources();
    setState(false, "Ready");

    if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
      $("hint").textContent = "Microphone permission denied. Allow microphone access in Chrome site settings.";
    } else if (error.name === "NotFoundError") {
      $("hint").textContent = "No microphone was found. Check your phone's microphone.";
    } else {
      $("hint").textContent = error.message || "Could not start the microphone. Please try again.";
    }
  } finally {
    starting = false;
    $("start").disabled = Boolean(stream);
    $("test").disabled = Boolean(stream);
  }
}

function updateMeter() {
  if (!analyser) return;

  const samples = new Uint8Array(analyser.fftSize);

  const tick = () => {
    if (!analyser) return;

    analyser.getByteTimeDomainData(samples);

    let sum = 0;
    for (const sample of samples) {
      const normalized = (sample - 128) / 128;
      sum += normalized * normalized;
    }

    const rms = Math.sqrt(sum / samples.length);
    const scale = 1 + Math.min(rms * 0.35, 0.12);
    $("start").style.transform = `scale(${scale})`;

    animationFrame = requestAnimationFrame(tick);
  };

  tick();
}

function stop() {
  stopAudioResources();
  starting = false;
  setState(false, "Ready");
  $("start").disabled = false;
  $("test").disabled = false;
  $("hint").textContent = "Session ended. Tap Start to listen again.";
}

$("start").addEventListener("click", start);
$("test").addEventListener("click", start);
$("stop").addEventListener("click", stop);

$("clear").addEventListener("click", () => {
  $("original").textContent = "Waiting for speech…";
  $("translated").textContent = "Translation will appear here when AI is connected.";
  $("original").classList.add("muted");
  $("translated").classList.add("muted");
});

$("play").addEventListener("click", () => {
  const text = $("translated").textContent;
  if (!text || $("translated").classList.contains("muted")) return;
  if (!("speechSynthesis" in window)) {
    $("hint").textContent = "Speech playback is not supported by this browser.";
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = $("target").value;
  window.speechSynthesis.speak(utterance);
});

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(error => {
      console.warn("Service worker registration failed:", error);
    });
  });
}
