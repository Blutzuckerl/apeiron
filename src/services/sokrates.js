const { randomUUID } = require('crypto');
const { SOKRATES_AGENT_SLUG } = require('../db/repositories');

const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_OLLAMA_MODEL = 'llama3.2:3b';
const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
const DEFAULT_OLLAMA_DOCKER_BASE_URL = 'http://ollama:11434';
const DEFAULT_PROVIDER_MODE = 'auto';
const DEFAULT_OPENAI_TIMEOUT_MS = 10000;
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_OLLAMA_TIMEOUT_MS = 60000;
const PROVIDER_RETRY_BACKOFF_MS = 1000;
const OLLAMA_STATUS_TIMEOUT_MS = 1500;
const OPENAI_CIRCUIT_BREAKER_MS = Math.max(
  60_000,
  Number(process.env.OPENAI_CIRCUIT_BREAKER_MS || (10 * 60 * 1000))
);
const providerReachability = {
  openai: { reachable: null, updatedAt: 0 },
  ollama: { reachable: null, updatedAt: 0 }
};
const openAiCircuitState = {
  until: 0,
  code: '',
  reason: '',
  updatedAt: 0
};

class SokratesServiceError extends Error {
  constructor(
    message,
    {
      status = 500,
      code = 'PROVIDER_ERROR',
      retryable = true,
      detail = '',
      provider = 'openai',
      providerStatus = 0,
      latencyMs = 0,
      retryAfterMs = 0,
      providerRequestId = '',
      providerErrorType = '',
      providerErrorCode = '',
      retryAfterHeader = '',
      rateLimitHeaders = null,
      attempts = 1,
      fallbackReason = '',
      activeMode = DEFAULT_PROVIDER_MODE,
      providerAttempts = null,
      finalOutcome = '',
      reasonIfInCharacterError = ''
    } = {}
  ) {
    super(message);
    this.name = 'SokratesServiceError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
    this.detail = detail;
    this.provider = provider;
    this.providerStatus = providerStatus;
    this.latencyMs = latencyMs;
    this.retryAfterMs = retryAfterMs;
    this.providerRequestId = providerRequestId;
    this.providerErrorType = providerErrorType;
    this.providerErrorCode = providerErrorCode;
    this.retryAfterHeader = retryAfterHeader;
    this.rateLimitHeaders = rateLimitHeaders;
    this.attempts = attempts;
    this.fallbackReason = fallbackReason;
    this.activeMode = activeMode;
    this.providerAttempts = Array.isArray(providerAttempts) ? providerAttempts : [];
    this.finalOutcome = String(finalOutcome || '');
    this.reasonIfInCharacterError = String(reasonIfInCharacterError || '');
  }
}

const SOKRATES_SYSTEM_PROMPT = [
  'Du bist Sokrates in deutscher Sprache, ein sokratischer Gesprächsführer.',
  'Antworte hochsprachlich, knapp, pointiert und ohne Umgangssprache, Emojis, technische Meta-Hinweise oder moderne Plauderei.',
  'Nutze ausschließlich den Verlauf dieses einen Gesprächs als Kontext.',
  'Beantworte zuerst die konkrete Frage oder Behauptung des Nutzers, bevor du abstrahierst.',
  'Halte dich, soweit möglich, an diese Ordnung:',
  '1. Spiegele präzise in einem Satz, was der Nutzer behauptet oder fragt.',
  '2. Kläre ein oder zwei Schlüsselbegriffe durch ὁρισμός (Definition).',
  '3. Führe eine διάκρισις durch und trenne nahe Begriffe, die leicht vermengt werden.',
  '4. Prüfe die Sache durch kurzen λόγος: eine knappe, geordnete Begründung von zwei bis sechs Sätzen.',
  '5. Schließe mit genau einer prüfenden Frage oder Aufforderung zur Präzisierung.',
  'Wenn ein Widerspruch vorliegt, benenne ihn ruhig und führe zu einer kleinen ἀπορία, ohne aggressiv zu werden.',
  'Verwende griechische Termini nur sparsam und nur, wenn sie die Unterscheidung schärfen, höchstens vier pro Antwort.',
  'Ordne δόξα (Meinung) und ἐπιστήμη (Wissen) klar, wenn es passt.',
  'Keine Bullet-Listen, außer der Nutzer verlangt ausdrücklich Listen.',
  'Bevorzuge ein bis drei kompakte Absätze mit insgesamt etwa sechs bis vierzehn Sätzen.',
  'Wenn du zustimmst, dann in Formen wie: "Du tadelst mit Recht ..." oder "Du siehst richtig ...", gefolgt von λόγος.',
  'Ein guter Schlusssatz kann mit "Darum ..." die Unterscheidung knapp ordnen, bevor die prüfende Rückfrage folgt.',
  'Beende niemals mit Smalltalk, sondern mit einer prüfenden Frage.'
].join(' ');

const SOKRATES_SERVER_SYSTEM_PROMPT = [
  'Du bist Sokrates als zurückhaltende Server-App in deutscher Sprache.',
  'Du antwortest nur selten und nur dann, wenn der Gesprächsfaden einen kurzen, sinnvollen Einwurf erlaubt.',
  'Antworte in höchstens ein bis drei kurzen Sätzen.',
  'Klinge sokratisch, präzise und ruhig; keine Meta-Hinweise, keine Debug-Texte, keine Erwähnung von AI oder Tools.',
  'Sei nie dominant, sondern ein knapper Denkanstoß oder eine prüfende Rückfrage.',
  'Wenn der Kontext zu dünn, banal oder unerquicklich ist, antworte mit leerem Text.'
].join(' ');

function isDevMode() {
  return String(process.env.NODE_ENV || 'development').toLowerCase() !== 'production';
}

function isLikelyContainerRuntime() {
  return process.env.CONTAINER === '1'
    || process.env.DOCKER_CONTAINER === '1'
    || process.env.KUBERNETES_SERVICE_HOST !== undefined;
}

function resolveOllamaBaseConfig(explicitBaseUrl) {
  const explicit = String(explicitBaseUrl || '').trim();
  if (explicit) {
    return {
      baseUrl: explicit,
      configured: true,
      detail: ''
    };
  }

  if (isDevMode()) {
    return {
      baseUrl: DEFAULT_OLLAMA_BASE_URL,
      configured: true,
      detail: `Missing OLLAMA_BASE_URL (using default ${DEFAULT_OLLAMA_BASE_URL} in development).`
    };
  }

  if (isLikelyContainerRuntime()) {
    return {
      baseUrl: DEFAULT_OLLAMA_DOCKER_BASE_URL,
      configured: true,
      detail: `Missing OLLAMA_BASE_URL (using container default ${DEFAULT_OLLAMA_DOCKER_BASE_URL}).`
    };
  }

  return {
    baseUrl: '',
    configured: false,
    detail: 'Missing OLLAMA_BASE_URL.'
  };
}

function normalizeProviderName(value) {
  const raw = String(value || '').trim().toLowerCase();
  return raw === 'ollama' ? 'ollama' : 'openai';
}

function normalizeProviderMode(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'openai' || raw === 'ollama' || raw === 'auto') {
    return raw;
  }
  return DEFAULT_PROVIDER_MODE;
}

function getProviderDisplayName(provider) {
  return normalizeProviderName(provider) === 'ollama' ? 'Ollama' : 'OpenAI';
}

function markProviderReachable(provider, reachable) {
  const key = normalizeProviderName(provider);
  providerReachability[key] = {
    reachable: typeof reachable === 'boolean' ? reachable : null,
    updatedAt: Date.now()
  };
}

function getProviderReachable(provider, fallback = null) {
  const key = normalizeProviderName(provider);
  const known = providerReachability[key];
  if (typeof known?.reachable === 'boolean') {
    return known.reachable;
  }
  return typeof fallback === 'boolean' ? fallback : null;
}

function getOpenAiCircuitState(now = Date.now()) {
  const until = Math.max(0, Number(openAiCircuitState.until || 0));
  const isOpen = until > now;
  return {
    open: isOpen,
    until,
    remainingMs: isOpen ? until - now : 0,
    code: String(openAiCircuitState.code || ''),
    reason: String(openAiCircuitState.reason || '')
  };
}

