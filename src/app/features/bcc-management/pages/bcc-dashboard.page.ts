import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { BCCService } from '@core/services/bcc.service';
import { ApiResponse } from '@core/models/family.model';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '@shared/components/status-badge/status-badge.component';
import {
  ActiveFilter,
  AdvancedSearchPanelComponent,
  SearchField,
} from '@shared/components/advanced-search-panel/advanced-search-panel.component';
import { ListToolbarComponent } from '@shared/components/list-toolbar/list-toolbar.component';
import { BccSubNavComponent } from '../components/bcc-sub-nav/bcc-sub-nav.component';
import {
  BccAttentionType,
  BccDashboardPeriod,
  BccParishDashboard,
  BccStatus,
  BccTrendFilter,
} from '../models/bcc.model';
import {
  attentionLabel,
  periodLabel,
  trendLabel,
} from '../components/dashboard/bcc-dashboard-filters.component';
import {
  BccGrowthMeasure,
  BccGrowthPanelComponent,
} from '../components/dashboard/bcc-growth-panel.component';
import {
  BccLifeStageChartComponent,
  BccLifeStageSlice,
} from '../components/dashboard/bcc-life-stage-chart.component';
import {
  BccLeadershipChartComponent,
  BccLeadershipChartData,
} from '../components/dashboard/bcc-leadership-chart.component';

