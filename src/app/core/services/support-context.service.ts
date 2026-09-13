import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, of, switchMap, tap } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { SubscriptionAccessService } from '@core/services/subscription-access.service';
import {
  StartSupportSessionPayload,
  SupportSession,
} from '@features/support-center/models/support-access.model';
import { SupportSessionService } from '@features/support-center/services/support-session.service';

/**
 * Centralized Support tenant-context lifecycle.
 * Platform operators enter/exit tenant overlay without changing authenticated identity.
 */
@Injectable({ providedIn: 'root' })
export class SupportContextService {
  private readonly sessions = inject(SupportSessionService);
  private readonly auth = inject(AuthService);
  private readonly subscriptionAccess = inject(SubscriptionAccessService);
  private readonly router = inject(Router);

  getCurrentSupportContext(): SupportSession | null {
    return this.sessions.currentSession;
  }

  hasSupportTenantContext(): boolean {
    return this.auth.isPlatformActor() && this.sessions.isSessionLive;
  }

  enterSupportContext(payload: StartSupportSessionPayload): Observable<SupportSession> {
    if (this.sessions.isSessionLive) {
      return this.replaceSupportContext(payload);
    }

    return this.sessions.start(payload);
  }

  replaceSupportContext(payload: StartSupportSessionPayload): Observable<SupportSession> {
    const current = this.sessions.currentSession;
    if (!current) {
      return this.sessions.start(payload);
    }

    return this.sessions.end(current.id).pipe(
      switchMap(() => {
        this.subscriptionAccess.clear();
        return this.sessions.start(payload);
      })
    );
  }

  /**
   * End server session, clear overlay caches, keep login, redirect to identity landing.
   */
  exitSupportContext(): Observable<void> {
    const session = this.sessions.currentSession;
    if (!session) {
      this.teardownLocalOverlay();
      this.navigateAfterExit();
      return of(undefined);
    }

    return this.sessions.end(session.id).pipe(
      tap(() => {
        this.teardownLocalOverlay();
        this.navigateAfterExit();
      }),
      switchMap(() => of(undefined))
    );
  }

  /** Local-only teardown when session already ended server-side or on login identity change. */
  clearLocalSupportOverlay(): void {
    this.sessions.clearSession();
    this.subscriptionAccess.clear();
  }

  private teardownLocalOverlay(): void {
    this.sessions.clearSession();
    this.subscriptionAccess.clear();
  }

  private navigateAfterExit(): void {
    void this.router.navigate(['/dashboard'], { replaceUrl: true });
  }
}
