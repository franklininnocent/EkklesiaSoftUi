import { Injectable, inject, signal, computed } from '@angular/core';
import { BehaviorSubject, Observable, of, interval, fromEvent } from 'rxjs';
import { catchError, map, tap, filter, switchMap } from 'rxjs/operators';
import { TenantService } from './tenant.service';
import { AuthService } from './auth.service';

export type SubscriptionAccessMode = 'full' | 'read_only';

export interface SubscriptionAccessSnapshot {
  status: string;
  access_mode?: SubscriptionAccessMode;
  is_read_only?: boolean;
  allows_gated_access: boolean;
  gated_modules?: string[];
  subscription_ends_at?: string | null;
  grace_ends_at?: string | null;
  days_until_end?: number | null;
  grace_period_days?: number;
  expiring_warning_days?: number;
  write_policy?: string;
}

const WARN_STATUSES = new Set(['EXPIRING', 'GRACE_PERIOD', 'EXPIRED', 'SUSPENDED']);

@Injectable({ providedIn: 'root' })
export class SubscriptionAccessService {
  private readonly tenantService = inject(TenantService);
  private readonly authService = inject(AuthService);

  private readonly snapshotSubject = new BehaviorSubject<SubscriptionAccessSnapshot | null>(null);
  private readonly loadingSubject = new BehaviorSubject<boolean>(false);
  private loadedForTenantId: number | null = null;
  private pollStarted = false;

  readonly snapshotSignal = signal<SubscriptionAccessSnapshot | null>(null);
  readonly loadingSignal = signal(false);

  readonly isReadOnly = computed(() => {
    const snap = this.snapshotSignal();
    const user = this.authService.currentUserValue;
    if (!user?.tenant_id) {
      return false;
    }
    if (!snap) {
      return true;
    }
    return snap.access_mode === 'read_only' || snap.is_read_only === true;
  });

  readonly canViewGatedModules = computed(() => {
    const snap = this.snapshotSignal();
    if (!snap) {
      return true;
    }
    return !!snap.allows_gated_access;
  });

  readonly snapshot$: Observable<SubscriptionAccessSnapshot | null> = this.snapshotSubject.asObservable();
  readonly loading$: Observable<boolean> = this.loadingSubject.asObservable();

  get snapshot(): SubscriptionAccessSnapshot | null {
    return this.snapshotSubject.value;
  }

  /** @deprecated Use canViewGatedModules signal — expired tenants may still view entitled modules. */
  get allowsGatedAccess(): boolean {
    return this.canViewGatedModules();
  }

  get shouldShowBanner(): boolean {
    const status = this.snapshotSubject.value?.status;
    return !!status && WARN_STATUSES.has(status);
  }

  ensureLoaded(): void {
    const user = this.authService.currentUserValue;
    if (!user?.tenant_id) {
      this.clear();
      return;
    }

    if (this.loadedForTenantId === user.tenant_id && this.snapshotSubject.value) {
      this.startPollingIfNeeded();
      return;
    }

    this.refresh().subscribe();
    this.startPollingIfNeeded();
  }

  refresh(): Observable<SubscriptionAccessSnapshot | null> {
    const user = this.authService.currentUserValue;
    if (!user?.tenant_id) {
      this.clear();
      return of(null);
    }

    this.loadingSubject.next(true);
    this.loadingSignal.set(true);

    return this.tenantService.getSubscriptionAccess().pipe(
      map((res) => (res.success && res.data ? (res.data as SubscriptionAccessSnapshot) : null)),
      tap((snap) => {
        this.applySnapshot(snap, user.tenant_id ?? null);
      }),
      catchError(() => {
        this.applySnapshot(null, null);
        return of(null);
      })
    );
  }

  clear(): void {
    this.applySnapshot(null, null);
  }

  private applySnapshot(snap: SubscriptionAccessSnapshot | null, tenantId: number | null): void {
    this.snapshotSubject.next(snap);
    this.snapshotSignal.set(snap);
    this.loadedForTenantId = snap ? tenantId : null;
    this.loadingSubject.next(false);
    this.loadingSignal.set(false);
  }

  private startPollingIfNeeded(): void {
    if (this.pollStarted || !this.authService.currentUserValue?.tenant_id) {
      return;
    }
    this.pollStarted = true;

    interval(60_000)
      .pipe(
        filter(() => !!this.authService.currentUserValue?.tenant_id),
        switchMap(() => this.refresh())
      )
      .subscribe();

    fromEvent(document, 'visibilitychange')
      .pipe(
        filter(() => document.visibilityState === 'visible'),
        switchMap(() => this.refresh())
      )
      .subscribe();
  }
}
