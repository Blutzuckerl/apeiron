# Apeiron LAN HTTPS ohne Browser-Warnung

## Kurzfassung
"Not secure" verschwindet nur, wenn der Browser dem Zertifikat vertraut.

Es gibt zwei valide Wege:
1. Domain + oeffentlich vertrautes Zertifikat (empfohlen)
2. Lokale CA (mkcert) + CA auf allen Clients installiert

## Strategie A (empfohlen): Domain + Let's Encrypt + Split-DNS

### Ziel
Clients im gleichen WLAN oeffnen `https://apeiron.<deine-domain>` ohne Warnscreen.

### Voraussetzungen
- Eine echte Domain
- DNS-01 faehiger ACME-Client (z. B. Caddy mit DNS-Plugin)
- Interner DNS/Router-DNS Override: `apeiron.<deine-domain> -> 172.29.40.90`

### Reverse Proxy (TLS-Termination) vor Node
Node bleibt intern auf HTTP (`127.0.0.1:3000`), TLS laeuft am Proxy auf `:443`.

Beispiel Caddyfile (Schema):
```caddy
apeiron.example.com {
  tls {
    dns <dns-provider> {env.DNS_API_TOKEN}
  }

  reverse_proxy 127.0.0.1:3000 {
    header_up X-Forwarded-Proto {scheme}
    header_up X-Forwarded-Host {host}
  }
}
```

### Apeiron Env hinter Proxy
```bash
HOST=127.0.0.1
PORT=3000
HTTP_PORT=3000
HTTPS_ENABLED=0
TRUST_PROXY=1
FORCE_HTTPS=1
HTTPS_REDIRECT_PORT=443
LAN_PUBLIC_HTTPS_URL=https://apeiron.example.com
APEIRON_PUBLIC_BASE_URL=https://apeiron.example.com
VOICE_REQUIRE_SECURE_ORIGIN=1
VOICE_REQUIRE_TURN=1
```

## Strategie B: mkcert / interne CA

### Ziel
LAN ueber IP/Hostname ohne Warnung, aber nur auf Clients mit installierter Root-CA.

### Zertifikat erzeugen
```bash
mkcert -install
mkcert -cert-file data/certs/apeiron-dev-cert.pem -key-file data/certs/apeiron-dev-key.pem \
  172.29.40.90 apeiron.local localhost 127.0.0.1 ::1
```

### Apeiron Env
```bash
HOST=0.0.0.0
HTTP_PORT=3000
HTTPS_ENABLED=1
HTTPS_PORT=3443
TLS_MODE=dev-trusted
TLS_CERT=data/certs/apeiron-dev-cert.pem
TLS_KEY=data/certs/apeiron-dev-key.pem
TRUST_PROXY=0
FORCE_HTTPS=0
LAN_PUBLIC_HTTPS_URL=https://172.29.40.90:3443
APEIRON_PUBLIC_BASE_URL=https://172.29.40.90:3443
```

### Client-Trust
- Windows: Root-CA in "Trusted Root Certification Authorities"
- Android/iOS: CA-Profil installieren und als vertrauenswuerdig markieren

## Musspunkte fuer Apeiron-Betrieb
- LAN Access zeigt HTTPS-first URLs/QR-Targets (`/login`)
- Voice-Signaling bleibt `wss://` auf HTTPS-Origin
- Keine `ignoreHTTPSErrors`-Bypasses in Trusted-Gate-Tests

## Harte Test-Gates
Trusted Suite (fuer CI/Abnahme):
```bash
PLAYWRIGHT_TRUSTED_BASE_URL=https://apeiron.example.com npm run test:e2e:tls-trusted
```

Die Suite failt absichtlich, wenn:
- Zertifikat nicht trusted
- `window.isSecureContext !== true`
- Voice nicht ueber `wss://` connected
- QR nicht auf HTTPS-Login zeigt
