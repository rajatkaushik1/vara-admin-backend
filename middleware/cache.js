'use strict';

// In-memory TTL cache keyed by request URL (includes query string).
// Emits app-level X-VARA-Cache: HIT | MISS | BYPASS | BYPASS_AUTH (and also sets X-Cache for compatibility).
// Use only on idempotent GET routes.

const store = new Map(); // key: url, value: { status, isJson, body, expiryMs }

function cache(ttlSeconds = 30) {
  return function cacheMiddleware(req, res, next) {
    try {
      if (req.method !== 'GET') return next();

      const headerName = 'X-VARA-Cache';
      const key = req.originalUrl || req.url;
      const now = Date.now();

      // NEW: Bypass cache for authenticated requests (admin/sub-admin).
      // If Authorization header is present OR an upstream middleware (e.g., optionalAuth) attached req.user,
      // we avoid serving shared cached payloads to ensure role/ownership freshness.
      const hasAuthHeader = !!(req.headers?.authorization || req.headers?.Authorization);
      const hasUser = !!(req.user && req.user._id);
      if (hasAuthHeader || hasUser) {
        try {
          res.set(headerName, 'BYPASS_AUTH');
          res.set('X-Cache', 'BYPASS_AUTH');
        } catch (_) {}
        return next();
      }

      // Bypass switch for admin/debug:
      // - ?admin_nocache=... OR ?__nocache=1 OR header x-no-cache: 1
      const q = req.query || {};
      const bypass =
        Object.prototype.hasOwnProperty.call(q, 'admin_nocache') ||
        Object.prototype.hasOwnProperty.call(q, '__nocache') ||
        req.headers['x-no-cache'] === '1';

      if (bypass) {
        try {
          res.set(headerName, 'BYPASS');
          res.set('X-Cache', 'BYPASS'); // may be overridden by CDN; X-VARA-Cache is authoritative
          // Ensure client doesn’t store bypassed responses
          res.set('Cache-Control', 'no-store');
        } catch (_) {}
        return next();
      }

      const hit = store.get(key);
      if (hit && hit.expiryMs > now) {
        try {
          res.set(headerName, 'HIT');
          res.set('X-Cache', 'HIT'); // CDN may overwrite; use X-VARA-Cache for app-level signal
        } catch (_) {}
        if (hit.isJson) {
          return res.status(hit.status || 200).json(hit.body);
        } else {
          return res.status(hit.status || 200).send(hit.body);
        }
      }

      // Miss: wrap res.json and res.send to capture payload
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
          res.set(headerName, 'MISS');
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
          res.set(headerName, 'MISS');
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
