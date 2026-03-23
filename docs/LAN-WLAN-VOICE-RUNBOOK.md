# Apeiron LAN/WLAN Voice Runbook

## Ziel
Zwei Geraete im gleichen WLAN nutzen Apeiron ueber HTTPS mit funktionierendem Chat, Uploads und Voice.

## Voraussetzungen
- Host und Clients im gleichen Subnetz (kein Guest-WLAN).
- Ports `3000` und `3443` in der Host-Firewall offen.
- `.env` konfiguriert:
  - `HOST=0.0.0.0`
  - `HTTPS_ENABLED=1`
  - `TLS_MODE=dev-trusted` (oder `self-signed`)
  - `VOICE_REQUIRE_SECURE_ORIGIN=1`
  - `VOICE_REQUIRE_TURN=1`
  - `TURN_URLS`, `TURN_USER`, `TURN_PASS` gesetzt

## Start
1. Host-IP ermitteln (`ipconfig` oder `ip a`).
2. App starten: `npm run dev` (oder `docker compose up --build`).
3. Logs pruefen:
   - `HTTP listening on ...`
   - `HTTPS listening on ...`
   - `Voice realtime WS path: /app/voice/realtime`

## Realer WLAN-Test (2 Geraete)
1. Geraet A: `https://<LAN-IP>:3443` oeffnen.
2. Login mit Testuser.
3. Server oeffnen, Voice-Channel auswaehlen, `Join Voice`.
4. Mic-Permission erlauben.
5. Geraet B: denselben Ablauf wiederholen.
6. Beide sprechen kurz nacheinander.

## Erwartete Resultate (DoD)
- Beide Clients zeigen `Connected to room`.
- Mute/Deafen auf einem Geraet aktualisiert den Zustand auf beiden.
- Audio ist in beide Richtungen hoerbar.
- Chat, Emoji/GIF und Uploads funktionieren weiter auf derselben HTTPS-Origin.
- Keine Polling-Requests fuer Voice-Signaling (`/voice/sync`, `/voice/presence`, `/voice/signal`).

## Debug-Checkliste
- Browser Console:
  - `voice_requires_https`: Client ist nicht in Secure Context.
  - `turn_required`: TURN in Env fehlt.
  - `session_missing`: Session-Rejoin noetig (reconnect/resync).
- Voice Debug (Loopback):
  - `signaling: open/closed`
  - `ice`, `conn`
- Netzwerk:
  - Zertifikat auf Mobile trusted?
  - TURN-Host von Mobile erreichbar?