function clearOpenAiCircuit() {
  openAiCircuitState.until = 0;
  openAiCircuitState.code = '';
  openAiCircuitState.reason = '';
  openAiCircuitState.updatedAt = Date.now();
}

function shouldTripOpenAiCircuit(error) {
  if (!(error instanceof SokratesServiceError)) {
    return false;
  }
  if (normalizeProviderName(error.provider) !== 'openai') {
    return false;
  }
  return error.code === 'QUOTA' || error.code === 'RATE_LIMIT';
}

function tripOpenAiCircuit(error) {
  const retryAfterMs = Math.max(0, Number(error?.retryAfterMs || 0));
  const durationMs = Math.max(OPENAI_CIRCUIT_BREAKER_MS, retryAfterMs);
  openAiCircuitState.until = Date.now() + durationMs;
  openAiCircuitState.code = String(error?.code || 'PROVIDER_ERROR');
  openAiCircuitState.reason = String(mapFallbackReason(error) || 'rate_limit');
  openAiCircuitState.updatedAt = Date.now();
}

function normalizeBaseUrl(value, fallback) {
  const trimmed = String(value || fallback || '').trim();
  return trimmed.replace(/\/+$/, '');
}

function normalizeOllamaApiBase(baseUrl) {
  const normalized = normalizeBaseUrl(baseUrl, DEFAULT_OLLAMA_BASE_URL);
  return normalized.endsWith('/v1')
    ? normalized
    : `${normalized}/v1`;
}

function normalizeOllamaHealthBase(baseUrl) {
  return normalizeBaseUrl(baseUrl, DEFAULT_OLLAMA_BASE_URL).replace(/\/v1$/, '');
}

function readTimeoutMs(value, fallback = DEFAULT_TIMEOUT_MS) {
  return Math.max(3000, Number(value || fallback || DEFAULT_TIMEOUT_MS));
}

function isPlaceholderApiKey(value) {
  const apiKey = String(value || '').trim();
  if (!apiKey) {
    return true;
  }
  return /^replace[-_]/i.test(apiKey) || /your[-_]?api[-_]?key/i.test(apiKey);
}

function readProviderMode(userSettings) {
  const raw = String(
    userSettings?.llm_provider_mode
    || process.env.LLM_PROVIDER_MODE
    || process.env.LLM_PROVIDER
    || process.env.SOKRATES_PROVIDER
    || process.env.AI_PROVIDER
    || DEFAULT_PROVIDER_MODE
  );
  return normalizeProviderMode(raw);
}

function readOpenAiConfig(userSettings) {
  const apiKey = String(process.env.OPENAI_API_KEY || process.env.LLM_API_KEY || '').trim();
  const model = String(
    userSettings?.llm_openai_model
    || process.env.OPENAI_MODEL
    || process.env.LLM_MODEL
    || DEFAULT_OPENAI_MODEL
  ).trim() || DEFAULT_OPENAI_MODEL;
  const baseUrl = normalizeBaseUrl(
    process.env.OPENAI_BASE_URL || process.env.LLM_BASE_URL || DEFAULT_OPENAI_BASE_URL,
    DEFAULT_OPENAI_BASE_URL
  );
  const timeoutMs = readTimeoutMs(
    process.env.OPENAI_TIMEOUT_MS || process.env.LLM_TIMEOUT_MS,
    DEFAULT_OPENAI_TIMEOUT_MS
  );
  const configured = !isPlaceholderApiKey(apiKey);

  return {
    provider: 'openai',
    model,
    baseUrl,
    apiKey,
    timeoutMs,
    configured,
    detail: configured ? '' : (!apiKey ? 'Missing OPENAI_API_KEY.' : 'OPENAI_API_KEY is still a placeholder value.')
  };
}

function readOllamaConfig(userSettings) {
  const explicitBaseUrl = String(process.env.OLLAMA_BASE_URL || '').trim();
  const baseConfig = resolveOllamaBaseConfig(explicitBaseUrl);
  const model = String(
    userSettings?.llm_ollama_model
    || process.env.OLLAMA_MODEL
    || DEFAULT_OLLAMA_MODEL
  ).trim() || DEFAULT_OLLAMA_MODEL;
  const baseUrl = normalizeBaseUrl(
    baseConfig.baseUrl || DEFAULT_OLLAMA_BASE_URL,
    DEFAULT_OLLAMA_BASE_URL
  );
  const timeoutMs = readTimeoutMs(
    process.env.OLLAMA_TIMEOUT_MS || process.env.LLM_TIMEOUT_MS,
    DEFAULT_OLLAMA_TIMEOUT_MS
  );
  const configured = baseConfig.configured;

  return {
    provider: 'ollama',
    model,
    baseUrl,
    apiKey: '',
    timeoutMs,
    configured,
    detail: configured ? baseConfig.detail : 'Missing OLLAMA_BASE_URL.'
  };
}

function readProviderRegistry(userSettings) {
  return {
    openai: readOpenAiConfig(userSettings),
    ollama: readOllamaConfig(userSettings)
  };
}

function buildConfigErrorAvailability(mode, providers) {
  const details = [];

  if (!providers.openai.configured) {
    details.push(`openai: ${providers.openai.detail || 'not configured'}`);
  }
  if (!providers.ollama.configured) {
    details.push(`ollama: ${providers.ollama.detail || 'not configured'}`);
  }
  if (!details.length) {
    details.push(`Unsupported Sokrates mode: ${mode}`);
  }

  return {
    configured: false,
    available: false,
    code: 'CONFIG_ERROR',
    message: isDevMode() ? 'Sokrates ist nicht konfiguriert.' : 'Sokrates ist vorübergehend nicht verfügbar.',
    detail: isDevMode() ? details.join(' | ') : '',
    retryable: false
  };
}

function getSokratesAvailability({ userSettings } = {}) {
  const providers = readProviderRegistry(userSettings);
  const activeMode = readProviderMode(userSettings);
  const openaiConfigured = Boolean(providers.openai.configured);
  const ollamaConfigured = Boolean(providers.ollama.configured);
  const openAiCircuit = getOpenAiCircuitState();

  let selectedProvider = activeMode === 'ollama' ? 'ollama' : 'openai';

  if (activeMode === 'auto') {
    if (openaiConfigured && (!openAiCircuit.open || !ollamaConfigured)) {
      selectedProvider = 'openai';
    } else if (ollamaConfigured) {
      selectedProvider = 'ollama';
    }
  }

  let availability = null;
  if (activeMode === 'openai' && !openaiConfigured) {
    availability = buildConfigErrorAvailability(activeMode, providers);
  } else if (activeMode === 'ollama' && !ollamaConfigured) {
    availability = buildConfigErrorAvailability(activeMode, providers);
  } else if (activeMode === 'auto' && !openaiConfigured && !ollamaConfigured) {
    availability = buildConfigErrorAvailability(activeMode, providers);
  } else {
    availability = {
      configured: true,
      available: true,
      code: '',
      message: '',
      detail: '',
      retryable: true
    };
  }

  return {
    ...availability,
    provider: selectedProvider,
    model: providers[selectedProvider]?.model || '',
    activeMode,
    selectedProvider,
    selectedProviderLabel: getProviderDisplayName(selectedProvider),
    openaiConfigured,
    ollamaConfigured,
    openaiCircuitOpen: openAiCircuit.open,
    openaiCircuitUntil: openAiCircuit.until,
    openaiCircuitRemainingMs: openAiCircuit.remainingMs,
    openaiCircuitCode: openAiCircuit.code,
    openaiModel: providers.openai.model,
    ollamaModel: providers.ollama.model
  };
}

