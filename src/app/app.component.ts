import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfirmationDialogHostComponent, ToastContainerComponent } from '@shared/components';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastContainerComponent, ConfirmationDialogHostComponent],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'EkklesiaSoft';

  constructor() {
    // #region agent log
    fetch('http://127.0.0.1:7631/ingest/5401a346-7001-4033-9c37-4ee605985cd9', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'ae66ec' },
      body: JSON.stringify({
        sessionId: 'ae66ec',
        runId: 'pre-fix',
        hypothesisId: 'A',
        location: 'app.component.ts:constructor',
        message: 'AppComponent constructed',
        data: { href: location.href },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  }
}

