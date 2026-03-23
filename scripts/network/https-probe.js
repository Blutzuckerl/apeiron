#!/usr/bin/env node
const tls = require('tls');
const https = require('https');

function sanitizeSubjectAltName(value) {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

async function probeTls(target) {
  const startedAt = Date.now();
  return new Promise((resolve) => {
    const socket = tls.connect({
      host: target.hostname,
      port: Number(target.port || 443),
      servername: target.hostname,
      rejectUnauthorized: false
    });

    const finish = (payload) => {
      socket.destroy();
      resolve({
        rttMs: Math.max(0, Date.now() - startedAt),
        ...payload
      });
    };

    socket.setTimeout(5_000, () => finish({ ok: false, error: 'timeout' }));
    socket.once('error', (error) => {
      finish({ ok: false, error: String(error?.code || error?.message || 'tls_error') });
    });
    socket.once('secureConnect', () => {
      const certificate = socket.getPeerCertificate(true) || {};
      finish({
        ok: true,
        authorized: socket.authorized === true,
        authorizationError: String(socket.authorizationError || ''),
        protocol: String(socket.getProtocol() || ''),
        cipher: socket.getCipher(),
        cert: {
          subject: certificate.subject || {},
          issuer: certificate.issuer || {},
          validFrom: String(certificate.valid_from || ''),
          validTo: String(certificate.valid_to || ''),
          subjectAltName: sanitizeSubjectAltName(certificate.subjectaltname)
        }
      });
    });
  });
}

async function probeHttp(target) {
  const startedAt = Date.now();
  return new Promise((resolve) => {
    const req = https.request({
      host: target.hostname,
      port: Number(target.port || 443),
      method: 'GET',
      path: `${target.pathname || '/'}${target.search || ''}`,
      rejectUnauthorized: false,
      timeout: 5_000
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          ok: Number(res.statusCode || 0) >= 200 && Number(res.statusCode || 0) < 400,
          status: Number(res.statusCode || 0),
          contentType: String(res.headers['content-type'] || ''),
          rttMs: Math.max(0, Date.now() - startedAt),
          bodyPreview: Buffer.concat(chunks).toString('utf8').slice(0, 220)
        });
      });
    });
    req.on('timeout', () => {
      req.destroy(new Error('timeout'));
    });
    req.on('error', (error) => {
      resolve({
        ok: false,
        status: 0,
        contentType: '',
        rttMs: Math.max(0, Date.now() - startedAt),
        error: String(error?.code || error?.message || 'https_error')
      });
    });
    req.end();
  });
}

async function main() {
  const input = String(process.argv[2] || 'https://127.0.0.1:3443/healthz').trim();
  let target;
  try {
    target = new URL(input);
  } catch (_error) {
    console.error(`Invalid URL: ${input}`);
    process.exit(2);
  }
  if (target.protocol !== 'https:') {
    console.error(`Expected https URL, got: ${target.protocol}`);
    process.exit(2);
  }

  const tlsResult = await probeTls(target);
  const httpResult = await probeHttp(target);
  const output = {
    target: target.toString(),
    tls: tlsResult,
    http: httpResult
  };
  console.log(JSON.stringify(output, null, 2));
  process.exit(tlsResult.ok && httpResult.ok ? 0 : 1);
}

void main();
