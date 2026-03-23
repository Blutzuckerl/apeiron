const path = require('path');
const fs = require('fs');
const net = require('net');
const express = require('express');
const session = require('express-session');

const { authRouter } = require('./routes/auth');
const { appRouter } = require('./routes/app');
const { runMigrations } = require('./db/migrate');
const { requireAuth, attachUser } = require('./middleware/auth');
const { flashMiddleware } = require('./middleware/flash');
const { getUserSettings, listServersForUser, canManageServer } = require('./db/repositories');
const { getSokratesStatus } = require('./services/sokrates');
const { touchRequestPresence } = require('./services/presence');
const {
  buildLanSystemPayload,
  isLoopbackHost,
  normalizePort,
  normalizePublicBaseUrl
} = require('./utils/lanAccess');

function isDevMode() {
  return String(process.env.NODE_ENV || 'development').toLowerCase() !== 'production';
}

function canAccessLanApi(req) {
  if (!req.session.userId || !req.currentUser) {
    return false;
  }
  if (isDevMode() || process.env.APP_TEST_MODE === '1') {
    return true;
  }
  const servers = listServersForUser(req.session.userId);
  return servers.some((server) => canManageServer(server.id, req.session.userId));
}

function parseBooleanEnv(value, fallback = false) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) {
    return Boolean(fallback);
  }
  if (['1', 'true', 'yes', 'on'].includes(raw)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(raw)) {
    return false;
  }
  return Boolean(fallback);
}

function extractHostnameFromHostHeader(hostHeader) {
  const raw = String(hostHeader || '').trim();
  if (!raw) {
    return '';
  }
  if (raw.startsWith('[')) {
    const end = raw.indexOf(']');
    return end > 1 ? raw.slice(1, end) : '';
  }
  const colonIndex = raw.indexOf(':');
  if (colonIndex === -1) {
    return raw;
  }
  return raw.slice(0, colonIndex);
}

async function probeTcpPort({ host = '', port = 0, timeoutMs = 1200 } = {}) {
  const safeHost = String(host || '').trim();
  const safePort = Number(port || 0);
  if (!safeHost || !Number.isFinite(safePort) || safePort <= 0 || safePort > 65535) {
    return {
      host: safeHost,
      port: safePort,
      ok: false,
      rttMs: 0,
      error: 'invalid_target'
    };
  }

  const startedAt = Date.now();
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (payload) => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      resolve({
        host: safeHost,
        port: safePort,
        rttMs: Math.max(0, Date.now() - startedAt),
        ...payload
      });
    };

    socket.setTimeout(Math.max(250, Number(timeoutMs) || 1200));
    socket.once('connect', () => finish({ ok: true, error: '' }));
    socket.once('timeout', () => finish({ ok: false, error: 'timeout' }));
    socket.once('error', (error) => {
      finish({
        ok: false,
        error: String(error?.code || error?.message || 'tcp_error')
      });
    });
    socket.connect(safePort, safeHost);
  });
}

function resolveClientOrigin(req) {
  const headerOrigin = normalizePublicBaseUrl(req.get('x-apeiron-origin'));
  if (headerOrigin) {
    return headerOrigin;
  }
  const queryOrigin = normalizePublicBaseUrl(req.query?.origin);
  if (queryOrigin) {
    return queryOrigin;
  }
  const fallback = normalizePublicBaseUrl(`${req.protocol}://${req.get('host')}`);
  return fallback || '';
}