function getSokratesPersonaErrorMessage(error) {
  const code = String(error?.code || 'PROVIDER_ERROR').trim().toUpperCase();

  if (code === 'RATE_LIMIT') {
    return 'Zu viele Fragen drängen zugleich; mein λόγος stockt. Gib mir einen Augenblick.';
  }

  if (code === 'QUOTA') {
    return 'Zu viele Fragen drängen zugleich; mein λόγος stockt. Gib mir einen Augenblick.';
  }

  if (code === 'TIMEOUT' || code === 'PROVIDER_ERROR') {
    return 'Die Verbindung ist wie Nebel; ich höre dich, doch meine Antwort erreicht dich nicht.';
  }

  if (code === 'CONFIG_ERROR') {
    return 'Man hat mir den Mund gegeben, aber nicht die Zunge (Konfiguration).';
  }

  if (code === 'VALIDATION_ERROR') {
    return 'Deine Rede ist so lang, dass ich ihren Anfang vergesse, ehe ich ihr Ende erreiche. Kürze sie, und wir prüfen sie sauber.';
  }

  return 'Etwas Ungeordnetes hat meinen Gedankengang zerrissen. Wiederhole deine Frage, damit ich sie erneut prüfen kann.';
}

function mapThreadMessagesToLlmMessages(history) {
  return history
    .filter((message) => String(message.content || '').trim())
    .slice(-40)
    .map((message) => ({
      role: message.agent_slug === SOKRATES_AGENT_SLUG || message.author_is_system_agent ? 'assistant' : 'user',
      content: String(message.content || '').trim()
    }));
}

function extractAssistantText(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === 'string') {
    return content.trim();
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .join('')
      .trim();
  }
  return '';
}

function extractUsage(payload) {
  if (!payload?.usage || typeof payload.usage !== 'object') {
    return null;
  }
  return payload.usage;
}

function stringifyProviderDetail(payload) {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  if (typeof payload.error === 'string' && payload.error.trim()) {
    return payload.error.trim().slice(0, 240);
  }
  if (typeof payload.error?.message === 'string' && payload.error.message.trim()) {
    return payload.error.message.trim().slice(0, 240);
  }
  if (typeof payload.message === 'string' && payload.message.trim()) {
    return payload.message.trim().slice(0, 240);
  }

  return '';
}

function createAbortError() {
  const error = new Error('Aborted');
  error.name = 'AbortError';
  return error;
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const duration = Math.max(0, Number(ms || 0));
    const timer = setTimeout(() => {
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
      resolve();
    }, duration);

    const onAbort = () => {
      clearTimeout(timer);
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
      reject(createAbortError());
    };

    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

function parseRetryAfterMs(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return 0;
  }

  const numericSeconds = Number(raw);
  if (Number.isFinite(numericSeconds) && numericSeconds >= 0) {
    return Math.ceil(numericSeconds * 1000);
  }

  const parsedDate = Date.parse(raw);
  if (!Number.isNaN(parsedDate)) {
    return Math.max(0, parsedDate - Date.now());
  }

  return 0;
}

function extractProviderRequestId(headers) {
  if (!headers) {
    return '';
  }
  return String(
    headers.get('x-request-id')
    || headers.get('request-id')
    || headers.get('openai-request-id')
    || ''
  ).trim();
}

function collectRateLimitHeaders(headers) {
  if (!headers) {
    return null;
  }

  const result = {};
  [
    'x-ratelimit-limit-requests',
    'x-ratelimit-remaining-requests',
    'x-ratelimit-reset-requests',
    'x-ratelimit-limit-tokens',
    'x-ratelimit-remaining-tokens',
    'x-ratelimit-reset-tokens'
  ].forEach((name) => {
    const value = headers.get(name);
    if (value) {
      result[name] = value;
    }
  });

  return Object.keys(result).length ? result : null;
}

function readProviderErrorType(payload) {
  return String(payload?.error?.type || '').trim();
}

function readProviderErrorCode(payload) {
  return String(payload?.error?.code || '').trim();
}

function extractOllamaAssistantText(payload) {
  if (!payload || typeof payload !== 'object') {
    return '';
  }
  if (typeof payload.message?.content === 'string') {
    return payload.message.content;
  }
  if (typeof payload.response === 'string') {
    return payload.response;
  }
  return '';
}

function parseOllamaModelNames(payload) {
  if (!payload || typeof payload !== 'object') {
    return [];
  }
  const models = Array.isArray(payload.models) ? payload.models : [];
  return models
    .map((entry) => String(entry?.name || entry?.model || '').trim())
    .filter(Boolean);
}

function isOllamaModelPresent(models, expectedModel) {
  const expected = String(expectedModel || '').trim().toLowerCase();
  if (!expected) {
    return false;
  }
  return models.some((name) => {
    const normalized = String(name || '').trim().toLowerCase();
    return normalized === expected
      || normalized.startsWith(`${expected}:`)
      || expected.startsWith(`${normalized}:`);
  });
}

