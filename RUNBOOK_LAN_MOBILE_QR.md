# Apeiron LAN Mobile QR Runbook (PC2)

## Ziel
Dieses Runbook prueft reproduzierbar, dass Apeiron im selben LAN auf einem zweiten Geraet (PC2/Handy) ueber QR-Link erreichbar ist.

## Voraussetzungen
- Host (PC1) und Client (PC2/Handy) im selben WLAN/Subnetz.
- Apeiron laeuft und bindet auf `0.0.0.0`.
- Host-Portcheck vorab:
  - `ss -lntp | egrep ':(3000|3001|3200|3443)\\b'`
  - `lsof -iTCP -sTCP:LISTEN -P | egrep ':(3000|3001|3200|3443)\\b'`
- LAN-IP des Hosts ist bekannt (z. B. `172.29.40.90`).
- Ports offen:
  - Basic: `3000` (oder euer HTTP-Port)
  - Full: `3443` (oder euer HTTPS-Port)
- Optional fuer Voice:
  - HTTPS mit trusted Zertifikat
  - TURN erreichbar

## Schrittfolge (PC2)
1. App auf PC1 starten.
2. Auf PC1 einloggen und `User Settings -> LAN Access` oeffnen.
3. Pruefen: `Secure (LAN)` zeigt die aktuelle Browser-Origin (`https://<LAN-IP>:3443`) und `Secure QR` ist sichtbar.
   - In der LAN-Access-Seite auch pruefen:
     - `Current Origin detected`
     - `Health endpoint: /healthz`
     - `Listening ports detected (server-side)`
     - optional `LAN Self-Test` ausfuehren
     - optional `TLS Trust Setup (/ca)` fuer Android/iOS aufrufen
4. Mit Handy/PC2 QR scannen und Link oeffnen.
5. Erwartung beim Oeffnen:
  - Nicht auf `localhost`
  - Login-Seite oder direkt App-Ansicht (wenn Session vorhanden)
6. Auf PC2 einloggen.
7. DM/Server-Kernfunktionen pruefen:
  - DM-Liste sichtbar
  - Composer sichtbar
  - Emoji/GIF-Picker oeffnen
8. Optional Voice-Test (nur HTTPS + TURN):
  - Voice-Channel joinen
  - Mic-Prompt erscheint
  - Audio-Verbindung moeglich

## Acceptance je Schritt
- LAN Access zeigt mindestens einen gueltigen Secure-Link + QR.
- QR-Inhalt und sichtbarer Link sind identisch.
- QR-Link auf PC2 ist ueber Netzwerk-IP erreichbar.
- Login auf PC2 funktioniert.
- DM-Layout und Composer sind auf Mobile sichtbar und nutzbar.
- Optional Voice: Join + Mic-Permission funktionieren ueber HTTPS.

## Troubleshooting
### QR fehlt
- Seite neu laden und erneut `LAN Access` oeffnen.
- Pruefen, ob `Secure (LAN)` angezeigt wird; ohne URL kein QR.

### Link laedt nicht
- Host lauscht wirklich auf `0.0.0.0`.
- Host-Firewall erlaubt den Port.
- PC2 ist im gleichen Subnetz (kein Gast-WLAN mit Client-Isolation).
- Externer Gegencheck (PC2):
  - `curl -vk https://<LAN-IP>:3443/login`
  - `curl -vk https://<LAN-IP>:3443/healthz`
  - `nc -vz <LAN-IP> 3443`
  - optional: `nmap -p 3001,3443,3200 <LAN-IP>`

### Mixed Content / HTTPS Probleme
- Fuer Voice im LAN HTTPS verwenden.
- Bei self-signed Zertifikat auf PC2 Zertifikat vertrauen oder Testmodus mit Ausnahme nutzen.

### Firewall
- Eingehend auf PC1: HTTP/HTTPS-Port erlauben.
- Schulnetz kann einzelne Ports/WSS/UDP filtern; dann IT-Freigabe anfragen.

## Automatisierte E2E-Kommandos
- QR + Mobile/Desktop Suite:
  - `npm run test:e2e:mobile-lan`
- Funktional (ohne Snapshot-Gate):
  - `npm run test:e2e:mobile-lan:functional`
- Einzeltests:
  - `npx playwright test e2e/lan-qr-scan.spec.js`
  - `npx playwright test e2e/mobile-android.spec.js`
  - `npx playwright test e2e/mobile-ios-webkit.spec.js`
  - `npx playwright test e2e/desktop-win-chromium.spec.js`
  - `npx playwright test e2e/visual-profile-smoke.spec.js`
  - `npm run diagnose:lan:https -- https://<LAN-IP>:3443/healthz`

## Hinweis zu Grenzen
Playwright simuliert Mobile-Viewports und Browser-Engines, aber keine physische WLAN-Funkverbindung eines echten Geraets. Fuer finale WLAN-Freigabe in Schulnetzen immer den manuellen PC2-Run oben ausfuehren.
