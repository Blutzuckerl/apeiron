const os = require('os');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const QRCode = require('qrcode');

function normalizePort(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 65535) {
    return Number(fallback);
  }
  return Math.round(parsed);
}

function isRfc1918Ipv4(address) {
  const value = String(address || '').trim();
  if (!value) {
    return false;
  }
  const octets = value.split('.').map((entry) => Number(entry));
  if (octets.length !== 4 || octets.some((entry) => !Number.isInteger(entry) || entry < 0 || entry > 255)) {
    return false;
  }
  if (octets[0] === 10) {
    return true;
  }
  if (octets[0] === 192 && octets[1] === 168) {
    return true;
  }
  if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) {
    return true;
  }
  return false;
}

function isLoopbackHost(hostname) {
  const value = String(hostname || '').trim().toLowerCase();
  return value === 'localhost'
    || value === '127.0.0.1'
    || value === '::1'
    || value === '[::1]';
}

function listLanIpv4Addresses() {
  let interfaces = {};
  try {
    interfaces = os.networkInterfaces() || {};
  } catch (_error) {
    return [];
  }
  const rows = [];
  Object.entries(interfaces).forEach(([interfaceName, addresses]) => {
    (addresses || []).forEach((entry) => {
      const family = String(entry?.family || '').toUpperCase();
      const address = String(entry?.address || '').trim();
      if (family !== 'IPV4' || !address || entry?.internal) {
        return;
      }
      if (!isRfc1918Ipv4(address)) {
        return;
      }
      rows.push({
        interface: interfaceName,
        address
      });
    });
  });

  rows.sort((left, right) => {
    if (left.address === right.address) {
      return left.interface.localeCompare(right.interface);
    }
    return left.address.localeCompare(right.address, undefined, { numeric: true, sensitivity: 'base' });
  });
  return rows;
}

function buildLanLinks({
  addresses = [],
  httpPort = 3000,
  httpsPort = 3443,
  httpsEnabled = false
}) {
  const safeHttpPort = normalizePort(httpPort, 3000);
  const safeHttpsPort = normalizePort(httpsPort, 3443);
  return addresses.map((entry) => ({
    interface: entry.interface,
    address: entry.address,
    basicUrl: httpsEnabled ? `https://${entry.address}:${safeHttpsPort}` : `http://${entry.address}:${safeHttpPort}`,
    fullUrl: httpsEnabled ? `https://${entry.address}:${safeHttpsPort}` : ''
  }));
}

function buildLocalAltNames({
  host = '0.0.0.0',
  extraIps = []
} = {}) {
  const dnsNames = new Set(['localhost', 'apeiron.local']);
  const ips = new Set(['127.0.0.1', ...listLanIpv4Addresses().map((entry) => entry.address)]);
  extraIps.forEach((entry) => {
    const value = String(entry || '').trim();
    if (!value) {
      return;
    }
    if (isRfc1918Ipv4(value) || value === '127.0.0.1') {
      ips.add(value);
      return;
    }
    dnsNames.add(value);
  });
  if (host && host !== '0.0.0.0' && host !== '::') {
    if (isRfc1918Ipv4(host) || host === '127.0.0.1') {
      ips.add(host);
    } else {
      dnsNames.add(host);
    }
  }
  return {
    dnsNames: [...dnsNames],
    ips: [...ips]
  };
}

function ensureSelfSignedCertificate({
  certPath,
  keyPath,
  host = '0.0.0.0',
  certDays = 365
}) {
  const absoluteCertPath = path.resolve(process.cwd(), certPath);
  const absoluteKeyPath = path.resolve(process.cwd(), keyPath);
  if (fs.existsSync(absoluteCertPath) && fs.existsSync(absoluteKeyPath)) {
    return {
      certPath: absoluteCertPath,
      keyPath: absoluteKeyPath,
      generated: false
    };
  }

  fs.mkdirSync(path.dirname(absoluteCertPath), { recursive: true });
  fs.mkdirSync(path.dirname(absoluteKeyPath), { recursive: true });

  const { dnsNames, ips } = buildLocalAltNames({ host });
  const altNames = [
    ...dnsNames.map((name, index) => `DNS.${index + 1} = ${name}`),
    ...ips.map((ip, index) => `IP.${index + 1} = ${ip}`)
  ];
  const configPath = path.resolve(
    process.cwd(),
    'data',
    'certs',
    'apeiron-selfsigned-openssl.cnf'
  );
  const opensslConfig = `
[ req ]
default_bits = 2048
prompt = no
default_md = sha256
x509_extensions = v3_req
distinguished_name = dn

[ dn ]
CN = Apeiron LAN Dev
O = Apeiron
OU = Development

[ v3_req ]
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[ alt_names ]
${altNames.join('\n')}
`.trim();
  fs.writeFileSync(configPath, `${opensslConfig}\n`, 'utf8');

  execFileSync('openssl', [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-sha256',
    '-nodes',
    '-days',
    String(Math.max(1, Number(certDays || 365))),
    '-keyout',
    absoluteKeyPath,
    '-out',
    absoluteCertPath,
    '-config',
    configPath,
    '-extensions',
    'v3_req'
  ], {
    stdio: 'ignore'
  });

  return {
    certPath: absoluteCertPath,
    keyPath: absoluteKeyPath,
    generated: true
  };
}