function createProviderRequestId(provider) {
  const prefix = normalizeProviderName(provider);
  if (typeof randomUUID === 'function') {
    return `${prefix}_${randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function logProviderRequestEvent(level, payload) {
  const line = JSON.stringify({
    event: 'sokrates.provider_request',
    ts: new Date().toISOString(),
    ...payload
  });

  if (level === 'error') {
    console.error(line);
    return;
  }
  if (level === 'warn') {
    console.warn(line);
    return;
  }
  console.log(line);
}

function isQuotaExceededFailure({ providerErrorType, providerErrorCode, detail }) {
  const type = String(providerErrorType || '').trim().toLowerCase();
  const code = String(providerErrorCode || '').trim().toLowerCase();
  const text = String(detail || '').trim().toLowerCase();

  if (type === 'insufficient_quota' || code === 'insufficient_quota') {
    return true;
  }

  return text.includes('current quota')
    || text.includes('billing details')
    || text.includes('maximum monthly spend')
    || text.includes('run out of credits')
    || text.includes('insufficient_quota');
}

function formatRateLimitMessage(retryAfterMs) {
  const waitSeconds = Math.max(1, Math.ceil(Math.max(0, Number(retryAfterMs || 0)) / 1000));
  return `Rate limit erreicht. Bitte warte ${waitSeconds} Sekunde${waitSeconds === 1 ? '' : 'n'} und versuche es erneut.`;
}

function mapProviderFailure({
  status,
  payload,
  provider,
  latencyMs,
  headers,
  attempt
}) {
  const detail = stringifyProviderDetail(payload);
  const providerRequestId = extractProviderRequestId(headers);
  const providerErrorType = readProviderErrorType(payload);
  const providerErrorCode = readProviderErrorCode(payload);
  const retryAfterHeader = String(headers?.get('retry-after') || '').trim();
  const retryAfterMsFromHeader = parseRetryAfterMs(retryAfterHeader);
  const rateLimitHeaders = collectRateLimitHeaders(headers);
  const attempts = Math.max(1, Number(attempt || 1));

  if (provider === 'ollama' && status === 404 && /model .* not found/i.test(detail)) {
    return new SokratesServiceError('Das konfigurierte Ollama-Modell fehlt.', {
      status: 503,
      code: 'CONFIG_ERROR',
      retryable: false,
      detail,
      provider,
      providerStatus: status,
      latencyMs,
      providerRequestId,
      providerErrorType,
      providerErrorCode,
      retryAfterHeader,
      rateLimitHeaders,
      attempts
    });
  }

  if (status === 400) {
    return new SokratesServiceError('Der AI-Provider hat die Anfrage abgelehnt.', {
      status: 400,
      code: 'VALIDATION_ERROR',
      retryable: false,
      detail,
      provider,
      providerStatus: status,
      latencyMs,
      providerRequestId,
      providerErrorType,
      providerErrorCode,
      retryAfterHeader,
      rateLimitHeaders,
      attempts
    });
  }

  if (status === 401 || status === 403) {
    return new SokratesServiceError(isDevMode() ? 'Sokrates ist nicht konfiguriert.' : 'Sokrates ist vorübergehend nicht verfügbar.', {
      status: 503,
      code: 'CONFIG_ERROR',
      retryable: false,
      detail,
      provider,
      providerStatus: status,
      latencyMs,
      providerRequestId,
      providerErrorType,
      providerErrorCode,
      retryAfterHeader,
      rateLimitHeaders,
      attempts
    });
  }

  if (status === 429) {
    if (isQuotaExceededFailure({ providerErrorType, providerErrorCode, detail })) {
      return new SokratesServiceError('Der AI-Provider ist derzeit nicht verfügbar.', {
        status: 429,
        code: 'QUOTA',
        retryable: false,
        detail,
        provider,
        providerStatus: status,
        latencyMs,
        providerRequestId,
        providerErrorType,
        providerErrorCode,
        retryAfterHeader,
        rateLimitHeaders,
        attempts
      });
    }

    const backoffMs = Math.max(retryAfterMsFromHeader, PROVIDER_RETRY_BACKOFF_MS);
    return new SokratesServiceError(formatRateLimitMessage(backoffMs), {
      status: 429,
      code: 'RATE_LIMIT',
      retryable: true,
      detail,
      provider,
      providerStatus: status,
      latencyMs,
      retryAfterMs: backoffMs,
      providerRequestId,
      providerErrorType,
      providerErrorCode,
      retryAfterHeader,
      rateLimitHeaders,
      attempts
    });
  }

  if (status >= 500) {
    return new SokratesServiceError('Der AI-Provider meldet gerade einen Fehler.', {
      status: 502,
      code: 'PROVIDER_ERROR',
      retryable: true,
      detail,
      provider,
      providerStatus: status,
      latencyMs,
      providerRequestId,
      providerErrorType,
      providerErrorCode,
      retryAfterHeader,
      rateLimitHeaders,
      attempts
    });
  }

  return new SokratesServiceError('Der AI-Provider konnte die Anfrage nicht verarbeiten.', {
    status: 502,
    code: 'PROVIDER_ERROR',
    retryable: true,
    detail,
    provider,
    providerStatus: status,
    latencyMs,
    providerRequestId,
    providerErrorType,
    providerErrorCode,
    retryAfterHeader,
    rateLimitHeaders,
    attempts
  });
}

function normalizeProviderTestPlan(plan) {
  if (!isDevMode() || !plan || typeof plan !== 'object') {
    return null;
  }

  const normalizeEntries = (value) => {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .filter((entry) => entry && typeof entry === 'object')
      .map((entry) => ({ ...entry }));
  };

  return {
    openai: normalizeEntries(plan.openai),
    ollama: normalizeEntries(plan.ollama)
  };
}

function buildTestPlanError(entry, provider, attempt) {
  const code = String(entry?.code || 'PROVIDER_ERROR').trim().toUpperCase();
  const status = Math.max(400, Number(entry?.status || 503));
  const retryable = entry?.retryable !== false;
  const detail = String(entry?.detail || '').slice(0, 240);
  const providerStatus = Number(entry?.providerStatus || status);

  const defaults = {
    RATE_LIMIT: {
      message: formatRateLimitMessage(Number(entry?.retryAfterMs || PROVIDER_RETRY_BACKOFF_MS)),
      retryAfterMs: Number(entry?.retryAfterMs || PROVIDER_RETRY_BACKOFF_MS),
      retryable
    },
    QUOTA: {
      message: 'Der AI-Provider ist derzeit nicht verfügbar.',
      retryAfterMs: 0,
      retryable: false
    },
    TIMEOUT: {
      message: 'Zeitüberschreitung beim AI-Provider.',
      retryAfterMs: 0,
      retryable
    },
    CONFIG_ERROR: {
      message: isDevMode() ? 'Sokrates ist nicht konfiguriert.' : 'Sokrates ist vorübergehend nicht verfügbar.',
      retryAfterMs: 0,
      retryable: false
    },
    VALIDATION_ERROR: {
      message: 'Der AI-Provider hat die Anfrage abgelehnt.',
      retryAfterMs: 0,
      retryable: false
    },
    PROVIDER_ERROR: {
      message: 'Der AI-Provider meldet gerade einen Fehler.',
      retryAfterMs: 0,
      retryable
    }
  };
  const fallback = defaults[code] || defaults.PROVIDER_ERROR;

  return new SokratesServiceError(String(entry?.message || fallback.message), {
    status,
    code,
    retryable: entry?.retryable === undefined ? fallback.retryable : retryable,
    detail,
    provider,
    providerStatus,
    latencyMs: Number(entry?.latencyMs || 0),
    retryAfterMs: Number(entry?.retryAfterMs || fallback.retryAfterMs || 0),
    providerRequestId: String(entry?.providerRequestId || ''),
    providerErrorType: String(entry?.providerErrorType || ''),
    providerErrorCode: String(entry?.providerErrorCode || ''),
    retryAfterHeader: String(entry?.retryAfterHeader || ''),
    rateLimitHeaders: entry?.rateLimitHeaders || null,
    attempts: Math.max(1, Number(attempt || 1))
  });
}

class TestPlanProvider {
  constructor(provider, config, planEntries = []) {
    this.provider = normalizeProviderName(provider);
    this.config = config;
    this.planEntries = Array.isArray(planEntries) ? planEntries : [];
    this.attempt = 0;
  }

  async generate() {
    this.attempt += 1;
    const entry = this.planEntries.shift() || { ok: true, text: `Simulierte ${getProviderDisplayName(this.provider)}-Antwort.` };
    if (entry.ok === false) {
      markProviderReachable(this.provider, String(entry?.code || '').toUpperCase() === 'VALIDATION_ERROR');
      throw buildTestPlanError(entry, this.provider, this.attempt);
    }

    markProviderReachable(this.provider, true);

    return {
      text: String(entry.text || `Simulierte ${getProviderDisplayName(this.provider)}-Antwort.`).trim(),
      usage: null,
      providerName: this.provider,
      model: String(entry.model || this.config?.model || ''),
      latencyMs: Number(entry.latencyMs || 0),
      providerRequestId: String(entry.providerRequestId || ''),
      rateLimitHeaders: entry.rateLimitHeaders || null,
      attempts: this.attempt,
      fallbackReason: '',
      activeMode: DEFAULT_PROVIDER_MODE,
      usedFallback: false
    };
  }
}

async function requestOpenAiChatCompletion({
  config,
  messages,
  signal,
  systemPrompt = SOKRATES_SYSTEM_PROMPT,
  maxTokens = 500,
  temperature = 0.7
}) {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  let abortHandler = null;

  if (signal) {
    abortHandler = () => controller.abort();
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener('abort', abortHandler, { once: true });
    }
  }

  try {
    const response = await fetch(`${config.apiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {})
      },
      body: JSON.stringify({
        model: config.model,
        temperature: Number.isFinite(Number(temperature)) ? Number(temperature) : 0.7,
        max_tokens: Math.max(32, Number(maxTokens || 500)),
        messages: [
          { role: 'system', content: String(systemPrompt || SOKRATES_SYSTEM_PROMPT) },
          ...messages
        ]
      }),
      signal: controller.signal
    });

    const latencyMs = Date.now() - startedAt;
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw mapProviderFailure({
        status: response.status,
        payload,
        provider: config.provider,
        latencyMs,
        headers: response.headers,
        attempt: 1
      });
    }

    const text = extractAssistantText(payload);
    if (!text) {
      throw new SokratesServiceError('Der AI-Provider lieferte keine verwertbare Antwort.', {
        status: 502,
        code: 'PROVIDER_ERROR',
        retryable: true,
        detail: 'Empty completion payload.',
        provider: config.provider,
        providerStatus: response.status,
        latencyMs,
        providerRequestId: extractProviderRequestId(response.headers),
        rateLimitHeaders: collectRateLimitHeaders(response.headers),
        attempts: 1
      });
    }

    markProviderReachable(config.provider, true);

    return {
      text,
      usage: extractUsage(payload),
      providerName: config.provider,
      model: config.model,
      latencyMs,
      providerRequestId: extractProviderRequestId(response.headers),
      rateLimitHeaders: collectRateLimitHeaders(response.headers),
      attempts: 1,
      fallbackReason: '',
      activeMode: DEFAULT_PROVIDER_MODE,
      usedFallback: false
    };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;

    if (error instanceof SokratesServiceError) {
      markProviderReachable(config.provider, error.code === 'VALIDATION_ERROR');
      error.latencyMs = Math.max(Number(error.latencyMs || 0), latencyMs);
      throw error;
    }

    if (error?.name === 'AbortError') {
      if (signal?.aborted) {
        throw createAbortError();
      }

      markProviderReachable(config.provider, false);
      throw new SokratesServiceError('Zeitüberschreitung beim AI-Provider.', {
        status: 504,
        code: 'TIMEOUT',
        retryable: true,
        detail: `Provider request exceeded ${config.timeoutMs}ms.`,
        provider: config.provider,
        latencyMs,
        attempts: 1
      });
    }

    markProviderReachable(config.provider, false);
    throw new SokratesServiceError('Netzwerkfehler beim AI-Provider.', {
      status: 503,
      code: 'TIMEOUT',
      retryable: true,
      detail: String(error?.message || 'Network request failed.').slice(0, 240),
      provider: config.provider,
      latencyMs,
      attempts: 1
    });
  } finally {
    clearTimeout(timeout);
    if (signal && abortHandler) {
      signal.removeEventListener('abort', abortHandler);
    }
  }
}

