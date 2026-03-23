# Apeiron E2E

`npm test:e2e` startet die App lokal auf `http://127.0.0.1:3000` ueber Playwrights `webServer` und fuehrt die Browser-Suite aus.

LAN/HTTPS-Suite (Voice-Gating + HTTPS-Flow + WS-Signaling):

`npm run test:e2e:lan`

Die Suite startet HTTPS + self-signed TLS und setzt TURN-Env fuer den Voice-Join-Pfad.

Trusted-TLS Gate (ohne SSL-Bypass, failt bei `Not secure`):

`PLAYWRIGHT_TRUSTED_BASE_URL=https://apeiron.example.com npm run test:e2e:tls-trusted`

Diese Suite erwartet ein bereits vertrauenswuerdiges Zertifikat (z. B. Let's Encrypt via Domain + Split-DNS oder installierte lokale CA auf dem Testgeraet).

Falls Playwright frisch installiert wurde, wird einmalig zusaetzlich ein Browser benoetigt:

`npx playwright install chromium`

Sokrates Diagnose-Suite (inkl. HAR + Docker-Logs bei Fail):

`npm run test:e2e:sokrates`

Die Suite liegt in `tests/e2e/sokrates.spec.js` und wird ueber `e2e/sokrates.spec.js` eingebunden.