function resolveTlsConfig({
  host = process.env.HOST || '0.0.0.0'
} = {}) {
  const mode = String(process.env.TLS_MODE || '').trim().toLowerCase();
  const certEnvPath = String(process.env.TLS_CERT || process.env.TLS_CERT_PATH || '').trim();
  const keyEnvPath = String(process.env.TLS_KEY || process.env.TLS_KEY_PATH || '').trim();
  const httpsEnabledFlag = String(process.env.HTTPS_ENABLED || '').trim();
  const wantsHttps = httpsEnabledFlag === '1'
    || mode === 'self-signed'
    || mode === 'dev-trusted'
    || (certEnvPath && keyEnvPath);

  if (!wantsHttps) {
    return {
      enabled: false,
      mode: 'off'
    };
  }

  let certPath = certEnvPath;
  let keyPath = keyEnvPath;
  let generatedSelfSigned = false;
  let activeMode = mode || 'dev-trusted';

  if (!certPath || !keyPath) {
    if (mode === 'dev-trusted') {
      return {
        enabled: false,
        mode: 'dev-trusted',
        error: 'TLS_MODE=dev-trusted requires TLS_CERT and TLS_KEY files.'
      };
    }

    const defaultCertPath = String(process.env.TLS_SELF_SIGNED_CERT || 'data/certs/apeiron-selfsigned-cert.pem');
    const defaultKeyPath = String(process.env.TLS_SELF_SIGNED_KEY || 'data/certs/apeiron-selfsigned-key.pem');
    const selfSigned = ensureSelfSignedCertificate({
      certPath: defaultCertPath,
      keyPath: defaultKeyPath,
      host,
      certDays: Number(process.env.TLS_SELF_SIGNED_DAYS || 365)
    });
    certPath = selfSigned.certPath;
    keyPath = selfSigned.keyPath;
    generatedSelfSigned = selfSigned.generated;
    activeMode = 'self-signed';
  }

  const absoluteCertPath = path.resolve(process.cwd(), certPath);
  const absoluteKeyPath = path.resolve(process.cwd(), keyPath);
  if (!fs.existsSync(absoluteCertPath) || !fs.existsSync(absoluteKeyPath)) {
    return {
      enabled: false,
      mode: activeMode,
      error: `TLS files missing: cert=${absoluteCertPath} key=${absoluteKeyPath}`
    };
  }

  return {
    enabled: true,
    mode: activeMode,
    generatedSelfSigned,
    certPath: absoluteCertPath,
    keyPath: absoluteKeyPath,
    cert: fs.readFileSync(absoluteCertPath),
    key: fs.readFileSync(absoluteKeyPath)
  };
}

function parseProxyTrust(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return false;
  }
  const normalized = raw.toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  const maybeNumber = Number(raw);
  if (Number.isFinite(maybeNumber) && maybeNumber >= 0) {
    return Math.floor(maybeNumber);
  }
  return raw;
}

function firstHeaderValue(value) {
  return String(value || '').split(',')[0].trim();
}

function stripOptionalQuotes(value) {
  const raw = String(value || '').trim();
  if (raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2) {
    return raw.slice(1, -1).trim();
  }
  return raw;
}