async function requestOllamaChatCompletion({
  config,
  messages,
  signal,
  systemPrompt = SOKRATES_SYSTEM_PROMPT,
  maxTokens = 500,
  temperature = 0.7
}) {
  const startedAt = Date.now();
  const controller = new AbortController();
  let timeout = null;
  let abortHandler = null;
  let firstTokenLatencyMs = 0;
  let parseErrorCount = 0;
  const requestId = createProviderRequestId(config.provider);
  const apiUrl = `${normalizeOllamaHealthBase(config.baseUrl)}/api/chat`;

  const resetTimeout = () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  };

  resetTimeout();

  if (signal) {
    abortHandler = () => controller.abort();
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener('abort', abortHandler, { once: true });
    }
  }

  logProviderRequestEvent('info', {
    request_id: requestId,
    provider: config.provider,
    url: apiUrl,
    model: config.model,
    phase: 'started'
  });

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/x-ndjson, application/json'
      },
      body: JSON.stringify({
        model: config.model,
        stream: true,
        messages: [
          { role: 'system', content: String(systemPrompt || SOKRATES_SYSTEM_PROMPT) },
          ...messages
        ],
        options: {
          temperature: Number.isFinite(Number(temperature)) ? Number(temperature) : 0.7,
          num_predict: Math.max(32, Number(maxTokens || 500))
        }
      }),
      signal: controller.signal
    });

    const latencyMs = Date.now() - startedAt;

    if (!response.ok) {
      const rawBody = await response.text().catch(() => '');
      let payload = rawBody ? { error: rawBody } : {};
      if (rawBody) {
        try {
          payload = JSON.parse(rawBody);
        } catch (_error) {
          payload = { error: rawBody };
        }
      }
      logProviderRequestEvent(response.status >= 500 ? 'error' : 'warn', {
        request_id: requestId,
        provider: config.provider,
        url: apiUrl,
        model: config.model,
        http_status: response.status,
        first_token_latency_ms: 0,
        parse_error_count: 0,
        detail: stringifyProviderDetail(payload) || null,
        provider_request_id: extractProviderRequestId(response.headers) || null
      });
      throw mapProviderFailure({
        status: response.status,
        payload,
        provider: config.provider,
        latencyMs,
        headers: response.headers,
        attempt: 1
      });
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new SokratesServiceError('Ollama lieferte keinen lesbaren Antwort-Stream.', {
        status: 502,
        code: 'PROVIDER_ERROR',
        retryable: true,
        detail: 'Response body was empty.',
        provider: config.provider,
        providerStatus: response.status,
        latencyMs,
        providerRequestId: extractProviderRequestId(response.headers),
        attempts: 1
      });
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let text = '';

    const consumeLine = (line) => {
      const trimmed = String(line || '').trim();
      if (!trimmed) {
        return;
      }

      let payload = null;
      try {
        payload = JSON.parse(trimmed);
      } catch (_error) {
        parseErrorCount += 1;
        return;
      }

      const piece = extractOllamaAssistantText(payload);
      if (piece && !firstTokenLatencyMs) {
        firstTokenLatencyMs = Date.now() - startedAt;
      }
      if (piece) {
        text += piece;
      }
    };

    while (true) {
      const chunk = await reader.read();
      if (chunk.done) {
        break;
      }

      resetTimeout();
      buffer += decoder.decode(chunk.value, { stream: true });

      let newlineIndex = buffer.indexOf('\n');
      while (newlineIndex >= 0) {
        consumeLine(buffer.slice(0, newlineIndex));
        buffer = buffer.slice(newlineIndex + 1);
        newlineIndex = buffer.indexOf('\n');
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) {
      consumeLine(buffer);
    }

    const finalText = text.trim();
    if (!finalText) {
      logProviderRequestEvent('warn', {
        request_id: requestId,
        provider: config.provider,
        url: apiUrl,
        model: config.model,
        http_status: response.status,
        first_token_latency_ms: Number(firstTokenLatencyMs || 0),
        parse_error_count: parseErrorCount,
        detail: 'Empty completion payload.',
        provider_request_id: extractProviderRequestId(response.headers) || null
      });
      throw new SokratesServiceError('Der AI-Provider lieferte keine verwertbare Antwort.', {
        status: 502,
        code: 'PROVIDER_ERROR',
        retryable: true,
        detail: 'Empty completion payload.',
        provider: config.provider,
        providerStatus: response.status,
        latencyMs: Date.now() - startedAt,
        providerRequestId: extractProviderRequestId(response.headers),
        attempts: 1
      });
    }

    markProviderReachable(config.provider, true);
    logProviderRequestEvent('info', {
      request_id: requestId,
      provider: config.provider,
      url: apiUrl,
      model: config.model,
      http_status: response.status,
      first_token_latency_ms: Number(firstTokenLatencyMs || latencyMs),
      parse_error_count: parseErrorCount,
      provider_request_id: extractProviderRequestId(response.headers) || null
    });

    return {
      text: finalText,
      usage: null,
      providerName: config.provider,
      model: config.model,
      latencyMs: Date.now() - startedAt,
      providerRequestId: extractProviderRequestId(response.headers) || requestId,
      rateLimitHeaders: collectRateLimitHeaders(response.headers),
      attempts: 1,
      fallbackReason: '',
      activeMode: DEFAULT_PROVIDER_MODE,
      usedFallback: false
    };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;

    if (error instanceof SokratesServiceError) {
      markProviderReachable(config.provider, error.code === 'VALIDATION_ERROR');
      error.latencyMs = Math.max(Number(error.latencyMs || 0), latencyMs);
      if (!error.providerRequestId) {
        error.providerRequestId = requestId;
      }
      throw error;
    }

    if (error?.name === 'AbortError') {
      if (signal?.aborted) {
        throw createAbortError();
      }

      markProviderReachable(config.provider, false);
      logProviderRequestEvent('warn', {
        request_id: requestId,
        provider: config.provider,
        url: apiUrl,
        model: config.model,
        http_status: 504,
        first_token_latency_ms: Number(firstTokenLatencyMs || 0),
        parse_error_count: parseErrorCount,
        detail: `Provider inactivity exceeded ${config.timeoutMs}ms.`
      });
      throw new SokratesServiceError('Zeitüberschreitung beim AI-Provider.', {
        status: 504,
        code: 'TIMEOUT',
        retryable: true,
        detail: `Provider inactivity exceeded ${config.timeoutMs}ms.`,
        provider: config.provider,
        latencyMs,
        providerRequestId: requestId,
        attempts: 1
      });
    }

    markProviderReachable(config.provider, false);
    logProviderRequestEvent('error', {
      request_id: requestId,
      provider: config.provider,
      url: apiUrl,
      model: config.model,
      http_status: 503,
      first_token_latency_ms: Number(firstTokenLatencyMs || 0),
      parse_error_count: parseErrorCount,
      detail: String(error?.message || 'Network request failed.').slice(0, 240)
    });
    throw new SokratesServiceError('Netzwerkfehler beim AI-Provider.', {
      status: 503,
      code: 'TIMEOUT',
      retryable: true,
      detail: String(error?.message || 'Network request failed.').slice(0, 240),
      provider: config.provider,
      latencyMs,
      providerRequestId: requestId,
      attempts: 1
    });
  } finally {
    clearTimeout(timeout);
    if (signal && abortHandler) {
      signal.removeEventListener('abort', abortHandler);
    }
  }
}

