#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
USER_HOME="${HOME}"
LAN_BASE_URL="${1:-https://172.29.40.90:3443}"
CA_CERT="${ROOT_DIR}/data/certs/local-ca/apeiron-local-ca.cert.pem"
PW_HOME="${PW_HOME:-/tmp/apeiron-home}"
CERTUTIL_BIN="${CERTUTIL_BIN:-/tmp/libnss3-tools-extract/usr/bin/certutil}"

if [[ ! -f "${CA_CERT}" ]]; then
  echo "Missing CA cert: ${CA_CERT}" >&2
  echo "Generate first: ./scripts/tls/generate-local-ca-cert.sh 172.29.40.90 apeiron.local" >&2
  exit 1
fi

if [[ ! -x "${CERTUTIL_BIN}" ]]; then
  mkdir -p /tmp/libnss3-tools-extract
  (cd /tmp && apt-get download libnss3-tools >/dev/null)
  dpkg-deb -x /tmp/libnss3-tools_*_amd64.deb /tmp/libnss3-tools-extract
fi

mkdir -p "${PW_HOME}/.pki/nssdb"
if [[ ! -f "${PW_HOME}/.pki/nssdb/cert9.db" ]]; then
  timeout 10s env HOME="${PW_HOME}" "${CERTUTIL_BIN}" -d sql:"${PW_HOME}/.pki/nssdb" -N --empty-password >/dev/null 2>&1 || true
fi
HOME="${PW_HOME}" "${CERTUTIL_BIN}" -d sql:"${PW_HOME}/.pki/nssdb" -D -n "Apeiron Local Root CA" >/dev/null 2>&1 || true
HOME="${PW_HOME}" "${CERTUTIL_BIN}" -d sql:"${PW_HOME}/.pki/nssdb" -A -n "Apeiron Local Root CA" -t "C,," -i "${CA_CERT}"

cd "${ROOT_DIR}"
HOME="${PW_HOME}" \
PLAYWRIGHT_BROWSERS_PATH="${USER_HOME}/.cache/ms-playwright" \
PLAYWRIGHT_TRUSTED_BASE_URL="${LAN_BASE_URL}" \
npm run test:e2e:tls-trusted -- --reporter=line
