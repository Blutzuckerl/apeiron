const os = require('os');
const fs = require('fs');
const path = require('path');
const { defineConfig } = require('@playwright/test');

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const isDocker = fs.existsSync('/.dockerenv');
const artifactsRoot = process.env.PLAYWRIGHT_ARTIFACTS_DIR || path.resolve(__dirname, 'playwright-artifacts');
const tempDir = isDocker
  ? path.join(os.tmpdir(), 'apeiron-playwright')
  : path.join(artifactsRoot, '.tmp');
const outputDir = process.env.PLAYWRIGHT_OUTPUT_DIR || path.join(artifactsRoot, 'test-results');
const htmlReportDir = process.env.PLAYWRIGHT_HTML_REPORT_DIR || path.join(artifactsRoot, 'html-report');
const reuseExistingServer = process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === '1';
const disableHtmlReport = process.env.PLAYWRIGHT_DISABLE_HTML_REPORT === '1';
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === '1';
const parsedBaseUrl = new URL(baseURL);
const serverHost = process.env.PLAYWRIGHT_SERVER_HOST || parsedBaseUrl.hostname;
const serverPort = process.env.PLAYWRIGHT_SERVER_PORT
  || parsedBaseUrl.port
  || (parsedBaseUrl.protocol === 'https:' ? '443' : '80');
const dbPath = process.env.PLAYWRIGHT_DB_PATH || './data/test.sqlite';
const reporter = [['list']];

if (!disableHtmlReport) {
  reporter.push(['html', { open: 'never', outputFolder: htmlReportDir }]);
}

fs.mkdirSync(tempDir, { recursive: true });
fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(htmlReportDir, { recursive: true });
process.env.TMPDIR = process.env.TMPDIR || tempDir;
process.env.TMP = process.env.TMP || tempDir;
process.env.TEMP = process.env.TEMP || tempDir;

const config = defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: {
    timeout: 10_000
  },
  outputDir,
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 1,
  reporter,
  use: {
    baseURL,
    ignoreHTTPSErrors: process.env.PLAYWRIGHT_IGNORE_HTTPS_ERRORS === '1',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    reducedMotion: 'reduce',
    permissions: ['microphone'],
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream'
      ]
    }
  }
});

if (!skipWebServer) {
  config.webServer = {
    command: 'node src/test/startPlaywrightServer.js',
    url: baseURL,
    reuseExistingServer,
    timeout: 120_000,
    env: {
      ...process.env,
      HOST: serverHost,
      PORT: serverPort,
      HTTP_PORT: process.env.HTTP_PORT || serverPort,
      HTTPS_PORT: process.env.HTTPS_PORT || '3443',
      HTTPS_ENABLED: process.env.HTTPS_ENABLED || '0',
      TLS_MODE: process.env.TLS_MODE || '',
      TLS_CERT: process.env.TLS_CERT || '',
      TLS_KEY: process.env.TLS_KEY || '',
      TLS_SELF_SIGNED_CERT: process.env.TLS_SELF_SIGNED_CERT || '',
      TLS_SELF_SIGNED_KEY: process.env.TLS_SELF_SIGNED_KEY || '',
      VOICE_REQUIRE_SECURE_ORIGIN: process.env.VOICE_REQUIRE_SECURE_ORIGIN || '1',
      VOICE_REQUIRE_TURN: process.env.VOICE_REQUIRE_TURN || '1',
      STUN_URLS: process.env.STUN_URLS || 'stun:stun.l.google.com:19302',
      TURN_URLS: process.env.TURN_URLS || 'turn:127.0.0.1:3478?transport=udp',
      TURN_USER: process.env.TURN_USER || 'apeiron',
      TURN_PASS: process.env.TURN_PASS || 'apeiron-dev-secret',
      TRUST_PROXY: process.env.TRUST_PROXY || '0',
      DB_PATH: dbPath,
      APP_TEST_MODE: '1'
    }
  };
}

module.exports = config;
