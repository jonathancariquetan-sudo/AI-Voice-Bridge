# AI Voice Bridge — Web Prototype 0.1

## Included
- Mobile-first dark interface and language selectors.
- Microphone permission request and live input-level meter.
- Start/stop session controls.
- PWA manifest and basic offline asset cache.
- Browser speech playback hook for a future translated response.

## Not yet implemented
Speech-to-text, automatic language identification, AI translation, AI-generated translated speech, conversation turn detection, and guaranteed separate headset/phone-speaker routing.

This prototype does not upload or store microphone audio.

## Run
Microphone access requires HTTPS or localhost. Do not open index.html directly from a file manager and expect microphone access to work. Deploy the folder to an HTTPS static host, then open the site in Chrome.

## Security
Never put an AI provider API key in app.js or any browser-delivered file. The next phase must use a backend with server-side secrets and short-lived client credentials or a secure audio proxy.

## Audio routing limitation
Mobile browsers and Android decide media output routing. A web app cannot guarantee independent simultaneous headset and built-in speaker output. Test on the target Samsung device; use native Android audio routing later if strict independent routing is required.
