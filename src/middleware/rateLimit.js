const buckets = new Map();

function createRateLimiter({ windowMs, max, keyFn }) {
  return function rateLimit(req, res, next) {
    const isProduction = String(process.env.NODE_ENV || 'development').toLowerCase() === 'production';
    if (!isProduction) {
      return next();
    }

    const key = keyFn ? keyFn(req) : req.ip;
    const now = Date.now();

    const bucket = buckets.get(key) || { hits: 0, resetAt: now + windowMs };

    if (now > bucket.resetAt) {
      bucket.hits = 0;
      bucket.resetAt = now + windowMs;
    }

    bucket.hits += 1;
    buckets.set(key, bucket);

    if (bucket.hits > max) {
      return res.status(429).render('pages/error', {
        title: 'Rate-Limit',
        code: 429,
        message: 'Zu viele Anfragen. Bitte in einer Minute erneut versuchen.',
        currentUser: req.currentUser
      });
    }

    return next();
  };
}

module.exports = { createRateLimiter };