function extractForwardedField(forwardedHeader, fieldName) {
  const firstEntry = firstHeaderValue(forwardedHeader);
  if (!firstEntry) {
    return '';
  }
  const key = String(fieldName || '').trim().toLowerCase();
  if (!key) {
    return '';
  }
  const segments = firstEntry.split(';');
  for (const segment of segments) {
    const [rawName, ...rest] = String(segment || '').split('=');
    const name = String(rawName || '').trim().toLowerCase();
    if (name !== key) {
      continue;
    }
    return stripOptionalQuotes(rest.join('='));
  }
  return '';
}

function normalizeRequestProtocol(value) {
  const raw = firstHeaderValue(value).toLowerCase();
  if (!raw) {
    return '';
  }
  if (raw === 'https' || raw === 'wss') {
    return 'https';
  }
  if (raw === 'http' || raw === 'ws') {
    return 'http';
  }
  return '';
}

function normalizeHostHeader(value) {
  const raw = firstHeaderValue(value);
  if (!raw) {
    return '';
  }
  if (/\s/.test(raw) || raw.includes('/')) {
    return '';
  }
  return raw;
}

function parseHostHeaderParts(hostHeader) {
  const host = normalizeHostHeader(hostHeader);
  if (!host) {
    return {
      host: '',
      hostname: '',
      port: ''
    };
  }
  if (host.startsWith('[')) {
    const end = host.indexOf(']');
    if (end <= 1) {
      return { host: '', hostname: '', port: '' };
    }
    const hostname = host.slice(1, end);
    const rest = host.slice(end + 1);
    if (!rest) {
      return { host, hostname, port: '' };
    }
    if (!rest.startsWith(':')) {
      return { host: '', hostname: '', port: '' };
    }
    const port = rest.slice(1).trim();
    if (port && !/^\d{1,5}$/.test(port)) {
      return { host: '', hostname: '', port: '' };
    }
    return { host, hostname, port };
  }

  const firstColonIndex = host.indexOf(':');
  const lastColonIndex = host.lastIndexOf(':');
  if (firstColonIndex !== -1 && firstColonIndex !== lastColonIndex) {
    return { host: '', hostname: '', port: '' };
  }
  if (firstColonIndex === -1) {
    return { host, hostname: host, port: '' };
  }
  const hostname = host.slice(0, firstColonIndex).trim();
  const port = host.slice(firstColonIndex + 1).trim();
  if (!hostname || (port && !/^\d{1,5}$/.test(port))) {
    return { host: '', hostname: '', port: '' };
  }
  return { host, hostname, port };
}

function extractHostnameFromHostHeader(hostHeader) {
  return parseHostHeaderParts(hostHeader).hostname;
}

function isUnspecifiedHost(hostname) {
  const value = String(hostname || '').trim().toLowerCase();
  return value === '0.0.0.0' || value === '::' || value === '[::]';
}

function isUsableHostHeader(hostHeader) {
  const host = normalizeHostHeader(hostHeader);
  if (!host) {
    return false;
  }
  const hostname = extractHostnameFromHostHeader(host);
  if (!hostname) {
    return false;
  }
  if (isUnspecifiedHost(hostname)) {
    return false;
  }
  return true;
}

function normalizePublicBaseUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    return parsed.origin;
  } catch (_error) {
    return '';
  }
}

function normalizePublicHttpsBaseUrl(value) {
  const origin = normalizePublicBaseUrl(value);
  if (!origin) {
    return '';
  }
  if (!origin.startsWith('https://')) {
    return '';
  }
  return origin;
}

function toLoginUrl(rawUrl) {
  const value = String(rawUrl || '').trim();
  if (!value) {
    return '';
  }
  try {
    return new URL('/login', value).toString();
  } catch (_error) {
    return '';
  }
}

function detectRuntimeHints({ httpPort = 3000, httpsPort = 3443 } = {}) {
  const safeHttpPort = normalizePort(httpPort, 3000);
  const safeHttpsPort = normalizePort(httpsPort, 3443);
  const procVersion = (() => {
    try {
      return String(fs.readFileSync('/proc/version', 'utf8') || '');
    } catch (_error) {
      return '';
    }
  })();
  const isWsl = Boolean(
    process.env.WSL_INTEROP
    || process.env.WSL_DISTRO_NAME
    || /microsoft/i.test(procVersion)
  );
  const isContainer = fs.existsSync('/.dockerenv');
  const wslIp = String(process.env.WSL_IP || '').trim();
  const hasWslPortProxyTemplate = isWsl && Boolean(wslIp);

  return {
    isWsl,
    isContainer,
    wslIp,
    hasWslPortProxyTemplate,
    portProxyCommands: hasWslPortProxyTemplate
      ? [
        `netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=${safeHttpsPort} connectaddress=${wslIp} connectport=${safeHttpsPort}`,
        `netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=${safeHttpPort} connectaddress=${wslIp} connectport=${safeHttpPort}`
      ]
      : []
  };
}

