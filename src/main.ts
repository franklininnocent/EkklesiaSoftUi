import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

// #region agent log
const __debugLog = (message: string, data: Record<string, unknown>, hypothesisId: string) => {
  fetch('http://127.0.0.1:7631/ingest/5401a346-7001-4033-9c37-4ee605985cd9', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '0c9b95' },
    body: JSON.stringify({
      sessionId: '0c9b95',
      location: 'main.ts',
      message,
      data,
      hypothesisId,
      timestamp: Date.now(),
      runId: 'app-load-debug',
    }),
  }).catch(() => {});
};
__debugLog('main.ts executing', { href: window.location.href, readyState: document.readyState }, 'H2');
// #endregion

bootstrapApplication(AppComponent, appConfig)
  .then(() => {
    // #region agent log
    __debugLog('bootstrapApplication resolved', { href: window.location.href }, 'H2');
    // #endregion
  })
  .catch((err) => {
    // #region agent log
    __debugLog('bootstrapApplication failed', { error: String(err), name: err?.name }, 'H2');
    // #endregion
    console.error(err);
  });

