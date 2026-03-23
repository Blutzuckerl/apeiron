const fs = require('fs');
const path = require('path');
const { nanoid } = require('nanoid');

const IGDB_API_URL = 'https://api.igdb.com/v4/games';
const IGDB_IMAGE_HOST = 'images.igdb.com';
const IGDB_IMAGE_SIZE = 't_cover_big';
const POSITIVE_CACHE_MS = 1000 * 60 * 60 * 24 * 14;
const NEGATIVE_CACHE_MS = 1000 * 60 * 60 * 24 * 2;
const ERROR_CACHE_MS = 1000 * 60 * 60 * 12;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp']
]);

function normalizeGameTitle(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .slice(0, 160);
}

function buildIsoExpiry(ttlMs) {
  return new Date(Date.now() + ttlMs).toISOString();
}

function escapeIgdbSearch(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').slice(0, 160);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 7000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

function buildIgdbCoverUrl(imageId) {
  const safeId = String(imageId || '').trim();
  if (!safeId) {
    return '';
  }
  return `https://${IGDB_IMAGE_HOST}/igdb/image/upload/${IGDB_IMAGE_SIZE}/${safeId}.jpg`;
}

async function lookupIgdbCover(gameName) {
  const clientId = String(process.env.IGDB_CLIENT_ID || '').trim();
  const accessToken = String(process.env.IGDB_ACCESS_TOKEN || '').trim();
  if (!clientId || !accessToken) {
    return { ok: false, code: 'provider_unconfigured' };
  }

  const safeTitle = escapeIgdbSearch(gameName);
  if (!safeTitle) {
    return { ok: false, code: 'empty_title' };
  }

  const response = await fetchWithTimeout(IGDB_API_URL, {
    method: 'POST',
    headers: {
      'Client-ID': clientId,
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'text/plain'
    },
    body: `search "${safeTitle}"; fields name,cover.image_id; where cover != null & version_parent = null; limit 1;`
  }, 7000);

  if (!response.ok) {
    return { ok: false, code: 'provider_error' };
  }

  const json = await response.json().catch(() => []);
  const match = Array.isArray(json) ? json[0] : null;
  const imageId = String(match?.cover?.image_id || '').trim();
  if (!match || !imageId) {
    return { ok: false, code: 'not_found' };
  }

  return {
    ok: true,
    provider: 'igdb',
    matchedName: String(match.name || '').trim(),
    imageId,
    sourceUrl: buildIgdbCoverUrl(imageId),
    attribution: 'Cover metadata: IGDB'
  };
}

async function downloadRemoteCoverToUploads(remoteUrl, userId) {
  const parsed = new URL(String(remoteUrl || ''));
  if (parsed.protocol !== 'https:' || parsed.hostname !== IGDB_IMAGE_HOST) {
    throw new Error('invalid_cover_host');
  }

  const response = await fetchWithTimeout(parsed.toString(), {
    headers: {
      Accept: 'image/jpeg,image/png,image/webp'
    }
  }, 7000);

  if (!response.ok) {
    throw new Error('cover_fetch_failed');
  }

  const contentType = String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const extension = ALLOWED_IMAGE_TYPES.get(contentType);
  if (!extension) {
    throw new Error('cover_invalid_type');
  }

  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength > MAX_IMAGE_BYTES) {
    throw new Error('cover_too_large');
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) {
    throw new Error('cover_too_large');
  }

  const ownerId = Math.max(1, Number(userId || 0));
  const relativeDir = path.join('uploads', 'about-plus-media', String(ownerId));
  const absoluteDir = path.join(process.cwd(), relativeDir);
  fs.mkdirSync(absoluteDir, { recursive: true });

  const fileName = `favorite-game-cover-${Date.now()}-${nanoid(8)}.${extension}`;
  fs.writeFileSync(path.join(absoluteDir, fileName), buffer);

  return `/${path.join(relativeDir, fileName).replaceAll(path.sep, '/')}`;
}

async function resolveFavoriteGameCover({
  gameName,
  userId,
  cachedEntry,
  saveCacheEntry
}) {
  const normalizedName = normalizeGameTitle(gameName);
  if (!normalizedName) {
    return { ok: true, media: null, cacheStatus: 'empty' };
  }

  const now = Date.now();
  if (cachedEntry && cachedEntry.expires_at && Date.parse(cachedEntry.expires_at) > now) {
    if (cachedEntry.status === 'found' && String(cachedEntry.local_file_url || '').trim()) {
      return {
        ok: true,
        media: {
          file_url: String(cachedEntry.local_file_url || '').trim(),
          data_url: '',
          caption: ''
        },
        cacheStatus: 'hit'
      };
    }
    if (cachedEntry.status === 'not_found' || cachedEntry.status === 'error') {
      return { ok: true, media: null, cacheStatus: cachedEntry.status };
    }
  }

  let lookupResult;
  try {
    lookupResult = await lookupIgdbCover(gameName);
  } catch (_error) {
    lookupResult = { ok: false, code: 'provider_error' };
  }

  if (!lookupResult.ok) {
    if (lookupResult.code === 'provider_unconfigured' || lookupResult.code === 'empty_title') {
      return { ok: true, media: null, cacheStatus: lookupResult.code };
    }

    saveCacheEntry({
      normalized_name: normalizedName,
      provider: 'igdb',
      matched_name: '',
      image_id: '',
      source_url: '',
      local_file_url: '',
      attribution: '',
      status: lookupResult.code === 'not_found' ? 'not_found' : 'error',
      expires_at: buildIsoExpiry(lookupResult.code === 'not_found' ? NEGATIVE_CACHE_MS : ERROR_CACHE_MS)
    });
    return { ok: true, media: null, cacheStatus: lookupResult.code };
  }

  try {
    const localFileUrl = await downloadRemoteCoverToUploads(lookupResult.sourceUrl, userId);
    saveCacheEntry({
      normalized_name: normalizedName,
      provider: lookupResult.provider,
      matched_name: lookupResult.matchedName,
      image_id: lookupResult.imageId,
      source_url: lookupResult.sourceUrl,
      local_file_url: localFileUrl,
      attribution: lookupResult.attribution,
      status: 'found',
      expires_at: buildIsoExpiry(POSITIVE_CACHE_MS)
    });
    return {
      ok: true,
      media: {
        file_url: localFileUrl,
        data_url: '',
        caption: ''
      },
      cacheStatus: 'fetched'
    };
  } catch (_error) {
    saveCacheEntry({
      normalized_name: normalizedName,
      provider: 'igdb',
      matched_name: lookupResult.matchedName,
      image_id: lookupResult.imageId,
      source_url: lookupResult.sourceUrl,
      local_file_url: '',
      attribution: lookupResult.attribution,
      status: 'error',
      expires_at: buildIsoExpiry(ERROR_CACHE_MS)
    });
    return { ok: true, media: null, cacheStatus: 'download_error' };
  }
}

module.exports = {
  normalizeGameTitle,
  resolveFavoriteGameCover
};
