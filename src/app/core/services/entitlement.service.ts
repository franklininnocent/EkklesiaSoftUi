import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, of } from 'rxjs';
import { catchError, finalize, map, shareReplay, tap } from 'rxjs/operators';
import { environment } from '@environments/environment';
import { AuthService } from './auth.service';
import { SubscriptionAccessService } from './subscription-access.service';

export interface EntitlementPlan {
  code: string | null;
  key: string | null;
  name: string | null;
  pricing_type: string | null;
  is_legacy: boolean;
  version_number: number | null;
}

export interface EntitlementMap {
  source: string;
  engine_mode: string;
  plan: EntitlementPlan | null;
  /** Feature code → available. Already reflects the server's rollout mode. */
  features: Record<string, boolean>;
  feature_names: Record<string, string>;
  /** Limit code → number, or null for unlimited. */
  limits: Record<string, number | null>;
  limits_enforced: boolean;
  hash: string;
}

/**
 * What the church's plan includes, for showing/hiding UI only.
 *
 * The API enforces every feature and limit server-side; this service never grants access.
 * While the map is loading (or for platform staff outside a church) features read as available
 * so screens do not flicker — any blocked call still gets a clear server response.
 */
@Injectable({ providedIn: 'root' })
export class EntitlementService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly access = inject(SubscriptionAccessService);

  private readonly mapSignal = signal<EntitlementMap | null>(null);
  private loadedForTenantId: number | null = null;
  private loadedVersion: string | null = null;
  private inflight$: Observable<EntitlementMap | null> | null = null;
  private watchingVersion = false;

  readonly entitlements = this.mapSignal.asReadonly();
  readonly entitlements$ = toObservable(this.mapSignal);
  readonly plan = computed(() => this.mapSignal()?.plan ?? null);

  /** After the first load, the access poll tells us when the plan changed server-side. */
  private watchVersion(): void {
    if (this.watchingVersion) return;
    this.watchingVersion = true;
    this.access.snapshot$.subscribe((snap) => {
      const version = snap?.entitlements_version;
      if (version && this.loadedVersion !== null && version !== this.loadedVersion) {
        this.refresh().subscribe();
      }
    });
  }

  /** Plan gating applies only to users who belong to a church. */
  appliesToCurrentUser(): boolean {
    return !!this.auth.currentUserValue?.tenant_id;
  }

  hasFeature(code: string): boolean {
    if (!this.appliesToCurrentUser()) return true;
    const map = this.mapSignal();
    if (!map) return true;
    return map.features[code.toUpperCase()] !== false;
  }

  hasAllFeatures(codes: readonly string[]): boolean {
    return codes.every((code) => this.hasFeature(code));
  }

  featureName(code: string): string {
    const upper = code.toUpperCase();
    return this.mapSignal()?.feature_names[upper] ?? upper.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
  }

  /** Numeric limit, null for unlimited, undefined when unknown. */
  getLimit(code: string): number | null | undefined {
    const limits = this.mapSignal()?.limits;
    if (!limits || !(code.toUpperCase() in limits)) return undefined;
    return limits[code.toUpperCase()];
  }

  isWithinLimit(code: string, currentUsage: number, adding = 1): boolean {
    const map = this.mapSignal();
    if (!this.appliesToCurrentUser() || !map?.limits_enforced) return true;
    const limit = this.getLimit(code);
    return limit === null || limit === undefined || currentUsage + adding <= limit;
  }

  /** Loads (or reuses) the map for the signed-in church. Never errors. */
  load(): Observable<EntitlementMap | null> {
    const tenantId = this.auth.currentUserValue?.tenant_id ?? null;
    if (!tenantId) {
      this.clear();
      return of(null);
    }
    const current = this.mapSignal();
    if (current && this.loadedForTenantId === tenantId) {
      return of(current);
    }
    return this.refresh();
  }

  refresh(): Observable<EntitlementMap | null> {
    const tenantId = this.auth.currentUserValue?.tenant_id ?? null;
    if (!tenantId) {
      this.clear();
      return of(null);
    }
    if (this.inflight$) return this.inflight$;

    this.inflight$ = this.http.get<{ success: boolean; data: EntitlementMap }>(`${environment.apiUrl}/tenant/entitlements`).pipe(
      map((res) => (res?.success && res.data ? res.data : null)),
      tap((data) => {
        if (data) {
          this.mapSignal.set(data);
          this.loadedForTenantId = tenantId;
          this.loadedVersion = data.hash;
          this.watchVersion();
        }
      }),
      catchError(() => of(this.mapSignal())),
      finalize(() => {
        this.inflight$ = null;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.inflight$;
  }

  clear(): void {
    this.mapSignal.set(null);
    this.loadedForTenantId = null;
    this.loadedVersion = null;
  }
}
