const fs = require('fs');
const path = require('path');
const { nanoid } = require('nanoid');

const GENERIC_PROFILE_ASSETS = Object.freeze({
  avatar: '/public/ressources/Small.png',
  banner: '/public/ressources/Medium.png'
});

const LOCAL_PROFILE_DEFAULTS = Object.freeze({
  sokrates: {
    avatar: '/public/ressources/DerDichterundDenker.jpg',
    banner: '/public/ressources/NyaUwuUsoWarm.jpg'
  },
  einstein: {
    avatar: '/public/ressources/Big.png',
    banner: '/public/ressources/NyaUwuUsoWarm.jpg'
  },
  euler: {
    avatar: '/public/ressources/Medium.png',
    banner: '/public/ressources/ufoglorp.png'
  },
  platon: {
    avatar: '/public/ressources/Small.png',
    banner: '/public/ressources/DerDichterundDenker.jpg'
  },
  lovelace: {
    avatar: '/public/ressources/cat.png',
    banner: '/public/ressources/Big.png'
  },
  curie: {
    avatar: '/public/ressources/ufoglorp.png',
    banner: '/public/ressources/Medium.png'
  },
  bohr: {
    avatar: '/public/ressources/Big.png',
    banner: '/public/ressources/Small.png'
  }
});

const IMAGE_MIME_TYPES = Object.freeze([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif'
]);

const PHOTO_MIME_TYPES = Object.freeze([
  ...IMAGE_MIME_TYPES,
  'video/mp4'
]);

const EXTENSIONS_BY_MIME = Object.freeze({
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4'
});

function isDataUrl(value) {
  return String(value || '').trim().startsWith('data:');
}

function isUploadUrl(value) {
  return String(value || '').trim().startsWith('/uploads/');
}

function isPublicUrl(value) {
  return String(value || '').trim().startsWith('/public/');
}

function resolveProfileAsset(profile = {}, kind = 'avatar') {
  const normalizedKind = kind === 'banner' ? 'banner' : 'avatar';
  const explicitValue = String(
    normalizedKind === 'banner'
      ? (profile.banner_url || '')
      : (profile.avatar_url || '')
  ).trim();
  const username = String(profile.username || '').toLowerCase();
  const localDefaults = profile.is_system_agent
    ? LOCAL_PROFILE_DEFAULTS.sokrates
    : (LOCAL_PROFILE_DEFAULTS[username] || null);
  const localDefault = String(localDefaults?.[normalizedKind] || GENERIC_PROFILE_ASSETS[normalizedKind] || '').trim();

  if (isUploadUrl(explicitValue) || isDataUrl(explicitValue) || isPublicUrl(explicitValue)) {
    return {
      src: explicitValue,
      fallback: localDefault || explicitValue
    };
  }

  if (localDefault) {
    return {
      src: localDefault,
      fallback: localDefault
    };
  }

  if (explicitValue) {
    return {
      src: explicitValue,
      fallback: GENERIC_PROFILE_ASSETS[normalizedKind] || ''
    };
  }

  return {
    src: GENERIC_PROFILE_ASSETS[normalizedKind] || '',
    fallback: GENERIC_PROFILE_ASSETS[normalizedKind] || ''
  };
}

function resolveProfileAssets(profile = {}) {
  const avatar = resolveProfileAsset(profile, 'avatar');
  const banner = resolveProfileAsset(profile, 'banner');
  return {
    avatar_url: avatar.src,
    avatar_fallback_url: avatar.fallback,
    banner_url: banner.src,
    banner_fallback_url: banner.fallback
  };
}

function parseDataUrl(dataUrl) {
  const match = String(dataUrl || '').trim().match(/^data:([^;,]+);base64,([a-zA-Z0-9+/=]+)$/);
  if (!match) {
    throw new Error('invalid_data_url');
  }

  const mimeType = String(match[1] || '').toLowerCase();
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length) {
    throw new Error('empty_upload');
  }

  return {
    mimeType,
    buffer
  };
}

function writeDataUrlToUploads({
  dataUrl,
  userId,
  subdir = 'profile-assets',
  prefix = 'asset',
  allowedMimeTypes = IMAGE_MIME_TYPES,
  maxBytes = 8 * 1024 * 1024
}) {
  const { mimeType, buffer } = parseDataUrl(dataUrl);
  if (!allowedMimeTypes.includes(mimeType)) {
    throw new Error('unsupported_media_type');
  }
  if (buffer.length > Number(maxBytes || 0)) {
    throw new Error('file_too_large');
  }

  const extension = EXTENSIONS_BY_MIME[mimeType];
  if (!extension) {
    throw new Error('unsupported_media_type');
  }

  const ownerId = Math.max(1, Number(userId || 0));
  const relativeDir = path.join('uploads', subdir, String(ownerId));
  const absoluteDir = path.join(process.cwd(), relativeDir);
  fs.mkdirSync(absoluteDir, { recursive: true });

  const fileName = `${prefix}-${Date.now()}-${nanoid(8)}.${extension}`;
  fs.writeFileSync(path.join(absoluteDir, fileName), buffer);

  return `/${path.join(relativeDir, fileName).replaceAll(path.sep, '/')}`;
}

module.exports = {
  GENERIC_PROFILE_ASSETS,
  IMAGE_MIME_TYPES,
  LOCAL_PROFILE_DEFAULTS,
  PHOTO_MIME_TYPES,
  isDataUrl,
  resolveProfileAssets,
  writeDataUrlToUploads
};