@Component({
  selector: 'app-bcc-dashboard-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    PageHeaderComponent,
    LoadingSkeletonComponent,
    CfEmptyStateComponent,
    StatusBadgeComponent,
    BccSubNavComponent,
    ListToolbarComponent,
    AdvancedSearchPanelComponent,
    BccGrowthPanelComponent,
    BccLifeStageChartComponent,
    BccLeadershipChartComponent,
  ],
  templateUrl: './bcc-dashboard.page.html',
  styleUrl: './bcc-dashboard.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BccDashboardPageComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly search$ = new Subject<string>();
  private readonly api = inject(BCCService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly cdr = inject(ChangeDetectorRef);

  loading = true;
  loadError: string | null = null;
  summary: BccParishDashboard | null = null;
  canCreate = false;
  growthMeasure: BccGrowthMeasure = 'families';

  lifeStageSlices: BccLifeStageSlice[] = [];
  sizeDistributionRows: Array<{ bucket: string; label: string; count: number; percent: number }> = [];
  sizeDistributionMax = 0;
  leadershipChartData: BccLeadershipChartData | null = null;

  status: BccStatus | 'all' = 'all';
  period: BccDashboardPeriod = '1y';
  search = '';
  coordinator: string | null = null;
  attention: BccAttentionType | null = null;
  trend: BccTrendFilter | null = null;
  showAdvancedSearch = false;
  searchFields: SearchField[] = [];
  private pendingScrollTo: string | null = null;

  ngOnInit(): void {
    this.canCreate = this.auth.hasPermission('bcc.create');
    this.initializeSearchFields();

    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.status = (params.get('status') as BccStatus | 'all') || 'all';
      this.period = (params.get('period') as BccDashboardPeriod) || '1y';
      this.search = params.get('search') || '';
      this.coordinator = params.get('coordinator');
      this.attention = (params.get('attention') as BccAttentionType | null) || null;
      this.trend = (params.get('trend') as BccTrendFilter | null) || null;
      this.syncSearchFieldValues();
      this.load();
    });

    this.search$
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((value) => {
        void this.patchQuery({ search: value || null });
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getActiveFilters(): ActiveFilter[] {
    const filters: ActiveFilter[] = [];
    if (this.status !== 'all') {
      filters.push({
        key: 'status',
        label: 'Status',
        value: this.status,
        displayValue: this.status.charAt(0).toUpperCase() + this.status.slice(1),
      });
    }
    if (this.period !== '1y') {
      filters.push({
        key: 'period',
        label: 'Period',
        value: this.period,
        displayValue: periodLabel(this.period),
      });
    }
    if (this.search.trim()) {
      filters.push({
        key: 'search',
        label: 'Search',
        value: this.search,
        displayValue: this.search.trim(),
      });
    }
    if (this.coordinator) {
      const name =
        this.summary?.coordinators?.find((c) => c.id === this.coordinator)?.name || 'Coordinator';
      filters.push({
        key: 'coordinator',
        label: 'Leader',
        value: this.coordinator,
        displayValue: name,
      });
    }
    if (this.attention) {
      filters.push({
        key: 'attention',
        label: 'Leadership status',
        value: this.attention,
        displayValue: attentionLabel(this.attention),
      });
    }
    if (this.trend) {
      filters.push({
        key: 'trend',
        label: 'Growth trend',
        value: this.trend,
        displayValue: trendLabel(this.trend),
      });
    }
    return filters;
  }

  getActiveFilterCount(): number {
    let count = 0;
    if (this.status !== 'all') {
      count++;
    }
    if (this.period !== '1y') {
      count++;
    }
    if (this.coordinator) {
      count++;
    }
    if (this.attention) {
      count++;
    }
    if (this.trend) {
      count++;
    }
    return count;
  }

  openAdvancedSearch(): void {
    this.updateCoordinatorFieldOptions();
    this.syncSearchFieldValues();
    this.showAdvancedSearch = true;
    this.cdr.markForCheck();
  }

  onAdvancedSearch(searchValues: { [key: string]: unknown }): void {
    const status = (searchValues['status'] as string) || '';
    const period = (searchValues['period'] as string) || '';
    void this.patchQuery({
      status: status && status !== 'all' ? status : null,
      period: period && period !== '1y' ? period : null,
      coordinator: (searchValues['coordinator'] as string) || null,
      attention: (searchValues['attention'] as string) || null,
      trend: (searchValues['trend'] as string) || null,
    });
    this.showAdvancedSearch = false;
  }

  onClearAdvancedSearch(): void {
    this.searchFields.forEach((field) => {
      field.value = undefined;
    });
    void this.patchQuery({
      status: null,
      period: null,
      coordinator: null,
      attention: null,
      trend: null,
    });
  }

  removeFilter(filter: ActiveFilter): void {
    this.clearChip(filter.key);
  }

  private initializeSearchFields(): void {
    this.searchFields = [
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'all', label: 'All' },
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
          { value: 'suspended', label: 'Suspended' },
        ],
      },
      {
        key: 'period',
        label: 'Time period',
        type: 'select',
        options: [
          { value: '3m', label: 'Last 3 months' },
          { value: '6m', label: 'Last 6 months' },
          { value: '1y', label: 'Last 12 months' },
          { value: '3y', label: 'Last 3 years' },
        ],
      },
      {
        key: 'attention',
        label: 'Leadership status',
        type: 'select',
        options: [
          { value: 'no_primary', label: 'Needs primary leader' },
          { value: 'empty', label: 'Empty BCC' },
        ],
      },
      {
        key: 'trend',
        label: 'Growth trend',
        type: 'select',
        options: [
          { value: 'growing', label: 'Growing' },
          { value: 'declining', label: 'Declining' },
        ],
      },
    ];
    this.updateCoordinatorFieldOptions();
    this.syncSearchFieldValues();
  }

  private updateCoordinatorFieldOptions(): void {
    const coordinators = this.summary?.coordinators ?? [];
    const existing = this.searchFields.find((field) => field.key === 'coordinator');
    const coordinatorField: SearchField = {
      key: 'coordinator',
      label: 'Leader',
      type: 'select',
      options: coordinators.map((c) => ({ value: c.id, label: c.name })),
      value: existing?.value,
    };

    const withoutCoordinator = this.searchFields.filter((field) => field.key !== 'coordinator');
    if (coordinators.length === 0) {
      this.searchFields = withoutCoordinator;
      return;
    }

    const periodIndex = withoutCoordinator.findIndex((field) => field.key === 'period');
    const insertAt = periodIndex >= 0 ? periodIndex + 1 : withoutCoordinator.length;
    this.searchFields = [
      ...withoutCoordinator.slice(0, insertAt),
      coordinatorField,
      ...withoutCoordinator.slice(insertAt),
    ];
  }

  private syncSearchFieldValues(): void {
    const values: Record<string, string | undefined> = {
      status: this.status === 'all' ? undefined : this.status,
      period: this.period === '1y' ? undefined : this.period,
      coordinator: this.coordinator || undefined,
      attention: this.attention || undefined,
      trend: this.trend || undefined,
    };

    this.searchFields.forEach((field) => {
      field.value = values[field.key];
    });
  }

  get freshnessLabel(): string {
    const raw = this.summary?.generated_at;
    if (!raw) {
      return '';
    }
    const generated = new Date(raw);
    const diffMin = Math.max(0, Math.round((Date.now() - generated.getTime()) / 60000));
    if (diffMin < 1) {
      return 'Updated just now';
    }
    if (diffMin < 60) {
      return `Updated ${diffMin} min ago`;
    }
    return `Updated ${generated.toLocaleString()}`;
  }

  get hasBccs(): boolean {
    return (this.summary?.bccs?.total ?? 0) > 0;
  }

  /** Operational attention only — data-review items belonged to the removed Data quality panel. */
  get attentionItems(): NonNullable<BccParishDashboard['attention']> {
    return (this.summary?.attention ?? []).filter((item) => item.type !== 'data_review');
  }

  get coveragePercent(): number | null {
    return this.summary?.coverage?.percent ?? this.summary?.snapshot?.coverage_percent ?? null;
  }

  get coveragePointChange(): number | null {
    return (
      this.summary?.coverage?.percent_point_change ??
      this.summary?.snapshot?.coverage_percent_point_change ??
      null
    );
  }

  definition(key: string): string {
    return this.summary?.definitions?.[key] ?? '';
  }

  load(): void {
    this.loading = true;
    this.loadError = null;
    const params: Record<string, string | number | null> = {
      status: this.status,
      period: this.period,
      search: this.search.trim() || null,
      coordinator: this.coordinator,
      attention: this.attention,
      trend: this.trend,
      overview_limit: 10,
    };

    this.api
      .getDashboard(params)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: ApiResponse<unknown>) => {
          this.summary = (res.data as BccParishDashboard) ?? null;
          this.refreshDerivedViews();
          this.updateCoordinatorFieldOptions();
          this.syncSearchFieldValues();
          this.loading = false;
          this.cdr.markForCheck();
          if (this.pendingScrollTo) {
            const target = this.pendingScrollTo;
            this.pendingScrollTo = null;
            setTimeout(() => this.scrollToId(target), 80);
          }
        },
        error: () => {
          this.pendingScrollTo = null;
          this.loadError = 'Could not load the BCC dashboard.';
          this.summary = null;
          this.refreshDerivedViews();
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  private refreshDerivedViews(): void {
    const ages = this.summary?.demographics?.age_groups;
    const children = (ages?.babies?.count ?? 0) + (ages?.children?.count ?? 0);
    const youth = (ages?.teenagers?.count ?? 0) + (ages?.young_adults?.count ?? 0);
    const adults = ages?.adults?.count ?? 0;
    const seniors = ages?.seniors?.count ?? 0;

    this.lifeStageSlices = [
      { label: 'Children', count: children },
      { label: 'Youth', count: youth },
      { label: 'Adults', count: adults },
      { label: 'Seniors', count: seniors },
    ];

    const order = ['1-10', '11-25', '26-50', '51-100', '100+'] as const;
    const labels: Record<(typeof order)[number], string> = {
      '1-10': '1–10',
      '11-25': '11–25',
      '26-50': '26–50',
      '51-100': '51–100',
      '100+': '100+',
    };
    const byBucket = new Map(
      (this.summary?.size_distribution ?? []).map((row) => [row.bucket, row.count])
    );
    const relevant = (this.summary?.size_distribution ?? []).filter((r) => r.bucket !== '0');
    this.sizeDistributionMax = Math.max(0, ...relevant.map((r) => r.count), 0);
    this.sizeDistributionRows = order.map((bucket) => {
      const count = byBucket.get(bucket) ?? 0;
      return {
        bucket,
        label: labels[bucket],
        count,
        percent: this.sizeDistributionMax > 0 ? Math.round((count / this.sizeDistributionMax) * 100) : 0,
      };
    });

    if (!this.summary) {
      this.leadershipChartData = null;
      return;
    }

    this.leadershipChartData = {
      withPrimary:
        this.summary.leadership.bccs_with_primary ?? this.summary.snapshot?.bccs_with_primary ?? 0,
      withoutPrimary: this.summary.leadership.bccs_without_primary ?? 0,
      activeLeaders: this.summary.leadership.active_leaders ?? 0,
      coveragePercent: this.summary.leadership.coverage_percent ?? null,
    };
  }

  onSearchChange(value: string): void {
    this.search = value;
    this.search$.next(value);
  }

  clearChip(key: string): void {
    const patch: Record<string, string | null> = {};
    if (key === 'status') patch['status'] = null;
    if (key === 'period') patch['period'] = null;
    if (key === 'search') patch['search'] = null;
    if (key === 'coordinator') patch['coordinator'] = null;
    if (key === 'attention') patch['attention'] = null;
    if (key === 'trend') patch['trend'] = null;
    void this.patchQuery(patch);
  }

  resetFilters(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
    });
  }

  get overviewSubtitle(): string {
    const matching = this.summary?.community_overview?.total_matching ?? 0;
    if (this.trend === 'growing') {
      return `Showing growing BCCs this period · ${matching} matching`;
    }
    if (this.trend === 'declining') {
      return `Showing declining BCCs this period · ${matching} matching`;
    }
    if (this.attention === 'no_primary') {
      return `Showing BCCs without a primary leader · ${matching} matching`;
    }
    if (this.attention === 'empty') {
      return `Showing BCCs with no families · ${matching} matching`;
    }
    return `${this.summary?.community_overview?.label || 'Top communities'} · ${matching} matching`;
  }

  setAttention(type: BccAttentionType): void {
    if (type === 'unlinked_families') {
      void this.router.navigate(['/families']);
      return;
    }
    if (type === 'data_review') {
      return;
    }
    const next = type === this.attention ? null : type;
    this.pendingScrollTo = next ? 'bcc-community-overview' : null;
    void this.patchQuery({ attention: next, trend: null });
  }

  clearOverviewFilters(): void {
    void this.patchQuery({ trend: null, attention: null });
  }

  private scrollToId(id: string): void {
    queueMicrotask(() => {
      const el = document.getElementById(id);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  openList(): void {
    void this.router.navigate(['/bccs/list']);
  }

  openBcc(id: string): void {
    void this.router.navigate(['/bccs', id]);
  }

  openAudit(): void {
    void this.router.navigate(['/bccs/audit']);
  }

  openCreate(): void {
    void this.router.navigate(['/bccs/list'], { queryParams: { create: '1' } });
  }

  refresh(): void {
    this.load();
  }

  onGrowthMeasure(measure: BccGrowthMeasure): void {
    this.growthMeasure = measure;
    this.cdr.markForCheck();
  }

  formatSigned(value: number | null | undefined, suffix = ''): string {
    if (value === null || value === undefined) {
      return '';
    }
    const sign = value > 0 ? '+' : '';
    return `${sign}${value}${suffix}`;
  }

  eventLabel(event: string): string {
    return event.replace(/\./g, ' · ').replace(/_/g, ' ');
  }

  private async patchQuery(patch: Record<string, string | null | undefined>): Promise<void> {
    const next: Record<string, string | null> = {
      status: this.status === 'all' ? null : this.status,
      period: this.period === '1y' ? null : this.period,
      search: this.search.trim() || null,
      coordinator: this.coordinator,
      attention: this.attention,
      trend: this.trend,
    };
    Object.entries(patch).forEach(([key, value]) => {
      next[key] = value === undefined ? next[key] ?? null : value;
    });
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: next,
      queryParamsHandling: 'merge',
    });
  }
}