class OpenAIProvider {
  constructor(config) {
    this.config = {
      ...config,
      apiBaseUrl: normalizeBaseUrl(config.baseUrl, DEFAULT_OPENAI_BASE_URL)
    };
  }

  async generate(messages, options = {}) {
    return requestOpenAiChatCompletion({
      config: this.config,
      messages,
      signal: options.signal,
      systemPrompt: options.systemPrompt,
      maxTokens: options.maxTokens,
      temperature: options.temperature
    });
  }
}

class OllamaProvider {
  constructor(config) {
    this.config = {
      ...config,
      apiBaseUrl: normalizeOllamaApiBase(config.baseUrl)
    };
  }

  async generate(messages, options = {}) {
    return requestOllamaChatCompletion({
      config: this.config,
      messages,
      signal: options.signal,
      systemPrompt: options.systemPrompt,
      maxTokens: options.maxTokens,
      temperature: options.temperature
    });
  }
}

function createProvider(config) {
  if (!config?.configured) {
    return null;
  }

  if (config.provider === 'ollama') {
    return new OllamaProvider(config);
  }

  return new OpenAIProvider(config);
}

function addRoutingMeta(target, { activeMode, fallbackReason }) {
  if (!target || typeof target !== 'object') {
    return target;
  }
  if (activeMode) {
    target.activeMode = activeMode;
  }
  if (fallbackReason) {
    target.fallbackReason = fallbackReason;
  }
  return target;
}

function addProviderAttemptMeta(
  target,
  {
    providerAttemptOrder = [],
    providerErrors = null,
    finalProviderUsed = '',
    openAiCircuitOpened = false,
    providerAttempts = null,
    finalOutcome = '',
    reasonIfInCharacterError = ''
  } = {}
) {
  if (!target || typeof target !== 'object') {
    return target;
  }

  if (Array.isArray(providerAttemptOrder) && providerAttemptOrder.length) {
    target.providerAttemptOrder = [...providerAttemptOrder];
  }
  if (providerErrors && typeof providerErrors === 'object') {
    target.providerErrors = {
      openai: String(providerErrors.openai || ''),
      ollama: String(providerErrors.ollama || '')
    };
  }
  if (finalProviderUsed) {
    target.finalProviderUsed = String(finalProviderUsed);
  }
  if (Array.isArray(providerAttempts) && providerAttempts.length) {
    target.providerAttempts = providerAttempts.map((entry) => ({
      provider: String(entry?.provider || '').trim(),
      ok: entry?.ok === true,
      status: Number(entry?.status || 0),
      err_code: String(entry?.err_code || ''),
      latency_ms: Number(entry?.latency_ms || 0)
    }));
  }
  if (finalOutcome) {
    target.finalOutcome = String(finalOutcome);
  }
  if (reasonIfInCharacterError) {
    target.reasonIfInCharacterError = String(reasonIfInCharacterError);
  }
  if (openAiCircuitOpened) {
    target.openAiCircuitOpened = true;
    target.openAiCircuitUntil = getOpenAiCircuitState().until;
  }
  return target;
}

function compactProviderErrorCode(error) {
  if (!(error instanceof SokratesServiceError)) {
    return '';
  }
  const code = String(error.code || 'PROVIDER_ERROR');
  const providerStatus = Number(error.providerStatus || error.status || 0);
  return providerStatus > 0 ? `${code}:${providerStatus}` : code;
}

function appendSuccessAttempt(target, provider, result) {
  if (!Array.isArray(target)) {
    return;
  }
  target.push({
    provider: String(provider || '').trim(),
    ok: true,
    status: 200,
    err_code: '',
    latency_ms: Number(result?.latencyMs || 0)
  });
}

function appendFailureAttempt(target, provider, error) {
  if (!Array.isArray(target)) {
    return;
  }
  target.push({
    provider: String(provider || '').trim(),
    ok: false,
    status: Number(error?.providerStatus || error?.status || 0),
    err_code: compactProviderErrorCode(error),
    latency_ms: Number(error?.latencyMs || 0)
  });
}

function mapInCharacterErrorReasonFromAttempts(providerErrors = {}) {
  const openaiError = String(providerErrors?.openai || '').trim();
  const ollamaError = String(providerErrors?.ollama || '').trim();
  if (openaiError.includes('QUOTA') || openaiError.includes('RATE_LIMIT')) {
    if (ollamaError) {
      return `OPENAI_${openaiError.replace(':', '_')}+OLLAMA_${ollamaError.replace(':', '_')}`;
    }
    return `OPENAI_${openaiError.replace(':', '_')}`;
  }
  if (ollamaError.includes('TIMEOUT')) {
    return `OLLAMA_TIMEOUT${openaiError ? `+OPENAI_${openaiError.replace(':', '_')}` : ''}`;
  }
  if (ollamaError.includes('CONFIG_ERROR')) {
    return `OLLAMA_MODEL_MISSING${openaiError ? `+OPENAI_${openaiError.replace(':', '_')}` : ''}`;
  }
  if (ollamaError) {
    return `OLLAMA_${ollamaError.replace(':', '_')}${openaiError ? `+OPENAI_${openaiError.replace(':', '_')}` : ''}`;
  }
  if (openaiError) {
    return `OPENAI_${openaiError.replace(':', '_')}`;
  }
  return 'BOTH_PROVIDERS_UNAVAILABLE';
}

function mapFallbackReason(error) {
  if (!error) {
    return '';
  }
  if (error.code === 'QUOTA') {
    return 'quota';
  }
  if (error.code === 'RATE_LIMIT') {
    return 'rate_limit';
  }
  if (error.code === 'TIMEOUT') {
    return 'timeout';
  }
  if (error.code === 'CONFIG_ERROR') {
    return 'config_error';
  }
  if (error.code === 'PROVIDER_ERROR' && Number(error.providerStatus || 0) >= 500) {
    return '5xx';
  }
  if (error.code === 'PROVIDER_ERROR') {
    return 'provider_error';
  }
  return '';
}

function shouldFallbackFromOpenAi(error) {
  if (!error || error.code === 'VALIDATION_ERROR') {
    return false;
  }

  if (error.code === 'QUOTA' || error.code === 'CONFIG_ERROR' || error.code === 'RATE_LIMIT' || error.code === 'TIMEOUT') {
    return true;
  }

  if (error.code === 'PROVIDER_ERROR') {
    return Number(error.providerStatus || 0) >= 500 || Number(error.providerStatus || 0) === 0;
  }

  return false;
}

function getProviderRetryStrategy(providerKey) {
  return providerKey === 'openai'
    ? { rateLimitRetries: 1, transientRetries: 1 }
    : { rateLimitRetries: 0, transientRetries: 0 };
}

async function probeOllamaReachability(config, signal, options = {}) {
  if (!config?.configured) {
    return options?.includeModelState
      ? { reachable: false, modelPresent: false, models: [] }
      : false;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.min(OLLAMA_STATUS_TIMEOUT_MS, Number(config.timeoutMs || OLLAMA_STATUS_TIMEOUT_MS)));
  let abortHandler = null;

  if (signal) {
    abortHandler = () => controller.abort();
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener('abort', abortHandler, { once: true });
    }
  }

  try {
    const response = await fetch(`${normalizeOllamaHealthBase(config.baseUrl)}/api/tags`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal
    });
    markProviderReachable('ollama', response.ok);
    if (!options?.includeModelState) {
      return response.ok;
    }
    if (!response.ok) {
      return { reachable: false, modelPresent: false, models: [] };
    }
    const payload = await response.json().catch(() => ({}));
    const models = parseOllamaModelNames(payload);
    return {
      reachable: true,
      modelPresent: isOllamaModelPresent(models, config.model),
      models
    };
  } catch (error) {
    if (error?.name === 'AbortError' && signal?.aborted) {
      throw createAbortError();
    }
    markProviderReachable('ollama', false);
    return options?.includeModelState
      ? { reachable: false, modelPresent: false, models: [] }
      : false;
  } finally {
    clearTimeout(timeout);
    if (signal && abortHandler) {
      signal.removeEventListener('abort', abortHandler);
    }
  }
}

