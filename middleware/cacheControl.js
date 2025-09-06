'use strict';

// Sets Cache-Control to encourage browser disk caching and reduce revalidation.
// Example header: "public, max-age=600, stale-while-revalidate=300, immutable"
function cacheControl(seconds = 60) {
  const sMaxAge = Math.max(0, Math.floor(seconds / 2));
  return function cacheControlMiddleware(req, res, next) {
    try {
      if (req.method === 'GET') {
        const parts = [
          `public`,
          `max-age=${Math.max(0, seconds)}`,
          `stale-while-revalidate=${sMaxAge}`,
          // "immutable" hints that the resource won't change during max-age,
          // allowing browsers to use disk cache without revalidation.
          `immutable`
        ];
        res.set('Cache-Control', parts.join(', '));
      }
    } catch (_) {
      // best-effort; never block
    }
    next();
  };
}

module.exports = cacheControl;
