const http = require('http');
const https = require('https');

const { createApp } = require('../app');
const {
  listLanIpv4Addresses,
  normalizePort,
  normalizePublicHttpsBaseUrl,
  parseProxyTrust,
  resolveTlsConfig
} = require('../utils/lanAccess');
const { resolveVoiceIceConfig } = require('../utils/voiceIce');
const { createVoiceRealtimeGateway } = require('../services/voiceRealtimeGateway');

const DEV_OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
const DOCKER_OLLAMA_BASE_URL = 'http://ollama:11434';

function formatPublicBaseUrl(protocol, host, port) {
  const safeHost = String(host || '').trim() || '0.0.0.0';
  return `${protocol}://${safeHost}:${Number(port)}`;
}

function normalizeBaseUrl(value, fallback = '') {
  return String(value || fallback || '').trim().replace(/\/+$/, '');
}

function normalizeOllamaHealthBase(baseUrl) {
  return normalizeBaseUrl(baseUrl, 'http://127.0.0.1:11434').replace(/\/v1$/, '');
}

function parseModelList(payload) {
  if (!payload || typeof payload !== 'object') {
    return [];
  }
  const models = Array.isArray(payload.models) ? payload.models : [];
  return models
    .map((entry) => String(entry?.name || entry?.model || '').trim())
    .filter(Boolean);
}

function looksLikeModelInstalled(installed, expected) {
  const normalizedExpected = String(expected || '').trim().toLowerCase();
  if (!normalizedExpected) {
    return false;
  }
  return installed.some((name) => {
    const normalized = String(name || '').trim().toLowerCase();
    return normalized === normalizedExpected
      || normalized.startsWith(`${normalizedExpected}:`)
      || normalizedExpected.startsWith(`${normalized}:`);
  });
}

function isDevMode() {
  return String(process.env.NODE_ENV || 'development').toLowerCase() !== 'production';
}

function isLikelyContainerRuntime() {
  return process.env.CONTAINER === '1'
    || process.env.DOCKER_CONTAINER === '1'
    || process.env.KUBERNETES_SERVICE_HOST !== undefined;
}

function resolveOllamaStartupBaseUrl(rawBase) {
  const explicit = String(rawBase || '').trim();
  if (explicit) {
    return {
      baseUrl: explicit,
      source: 'explicit'
    };
  }

  if (isDevMode()) {
    return {
      baseUrl: DEV_OLLAMA_BASE_URL,
      source: 'dev_default'
    };
  }

  if (isLikelyContainerRuntime()) {
    return {
      baseUrl: DOCKER_OLLAMA_BASE_URL,
      source: 'container_default'
    };
  }

  return {
    baseUrl: '',
    source: 'missing'
  };
}

async function warmupOllamaModel({ baseUrl, model }) {
  const warmupEnabled = String(process.env.SOKRATES_OLLAMA_WARMUP || (isDevMode() ? '1' : '0')) !== '0';
  if (!warmupEnabled) {
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    // Prefer /api/chat because some runtimes disable /api/generate.
    let response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          { role: 'system', content: 'Antworte nur mit "ok".' },
          { role: 'user', content: 'ok?' }
        ],
        options: {
          num_predict: 8,
          temperature: 0
        }
      }),
      signal: controller.signal
    });

    if (response.status === 404) {
      response = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          model,
          prompt: 'Antworte nur mit "ok".',
          stream: false,
          options: {
            num_predict: 8,
            temperature: 0
          }
        }),
        signal: controller.signal
      });
    }

    if (!response.ok) {
      console.warn(`[Apeiron] Sokrates Ollama warmup failed: ${response.status} (${baseUrl}/api/chat).`);
      return;
    }
    console.log(`[Apeiron] Sokrates Ollama warmup complete for model '${model}'.`);
  } catch (error) {
    const detail = error?.name === 'AbortError'
      ? 'timeout'
      : String(error?.message || 'unknown error').slice(0, 200);
    console.warn(`[Apeiron] Sokrates Ollama warmup failed: ${detail} (${baseUrl}/api/chat).`);
  } finally {
    clearTimeout(timeout);
  }
}