function buildAutoUnavailableError({
  primaryError,
  fallbackKey = '',
  fallbackReason = '',
  fallbackError = null,
  activeMode = DEFAULT_PROVIDER_MODE,
  detail = ''
}) {
  const finalError = fallbackError instanceof SokratesServiceError ? fallbackError : null;
  const safeDetail = String(detail || '').trim();
  const debugParts = [];

  if (primaryError instanceof SokratesServiceError) {
    debugParts.push(`primary=${primaryError.provider}:${primaryError.code}`);
  }
  if (fallbackKey) {
    debugParts.push(`fallback=${fallbackKey}${finalError ? `:${finalError.code}` : ':unreachable'}`);
  }
  if (safeDetail) {
    debugParts.push(safeDetail);
  }

  return new SokratesServiceError('Sokrates ist derzeit nicht verfügbar.', {
    status: 503,
    code: 'PROVIDER_ERROR',
    retryable: false,
    detail: isDevMode() ? debugParts.join(' | ') : '',
    provider: String(finalError?.provider || fallbackKey || primaryError?.provider || 'openai'),
    providerStatus: Number(finalError?.providerStatus || 0),
    latencyMs: Math.max(
      0,
      Number(primaryError?.latencyMs || 0) + Number(finalError?.latencyMs || 0)
    ),
    retryAfterMs: Number(finalError?.retryAfterMs || 0),
    providerRequestId: String(finalError?.providerRequestId || ''),
    providerErrorType: String(finalError?.providerErrorType || ''),
    providerErrorCode: String(finalError?.providerErrorCode || ''),
    retryAfterHeader: String(finalError?.retryAfterHeader || ''),
    rateLimitHeaders: finalError?.rateLimitHeaders || null,
    attempts: Math.max(
      1,
      Number(primaryError?.attempts || 1) + Number(finalError?.attempts || 0)
    ),
    fallbackReason,
    activeMode
  });
}

async function runProviderWithStrategy(provider, messages, strategy, signal, options = {}) {
  const rateLimitRetries = Math.max(0, Number(strategy?.rateLimitRetries || 0));
  const transientRetries = Math.max(0, Number(strategy?.transientRetries || 0));
  let attempts = 0;
  let usedRateLimitRetries = 0;
  let usedTransientRetries = 0;

  while (true) {
    attempts += 1;

    try {
      const result = await provider.generate(messages, {
        signal,
        systemPrompt: options.systemPrompt,
        maxTokens: options.maxTokens,
        temperature: options.temperature
      });
      result.attempts = attempts;
      return result;
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw error;
      }

      if (!(error instanceof SokratesServiceError)) {
        throw error;
      }

      error.attempts = Math.max(Number(error.attempts || 1), attempts);

      if (error.code === 'RATE_LIMIT' && error.retryable !== false && usedRateLimitRetries < rateLimitRetries) {
        usedRateLimitRetries += 1;
        await sleep(Math.max(PROVIDER_RETRY_BACKOFF_MS, Number(error.retryAfterMs || 0)), signal);
        continue;
      }

      if (
        (error.code === 'TIMEOUT' || error.code === 'PROVIDER_ERROR')
        && error.retryable !== false
        && usedTransientRetries < transientRetries
      ) {
        usedTransientRetries += 1;
        await sleep(250, signal);
        continue;
      }

      throw error;
    }
  }
}

async function getSokratesStatus({ userSettings } = {}) {
  const availability = getSokratesAvailability({ userSettings });
  const providers = readProviderRegistry(userSettings);
  const openAiCircuit = getOpenAiCircuitState();
  const openaiReachable = providers.openai.configured
    ? (!openAiCircuit.open && getProviderReachable('openai', true) !== false)
    : false;
  const ollamaProbe = providers.ollama.configured
    ? await probeOllamaReachability(providers.ollama, null, { includeModelState: true }).catch(() => ({
      reachable: false,
      modelPresent: false,
      models: []
    }))
    : { reachable: false, modelPresent: false, models: [] };
  const ollamaReachable = Boolean(ollamaProbe.reachable);
  markProviderReachable('ollama', ollamaReachable);

  let selectedProvider = String(availability.selectedProvider || availability.provider || 'openai');
  let model = String(availability.model || providers[selectedProvider]?.model || '');
  let available = Boolean(availability.available);
  let code = String(availability.code || '');
  let message = String(availability.message || '');
  let detail = String(availability.detail || '');
  let fallbackReason = '';

  if (availability.activeMode === 'openai') {
    available = providers.openai.configured && openaiReachable;
    if (!available && providers.openai.configured) {
      code = 'TIMEOUT';
      message = '';
      detail = isDevMode() ? 'OpenAI ist derzeit nicht nutzbar.' : '';
    }
  } else if (availability.activeMode === 'ollama') {
    available = providers.ollama.configured && ollamaReachable;
    if (!available && providers.ollama.configured) {
      code = 'TIMEOUT';
      message = '';
      detail = isDevMode()
        ? `Health check failed for ${normalizeOllamaHealthBase(providers.ollama.baseUrl)}.`
        : '';
    }
  } else if (availability.activeMode === 'auto') {
    available = (providers.openai.configured && openaiReachable) || (providers.ollama.configured && ollamaReachable);
    if (providers.openai.configured && openaiReachable) {
      selectedProvider = 'openai';
      model = providers.openai.model;
    } else if (providers.ollama.configured && ollamaReachable) {
      selectedProvider = 'ollama';
      model = providers.ollama.model;
      fallbackReason = providers.openai.configured
        ? (openAiCircuit.open ? 'openai_circuit_open' : 'openai_unavailable')
        : '';
      if (fallbackReason) {
        code = 'FALLBACK';
        message = openAiCircuit.open
          ? 'OpenAI rate-limited - nutze Ollama.'
          : 'OpenAI nicht verfügbar - nutze Ollama.';
      }
    }
    if (!available && providers.openai.configured && providers.ollama.configured) {
      code = 'TIMEOUT';
      message = '';
      detail = isDevMode() ? 'OpenAI und Ollama sind derzeit nicht nutzbar.' : '';
    }
  }

  return {
    ...availability,
    available,
    code,
    message,
    detail,
    provider: selectedProvider,
    model,
    selectedProvider,
    selectedProviderLabel: getProviderDisplayName(selectedProvider),
    fallbackReason,
    openaiConfigured: Boolean(providers.openai.configured),
    openaiReachable,
    openaiCircuitOpen: openAiCircuit.open,
    openaiCircuitUntil: openAiCircuit.until,
    openaiCircuitRemainingMs: openAiCircuit.remainingMs,
    openaiCircuitCode: openAiCircuit.code,
    ollamaConfigured: Boolean(providers.ollama.configured),
    ollamaReachable,
    ollamaModelPresent: Boolean(ollamaProbe.modelPresent),
    ollamaModels: Array.isArray(ollamaProbe.models) ? ollamaProbe.models : [],
    autoOrder: ['openai', 'ollama'],
    openaiModel: providers.openai.model,
    ollamaModel: providers.ollama.model
  };
}

