import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { TenantService } from './tenant.service';
import { AuthService } from './auth.service';

export interface SubscriptionAccessSnapshot {
  status: string;
  allows_gated_access: boolean;
  gated_modules?: string[];
  subscription_ends_at?: string | null;
  grace_ends_at?: string | null;
  days_until_end?: number | null;
  grace_period_days?: number;
  expiring_warning_days?: number;
}

const WARN_STATUSES = new Set(['EXPIRING', 'GRACE_PERIOD', 'EXPIRED', 'SUSPENDED']);
const BLOCKED_STATUSES = new Set(['EXPIRED', 'SUSPENDED']);

@Injectable({ providedIn: 'root' })
export class SubscriptionAccessService {
  private readonly tenantService = inject(TenantService);
  private readonly authService = inject(AuthService);

  private readonly snapshotSubject = new BehaviorSubject<SubscriptionAccessSnapshot | null>(null);
  private readonly loadingSubject = new BehaviorSubject<boolean>(false);
  private loadedForTenantId: number | null = null;

  readonly snapshot$: Observable<SubscriptionAccessSnapshot | null> = this.snapshotSubject.asObservable();
  readonly loading$: Observable<boolean> = this.loadingSubject.asObservable();

  get snapshot(): SubscriptionAccessSnapshot | null {
    return this.snapshotSubject.value;
  }

  /** Soft-gate: gated modules blocked when EXPIRED / SUSPENDED. */
  get allowsGatedAccess(): boolean {
    const snap = this.snapshotSubject.value;
    if (!snap) {
      return true;
    }
    return !!snap.allows_gated_access && !BLOCKED_STATUSES.has(snap.status);
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
      return;
    }

    this.refresh().subscribe();
  }

  refresh(): Observable<SubscriptionAccessSnapshot | null> {
    const user = this.authService.currentUserValue;
    if (!user?.tenant_id) {
      this.clear();
      return of(null);
    }

    this.loadingSubject.next(true);
    return this.tenantService.getSubscriptionAccess().pipe(
      map((res) => (res.success && res.data ? (res.data as SubscriptionAccessSnapshot) : null)),
      tap((snap) => {
        this.snapshotSubject.next(snap);
        this.loadedForTenantId = snap ? (user.tenant_id ?? null) : null;
        this.loadingSubject.next(false);
      }),
      catchError(() => {
        this.snapshotSubject.next(null);
        this.loadedForTenantId = null;
        this.loadingSubject.next(false);
        return of(null);
      })
    );
  }

  clear(): void {
    this.snapshotSubject.next(null);
    this.loadedForTenantId = null;
    this.loadingSubject.next(false);
  }
}
