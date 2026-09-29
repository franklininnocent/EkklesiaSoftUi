const { execFileSync } = require('child_process');

/**
 * Dev proxy target for `ng serve`.
 * Override with API_PROXY_TARGET=http://127.0.0.1:8001 when needed.
 */
function pickApiTarget() {
  if (process.env.API_PROXY_TARGET) {
    return process.env.API_PROXY_TARGET;
  }

  for (const port of [8000, 8001, 8080]) {
    try {
      execFileSync(
        'curl',
        ['-sf', '-o', '/dev/null', `http://127.0.0.1:${port}/up`],
        { stdio: 'ignore', timeout: 1000 }
      );
      const target = `http://127.0.0.1:${port}`;
      console.log(`[proxy] Forwarding /api and /storage to ${target}`);
      return target;
    } catch {
      // try next port
    }
  }

  console.warn('[proxy] No API found on 8000/8001/8080 — defaulting to http://127.0.0.1:8000');
  return 'http://127.0.0.1:8000';
}

const target = pickApiTarget();

module.exports = {
  '/api': {
    target,
    secure: false,
    changeOrigin: true,
  },
  '/storage': {
    target,
    secure: false,
    changeOrigin: true,
  },
};
