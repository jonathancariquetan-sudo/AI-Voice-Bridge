# AI Voice Bridge — AI Turn Translation Preview

## Current capabilities
- Mobile-first two-way conversation interface.
- Select the language pair and choose which person is speaking for each turn.
- Record a short speaker turn (maximum 20 seconds in the browser).
- Send the recording to a server-side Netlify Function.
- Transcribe speech, translate the recognized text, and generate translated speech.
- Show the original transcript and translated text; play the generated audio.
- Microphone capture uses browser echo cancellation, noise suppression, and automatic gain control.

## Deployment architecture
- GitHub remains the source of truth.
- GitHub Pages can continue serving the static microphone prototype.
- Netlify deploys the same repository as the AI-enabled site and hosts `netlify/functions/translate-turn.mjs`.
- `netlify.toml` builds the root web files into `public/` and keeps the function source outside the published directory.

## Required Netlify environment variables
Set these in Netlify Project configuration → Environment variables. Set the scope to Functions (or all scopes), mark secrets as secret, then redeploy.

- `OPENAI_API_KEY` — your OpenAI API key. Never put this in browser JavaScript or GitHub.
- `APP_ACCESS_CODE` — a private access code you create. Enter the same code in the app before recording.
- Optional `OPENAI_TRANSLATION_MODEL` — defaults to `gpt-6.1-sol`.
- Optional `OPENAI_TRANSCRIPTION_MODEL` — defaults to `gpt-4o-mini-transcribe`.
- Optional `OPENAI_TTS_MODEL` — defaults to `gpt-4o-mini-tts`.
- Optional `OPENAI_TTS_VOICE` — defaults to `alloy`.

The function rejects requests without the app access code, limits audio uploads to 3 MB, and only accepts requests from the same Netlify site origin. The API key remains server-side.

## Deploy with Netlify
1. Import `jonathancariquetan-sudo/AI-Voice-Bridge` as a new Netlify project.
2. Use the repository's `netlify.toml` settings; the build command copies the app shell to `public/`.
3. Add the required environment variables above.
4. Redeploy and open the Netlify production URL.
5. Enter the app access code, select the speaker direction, record a short turn, then tap Finish & translate.

## Important limitations
- The AI turn workflow requires a deployed Netlify backend and valid OpenAI API billing/API access. It will not work from GitHub Pages alone.
- This is turn-by-turn interpretation, not continuous automatic speaker detection or real-time simultaneous translation.
- The browser plays generated speech through the current Android media output route. It cannot guarantee independent simultaneous routing to the headset and built-in phone speaker. Test route switching on the target Samsung device; strict independent routing may require a native Android audio layer.
- Short audio is sent to OpenAI for transcription and translation. Do not use the prototype for confidential conversations until privacy, retention, and consent requirements have been reviewed.
- API usage can incur charges. Set an appropriate usage budget/limit in the OpenAI Platform before testing.
