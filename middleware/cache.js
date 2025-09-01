'use strict';

// In-memory TTL cache keyed by request URL.
// Supports caching for responses produced via res.json or res.send.
// Preserves status code; adds 'X-Cache: HIT|MISS' headers.
// Use only on idempotent GET routes.

const store = new Map(); // key: url, value: { status, isJson, body, expiryMs }

function cache(ttlSeconds = 30) {
  return function cacheMiddleware(req, res, next) {
    try {
      if (req.method !== 'GET') return next();

      const key = req.originalUrl || req.url;
      const now = Date.now();
      const hit = store.get(key);

      if (hit && hit.expiryMs > now) {
        res.set('X-Cache', 'HIT');
        if (hit.isJson) {
          return res.status(hit.status || 200).json(hit.body);
        } else {
          return res.status(hit.status || 200).send(hit.body);
        }
      }

      // Wrap both res.json and res.send to capture payload
      const originalJson = res.json.bind(res);
      const originalSend = res.send.bind(res);

      res.json = (body) => {
        try {
          store.set(key, {
            status: res.statusCode || 200,
            isJson: true,
            body,
            expiryMs: now + ttlSeconds * 1000
          });
          res.set('X-Cache', 'MISS');
        } catch (_) {
          // best-effort cache; never block response
        }
        return originalJson(body);
      };

      res.send = (body) => {
        try {
          store.set(key, {
            status: res.statusCode || 200,
            isJson: false,
            body,
            expiryMs: now + ttlSeconds * 1000
          });
          res.set('X-Cache', 'MISS');
        } catch (_) {
          // best-effort cache; never block response
        }
        return originalSend(body);
      };

      return next();
    } catch (_) {
      return next(); // never block requests due to cache errors
    }
  };
}

module.exports = cache;
