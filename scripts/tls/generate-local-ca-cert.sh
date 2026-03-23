#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CERT_DIR="${ROOT_DIR}/data/certs/local-ca"
mkdir -p "${CERT_DIR}"

CA_KEY="${CERT_DIR}/apeiron-local-ca.key.pem"
CA_CERT="${CERT_DIR}/apeiron-local-ca.cert.pem"
SERVER_KEY="${CERT_DIR}/apeiron-lan.key.pem"
SERVER_CSR="${CERT_DIR}/apeiron-lan.csr.pem"
SERVER_CERT="${CERT_DIR}/apeiron-lan.cert.pem"
SERVER_EXT="${CERT_DIR}/apeiron-lan.ext"

LAN_IP="${1:-172.29.40.90}"
LAN_HOSTNAME="${2:-apeiron.local}"
DAYS_CA="${DAYS_CA:-3650}"
DAYS_SERVER="${DAYS_SERVER:-825}"

if [[ ! -f "${CA_KEY}" || ! -f "${CA_CERT}" ]]; then
  openssl genrsa -out "${CA_KEY}" 4096
  openssl req -x509 -new -nodes -key "${CA_KEY}" -sha256 -days "${DAYS_CA}" \
    -out "${CA_CERT}" -subj "/CN=Apeiron Local Root CA/O=Apeiron/OU=LAN"
fi

openssl genrsa -out "${SERVER_KEY}" 2048
openssl req -new -key "${SERVER_KEY}" -out "${SERVER_CSR}" \
  -subj "/CN=${LAN_HOSTNAME}/O=Apeiron/OU=LAN"

cat > "${SERVER_EXT}" <<EXT
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage=digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=@alt_names
[alt_names]
DNS.1=${LAN_HOSTNAME}
DNS.2=localhost
IP.1=${LAN_IP}
IP.2=127.0.0.1
EXT

openssl x509 -req -in "${SERVER_CSR}" -CA "${CA_CERT}" -CAkey "${CA_KEY}" -CAcreateserial \
  -out "${SERVER_CERT}" -days "${DAYS_SERVER}" -sha256 -extfile "${SERVER_EXT}"

cat <<INFO
Generated:
  CA cert:      ${CA_CERT}
  CA key:       ${CA_KEY}
  Server cert:  ${SERVER_CERT}
  Server key:   ${SERVER_KEY}

Use env:
  HTTPS_ENABLED=1
  TLS_MODE=dev-trusted
  TLS_CERT=${SERVER_CERT}
  TLS_KEY=${SERVER_KEY}
  LAN_PUBLIC_HTTPS_URL=https://${LAN_IP}:3443

Client trust required:
  - Import CA cert on every client: ${CA_CERT}
INFO