function resolveRequestBaseUrl({ req, trustProxy = false } = {}) {
  if (!req || typeof req.get !== 'function') {
    return {
      baseUrl: '',
      source: 'none'
    };
  }

  const requestProtocol = normalizeRequestProtocol(req.protocol) || 'http';
  const requestHost = normalizeHostHeader(req.get('host'));
  let protocol = requestProtocol;
  let host = requestHost;
  let source = 'request';

  if (trustProxy) {
    const forwardedHeader = req.get('forwarded');
    const forwardedProto = normalizeRequestProtocol(
      extractForwardedField(forwardedHeader, 'proto') || req.get('x-forwarded-proto')
    );
    const forwardedHost = normalizeHostHeader(
      extractForwardedField(forwardedHeader, 'host') || req.get('x-forwarded-host')
    );
    if (forwardedProto || forwardedHost) {
      protocol = forwardedProto || protocol;
      host = forwardedHost || host;
      source = 'forwarded';
    }
  }

  const detectedBaseUrl = host ? `${protocol}://${host}` : '';
  if (isUsableHostHeader(host)) {
    return {
      baseUrl: `${protocol}://${host}`,
      source,
      detectedBaseUrl
    };
  }
  if (isUsableHostHeader(requestHost)) {
    return {
      baseUrl: `${requestProtocol}://${requestHost}`,
      source: 'request',
      detectedBaseUrl
    };
  }
  return {
    baseUrl: '',
    source: 'none',
    detectedBaseUrl
  };
}

function resolveEnvPublicBaseUrl() {
  const candidates = [
    process.env.APEIRON_PUBLIC_BASE_URL,
    process.env.LAN_PUBLIC_HTTPS_URL,
    process.env.PUBLIC_HTTPS_BASE_URL,
    process.env.PUBLIC_BASE_URL
  ];
  for (const value of candidates) {
    const baseUrl = normalizePublicBaseUrl(value);
    if (!baseUrl) {
      continue;
    }
    return {
      baseUrl,
      source: 'env'
    };
  }
  return {
    baseUrl: '',
    source: 'none'
  };
}

function buildHttpFallbackBaseUrl({
  secureBaseUrl,
  httpPort = 3000,
  httpEnabled = true
} = {}) {
  if (!httpEnabled) {
    return '';
  }
  const base = normalizePublicBaseUrl(secureBaseUrl);
  if (!base) {
    return '';
  }
  try {
    const parsed = new URL(base);
    parsed.protocol = 'http:';
    parsed.port = String(normalizePort(httpPort, 3000));
    return parsed.origin;
  } catch (_error) {
    return '';
  }
}

function resolveSecureBaseUrl({
  preferredBaseUrl = '',
  fallbackBaseUrl = '',
  httpPort = 3000,
  httpsPort = 3443,
  httpsEnabled = false
} = {}) {
  const candidate = normalizePublicBaseUrl(preferredBaseUrl) || normalizePublicBaseUrl(fallbackBaseUrl);
  if (!candidate) {
    return '';
  }
  if (!httpsEnabled) {
    return candidate;
  }

  const safeHttpPort = normalizePort(httpPort, 3000);
  const safeHttpsPort = normalizePort(httpsPort, 3443);
  try {
    const parsed = new URL(candidate);
    const originalProtocol = parsed.protocol;
    const defaultPort = originalProtocol === 'https:' ? 443 : (originalProtocol === 'http:' ? 80 : 0);
    const originalPort = parsed.port ? Number(parsed.port) : defaultPort;
    const isSuspiciousHttpsOnHttpPort = originalProtocol === 'https:'
      && safeHttpPort !== safeHttpsPort
      && originalPort === safeHttpPort;
    const keepExistingHttpsPort = originalProtocol === 'https:' && !isSuspiciousHttpsOnHttpPort;

    parsed.protocol = 'https:';
    if (keepExistingHttpsPort) {
      if (originalPort === 443 || !Number.isFinite(originalPort) || originalPort <= 0) {
        parsed.port = '';
      } else {
        parsed.port = String(originalPort);
      }
      return parsed.origin;
    }

    if (safeHttpsPort === 443) {
      parsed.port = '';
    } else {
      parsed.port = String(safeHttpsPort);
    }
    return parsed.origin;
  } catch (_error) {
    return '';
  }
}

