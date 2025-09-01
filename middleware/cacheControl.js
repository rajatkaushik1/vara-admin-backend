'use strict';

// Sets Cache-Control: public, max-age=<seconds>, stale-while-revalidate=<half of seconds> (best-effort).
// Use on read-only GET endpoints like trending/new/genres/subgenres to reduce 304 revalidations and cut XHRs.
function cacheControl(seconds = 60) {
  const sMaxAge = Math.max(0, Math.floor(seconds / 2));
  return function cacheControlMiddleware(req, res, next) {
    try {
      // Only set for GET responses
      if (req.method === 'GET') {
        res.set('Cache-Control', `public, max-age=${seconds}, stale-while-revalidate=${sMaxAge}`);
      }
    } catch (_) {
      // best-effort; never block
    }
    next();
  };
}

module.exports = cacheControl;