async function logAiProviderStartupHealth() {
  const mode = String(
    process.env.LLM_PROVIDER_MODE
    || process.env.LLM_PROVIDER
    || process.env.SOKRATES_PROVIDER
    || process.env.AI_PROVIDER
    || 'auto'
  ).trim().toLowerCase() || 'auto';
  const openAiConfigured = Boolean(String(process.env.OPENAI_API_KEY || process.env.LLM_API_KEY || '').trim());
  const ollamaBaseRaw = String(process.env.OLLAMA_BASE_URL || '').trim();
  const ollamaStartup = resolveOllamaStartupBaseUrl(ollamaBaseRaw);
  const ollamaModel = String(process.env.OLLAMA_MODEL || 'llama3.2:3b').trim() || 'llama3.2:3b';
  const ollamaHealthBase = normalizeOllamaHealthBase(ollamaStartup.baseUrl);

  console.log(`[Apeiron] Sokrates provider mode: ${mode} (openai=${openAiConfigured ? 'configured' : 'missing'}, ollama_model=${ollamaModel})`);

  if (!ollamaStartup.baseUrl) {
    console.warn('[Apeiron] Sokrates Ollama endpoint: OLLAMA_BASE_URL is not set.');
    return;
  }

  if (ollamaStartup.source === 'dev_default') {
    console.log(`[Apeiron] Sokrates Ollama endpoint: OLLAMA_BASE_URL is not set, using development default ${DEV_OLLAMA_BASE_URL}.`);
  } else if (ollamaStartup.source === 'container_default') {
    console.log(`[Apeiron] Sokrates Ollama endpoint: OLLAMA_BASE_URL is not set, using container default ${DOCKER_OLLAMA_BASE_URL}.`);
  }

  if (!ollamaHealthBase) {
    console.warn('[Apeiron] Sokrates Ollama endpoint is empty after normalization.');
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(`${ollamaHealthBase}/api/tags`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal
    });
    if (!response.ok) {
      console.warn(`[Apeiron] Sokrates Ollama health failed: ${response.status} from ${ollamaHealthBase}/api/tags`);
      return;
    }
    const payload = await response.json().catch(() => ({}));
    const models = parseModelList(payload);
    const installed = looksLikeModelInstalled(models, ollamaModel);
    if (installed) {
      console.log(`[Apeiron] Sokrates Ollama healthy: model '${ollamaModel}' is installed.`);
      await warmupOllamaModel({
        baseUrl: ollamaHealthBase,
        model: ollamaModel
      });
    } else {
      console.warn(`[Apeiron] Sokrates Ollama healthy, but model '${ollamaModel}' is missing. Installed models: ${models.slice(0, 6).join(', ') || '(none)'}.`);
    }
  } catch (error) {
    const detail = error?.name === 'AbortError'
      ? 'timeout'
      : String(error?.message || 'unknown error').slice(0, 200);
    console.warn(`[Apeiron] Sokrates Ollama health failed: ${detail} (${ollamaHealthBase}/api/tags)`);
  } finally {
    clearTimeout(timeout);
  }
}

function startServers() {
  const host = String(process.env.HOST || '0.0.0.0').trim() || '0.0.0.0';
  const httpPort = normalizePort(process.env.HTTP_PORT || process.env.PORT, 3000);
  const httpsPort = normalizePort(process.env.HTTPS_PORT, 3443);
  const trustProxy = parseProxyTrust(process.env.TRUST_PROXY || '');
  const tls = resolveTlsConfig({ host });
  const voiceRequiresSecureOrigin = String(process.env.VOICE_REQUIRE_SECURE_ORIGIN || '1') !== '0';
  const externalHttpsBaseUrl = normalizePublicHttpsBaseUrl(
    process.env.APEIRON_PUBLIC_BASE_URL
      || process.env.LAN_PUBLIC_HTTPS_URL
      || process.env.PUBLIC_HTTPS_BASE_URL
      || process.env.PUBLIC_BASE_URL
  );
  const voiceIce = resolveVoiceIceConfig();
  const app = createApp({
    trustProxy,
    secureCookiesAuto: true
  });
  const voiceRealtimePath = '/app/voice/realtime';

  app.locals.network = {
    host,
    httpPort,
    httpEnabled: true,
    httpsPort,
    httpsEnabled: Boolean(tls.enabled),
    tlsMode: String(tls.mode || 'off'),
    trustProxy,
    externalHttpsBaseUrl,
    voiceRequiresSecureOrigin,
    voiceRealtimePath,
    voiceRequireTurn: Boolean(voiceIce.turnRequired),
    turnConfigured: Boolean(voiceIce.turnConfigured),
    voiceIceServers: Array.isArray(voiceIce.iceServers) ? voiceIce.iceServers : [],
    voiceTurnError: String(voiceIce.error || '')
  };

  const httpServer = http.createServer(app);
  const voiceRealtimeGateway = createVoiceRealtimeGateway({
    app,
    path: voiceRealtimePath
  });
  voiceRealtimeGateway.attachToServer(httpServer);
  const lanIps = listLanIpv4Addresses().map((entry) => entry.address);
  httpServer.listen(httpPort, host, () => {
    console.log(`[Apeiron] HTTP listening on ${formatPublicBaseUrl('http', host, httpPort)}`);
    if (lanIps.length) {
      console.log(`[Apeiron] LAN basic URLs: ${lanIps.map((ip) => `http://${ip}:${httpPort}`).join(', ')}`);
    }
  });

  let httpsServer = null;
  if (tls.enabled) {
    httpsServer = https.createServer({
      key: tls.key,
      cert: tls.cert
    }, app);
    voiceRealtimeGateway.attachToServer(httpsServer);
    httpsServer.listen(httpsPort, host, () => {
      console.log(`[Apeiron] HTTPS listening on ${formatPublicBaseUrl('https', host, httpsPort)} (${tls.mode}${tls.generatedSelfSigned ? ', generated self-signed cert' : ''})`);
      if (externalHttpsBaseUrl) {
        console.log(`[Apeiron] Public HTTPS base URL: ${externalHttpsBaseUrl}`);
      }
      if (lanIps.length) {
        console.log(`[Apeiron] LAN full URLs: ${lanIps.map((ip) => `https://${ip}:${httpsPort}`).join(', ')}`);
      }
    });
  } else if (tls.error) {
    console.warn(`[Apeiron] HTTPS disabled: ${tls.error}`);
  } else {
    console.warn('[Apeiron] HTTPS disabled (set HTTPS_ENABLED=1 and TLS_* variables, or TLS_MODE=self-signed)');
  }
  console.log(`[Apeiron] Voice realtime WS path: ${voiceRealtimePath}`);
  if (voiceIce.turnRequired && !voiceIce.turnConfigured) {
    console.error(`[Apeiron] Voice blocked: TURN is required but not configured (${voiceIce.error}).`);
  }
  void logAiProviderStartupHealth();

  return {
    app,
    httpServer,
    httpsServer
  };
}

module.exports = {
  startServers
};
