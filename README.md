# Apeiron Platform

Discord-aehnliche Plattform mit echter SQL-Datenbank, vollem Auth-Flow, Sessions + JWT und mehrseitigem Frontend mit Partials.

## Tech-Stack
- Node.js + Express
- SQLite (`better-sqlite3`)
- EJS Templates (mehrere Seiten + Partials/Layout)
- Auth: Register, Login, Logout, Passwort-Reset, bcrypt Hashing
- Session-basierte Auth (Cookie) + JWT Ausgabe unter `/api/token`

## Projektstruktur
- `src/server.js`: Startpunkt
- `src/app.js`: App-Setup, Middleware, Routing
- `src/routes/auth.js`: Register/Login/Forgot/Reset/Logout
- `src/routes/app.js`: DM- und Server-Seiten
- `src/routes/api.js`: JWT Endpoint
- `src/db/connection.js`: DB Verbindung
- `src/db/migrate.js`: Migration Runner
- `src/db/seed.js`: Seed-Daten mit Persoenlichkeiten
- `migrations/001_init.sql`: Datenbankschema
- `migrations/002_dm_social_features.sql`: Group DM, Privacy/Settings, Unread/Mute Erweiterungen
- `views/`: Seiten + Partials
- `public/css/main.css`: buntes UI, Badges, Animationen
- `public/js/main.js`: Composer UX, Upload Queue, Emoji/GIF Picker, Edge-State Handling

## Setup
1. Abhaengigkeiten installieren:
```bash
npm install
```

2. Optional `.env` aus `.env.example` erstellen und Secrets setzen. Die App und DB-Skripte laden `.env` automatisch beim Start.

3. Datenbank migrieren:
```bash
npm run db:migrate
```

4. Seed-Daten laden:
```bash
npm run db:seed
```

5. App starten:
```bash
npm run dev
```

6. Oeffnen:
- Basic: `http://localhost:3000`
- Full Features (Voice/WebRTC): `https://localhost:3443` (HTTPS + TURN konfiguriert)

## Demo-Logins (Seed)
Alle Seed-User nutzen Passwort:
- `apeiron123!`

Beispiele:
- Username: `einstein`
- Username: `euler`
- Username: `platon`
- Username: `lovelace`
- Username: `curie`
- Username: `bohr`

## Enthaltene Features
- Vollstaendiger Auth-Flow
  - Register mit 16+ Check
  - Login mit Passwort-Check, Account-Lock-Unterstuetzung, IP Rate-Limit
  - Forgot Password mit Reset Token
  - Reset Password mit Ablauf + Einmalnutzung
- Sessions
  - Session-Cookie fuer Web-Login
- JWT
  - `GET /api/token` liefert signiertes JWT fuer API-Nutzung
- Reale Daten
  - Seed mit Einstein, Euler, Platon, Ada Lovelace, Marie Curie, Niels Bohr
  - Beispiel-Server, Channel, DMs, Nachrichten
- Frontend
  - Viele Seiten: Login, Register, Forgot, Reset, DM Home, Friends, Settings, Server, Error
  - Partials/Layout (Head, Header, Flash, Server-Rail, Cat-Widgets)
  - Bunte Gradienten, Badges, Animationen
  - Attach/Emoji/GIF Interaktionen im Composer
  - Katzen in Empty/Error/Loading Bereichen
- DMs/Friends
  - Group DM: Name/Icon anpassen, Teilnehmer add/remove, Member-Liste
  - Friends-Seite mit Tabs: Online, All, Pending, Blocked
  - Friend Request senden, annehmen/ablehnen, blockieren/entblocken
  - Unread/Mention Inbox Priorisierung, Mute je DM
  - Suche in DMs: global + in-chat inkl. Filter (From/Has/Date/Only mentions)
- Privacy & Safety
  - DM-Berechtigungen (alle/server members/nur Freunde)
  - Friend-Request-Berechtigungen (everyone/friends-of-friends/server members)
  - Blocked-Liste, Message Requests, Block-Historienmodus
- Global User Settings
  - My Account, Profile, Privacy & Safety, Notifications, Connections, Appearance, Accessibility, Voice & Video, Language
  - Unsaved-Changes-Bar (Revert/Save) mit Inline-Validierung

## Datenbankschema (Kurz)
- `users`: Accounts, Hash, Profil, Lock-Flag
- `password_reset_tokens`: Reset-Token mit Expiry + Used-Flag
- `friendships`: Freundschaft/Block Status
- `servers`, `server_members`, `channels`
- `dm_threads`, `dm_participants`
- `messages` (Channel- oder DM-Nachrichten)

