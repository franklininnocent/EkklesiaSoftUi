import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

// #region agent log
const __dbg = (message: string, hypothesisId: string, data: Record<string, unknown> = {}) => {
  fetch('http://127.0.0.1:7631/ingest/5401a346-7001-4033-9c37-4ee605985cd9', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'ae66ec' },
    body: JSON.stringify({
      sessionId: 'ae66ec',
      runId: 'pre-fix',
      hypothesisId,
      location: 'main.ts',
      message,
      data: { href: typeof location !== 'undefined' ? location.href : '', ...data },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
};
window.addEventListener('error', (e) => {
  __dbg('window.error', 'A', { msg: String(e.message), file: String(e.filename || ''), line: e.lineno });
});
window.addEventListener('unhandledrejection', (e) => {
  __dbg('unhandledrejection', 'A', { reason: String((e as PromiseRejectionEvent).reason) });
});
__dbg('main.ts evaluated', 'D', { ready: document.readyState, overlay: !!document.querySelector('vite-error-overlay') });
// #endregion

bootstrapApplication(AppComponent, appConfig)
  .then(() => {
    // #region agent log
    __dbg('bootstrap success', 'A', { overlay: !!document.querySelector('vite-error-overlay') });
    // #endregion
  })
  .catch((err) => {
    // #region agent log
    __dbg('bootstrap failed', 'A', { err: String(err) });
    // #endregion
    console.error(err);
  });
