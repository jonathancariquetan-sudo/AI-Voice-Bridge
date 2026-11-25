const MAX_AUDIO_BYTES = 3 * 1024 * 1024;
const ALLOWED_LANGUAGES = new Set(["ar-SA", "ar", "en-US", "fil-PH", "hi-IN", "ur-PK", "zh-CN", "fr-FR"]);
const LANGUAGE_CODES = {
  "ar-SA": "ar",
  "ar": "ar",
  "en-US": "en",
  "fil-PH": "tl",
  "hi-IN": "hi",
  "ur-PK": "ur",
  "zh-CN": "zh",
  "fr-FR": "fr"
};

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}

async function readError(response) {
  try {
    const data = await response.json();
    return data?.error?.message || data?.message || "The AI service returned an error.";
  } catch {
    return "The AI service returned an unreadable response.";
  }
}

function extractResponseText(data) {
  if (typeof data.output_text === "string" && data.output_text.trim()) return data.output_text.trim();
  for (const item of data.output || []) {
    for (const part of item.content || []) {
      if (part.type === "output_text" && typeof part.text === "string") return part.text.trim();
    }
  }
  return "";
}

export default async (request) => {
  if (request.method !== "POST") {
    return json(405, { error: "Use POST for a translation turn." });
  }

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) {
    return json(403, { error: "Requests must come from the AI Voice Bridge site." });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const appCode = process.env.APP_ACCESS_CODE;
  if (!apiKey || !appCode) {
    return json(503, { error: "Backend setup is incomplete. Configure OPENAI_API_KEY and APP_ACCESS_CODE in Netlify." });
  }

  if (request.headers.get("x-app-access-code") !== appCode) {
    return json(401, { error: "App access code is missing or incorrect." });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "Invalid request body." });
  }

  const { audioBase64, mimeType, sourceLanguage, targetLanguage } = body || {};
  if (typeof audioBase64 !== "string" || !audioBase64 || !ALLOWED_LANGUAGES.has(sourceLanguage) || !ALLOWED_LANGUAGES.has(targetLanguage)) {
    return json(400, { error: "Audio and supported source/target languages are required." });
  }

  const audioBytes = Buffer.from(audioBase64, "base64");
  if (!audioBytes.length || audioBytes.length > MAX_AUDIO_BYTES) {
    return json(413, { error: "Audio is empty or exceeds the 3 MB limit. Record a shorter turn." });
  }

  const safeMime = typeof mimeType === "string" && /^audio\/(webm|mp4|ogg|mpeg|wav)/i.test(mimeType)
    ? mimeType.split(";")[0]
    : "audio/webm";
  const extension = safeMime.includes("mp4") ? "mp4" : safeMime.includes("ogg") ? "ogg" : safeMime.includes("mpeg") ? "mp3" : safeMime.includes("wav") ? "wav" : "webm";

  try {
    const audioForm = new FormData();
    audioForm.append("file", new Blob([audioBytes], { type: safeMime }), `voice-turn.${extension}`);
    audioForm.append("model", process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe");
    audioForm.append("language", LANGUAGE_CODES[sourceLanguage]);
    audioForm.append("response_format", "json");

    const transcriptionResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: audioForm
    });

    if (!transcriptionResponse.ok) {
      console.error("Transcription request failed:", transcriptionResponse.status, await readError(transcriptionResponse));
      return json(502, { error: "Speech recognition failed. Check API access and try a shorter recording." });
    }

    const transcription = await transcriptionResponse.json();
    const originalText = (transcription.text || "").trim();
    if (!originalText) return json(422, { error: "No speech was detected. Try speaking closer to the phone microphone." });

    const translationResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_TRANSLATION_MODEL || "gpt-6.1-sol",
        input: [
          {
            role: "system",
            content: "You are a professional live conversation interpreter. Translate the user's spoken text faithfully from the stated source language into the stated target language. Preserve meaning, names, numbers, politeness, and conversational tone. Do not answer questions or add explanations. Return only the translated words."
          },
          {
            role: "user",
            content: `Source language: ${sourceLanguage}. Target language: ${targetLanguage}. Spoken text: ${originalText}`
          }
        ],
        max_output_tokens: 500
      })
    });

    if (!translationResponse.ok) {
      console.error("Translation request failed:", translationResponse.status, await readError(translationResponse));
      return json(502, { error: "Translation failed. Check the configured translation model and API access." });
    }

    const translationData = await translationResponse.json();
    const translatedText = extractResponseText(translationData);
    if (!translatedText) return json(502, { error: "The translation service returned no translated text." });

    const speechResponse = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
        voice: process.env.OPENAI_TTS_VOICE || "alloy",
        input: translatedText,
        instructions: "Speak clearly and naturally in the target language, at a moderate pace, suitable for a live conversation.",
        response_format: "mp3"
      })
    });

    if (!speechResponse.ok) {
      console.error("Speech generation failed:", speechResponse.status, await readError(speechResponse));
      return json(502, { error: "Translation is ready, but voice generation failed." });
    }

    const speechBuffer = Buffer.from(await speechResponse.arrayBuffer());
    return json(200, {
      originalText,
      translatedText,
      audioBase64: speechBuffer.toString("base64"),
      audioMimeType: "audio/mpeg",
      sourceLanguage,
      targetLanguage
    });
  } catch (error) {
    console.error("Translation turn error:", error);
    return json(500, { error: "The translation service could not complete this turn. Please try again." });
  }
};