## Hinweise
- Session-Store ist fuer Demo der Default Memory Store von `express-session`.
- Fuer Produktion: persistenten Session-Store, TLS (`secure` Cookies), echte Mail-Zustellung fuer Reset-Links, CSRF-Schutz und stricteres Validation/Logging aktivieren.

## LAN/WLAN Zugriff (gleicher Router)

### Ziel-URLs
- HTTPS First (Login/Chat/Voice): `https://<LAN-IP>:3443`
- HTTP nur Diagnose/Fallback: `http://<LAN-IP>:3000`

Die App bindet auf `0.0.0.0`. REST + Realtime + Voice-Signaling laufen origin-relativ:
- HTTP Origin -> `ws://<host>/app/voice/realtime`
- HTTPS Origin -> `wss://<host>/app/voice/realtime`

Voice im LAN erfordert:
- HTTPS/WSS
- TURN-Konfiguration (`VOICE_REQUIRE_TURN=1`)

### Ohne Warnscreen (Trusted TLS)
Fuer `Not secure`-freie Clients gibt es genau zwei valide Wege:

1. Domain + oeffentlich vertrautes Zertifikat (Let's Encrypt via DNS-01 + Split-DNS)
2. Lokale CA (z. B. mkcert) + CA auf allen Clientgeraeten installiert

Details inkl. Reverse-Proxy-Setup, Env und Test-Gates:
- `docs/LAN-HTTPS-TRUSTED.md`
- `deploy/caddy/Caddyfile.letsencrypt.template`
- `deploy/docker-compose.caddy.yml`

### TLS Modi

#### A) Dev Trusted (empfohlen)
Nutze ein lokal vertrautes Zertifikat (z.B. mkcert):

1. mkcert installieren und lokale CA einrichten:
```bash
mkcert -install
```
2. Zertifikat fuer Hostnamen/IPs erzeugen:
```bash
mkcert -cert-file data/certs/apeiron-dev-cert.pem -key-file data/certs/apeiron-dev-key.pem localhost 127.0.0.1 ::1 192.168.0.10
```
3. `.env` setzen:
```bash
HTTPS_ENABLED=1
TLS_MODE=dev-trusted
TLS_CERT=data/certs/apeiron-dev-cert.pem
TLS_KEY=data/certs/apeiron-dev-key.pem
HTTPS_PORT=3443
```
4. Auf mobilen Geraeten optional die mkcert-CA vertrauen (Android/iOS), sonst Warnscreen.

#### B) Quick Self-Signed (Fallback)
Ohne eigene Zertifikatsdateien:
```bash
HTTPS_ENABLED=1
TLS_MODE=self-signed
HTTPS_PORT=3443
```
Beim Start wird automatisch ein Self-Signed Zertifikat unter `data/certs/` erzeugt.
Browser zeigt Warnung; nach expliziter Akzeptanz funktionieren HTTPS + Voice.

### TURN (Pflicht fuer Voice)
Beispiel `.env`:
```bash
VOICE_REQUIRE_TURN=1
STUN_URLS=stun:stun.l.google.com:19302
TURN_URLS=turn:<LAN-IP>:3478?transport=udp,turn:<LAN-IP>:3478?transport=tcp
TURN_USER=apeiron
TURN_PASS=<SECRET>
```

Hinweis:
- Ohne TURN-Config bleibt Voice-Join deaktiviert/fehlerhaft (`turn_required`).
- Fuer echte WLAN-Tests muss `<LAN-IP>` von anderen Geraeten erreichbar sein.

### LAN Discovery in der App
- Settings -> `LAN Access` zeigt:
  - `Secure (LAN)` strikt aus der aktuellen Browser-Origin (`window.location.origin`)
  - QR-Code immer fuer diese Secure-Login-URL (`/login`)
  - optionalen HTTP-Fallback-Link (gleicher Host, HTTP-Port)
  - `Current Origin detected` + `Listening ports detected (server-side)` als Diagnostik
  - Button `LAN Self-Test` mit Browser-Same-Origin-Check auf `/healthz` plus TCP-Portprobe (`tcp_http`, `tcp_https`)
  - Link `TLS Trust Setup (/ca)` fuer Android/iOS Zertifikat-Setup
  - lokale Adapter nur als Diagnosehinweis (kann container-intern sein, nicht QR-Ziel)
  - Copy-Buttons
- API: `GET /api/system/lan` (auth erforderlich, in Dev/Test fuer eingeloggte Nutzer verfuegbar)
- Fallback fuer unbrauchbaren Host-Header: `APEIRON_PUBLIC_BASE_URL=https://<LAN-IP-or-DNS>:3443`

### Firewall / Netzwerk
- Host-Firewall muss eingehende Ports `3000` und `3443` erlauben.
- Alle Geraete muessen im gleichen Subnetz sein (kein isoliertes Gast-WLAN).
- Hinter Reverse Proxy: `TRUST_PROXY` setzen, damit `secure` Cookie-Erkennung korrekt funktioniert.

### LAN Test Runbook (2 Geraete, reproduzierbar)
1. Host-IP ermitteln (`ipconfig`/`ip a`) und `.env` mit HTTPS + TURN setzen.
2. App starten (`npm run dev` oder `docker compose up --build`).
3. Auf Geraet A `https://<LAN-IP>:3443` oeffnen, einloggen, Voice-Channel joinen, Mic erlauben.
4. Auf Geraet B dieselbe URL oeffnen, einloggen, denselben Voice-Channel joinen, Mic erlauben.
5. Checkpoint: Beide Clients zeigen `Connected to room`.
6. Checkpoint: Audio in beide Richtungen hoerbar (kein Dauerspinner, kein stilles Waiting).
7. Checkpoint: Mute/Deafen auf beiden Seiten aendert UI- und Peer-Zustand.
8. Checkpoint: Chat + Uploads + Emoji/GIF laufen ueber dieselbe HTTPS-Origin.

Debug-Checkpoints:
- Browser Console: `voice_error` Codes (`voice_requires_https`, `turn_required`, `session_missing`).
- Voice Debug Panel (Loopback): `signaling`, `ice`, `conn`.
- Server Logs: `HTTP listening ...`, `HTTPS listening ...`, `Voice realtime WS path ...`.

Vollstaendiges Bedien-Runbook:
- `docs/LAN-WLAN-VOICE-RUNBOOK.md`
- `docs/LAN-HTTPS-TRUSTED.md`
- `RUNBOOK_LAN_MOBILE_QR.md`

Hilfsskripte:
- `./scripts/tls/generate-local-ca-cert.sh <LAN-IP> apeiron.local`
- `./scripts/tls/start-strategy2-dev-trusted.sh <LAN-IP>`
- `./scripts/tls/start-strategy1-domain.sh` (benoetigt `APEIRON_DOMAIN`, `DNS_PROVIDER`, `DNS_API_TOKEN`)
- `./scripts/tls/run-trusted-gate-local.sh https://<LAN-IP>:3443`
- `npm run test:e2e:mobile-lan:functional` (Android/iOS-LAN-Funktionstest ohne Snapshot-Gate)

## Docker (Dev + Prod)

### Dev (Hot Reload)
Start:
```bash
docker compose up --build
```

Stop:
```bash
docker compose down
```

Logs:
```bash
docker compose logs -f app
```

Dev-Setup Details:
- `docker-compose.yml` nutzt `Dockerfile.dev`.
- Source-Code ist als Bind-Mount aktiv: `./ -> /app`.
- `node_modules` bleibt im Container-Volume: `app_node_modules:/app/node_modules`.
- SQLite ist persistent gemountet: `./data -> /app/data`.
- Beim Start laufen automatisch Migrationen: `npm run db:migrate`.
- Hot Reload laeuft ueber `npm run dev` (`node --watch`).
- HTTP (`3000`) und HTTPS (`3443`) sind gemappt.
- Logs zeigen getrennt: `HTTP listening ...` / `HTTPS listening ...`.

Crash-Recovery testen:
```bash
docker compose exec app sh -c 'kill -9 $(pidof node)'
```
Der Container startet wegen `restart: unless-stopped` automatisch neu.

## E2E Sokrates

Ziel:
- reproduzierbar pruefen, ob Sokrates im DM antwortet
- Fallback OpenAI -> Ollama verifizieren
- bei Fehlern verwertbare Diagnose-Artefakte sichern

### Run (Docker Compose)

1. Stack starten:
```bash
docker compose up -d --build
```

2. Sokrates-Suite ausfuehren:
```bash
npm run test:e2e:sokrates
```

3. Optional danach:
```bash
docker compose down
```

### Was getestet wird

- Sokrates-DM oeffnen (`Σ Sokrates` + AI-Badge sichtbar)
- Nachricht senden -> Antwort innerhalb Zeitfenster
- erzwungener OpenAI-Fehler -> Ollama-Fallback
- Timeout-/Retry-Verhalten
- Rate-Limit-Verhalten ohne technische Fehlertexte im Chat

### Sokrates Fallback (OpenAI -> Ollama)

- Empfohlener Modus: `LLM_PROVIDER=auto`
- Wenn OpenAI (401/403/429/5xx/timeout) fehlschlaegt, wird automatisch Ollama versucht.
- OpenAI-Quota/Rate-Limit oeffnet einen Circuit-Breaker (Default: 10 Minuten), waehrenddessen wird direkt Ollama genutzt.
- In Logs (`event=sokrates.ai_reply`) stehen:
  - `provider_attempt_order`
  - `openai_error_code` / `ollama_error_code`
  - `final_provider_used`
  - `final_outcome` (`ANSWER`, `IN_CHARACTER_ERROR`, `HTTP_ERROR`)

Ollama Endpoint korrekt setzen:
- Docker Compose (app + ollama im selben Netzwerk): `OLLAMA_BASE_URL=http://ollama:11434`
- Lokaler Host-Run (`npm run dev`): `OLLAMA_BASE_URL=http://127.0.0.1:11434`

### Artefakte

Playwright-Artefakte:
- Failure Screenshot/Video/Trace (ueber Playwright-Konfiguration)
- HAR-Dateien pro Testfall

Zusatzdiagnose:
- `playwright-artifacts/sokrates/` enthaelt:
  - HAR Exporte je Testfall
  - `*.app.log` und `*.ollama.log` bei Fehlschlag
  - `sokrates-diagnostics.json` Attachment mit Endpoint-Status + Dauer + Konsolen-Tail

### Prod (Multi-Stage Image)
Build:
```bash
docker build -f Dockerfile -t apeiron:prod .
```

Run:
```bash
docker run -d \
  --name apeiron-prod \
  --restart unless-stopped \
  -p 3000:3000 \
  -p 3443:3443 \
  -e HOST=0.0.0.0 \
  -e PORT=3000 \
  -e HTTP_PORT=3000 \
  -e HTTPS_PORT=3443 \
  -e HTTPS_ENABLED=1 \
  -e TLS_MODE=dev-trusted \
  -e TLS_CERT=/app/data/certs/apeiron-dev-cert.pem \
  -e TLS_KEY=/app/data/certs/apeiron-dev-key.pem \
  -e VOICE_REQUIRE_TURN=1 \
  -e TURN_URLS=turn:<LAN-IP>:3478?transport=udp,turn:<LAN-IP>:3478?transport=tcp \
  -e TURN_USER=apeiron \
  -e TURN_PASS=replace-with-turn-secret \
  -e SESSION_SECRET=replace-with-long-random-secret \
  -e JWT_SECRET=replace-with-long-random-secret \
  -v "$(pwd)/data:/app/data" \
  apeiron:prod \
  sh -c "npm run db:migrate && npm start"
```

Prod-Image Eigenschaften:
- Multi-Stage Build (`Dockerfile`)
- Keine Dev-Dependencies (`npm ci --omit=dev`)
- Non-root Runtime User (`node`)

### Persistenzpfad
- SQLite liegt im Container unter `/app/data/apeiron.db`.
- Persistenz auf Host: `./data/apeiron.db` (plus `-wal`/`-shm` Dateien).

### Typische Fehler
- Port belegt (`3000 already in use`): lokalen Prozess stoppen oder Port-Mapping anpassen.
- Rechteprobleme auf `./data`: Schreibrechte fuer das Projektverzeichnis sicherstellen.
- Kein Reload bei Aenderung: pruefen, ob App ueber `docker compose up --build` gestartet wurde und `npm run dev` im Container laeuft.

## Security and Repository Hygiene (2026-03-23)
- Local DB snapshots and local TLS certificate/key artifacts are intentionally excluded from version control.
- New ignore rules cover:
  - `data/*.db`, `data/*.sqlite`, related temp variants
  - `data/certs/`
  - `.env*` (except `.env.example`)
- If you need test data, generate it locally via migrations/seeds instead of committing binary DB files.
- If sensitive data was committed in older history, use history rewrite (`git filter-repo` / BFG) and rotate affected credentials.
