import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '@environments/environment';
import {
  MinistriesInsightsAdoptionAnalytics,
  MinistriesInsightsApiEnvelope,
  MinistriesInsightsAuditFilters,
  MinistriesInsightsAuditResponse,
  MinistriesInsightsFeaturesAnalytics,
  MinistriesInsightsHealthSummary,
  MinistriesInsightsOrgFilters,
  MinistriesInsightsOrgListResponse,
  MinistriesInsightsOrgRow,
  MinistriesInsightsOverview,
  MinistriesInsightsReportCatalogItem,
  MinistriesInsightsReportSummary,
  MinistriesInsightsTenantDetail,
  MinistriesInsightsTenantFilters,
  MinistriesInsightsTenantListResponse,
  MinistriesInsightsTenantRow,
  MinistriesInsightsTrendsAnalytics,
  MinistriesInsightsUsageAnalytics,
  MinistriesInsightsWindowDays,
} from '../models/ministries-insights.model';

@Injectable({ providedIn: 'root' })
export class MinistriesInsightsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin/ministries`;

  getOverview(windowDays: MinistriesInsightsWindowDays = 30): Observable<MinistriesInsightsOverview> {
    const params = new HttpParams().set('window_days', String(windowDays));
    return this.http
      .get<MinistriesInsightsApiEnvelope<MinistriesInsightsOverview>>(`${this.base}/overview`, { params })
      .pipe(map((res) => res.data));
  }

  getTenants(filters: MinistriesInsightsTenantFilters = {}): Observable<MinistriesInsightsTenantListResponse> {
    return this.http
      .get<MinistriesInsightsApiEnvelope<MinistriesInsightsTenantRow[]>>(`${this.base}/tenants`, {
        params: this.toParams(filters),
      })
      .pipe(
        map((res) => ({
          data: res.data ?? [],
          meta: res.meta ?? {
            current_page: 1,
            last_page: 1,
            per_page: filters.per_page ?? 25,
            total: 0,
            from: 0,
            to: 0,
          },
          window: res.window ?? { days: filters.window_days ?? 30, current_start: '', current_end: '' },
        }))
      );
  }

  getTenantDetail(
    tenantId: number,
    windowDays: MinistriesInsightsWindowDays = 30
  ): Observable<MinistriesInsightsTenantDetail> {
    const params = new HttpParams().set('window_days', String(windowDays));
    return this.http
      .get<MinistriesInsightsApiEnvelope<MinistriesInsightsTenantDetail>>(`${this.base}/tenants/${tenantId}`, {
        params,
      })
      .pipe(map((res) => res.data));
  }

  getOrganizations(filters: MinistriesInsightsOrgFilters = {}): Observable<MinistriesInsightsOrgListResponse> {
    return this.http
      .get<MinistriesInsightsApiEnvelope<MinistriesInsightsOrgRow[]>>(`${this.base}/organizations`, {
        params: this.toParams(filters),
      })
      .pipe(
        map((res) => ({
          data: res.data ?? [],
          meta: res.meta ?? {
            current_page: 1,
            last_page: 1,
            per_page: filters.per_page ?? 25,
            total: 0,
            from: 0,
            to: 0,
          },
        }))
      );
  }

  getHealth(): Observable<MinistriesInsightsHealthSummary> {
    return this.http
      .get<MinistriesInsightsApiEnvelope<MinistriesInsightsHealthSummary>>(`${this.base}/health`)
      .pipe(map((res) => res.data));
  }

  getAdoptionAnalytics(windowDays: MinistriesInsightsWindowDays = 30): Observable<MinistriesInsightsAdoptionAnalytics> {
    const params = new HttpParams().set('window_days', String(windowDays));
    return this.http
      .get<MinistriesInsightsApiEnvelope<MinistriesInsightsAdoptionAnalytics>>(`${this.base}/analytics/adoption`, {
        params,
      })
      .pipe(map((res) => res.data));
  }

  getUsageAnalytics(windowDays: MinistriesInsightsWindowDays = 30): Observable<MinistriesInsightsUsageAnalytics> {
    const params = new HttpParams().set('window_days', String(windowDays));
    return this.http
      .get<MinistriesInsightsApiEnvelope<MinistriesInsightsUsageAnalytics>>(`${this.base}/analytics/usage`, {
        params,
      })
      .pipe(map((res) => res.data));
  }

  getFeaturesAnalytics(
    windowDays: MinistriesInsightsWindowDays = 30,
    category?: string | null
  ): Observable<MinistriesInsightsFeaturesAnalytics> {
    let params = new HttpParams().set('window_days', String(windowDays));
    if (category) {
      params = params.set('category', category);
    }
    return this.http
      .get<MinistriesInsightsApiEnvelope<MinistriesInsightsFeaturesAnalytics>>(`${this.base}/analytics/features`, {
        params,
      })
      .pipe(map((res) => res.data));
  }

  getTrendsAnalytics(windowDays: MinistriesInsightsWindowDays = 30): Observable<MinistriesInsightsTrendsAnalytics> {
    const params = new HttpParams().set('window_days', String(windowDays));
    return this.http
      .get<MinistriesInsightsApiEnvelope<MinistriesInsightsTrendsAnalytics>>(`${this.base}/analytics/trends`, {
        params,
      })
      .pipe(map((res) => res.data));
  }

  getAudit(filters: MinistriesInsightsAuditFilters = {}): Observable<MinistriesInsightsAuditResponse> {
    return this.http
      .get<
        MinistriesInsightsApiEnvelope<MinistriesInsightsAuditResponse['data']> & {
          meta: MinistriesInsightsAuditResponse['meta'];
          window: MinistriesInsightsAuditResponse['window'];
          event_options: string[];
          governance: MinistriesInsightsAuditResponse['governance'];
        }
      >(`${this.base}/audit`, { params: this.toParams(filters) })
      .pipe(
        map((res) => ({
          data: res.data ?? [],
          meta: res.meta ?? {
            current_page: 1,
            last_page: 1,
            per_page: filters.per_page ?? 25,
            total: 0,
            from: 0,
            to: 0,
          },
          window: res.window ?? { days: filters.window_days ?? 30, current_start: '', current_end: '' },
          event_options: res.event_options ?? [],
          governance: res.governance ?? { available: false, reason: 'Unavailable', items: [] },
        }))
      );
  }

  getReportCatalog(): Observable<MinistriesInsightsReportCatalogItem[]> {
    return this.http
      .get<MinistriesInsightsApiEnvelope<MinistriesInsightsReportCatalogItem[]>>(`${this.base}/reports`)
      .pipe(map((res) => res.data ?? []));
  }

  getReportSummary(
    type: string,
    windowDays: MinistriesInsightsWindowDays = 30
  ): Observable<MinistriesInsightsReportSummary> {
    const params = new HttpParams().set('window_days', String(windowDays));
    return this.http
      .get<MinistriesInsightsApiEnvelope<MinistriesInsightsReportSummary>>(`${this.base}/reports/${type}`, {
        params,
      })
      .pipe(map((res) => res.data));
  }

  downloadReportCsv(type: string, windowDays: MinistriesInsightsWindowDays = 30): Observable<Blob> {
    const params = new HttpParams().set('window_days', String(windowDays));
    return this.http.get(`${this.base}/reports/${type}/export`, {
      params,
      responseType: 'blob',
    });
  }

  downloadTenantsCsv(filters: MinistriesInsightsTenantFilters = {}): Observable<Blob> {
    return this.http.get(`${this.base}/tenants/export`, {
      params: this.toParams(filters),
      responseType: 'blob',
    });
  }

  private toParams(filters: object): HttpParams {
    let params = new HttpParams();
    Object.entries(filters as Record<string, unknown>).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }
      params = params.set(key, String(value));
    });
    return params;
  }
}
