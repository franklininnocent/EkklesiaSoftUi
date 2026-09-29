import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { SectionCardComponent } from '@shared/components/section-card/section-card.component';
import { StatusBadgeComponent, StatusBadgeTone } from '@shared/components/status-badge/status-badge.component';
import { MinistriesInsightsApiService } from '../services/ministries-insights-api.service';
import {
  MinistriesInsightsMetric,
  MinistriesInsightsOverview,
  MinistriesInsightsOverviewKpis,
  MinistriesInsightsWindowDays,
} from '../models/ministries-insights.model';
import { insightsSeverityTone, insightsStatusLabel } from '../utils/insights-labels';

interface KpiTile {
  key: keyof MinistriesInsightsOverviewKpis;
  label: string;
  href?: string;
  queryParams?: Record<string, string>;
}

@Component({
  selector: 'app-ministries-insights-overview-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    CfEmptyStateComponent,
    LoadingSkeletonComponent,
    SectionCardComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './overview.page.html',
  styleUrl: './overview.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MinistriesInsightsOverviewPageComponent implements OnInit, OnDestroy {
  private readonly api = inject(MinistriesInsightsApiService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  readonly windows: MinistriesInsightsWindowDays[] = [7, 30, 90];

  /** Executive decision strip — answers “how is the platform doing?” */
  readonly primaryKpis: KpiTile[] = [
    { key: 'module_enabled', label: 'Module enabled', href: '/platform/ministries/tenants', queryParams: { module_status: 'enabled' } },
    { key: 'activated', label: 'Activated', href: '/platform/ministries/tenants', queryParams: { adoption_status: 'activated' } },
    { key: 'active', label: 'Active', href: '/platform/ministries/tenants', queryParams: { adoption_status: 'active' } },
    { key: 'highly_engaged', label: 'Highly engaged', href: '/platform/ministries/tenants', queryParams: { adoption_status: 'highly_engaged' } },
    { key: 'inactive', label: 'Inactive', href: '/platform/ministries/tenants', queryParams: { adoption_status: 'inactive' } },
    { key: 'declining', label: 'Declining', href: '/platform/ministries/tenants', queryParams: { adoption_status: 'declining' } },
    { key: 'data_health_issues', label: 'Data health issues', href: '/platform/ministries/organizations', queryParams: { health: 'attention' } },
    { key: 'meaningful_actions', label: 'Meaningful actions', href: '/platform/ministries/analytics', queryParams: { section: 'usage' } },
  ];

  /** Secondary inventory context — denser, lower emphasis */
  readonly secondaryKpis: KpiTile[] = [
    { key: 'total_tenants', label: 'Total tenants' },
    { key: 'organizations', label: 'Organizations', href: '/platform/ministries/organizations' },
    { key: 'active_organizations', label: 'Active orgs', href: '/platform/ministries/organizations', queryParams: { status: 'active' } },
    { key: 'active_memberships', label: 'Active memberships' },
    { key: 'active_leadership', label: 'Active leadership' },
    { key: 'active_users', label: 'Active users' },
  ];

  windowDays: MinistriesInsightsWindowDays = 30;
  loading = true;
  error: string | null = null;
  unauthorized = false;
  overview: MinistriesInsightsOverview | null = null;

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setWindow(days: MinistriesInsightsWindowDays): void {
    if (this.windowDays === days) {
      return;
    }
    this.windowDays = days;
    this.load();
  }

  metricValue(metric: MinistriesInsightsMetric | null | undefined): string {
    if (!metric || !metric.available || metric.value === null || metric.value === undefined) {
      return '—';
    }
    return String(metric.value);
  }

  funnelPercent(part: number | undefined, whole: number | undefined): number {
    if (!whole || whole <= 0 || part === undefined || part === null) {
      return 0;
    }
    return Math.max(0, Math.min(100, Math.round((part / whole) * 100)));
  }

  attentionTone(severity: string): StatusBadgeTone {
    return insightsSeverityTone(severity);
  }

  statusLabel(value: string): string {
    return insightsStatusLabel(value);
  }

  attentionQuery(item: { href: string; filter: Record<string, string> }): Record<string, string> {
    return { ...item.filter, window_days: String(this.windowDays) };
  }

  private load(): void {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    this.api
      .getOverview(this.windowDays)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.overview = data;
          this.loading = false;
          this.error = null;
          this.unauthorized = false;
          this.cdr.markForCheck();
        },
        error: (err: HttpErrorResponse) => {
          this.loading = false;
          this.unauthorized = err.status === 401 || err.status === 403;
          this.error = this.unauthorized
            ? 'You do not have permission to view Ministries Insights.'
            : 'Unable to load Ministries Insights overview.';
          this.cdr.markForCheck();
        },
      });
  }
}
