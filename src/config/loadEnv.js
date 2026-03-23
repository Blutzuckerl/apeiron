const fs = require('fs');
const path = require('path');

let loaded = false;

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function loadEnv() {
  if (loaded) {
    return;
  }
  loaded = true;

  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, 'utf8');
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }

    const idx = trimmed.indexOf('=');
    if (idx <= 0) {
      return;
    }

    const key = trimmed.slice(0, idx).trim();
    if (!key || Object.prototype.hasOwnProperty.call(process.env, key)) {
      return;
    }

    const value = stripQuotes(trimmed.slice(idx + 1).trim());
    process.env[key] = value;
  });
}

module.exports = { loadEnv };
