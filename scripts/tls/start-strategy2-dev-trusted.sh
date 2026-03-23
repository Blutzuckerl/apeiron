#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LAN_IP="${1:-172.29.40.90}"
CERT_DIR="${ROOT_DIR}/data/certs/local-ca"
SERVER_CERT="${CERT_DIR}/apeiron-lan.cert.pem"
SERVER_KEY="${CERT_DIR}/apeiron-lan.key.pem"

if [[ ! -f "${SERVER_CERT}" || ! -f "${SERVER_KEY}" ]]; then
  echo "Missing local cert/key. Generate first:" >&2
  echo "  ./scripts/tls/generate-local-ca-cert.sh ${LAN_IP} apeiron.local" >&2
  exit 1
fi

cd "${ROOT_DIR}"
HOST=0.0.0.0 \
PORT=3001 \
HTTP_PORT=3001 \
HTTPS_ENABLED=1 \
HTTPS_PORT=3443 \
TLS_MODE=dev-trusted \
TLS_CERT="${SERVER_CERT}" \
TLS_KEY="${SERVER_KEY}" \
LAN_PUBLIC_HTTPS_URL="https://${LAN_IP}:3443" \
VOICE_REQUIRE_SECURE_ORIGIN=1 \
VOICE_REQUIRE_TURN=1 \
TURN_URLS="${TURN_URLS:-turn:127.0.0.1:3478?transport=udp}" \
TURN_USER="${TURN_USER:-demo}" \
TURN_PASS="${TURN_PASS:-demo-pass}" \
npm run dev
