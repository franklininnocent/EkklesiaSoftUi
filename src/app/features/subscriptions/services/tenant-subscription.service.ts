import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { environment } from '@environments/environment';
import { PublicPlanCard } from '../models/subscription-admin.models';
import {
  SubmitUpgradeRequestPayload,
  TenantSubscriptionOverview,
  UpgradeRequest,
  UsageRow,
} from '../models/tenant-subscription.models';

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

/** Church-facing subscription reads. Plans and prices always come from the API catalog. */
@Injectable({ providedIn: 'root' })
export class TenantSubscriptionService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;
  private publicPlans$: Observable<PublicPlanCard[]> | null = null;

  /** Published public plans (cached for the session; failures yield an empty list). */
  publicPlans(): Observable<PublicPlanCard[]> {
    if (!this.publicPlans$) {
      this.publicPlans$ = this.http.get<ApiEnvelope<PublicPlanCard[]>>(`${this.base}/public/subscription-plans`).pipe(
        map((res) => (Array.isArray(res?.data) ? res.data : [])),
        catchError(() => {
          this.publicPlans$ = null;
          return of([] as PublicPlanCard[]);
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    }
    return this.publicPlans$;
  }

  overview(): Observable<TenantSubscriptionOverview> {
    return this.http
      .get<ApiEnvelope<TenantSubscriptionOverview>>(`${this.base}/tenant/subscription/overview`)
      .pipe(map((res) => res.data));
  }

  usage(): Observable<UsageRow[]> {
    return this.http
      .get<ApiEnvelope<{ usage: UsageRow[] } | UsageRow[]>>(`${this.base}/tenant/subscription/usage`)
      .pipe(map((res) => (Array.isArray(res.data) ? res.data : res.data?.usage ?? [])));
  }

  upgradeRequests(): Observable<UpgradeRequest[]> {
    return this.http
      .get<ApiEnvelope<UpgradeRequest[]>>(`${this.base}/tenant/subscription/upgrade-requests`)
      .pipe(map((res) => (Array.isArray(res?.data) ? res.data : [])));
  }

  /** The church is taken from the signed-in session; only the chosen plan code is sent. */
  submitUpgradeRequest(payload: SubmitUpgradeRequestPayload): Observable<{ request: UpgradeRequest; message: string }> {
    return this.http
      .post<ApiEnvelope<UpgradeRequest>>(`${this.base}/tenant/subscription/upgrade-requests`, payload)
      .pipe(map((res) => ({ request: res.data, message: res.message ?? 'Your request has been sent.' })));
  }
}
