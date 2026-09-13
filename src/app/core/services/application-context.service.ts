import { Injectable, inject } from '@angular/core';
import { Observable, combineLatest, map } from 'rxjs';
import { User } from '@core/models';
import { AuthService } from '@core/services/auth.service';
import { SupportSessionService } from '@features/support-center/services/support-session.service';

export type ActorKind = 'platform' | 'tenant';
export type ApplicationContext = 'EKKLESIA' | 'TENANT';
/** @deprecated Use ApplicationContext — kept for callers expecting *_MODE suffix. */
export type ApplicationMode = 'EKKLESIA_MODE' | 'TENANT_MODE';

export interface NavigationSnapshot {
  actorKind: ActorKind;
  application: ApplicationContext;
  supportActive: boolean;
  targetTenantId: number | null;
}

@Injectable({ providedIn: 'root' })
export class ApplicationContextService {
  private readonly auth = inject(AuthService);
  private readonly supportSessions = inject(SupportSessionService);

  readonly actorKind$: Observable<ActorKind> = this.auth.currentUser$.pipe(
    map((user) => this.resolveActorKind(user))
  );

  readonly applicationMode$: Observable<ApplicationMode> = combineLatest([
    this.auth.currentUser$,
    this.supportSessions.session$,
  ]).pipe(map(([user]) => this.resolveApplicationMode(user)));

  readonly navigationSnapshot$: Observable<NavigationSnapshot> = combineLatest([
    this.auth.currentUser$,
    this.supportSessions.session$,
  ]).pipe(map(([user]) => this.resolveNavigationSnapshot(user)));

  resolveActorKind(user: User | null = this.auth.currentUserValue): ActorKind {
    return this.auth.isPlatformActor(user) ? 'platform' : 'tenant';
  }

  resolveApplicationContext(user: User | null = this.auth.currentUserValue): ApplicationContext {
    if (!user || !this.auth.isPlatformActor(user)) {
      return 'TENANT';
    }

    return 'EKKLESIA';
  }

  resolveApplicationMode(user: User | null = this.auth.currentUserValue): ApplicationMode {
    return this.resolveApplicationContext(user) === 'EKKLESIA' ? 'EKKLESIA_MODE' : 'TENANT_MODE';
  }

  resolveNavigationSnapshot(user: User | null = this.auth.currentUserValue): NavigationSnapshot {
    const supportActive = this.hasSupportTenantContext(user);

    return {
      actorKind: this.resolveActorKind(user),
      application: this.resolveApplicationContext(user),
      supportActive,
      targetTenantId: supportActive
        ? (this.supportSessions.currentSession?.tenant_id ?? null)
        : (user?.tenant_id ?? null),
    };
  }

  /** Home tenant or platform Support overlay — for parish routes/APIs, not sidebar. */
  hasParishResourceContext(user: User | null = this.auth.currentUserValue): boolean {
    if (!user) {
      return false;
    }

    if (user.tenant_id) {
      return true;
    }

    return this.auth.isPlatformActor(user) && this.supportSessions.isSessionLive;
  }

  hasSupportTenantContext(user: User | null = this.auth.currentUserValue): boolean {
    return this.auth.isPlatformActor(user) && this.supportSessions.isSessionLive;
  }

  getCurrentSupportContext() {
    return this.supportSessions.currentSession;
  }

  resourceTenantId(user: User | null = this.auth.currentUserValue): number | null {
    if (!user) {
      return null;
    }

    if (this.hasSupportTenantContext(user)) {
      return this.supportSessions.currentSession?.tenant_id ?? null;
    }

    return user.tenant_id ?? null;
  }
}