function createApp(options = {}) {
  const trustProxy = options.trustProxy ?? false;
  const secureCookiesAuto = options.secureCookiesAuto !== false;
  const forceHttps = parseBooleanEnv(process.env.FORCE_HTTPS, false);
  const forceHttpsAllowLoopback = parseBooleanEnv(process.env.FORCE_HTTPS_ALLOW_LOCALHOST, true);
  const httpsRedirectPort = normalizePort(
    process.env.HTTPS_REDIRECT_PORT || process.env.HTTPS_PORT || 443,
    443
  );
  runMigrations();
  const app = express();

  if (trustProxy) {
    app.set('trust proxy', trustProxy);
  }

  app.set('view engine', 'ejs');
  app.set('views', path.join(process.cwd(), 'views'));

  app.use('/public', express.static(path.join(process.cwd(), 'public')));
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
  app.use(express.urlencoded({ extended: false, limit: '10mb' }));
  app.use(express.json({ limit: '20mb' }));

  if (forceHttps) {
    app.use((req, res, next) => {
      if (req.secure) {
        return next();
      }

      const hostHeader = String(req.get('x-forwarded-host') || req.get('host') || '').split(',')[0].trim();
      const hostname = extractHostnameFromHostHeader(hostHeader) || String(req.hostname || '').trim() || 'localhost';
      if (forceHttpsAllowLoopback && isLoopbackHost(hostname)) {
        return next();
      }

      const includePort = httpsRedirectPort > 0 && httpsRedirectPort !== 443;
      const targetHost = includePort ? `${hostname}:${httpsRedirectPort}` : hostname;
      const targetUrl = `https://${targetHost}${req.originalUrl || req.url || '/'}`;
      return res.redirect(308, targetUrl);
    });
  }

  const sessionMiddleware = session({
    name: 'apeiron.sid',
    secret: process.env.SESSION_SECRET || 'apeiron-session-secret',
    resave: false,
    saveUninitialized: false,
    proxy: Boolean(trustProxy),
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: secureCookiesAuto ? 'auto' : false,
      maxAge: 1000 * 60 * 60 * 24
    }
  });
  app.locals.sessionMiddleware = sessionMiddleware;
  app.use(sessionMiddleware);

  app.use(attachUser);
  app.use((req, _res, next) => {
    if (req.currentUser) {
      const presence = touchRequestPresence(req.currentUser.id, {
        manualStatus: req.currentUser.presence_status
      });
      req.currentUser.effective_presence = presence.status;
      req.currentUser.presence_last_seen = presence.last_seen;
    }
    next();
  });
  app.use(flashMiddleware);

  app.use((req, res, next) => {
    res.locals.currentUser = req.currentUser;
    res.locals.uiPrefs = req.currentUser ? getUserSettings(req.currentUser.id) : null;
    res.locals.appTestMode = process.env.APP_TEST_MODE === '1';
    res.locals.network = req.app.locals.network || {
      host: process.env.HOST || '0.0.0.0',
      httpPort: Number(process.env.HTTP_PORT || process.env.PORT || 3000),
      httpsPort: Number(process.env.HTTPS_PORT || 3443),
      httpsEnabled: false,
      tlsMode: 'off',
      trustProxy,
      voiceRequiresSecureOrigin: String(process.env.VOICE_REQUIRE_SECURE_ORIGIN || '1') !== '0',
      voiceRealtimePath: '/app/voice/realtime',
      voiceRequireTurn: String(process.env.VOICE_REQUIRE_TURN || '1') !== '0',
      turnConfigured: Boolean(process.env.TURN_URLS || process.env.TURN_URL),
      voiceIceServers: []
    };
    next();
  });

  app.get('/', (req, res) => {
    if (req.session.userId) {
      return res.redirect('/app/home');
    }
    return res.redirect('/login');
  });

  app.get(['/ai/status', '/health/ai'], async (req, res) => {
    const availability = await getSokratesStatus({
      userSettings: req.currentUser ? getUserSettings(req.currentUser.id) : null
    });
    return res.json({
      ok: true,
      configured: availability.configured,
      available: availability.available,
      provider: availability.provider || '',
      selectedProvider: availability.selectedProvider || '',
      model: availability.model || '',
      activeMode: availability.activeMode || 'auto',
      active_mode: availability.activeMode || 'auto',
      auto_order: availability.autoOrder || ['openai', 'ollama'],
      fallback_reason: availability.fallbackReason || '',
      openai_configured: availability.openaiConfigured === true,
      openai_reachable: availability.openaiReachable === true,
      openai_circuit_open: availability.openaiCircuitOpen === true,
      openai_circuit_until: Number(availability.openaiCircuitUntil || 0),
      openai_circuit_remaining_ms: Number(availability.openaiCircuitRemainingMs || 0),
      openai_circuit_code: availability.openaiCircuitCode || '',
      ollama_configured: availability.ollamaConfigured === true,
      ollama_reachable: availability.ollamaReachable === true,
      ollama_model_present: availability.ollamaModelPresent === true,
      ollama_models: Array.isArray(availability.ollamaModels) ? availability.ollamaModels : [],
      openai_model: availability.openaiModel || '',
      ollama_model: availability.ollamaModel || '',
      code: availability.code || '',
      message: availability.message || '',
      detail: availability.detail || ''
    });
  });

  app.get('/health/ollama', async (req, res) => {
    const availability = await getSokratesStatus({
      userSettings: req.currentUser ? getUserSettings(req.currentUser.id) : null
    });
    const ok = availability.ollamaConfigured && availability.ollamaReachable && availability.ollamaModelPresent;
    return res.status(ok ? 200 : 503).json({
      ok,
      configured: availability.ollamaConfigured === true,
      reachable: availability.ollamaReachable === true,
      model: availability.ollamaModel || '',
      modelPresent: availability.ollamaModelPresent === true,
      models: Array.isArray(availability.ollamaModels) ? availability.ollamaModels : [],
      reason: ok
        ? ''
        : (
          !availability.ollamaConfigured
            ? 'OLLAMA_BASE_URL_MISSING'
            : (!availability.ollamaReachable ? 'OLLAMA_CONN_REFUSED' : 'OLLAMA_MODEL_MISSING')
        )
    });
  });

  app.get('/health', (_req, res) => {
    return res.status(200).json({
      ok: true,
      service: 'apeiron'
    });
  });
  app.get('/healthz', (_req, res) => {
    return res.status(200).json({
      ok: true,
      service: 'apeiron',
      endpoint: 'healthz'
    });
  });

  app.get('/ca', (_req, res) => {
    const caPath = String(process.env.APEIRON_CA_CERT_PATH || process.env.TLS_CA_CERT || '').trim();
    const hasCaFile = Boolean(caPath) && fs.existsSync(path.resolve(process.cwd(), caPath));
    const html = `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Apeiron LAN TLS Trust</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 900px; margin: 24px auto; padding: 0 16px; line-height: 1.45; }
    code, pre { background: #f2f2f2; border-radius: 6px; padding: 2px 6px; }
    pre { padding: 10px; overflow: auto; }
  </style>
</head>
<body>
  <h1>Apeiron LAN TLS Trust</h1>
  <p>Fuer Android/iOS Voice im LAN brauchst du eine vertraute lokale CA (z. B. mkcert) und ein Zertifikat mit IP-SAN (z. B. 172.29.40.90).</p>
  <ol>
    <li>CA auf Handy installieren (Android: Nutzerzertifikat, iOS: Profil installieren + Full Trust aktivieren).</li>
    <li>Apeiron HTTPS mit diesem Zertifikat starten (Port 3443 oder euer HTTPS-Port).</li>
    <li>Danach <code>https://&lt;LAN-IP&gt;:&lt;HTTPS-PORT&gt;/login</code> direkt am Handy testen.</li>
  </ol>
  <p>CA Download: ${hasCaFile ? '<a href="/ca/download">/ca/download</a>' : 'nicht konfiguriert (setze APEIRON_CA_CERT_PATH oder TLS_CA_CERT)'}</p>
  <h2>WSL Portproxy (PowerShell als Admin)</h2>
  <pre>netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=3443 connectaddress=&lt;WSL_IP&gt; connectport=3443
netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=3000 connectaddress=&lt;WSL_IP&gt; connectport=3000</pre>
</body>
</html>`;
    res.type('html').status(200).send(html);
  });

  app.get('/ca/download', (_req, res) => {
    const caPath = String(process.env.APEIRON_CA_CERT_PATH || process.env.TLS_CA_CERT || '').trim();
    if (!caPath) {
      return res.status(404).json({ ok: false, error: 'ca_path_not_configured' });
    }
    const absolutePath = path.resolve(process.cwd(), caPath);
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ ok: false, error: 'ca_file_missing' });
    }
    return res.download(absolutePath, path.basename(absolutePath));
  });

  app.get('/api/system/lan', async (req, res) => {
    if (!req.session.userId || !req.currentUser) {
      return res.status(401).json({ ok: false, error: 'auth_required' });
    }
    if (!canAccessLanApi(req)) {
      return res.status(403).json({ ok: false, error: 'permission_denied' });
    }

    try {
      const network = req.app.locals.network || {};
      const clientOrigin = resolveClientOrigin(req);
      const payload = await buildLanSystemPayload({
        host: network.host || process.env.HOST || '0.0.0.0',
        httpPort: network.httpPort || process.env.HTTP_PORT || process.env.PORT || 3000,
        httpsPort: network.httpsPort || process.env.HTTPS_PORT || 3443,
        httpsEnabled: Boolean(network.httpsEnabled),
        tlsMode: network.tlsMode || 'off',
        req,
        trustProxy: network.trustProxy ?? req.app.get('trust proxy'),
        clientOrigin,
        httpEnabled: network.httpEnabled !== false,
        turnRequired: network.voiceRequireTurn,
        turnConfigured: network.turnConfigured
      });
      return res.json(payload);
    } catch (error) {
      return res.status(500).json({
        ok: false,
        error: 'lan_info_failed',
        message: String(error?.message || 'Could not build LAN info payload.')
      });
    }
  });

  app.get('/api/system/lan/self-test', async (req, res) => {
    if (!req.session.userId || !req.currentUser) {
      return res.status(401).json({ ok: false, error: 'auth_required' });
    }
    if (!canAccessLanApi(req)) {
      return res.status(403).json({ ok: false, error: 'permission_denied' });
    }

    try {
      const network = req.app.locals.network || {};
      const clientOrigin = resolveClientOrigin(req);
      const payload = await buildLanSystemPayload({
        host: network.host || process.env.HOST || '0.0.0.0',
        httpPort: network.httpPort || process.env.HTTP_PORT || process.env.PORT || 3000,
        httpsPort: network.httpsPort || process.env.HTTPS_PORT || 3443,
        httpsEnabled: Boolean(network.httpsEnabled),
        tlsMode: network.tlsMode || 'off',
        req,
        trustProxy: network.trustProxy ?? req.app.get('trust proxy'),
        clientOrigin,
        httpEnabled: network.httpEnabled !== false,
        turnRequired: network.voiceRequireTurn,
        turnConfigured: network.turnConfigured
      });

      const probeHost = (() => {
        const secureBase = String(payload.currentOriginDetected || payload.secureBaseUrl || '').trim();
        if (!secureBase) {
          return '';
        }
        try {
          return new URL(secureBase).hostname;
        } catch (_error) {
          return '';
        }
      })();
      const httpPort = Number(payload.httpPort || 0);
      const httpsPort = Number(payload.httpsPort || 0);
      const [tcpHttpProbe, tcpHttpsProbe] = await Promise.all([
        probeTcpPort({ host: probeHost, port: httpPort }),
        probeTcpPort({ host: probeHost, port: httpsPort })
      ]);

      return res.json({
        ok: true,
        baseUrl: payload.secureBaseUrl || '',
        source: payload.baseUrlSource || 'none',
        currentOriginDetected: payload.currentOriginDetected || '',
        listeningPorts: Array.isArray(payload.listeningPorts) ? payload.listeningPorts : [],
        runtimeHints: payload.runtimeHints || {},
        probes: {
          tcp_http: tcpHttpProbe,
          tcp_https: tcpHttpsProbe
        }
      });
    } catch (error) {
      return res.status(500).json({
        ok: false,
        error: 'lan_self_test_failed',
        message: String(error?.message || 'Could not run LAN self-test.')
      });
    }
  });

  app.use(authRouter);
  app.use('/app', requireAuth, appRouter);

  app.use((req, res) => {
    res.status(404).render('pages/error', {
      title: 'Nicht gefunden',
      code: 404,
      message: 'Diese Seite existiert nicht.',
      currentUser: req.currentUser
    });
  });

  return app;
}

module.exports = { createApp };