async function buildLanSystemPayload({
  host = process.env.HOST || '0.0.0.0',
  httpPort = 3000,
  httpsPort = 3443,
  httpsEnabled = false,
  tlsMode = 'off',
  req = null,
  trustProxy = false,
  clientOrigin = '',
  httpEnabled = true,
  turnRequired = String(process.env.VOICE_REQUIRE_TURN || '1') !== '0',
  turnConfigured = Boolean(process.env.TURN_URLS || process.env.TURN_URL)
  } = {}) {
  const addresses = listLanIpv4Addresses();
  const safeHttpPort = normalizePort(httpPort, 3000);
  const safeHttpsPort = normalizePort(httpsPort, 3443);
  const requestBase = resolveRequestBaseUrl({
    req,
    trustProxy: Boolean(trustProxy)
  });
  const envBase = resolveEnvPublicBaseUrl();
  const forcedClientOrigin = normalizePublicBaseUrl(clientOrigin);
  const resolvedBaseUrl = forcedClientOrigin || resolveSecureBaseUrl({
    preferredBaseUrl: requestBase.baseUrl,
    fallbackBaseUrl: envBase.baseUrl,
    httpPort: safeHttpPort,
    httpsPort: safeHttpsPort,
    httpsEnabled
  });
  const baseUrlSource = forcedClientOrigin
    ? 'client'
    : (requestBase.baseUrl ? requestBase.source : envBase.source);
  const links = buildLanLinks({
    addresses,
    httpPort,
    httpsPort,
    httpsEnabled
  });
  const secureBaseUrl = resolvedBaseUrl;
  const secureLoginUrl = toLoginUrl(secureBaseUrl);
  const basicBaseUrl = buildHttpFallbackBaseUrl({
    secureBaseUrl,
    httpPort,
    httpEnabled
  });
  const basicLoginUrl = toLoginUrl(basicBaseUrl);
  const basicQrDataUrl = secureLoginUrl
    ? await QRCode.toDataURL(secureLoginUrl, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 224
    })
    : '';

  return {
    ok: true,
    host,
    httpPort: safeHttpPort,
    httpsPort: safeHttpsPort,
    httpsEnabled: Boolean(httpsEnabled),
    tlsMode: String(tlsMode || 'off'),
    turnRequired: Boolean(turnRequired),
    turnConfigured: Boolean(turnConfigured),
    links,
    currentOriginDetected: String(forcedClientOrigin || requestBase.detectedBaseUrl || ''),
    requestBaseUrl: String(forcedClientOrigin || requestBase.baseUrl || ''),
    secureBaseUrl,
    secureLoginUrl,
    basicBaseUrl,
    basicLoginUrl,
    baseUrlSource,
    publicHttpsBaseUrl: normalizePublicHttpsBaseUrl(envBase.baseUrl),
    runtimeHints: detectRuntimeHints({
      httpPort: safeHttpPort,
      httpsPort: safeHttpsPort
    }),
    listeningPorts: [
      {
        name: 'http',
        host: String(host || '0.0.0.0'),
        port: safeHttpPort,
        enabled: Boolean(httpEnabled)
      },
      {
        name: 'https',
        host: String(host || '0.0.0.0'),
        port: safeHttpsPort,
        enabled: Boolean(httpsEnabled)
      }
    ],
    preferredUrl: secureBaseUrl,
    preferredLoginUrl: secureLoginUrl,
    basicQrTarget: secureLoginUrl,
    fullQrTarget: '',
    basicQrDataUrl,
    fullQrDataUrl: ''
  };
}

module.exports = {
  buildLanLinks,
  buildLanSystemPayload,
  isLoopbackHost,
  isRfc1918Ipv4,
  listLanIpv4Addresses,
  normalizePort,
  normalizePublicBaseUrl,
  normalizePublicHttpsBaseUrl,
  resolveRequestBaseUrl,
  detectRuntimeHints,
  parseProxyTrust,
  resolveTlsConfig
};
