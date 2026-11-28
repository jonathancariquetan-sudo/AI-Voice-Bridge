# Gemini offline verification

Node.js v22.16.0; command `node --test tests/gemini-translation.test.mjs`.

Connector-retrieved files were copied into an isolated runtime; git hash-object matched repository blobs: adapter `39f89674004ce5b70f2a97269ca32327a4fd45fb`, tests `5da75a7fcfab3b69bb510d426954965d1758d1bf`.

TAP summary: tests 7, pass 7, fail 0, skipped 0; duration 125.902605 ms. Four mocked language directions, missing configuration, upstream 429 and invalid response passed. No network API requests, actual speech, device tests or translation accuracy measurements. This resolves the offline test execution blocker, not the integration gate. Next: endpoint integration and TTS compatibility. Production promotion requires owner approval.
