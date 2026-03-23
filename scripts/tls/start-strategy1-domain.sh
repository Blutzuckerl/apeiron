#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

: "${APEIRON_DOMAIN:?Set APEIRON_DOMAIN (e.g. apeiron.example.com)}"
: "${DNS_PROVIDER:?Set DNS_PROVIDER (Caddy DNS module name)}"
: "${DNS_API_TOKEN:?Set DNS_API_TOKEN for DNS-01 challenge}"

cd "${ROOT_DIR}/deploy"
LAN_PUBLIC_HTTPS_URL="https://${APEIRON_DOMAIN}" \
APEIRON_DOMAIN="${APEIRON_DOMAIN}" \
DNS_PROVIDER="${DNS_PROVIDER}" \
DNS_API_TOKEN="${DNS_API_TOKEN}" \
docker compose -f docker-compose.caddy.yml up -d --build

echo "Strategy 1 started. Ensure Split-DNS maps ${APEIRON_DOMAIN} -> host LAN IP."
