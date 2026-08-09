import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';
import { Chart } from 'chart.js/auto';
import {
  AdvancedSearchPanelComponent,
  SearchField,
} from '@shared/components/advanced-search-panel/advanced-search-panel.component';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { ListToolbarComponent } from '@shared/components/list-toolbar/list-toolbar.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { SectionCardComponent } from '@shared/components/section-card/section-card.component';
import { StatusBadgeComponent, StatusBadgeTone } from '@shared/components/status-badge/status-badge.component';
import { MinistriesInsightsApiService } from '../services/ministries-insights-api.service';
import {
  MinistriesInsightsActivityItem,
  MinistriesInsightsAdoptionAnalytics,
  MinistriesInsightsAnalyticsSection,
  MinistriesInsightsFeaturesAnalytics,
  MinistriesInsightsGovernanceItem,
  MinistriesInsightsTrendsAnalytics,
  MinistriesInsightsUsageAnalytics,
  MinistriesInsightsWindowDays,
} from '../models/ministries-insights.model';
import { insightsFeatureLabel, insightsStatusLabel } from '../utils/insights-labels';

@Component({
  selector: 'app-ministries-insights-analytics-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    AdvancedSearchPanelComponent,
    CfEmptyStateComponent,
    DataTableComponent,
    ListToolbarComponent,
    LoadingSkeletonComponent,
    PaginationComponent,
    SectionCardComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './analytics.page.html',
  styleUrl: './analytics.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MinistriesInsightsAnalyticsPageComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly api = inject(MinistriesInsightsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  @ViewChild('trendsCanvas') trendsCanvas?: ElementRef<HTMLCanvasElement>;

  readonly windows: Array<{ days: MinistriesInsightsWindowDays; label: string }> = [
    { days: 7, label: '7D' },
    { days: 30, label: '30D' },
    { days: 90, label: '90D' },
    { days: 180, label: '6M' },
    { days: 365, label: '12M' },
  ];

  readonly sections: Array<{ id: MinistriesInsightsAnalyticsSection; label: string }> = [
    { id: 'adoption', label: 'Adoption' },
    { id: 'usage', label: 'Usage' },
    { id: 'features', label: 'Features' },
    { id: 'trends', label: 'Trends' },
    { id: 'audit', label: 'Audit' },
  ];

  section: MinistriesInsightsAnalyticsSection = 'adoption';
  windowDays: MinistriesInsightsWindowDays = 30;
  loading = true;
  error: string | null = null;
  unauthorized = false;
  showFilters = false;
  searchFields: SearchField[] = [];

  adoption: MinistriesInsightsAdoptionAnalytics | null = null;
  usage: MinistriesInsightsUsageAnalytics | null = null;
  features: MinistriesInsightsFeaturesAnalytics | null = null;
  trends: MinistriesInsightsTrendsAnalytics | null = null;

  auditRows: MinistriesInsightsActivityItem[] = [];
  governanceItems: MinistriesInsightsGovernanceItem[] = [];
  governanceAvailable = true;
  governanceReason: string | null = null;
  eventOptions: string[] = [];
  auditPage = 1;
  auditLastPage = 1;
  auditTotal = 0;
  auditFilters = {
    event: '',
    tenant_id: '',
    meaningful_only: true,
  };

  private chart?: Chart;
  private viewReady = false;

  get drawerFilterCount(): number {
    return [this.auditFilters.event, this.auditFilters.tenant_id].filter(Boolean).length;
  }

  ngOnInit(): void {
    this.initSearchFields();

    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const section = (params.get('section') || 'adoption') as MinistriesInsightsAnalyticsSection;
      this.section = this.sections.some((s) => s.id === section) ? section : 'adoption';
      const days = Number(params.get('window_days') || 30) as MinistriesInsightsWindowDays;
      this.windowDays = ([7, 30, 90, 180, 365] as MinistriesInsightsWindowDays[]).includes(days) ? days : 30;
      this.auditFilters.event = params.get('event') || '';
      this.auditFilters.tenant_id = params.get('tenant_id') || '';
      this.auditPage = Number(params.get('page') || 1) || 1;
      if (this.section !== 'audit') {
        this.showFilters = false;
      }
      this.syncSearchFieldValues();
      this.load();
    });
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    queueMicrotask(() => this.renderTrendsChart());
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
    this.destroy$.next();
    this.destroy$.complete();
  }

  setSection(section: MinistriesInsightsAnalyticsSection): void {
    if (section !== 'audit') {
      this.showFilters = false;
    }
    this.patchQuery({ section, page: section === 'audit' ? this.auditPage : null });
  }

  setWindow(days: MinistriesInsightsWindowDays): void {
    this.patchQuery({ window_days: days, page: 1 });
  }

  openFilters(): void {
    this.syncSearchFieldValues();
    this.showFilters = true;
    this.cdr.markForCheck();
  }

  onAdvancedSearch(values: { [key: string]: unknown }): void {
    const tenantId = values['tenant_id'];
    this.patchQuery({
      event: (values['event'] as string) || null,
      tenant_id: tenantId !== undefined && tenantId !== null && tenantId !== '' ? String(tenantId) : null,
      page: 1,
    });
    this.showFilters = false;
    this.cdr.markForCheck();
  }

  onClearAdvancedSearch(): void {
    this.searchFields.forEach((field) => {
      field.value = undefined;
    });
    this.patchQuery({
      event: null,
      tenant_id: null,
      page: 1,
    });
    this.cdr.markForCheck();
  }

  onFeatureClick(category: string): void {
    this.patchQuery({ section: 'features' });
    this.loading = true;
    this.api
      .getFeaturesAnalytics(this.windowDays, category)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.features = data;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => this.handleError(err),
      });
  }

  onAuditPage(page: number): void {
    this.patchQuery({ page });
  }

  openTenant(tenantId: number): void {
    void this.router.navigate(['/platform/ministries/tenants', tenantId]);
  }

  toneForTrend(trend: string): StatusBadgeTone {
    if (trend === 'up') return 'success';
    if (trend === 'down') return 'critical';
    return 'neutral';
  }

  statusLabel(value: string): string {
    return insightsStatusLabel(value);
  }

  featureLabel(value: string): string {
    return insightsFeatureLabel(value);
  }

  formatPercent(value: number | null | undefined): string {
    if (value === null || value === undefined) {
      return '—';
    }
    return `${value}%`;
  }

  funnelPercent(part: number | undefined, whole: number | undefined): number {
    if (!whole || whole <= 0 || part === undefined || part === null) {
      return 0;
    }
    return Math.max(0, Math.min(100, Math.round((part / whole) * 100)));
  }

  bucketPercent(
    value: number | undefined | null,
    buckets: Record<string, number> | null | undefined
  ): number {
    if (!buckets) {
      return 0;
    }
    const total = Object.values(buckets).reduce((sum, n) => sum + (Number(n) || 0), 0);
    return this.funnelPercent(Number(value) || 0, total);
  }

  private initSearchFields(): void {
    this.searchFields = [
      {
        key: 'event',
        label: 'Event',
        type: 'select',
        placeholder: 'All meaningful',
        options: [],
      },
      {
        key: 'tenant_id',
        label: 'Tenant ID',
        type: 'number',
        placeholder: 'Optional',
      },
    ];
    this.syncSearchFieldValues();
  }

  private syncSearchFieldValues(): void {
    const values: Record<string, string | number | undefined> = {
      event: this.auditFilters.event || undefined,
      tenant_id: this.auditFilters.tenant_id ? Number(this.auditFilters.tenant_id) : undefined,
    };
    this.searchFields.forEach((field) => {
      field.value = values[field.key];
    });
  }

  private refreshEventOptions(): void {
    const field = this.searchFields.find((f) => f.key === 'event');
    if (!field) {
      return;
    }
    field.options = this.eventOptions.map((ev) => ({ value: ev, label: ev }));
  }

  private load(): void {
    this.loading = true;
    this.error = null;
    this.unauthorized = false;

    if (this.section === 'adoption') {
      this.api
        .getAdoptionAnalytics(this.windowDays)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (data) => {
            this.adoption = data;
            this.finishLoad();
          },
          error: (err) => this.handleError(err),
        });
      return;
    }

    if (this.section === 'usage') {
      this.api
        .getUsageAnalytics(this.windowDays)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (data) => {
            this.usage = data;
            this.finishLoad();
          },
          error: (err) => this.handleError(err),
        });
      return;
    }

    if (this.section === 'features') {
      this.api
        .getFeaturesAnalytics(this.windowDays)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (data) => {
            this.features = data;
            this.finishLoad();
          },
          error: (err) => this.handleError(err),
        });
      return;
    }

    if (this.section === 'trends') {
      this.api
        .getTrendsAnalytics(this.windowDays)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (data) => {
            this.trends = data;
            this.finishLoad();
            queueMicrotask(() => this.renderTrendsChart());
          },
          error: (err) => this.handleError(err),
        });
      return;
    }

    this.api
      .getAudit({
        window_days: this.windowDays,
        event: this.auditFilters.event || undefined,
        tenant_id: this.auditFilters.tenant_id || undefined,
        meaningful_only: this.auditFilters.meaningful_only ? 1 : undefined,
        page: this.auditPage,
        per_page: 25,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.auditRows = res.data;
          this.auditPage = res.meta.current_page;
          this.auditLastPage = res.meta.last_page;
          this.auditTotal = res.meta.total;
          this.eventOptions = res.event_options;
          this.governanceAvailable = res.governance.available;
          this.governanceReason = res.governance.reason;
          this.governanceItems = res.governance.items ?? [];
          this.refreshEventOptions();
          this.finishLoad();
        },
        error: (err) => this.handleError(err),
      });
  }

  private finishLoad(): void {
    this.loading = false;
    this.cdr.markForCheck();
  }

  private handleError(err: HttpErrorResponse): void {
    this.loading = false;
    this.unauthorized = err.status === 403;
    this.error = this.unauthorized
      ? 'You do not have permission to view analytics.'
      : 'Unable to load analytics.';
    this.cdr.markForCheck();
  }

  private patchQuery(patch: Record<string, string | number | null>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        section: this.section,
        window_days: this.windowDays,
        event: this.auditFilters.event || null,
        tenant_id: this.auditFilters.tenant_id || null,
        page: this.section === 'audit' ? this.auditPage : null,
        ...patch,
      },
      queryParamsHandling: 'merge',
    });
  }

  private renderTrendsChart(): void {
    if (!this.viewReady || this.section !== 'trends' || !this.trends) {
      return;
    }
    const canvas = this.trendsCanvas?.nativeElement;
    if (!canvas) {
      return;
    }

    const styles = getComputedStyle(document.documentElement);
    const brand = (styles.getPropertyValue('--cf-brand') || '#1d4ed8').trim();
    const forest = (styles.getPropertyValue('--cf-forest') || '#0f766e').trim();

    this.chart?.destroy();
    this.chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: this.trends.series.map((p) => p.label),
        datasets: [
          {
            label: 'Meaningful actions',
            data: this.trends.series.map((p) => p.meaningful_actions),
            borderColor: brand,
            backgroundColor: 'rgba(29, 78, 216, 0.12)',
            fill: true,
            tension: 0.25,
          },
          {
            label: 'Active tenants',
            data: this.trends.series.map((p) => p.active_tenants),
            borderColor: forest,
            backgroundColor: 'transparent',
            tension: 0.25,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'bottom' } },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, ticks: { precision: 0 } },
        },
      },
    });
  }
}