async function generateSokratesReply({
  history,
  userSettings,
  signal,
  providerTestPlan = null,
  completionOptions = null
} = {}) {
  const availability = getSokratesAvailability({ userSettings });
  if (!availability.available) {
    throw new SokratesServiceError(availability.message, {
      status: 503,
      code: availability.code || 'CONFIG_ERROR',
      retryable: false,
      detail: availability.detail,
      provider: availability.selectedProvider,
      activeMode: availability.activeMode
    });
  }

  const messages = mapThreadMessagesToLlmMessages(history || []);
  if (!messages.length) {
    throw new SokratesServiceError('Sokrates wartet auf eine Frage.', {
      status: 400,
      code: 'VALIDATION_ERROR',
      retryable: false,
      detail: 'No non-empty messages were available for the LLM context.',
      provider: availability.selectedProvider,
      activeMode: availability.activeMode
    });
  }

  const providers = readProviderRegistry(userSettings);
  const testPlan = normalizeProviderTestPlan(providerTestPlan);
  const primaryKey = availability.selectedProvider;
  const providerAttemptOrder = [];
  const providerAttempts = [];
  const providerErrors = {
    openai: '',
    ollama: ''
  };
  const primaryConfig = providers[primaryKey];
  const primaryProvider = testPlan
    ? new TestPlanProvider(primaryKey, primaryConfig, testPlan[primaryKey])
    : createProvider(primaryConfig);

  if (!primaryProvider) {
    const missingProviderError = new SokratesServiceError(isDevMode() ? 'Sokrates ist nicht konfiguriert.' : 'Sokrates ist vorübergehend nicht verfügbar.', {
      status: 503,
      code: 'CONFIG_ERROR',
      retryable: false,
      detail: `Provider ${primaryKey} is not configured.`,
      provider: primaryKey,
      activeMode: availability.activeMode
    });
    providerAttemptOrder.push(primaryKey);
    appendFailureAttempt(providerAttempts, primaryKey, missingProviderError);
    providerErrors[primaryKey] = compactProviderErrorCode(missingProviderError);
    addProviderAttemptMeta(missingProviderError, {
      providerAttemptOrder,
      providerErrors,
      finalProviderUsed: primaryKey,
      providerAttempts,
      finalOutcome: 'IN_CHARACTER_ERROR',
      reasonIfInCharacterError: mapInCharacterErrorReasonFromAttempts(providerErrors)
    });
    throw missingProviderError;
  }

  if (primaryKey === 'ollama' && providers.ollama.configured) {
    const ollamaReachable = await probeOllamaReachability(providers.ollama, signal);
    if (!ollamaReachable) {
      const ollamaUnavailableError = new SokratesServiceError('Ollama ist derzeit nicht erreichbar.', {
        status: 503,
        code: 'TIMEOUT',
        retryable: false,
        detail: isDevMode()
          ? `Health check failed for ${normalizeOllamaHealthBase(providers.ollama.baseUrl)}.`
          : '',
        provider: 'ollama',
        activeMode: availability.activeMode
      });
      providerAttemptOrder.push(primaryKey);
      appendFailureAttempt(providerAttempts, primaryKey, ollamaUnavailableError);
      providerErrors[primaryKey] = compactProviderErrorCode(ollamaUnavailableError);
      addProviderAttemptMeta(ollamaUnavailableError, {
        providerAttemptOrder,
        providerErrors,
        finalProviderUsed: primaryKey,
        providerAttempts,
        finalOutcome: 'IN_CHARACTER_ERROR',
        reasonIfInCharacterError: mapInCharacterErrorReasonFromAttempts(providerErrors)
      });
      throw ollamaUnavailableError;
    }
  }

  const fallbackKey = availability.activeMode === 'auto' && primaryKey === 'openai' && providers.ollama.configured
    ? 'ollama'
    : '';

  try {
    const result = await runProviderWithStrategy(
      primaryProvider,
      messages,
      getProviderRetryStrategy(primaryKey),
      signal,
      completionOptions || {}
    );
    if (primaryKey === 'openai') {
      clearOpenAiCircuit();
    }
    providerAttemptOrder.push(primaryKey);
    appendSuccessAttempt(providerAttempts, primaryKey, result);
    return {
      ...result,
      activeMode: availability.activeMode,
      selectedProvider: result.providerName,
      providerName: result.providerName,
      usedFallback: false,
      fallbackReason: '',
      providerAttemptOrder,
      providerAttempts,
      providerErrors,
      finalProviderUsed: result.providerName,
      finalOutcome: 'ANSWER'
    };
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw error;
    }

    if (!(error instanceof SokratesServiceError)) {
      throw error;
    }

    addRoutingMeta(error, { activeMode: availability.activeMode });
    providerAttemptOrder.push(primaryKey);
    appendFailureAttempt(providerAttempts, primaryKey, error);
    providerErrors[primaryKey] = compactProviderErrorCode(error);
    let openAiCircuitOpened = false;
    if (shouldTripOpenAiCircuit(error)) {
      tripOpenAiCircuit(error);
      openAiCircuitOpened = true;
    }

    if (
      availability.activeMode !== 'auto'
      || primaryKey !== 'openai'
      || !fallbackKey
      || !shouldFallbackFromOpenAi(error)
    ) {
      addProviderAttemptMeta(error, {
        providerAttemptOrder,
        providerErrors,
        finalProviderUsed: primaryKey,
        openAiCircuitOpened,
        providerAttempts,
        finalOutcome: 'IN_CHARACTER_ERROR',
        reasonIfInCharacterError: mapInCharacterErrorReasonFromAttempts(providerErrors)
      });
      throw error;
    }

    const fallbackReason = mapFallbackReason(error);
    if (fallbackKey === 'ollama') {
      const ollamaReachable = await probeOllamaReachability(providers.ollama, signal);
      if (!ollamaReachable) {
        const routedError = buildAutoUnavailableError({
          primaryError: error,
          fallbackKey,
          fallbackReason,
          activeMode: availability.activeMode,
          detail: 'Ollama health check failed before fallback.'
        });
        appendFailureAttempt(providerAttempts, fallbackKey, routedError);
        providerErrors[fallbackKey] = compactProviderErrorCode(routedError);
        addProviderAttemptMeta(routedError, {
          providerAttemptOrder: [...providerAttemptOrder, fallbackKey],
          providerErrors,
          finalProviderUsed: fallbackKey,
          openAiCircuitOpened,
          providerAttempts,
          finalOutcome: 'IN_CHARACTER_ERROR',
          reasonIfInCharacterError: mapInCharacterErrorReasonFromAttempts(providerErrors)
        });
        throw routedError;
      }
    }

    const fallbackProvider = testPlan
      ? new TestPlanProvider(fallbackKey, providers[fallbackKey], testPlan[fallbackKey])
      : createProvider(providers[fallbackKey]);

    if (!fallbackProvider) {
      addProviderAttemptMeta(error, {
        providerAttemptOrder,
        providerErrors,
        finalProviderUsed: primaryKey,
        openAiCircuitOpened,
        providerAttempts,
        finalOutcome: 'IN_CHARACTER_ERROR',
        reasonIfInCharacterError: mapInCharacterErrorReasonFromAttempts(providerErrors)
      });
      throw error;
    }

    try {
      providerAttemptOrder.push(fallbackKey);
      const fallbackResult = await runProviderWithStrategy(
        fallbackProvider,
        messages,
        getProviderRetryStrategy(fallbackKey),
        signal,
        completionOptions || {}
      );
      if (fallbackKey === 'openai') {
        clearOpenAiCircuit();
      }
      appendSuccessAttempt(providerAttempts, fallbackKey, fallbackResult);

      return {
        ...fallbackResult,
        activeMode: availability.activeMode,
        selectedProvider: fallbackResult.providerName,
        providerName: fallbackResult.providerName,
        usedFallback: true,
        fallbackReason,
        providerAttemptOrder,
        providerAttempts,
        providerErrors,
        finalProviderUsed: fallbackResult.providerName,
        openAiCircuitOpened,
        finalOutcome: 'ANSWER'
      };
    } catch (fallbackError) {
      if (fallbackError?.name === 'AbortError') {
        throw fallbackError;
      }

      if (fallbackError instanceof SokratesServiceError) {
        appendFailureAttempt(providerAttempts, fallbackKey, fallbackError);
        providerErrors[fallbackKey] = compactProviderErrorCode(fallbackError);
        const routedError = buildAutoUnavailableError({
          primaryError: error,
          fallbackKey,
          fallbackReason,
          fallbackError,
          activeMode: availability.activeMode
        });
        addProviderAttemptMeta(routedError, {
          providerAttemptOrder,
          providerErrors,
          finalProviderUsed: fallbackKey,
          openAiCircuitOpened,
          providerAttempts,
          finalOutcome: 'IN_CHARACTER_ERROR',
          reasonIfInCharacterError: mapInCharacterErrorReasonFromAttempts(providerErrors)
        });
        throw routedError;
      }

      throw fallbackError;
    }
  }
}

module.exports = {
  SOKRATES_SERVER_SYSTEM_PROMPT,
  SokratesServiceError,
  generateSokratesReply,
  getSokratesAvailability,
  getSokratesStatus,
  getProviderDisplayName,
  getSokratesPersonaErrorMessage
};
