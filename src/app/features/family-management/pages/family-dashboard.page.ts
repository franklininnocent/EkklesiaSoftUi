import { CommonModule } from '@angular/common';
import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { ListToolbarComponent } from '@shared/components/list-toolbar/list-toolbar.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import {
  AdvancedSearchPanelComponent,
  ActiveFilter,
  SearchField,
} from '@shared/components/advanced-search-panel/advanced-search-panel.component';
import { FamilyService } from '@core/services/family.service';
import { BCCService } from '@core/services/bcc.service';
import { BCC } from '@core/models/family.model';
import { memberAgeChartSlices } from '@features/members/utils/member-age-groups.util';
import { MemberAgeDistributionChartComponent } from '@features/members/components/member-age-distribution-chart/member-age-distribution-chart.component';
import { FamilyDashboardSummary } from '../models/family-dashboard.model';
import {
  FamilyMetricChartComponent,
  FamilyMetricSlice,
} from '../components/family-metric-chart/family-metric-chart.component';
import { cfFormatDate } from '@shared/utils/cf-intl.util';
import { DisableWhenReadOnlyDirective } from '@shared/directives/disable-when-read-only.directive';

@Component({
  selector: 'app-family-dashboard-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    PageHeaderComponent,
    ListToolbarComponent,
    AdvancedSearchPanelComponent,
    LoadingSkeletonComponent,
    CfEmptyStateComponent,
    MemberAgeDistributionChartComponent,
    FamilyMetricChartComponent,
    DisableWhenReadOnlyDirective,
  ],
  templateUrl: './family-dashboard.page.html',
  styleUrl: './family-dashboard.page.scss',
})
export class FamilyDashboardPageComponent implements OnDestroy {
  private readonly chartPalette = ['#0d9488', '#2563eb', '#ea580c', '#16a34a', '#7c3aed', '#db2777'];
  private readonly familyService = inject(FamilyService);
  private readonly bccService = inject(BCCService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();

  /** Shared canvas height for the family-size, gender, and household bar charts. */
  readonly distributionChartHeight = 176;

  readonly loading = signal(true);
  readonly refreshing = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly summary = signal<FamilyDashboardSummary | null>(null);
  readonly bccs = signal<BCC[]>([]);

  searchTerm = '';
  bccId = '';
  status = '';
  period = '12m';
  customFrom = '';
  customTo = '';
  showAdvancedSearch = false;
  searchFields: SearchField[] = [];

  readonly ageSlices = computed(() =>
    memberAgeChartSlices(this.summary()?.demographics?.age_groups).filter((slice) => slice.key !== 'unknown')
  );

  readonly genderSlices = computed((): FamilyMetricSlice[] => {
    const gender = this.summary()?.demographics?.gender;
    if (!gender) {
      return [];
    }
    const colors: Record<string, string> = { male: '#2563eb', female: '#db2777', other: '#7c3aed' };
    return (['male', 'female', 'other'] as const)
      .map((key) => ({
        key,
        label: key === 'other' ? 'Other' : key.charAt(0).toUpperCase() + key.slice(1),
        count: gender[key]?.count ?? 0,
        percent: gender[key]?.percent ?? 0,
        color: colors[key],
      }))
      .filter((row) => row.count > 0);
  });

  readonly sizeSlices = computed((): FamilyMetricSlice[] => {
    const bands = this.summary()?.household?.bands;
    if (!bands) {
      return [];
    }
    const labels: Record<string, string> = {
      '1': '1 member',
      '2': '2 members',
      '3_4': '3–4 members',
      '5_6': '5–6 members',
      '7_plus': '7+ members',
    };
    const colors = ['#0d9488', '#2563eb', '#ea580c', '#16a34a', '#7c3aed'];
    return Object.keys(labels).map((key, index) => ({
      key,
      label: labels[key],
      count: bands[key]?.count ?? 0,
      percent: bands[key]?.percent ?? 0,
      color: colors[index],
    }));
  });

  readonly householdSlices = computed((): FamilyMetricSlice[] => {
    const household = this.summary()?.household;
    if (!household) {
      return [];
    }
    const rows = [
      { key: 'under_18', label: 'Have children or teenagers', count: household.have_under_18 },
      { key: 'seniors', label: 'Have seniors', count: household.have_seniors },
      { key: 'multiple_adults', label: 'Two or more adults', count: household.multiple_adults },
      { key: 'missing_head', label: 'No active family head', count: household.no_active_head },
    ];
    return rows.map((row, index) => ({
      ...row,
      percent: this.percentOfFamilies(row.count),
      color: this.chartPalette[index],
    }));
  });

  readonly occupationSlices = computed(() => this.backgroundSlices('occupation'));

  readonly educationSlices = computed(() => this.backgroundSlices('education', 1));

  readonly extraMemberParams = computed(() => {
    const params: Record<string, string> = {};
    if (this.bccId) {
      params['bcc_id'] = this.bccId;
    }
    if (this.status) {
      params['family_status'] = this.status;
    }
    return params;
  });

  constructor() {
    this.initializeSearchFields();
    this.bccService.getBCCs({ status: 'active', per_page: 200 }).subscribe({
      next: (res) => {
        this.bccs.set(res.data ?? []);
        this.syncBccFieldOptions();
        this.syncSearchFieldValues();
      },
    });
    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.bccId = params.get('bcc_id') ?? '';
      this.status = params.get('status') ?? '';
      this.period = params.get('period') ?? '12m';
      this.customFrom = params.get('from') ?? '';
      this.customTo = params.get('to') ?? '';
      this.syncSearchFieldValues();
      this.load(params.get('refresh') === '1');
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(refresh = false): void {
    this.loading.set(!this.summary());
    this.refreshing.set(refresh);
    this.loadError.set(null);
    this.familyService.getDashboard({
      bcc_id: this.bccId || undefined,
      status: this.status || undefined,
      period: this.period,
      from: this.period === 'custom' ? this.customFrom || undefined : undefined,
      to: this.period === 'custom' ? this.customTo || undefined : undefined,
      refresh,
    }).subscribe({
      next: (res) => {
        this.summary.set(res.data ?? null);
        this.loading.set(false);
        this.refreshing.set(false);
        if (refresh) {
          void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { refresh: null },
            queryParamsHandling: 'merge',
            replaceUrl: true,
          });
        }
      },
      error: () => {
        this.loading.set(false);
        this.refreshing.set(false);
        this.loadError.set('Could not load the family dashboard.');
      },
    });
  }

  patchFilters(patch: Record<string, string | null>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: patch,
      queryParamsHandling: 'merge',
    });
  }

  openAdvancedSearch(): void {
    this.syncBccFieldOptions();
    this.syncSearchFieldValues();
    this.showAdvancedSearch = true;
  }

  onAdvancedSearch(searchValues: { [key: string]: unknown }): void {
    const bccId = String(searchValues['bcc_id'] ?? '');
    const status = String(searchValues['status'] ?? '');
    let period = String(searchValues['period'] ?? '12m');
    const from = String(searchValues['from'] ?? '');
    const to = String(searchValues['to'] ?? '');
    if ((from || to) && period === '12m') {
      period = 'custom';
    }
    this.patchFilters({
      bcc_id: bccId || null,
      status: status || null,
      period: period === '12m' ? null : period,
      from: period === 'custom' ? from || null : null,
      to: period === 'custom' ? to || null : null,
    });
    this.showAdvancedSearch = false;
  }

  onClearAdvancedSearch(): void {
    this.searchFields.forEach((field) => {
      field.value = undefined;
    });
    this.patchFilters({
      bcc_id: null,
      status: null,
      period: null,
      from: null,
      to: null,
    });
    this.showAdvancedSearch = false;
  }

  getActiveFilters(): ActiveFilter[] {
    const filters: ActiveFilter[] = [];
    if (this.bccId) {
      const bcc = this.bccs().find((row) => row.id === this.bccId);
      filters.push({
        key: 'bcc_id',
        label: 'BCC',
        value: this.bccId,
        displayValue: this.bccId === 'unassigned' ? 'Unassigned' : (bcc?.name || this.bccId),
      });
    }
    if (this.status) {
      filters.push({
        key: 'status',
        label: 'Family status',
        value: this.status,
        displayValue: this.status.charAt(0).toUpperCase() + this.status.slice(1),
      });
    }
    if (this.period && this.period !== '12m') {
      filters.push({
        key: 'period',
        label: 'Period',
        value: this.period,
        displayValue: this.periodChipLabel(),
      });
    }
    return filters;
  }

  getActiveFilterCount(): number {
    return this.getActiveFilters().length;
  }

  removeFilter(filter: ActiveFilter): void {
    if (filter.key === 'bcc_id') {
      this.patchFilters({ bcc_id: null });
      return;
    }
    if (filter.key === 'status') {
      this.patchFilters({ status: null });
      return;
    }
    this.patchFilters({ period: null, from: null, to: null });
  }

  clearAllFilters(): void {
    this.onClearAdvancedSearch();
  }

  onListSearchChange(value: string): void {
    this.searchTerm = value ?? '';
    const search = this.searchTerm.trim();
    if (!search) {
      return;
    }
    void this.router.navigate(['/families/list'], {
      queryParams: this.withScope({ search }),
    });
  }

  refresh(): void {
    this.patchFilters({ refresh: '1' });
  }

  manageFamilies(): void {
    void this.router.navigate(['/families/list'], { queryParams: this.withScope({}) });
  }

  addFamily(): void {
    void this.router.navigate(['/families/list'], { queryParams: this.withScope({ create: '1' }) });
  }

  familyList(extra: Record<string, string | undefined>): void {
    void this.router.navigate(['/families/list'], { queryParams: this.withScope(extra) });
  }

  openHousehold(slice: FamilyMetricSlice): void {
    if (slice.key === 'missing_head') {
      this.familyList({ missing: 'head' });
      return;
    }
    this.familyList({ household: slice.key });
  }

  memberList(extra: Record<string, string | undefined>): void {
    const params: Record<string, string | undefined> = { ...extra };
    if (this.bccId) {
      params['bcc_id'] = this.bccId;
    }
    if (this.status) {
      params['family_status'] = this.status;
    }
    void this.router.navigate(['/members/list'], { queryParams: params });
  }

  updatedLabel(): string {
    const iso = this.summary()?.meta?.generated_at;
    if (!iso) {
      return '';
    }
    const then = new Date(iso).getTime();
    const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
    if (seconds < 8) {
      return 'Updated just now';
    }
    return `Updated ${seconds} seconds ago`;
  }

  periodLabel(): string {
    return {
      '30d': 'last 30 days',
      '3m': 'last 3 months',
      '6m': 'last 6 months',
      custom: 'selected period',
      '12m': 'last 12 months',
    }[this.period] ?? 'last 12 months';
  }

  formatCount(value: number | null | undefined): string {
    return (value ?? 0).toLocaleString();
  }

  formatDate(value: string | null): string {
    return value ? cfFormatDate(value) || value : '';
  }

  headGenderLine(): string {
    const g = this.summary()?.household?.head_gender;
    if (!g) {
      return '';
    }
    return `Family heads: ${g['male'] ?? 0} male, ${g['female'] ?? 0} female, ${g['other'] ?? 0} other, ${g['unknown'] ?? 0} not recorded.`;
  }

  private percentOfFamilies(count: number): number {
    const total = this.summary()?.kpis.total_families ?? 0;
    if (total <= 0) {
      return 0;
    }
    return Math.round((count / total) * 1000) / 10;
  }

  private backgroundSlices(kind: 'occupation' | 'education', colorOffset = 0): FamilyMetricSlice[] {
    const values = this.summary()?.background?.[kind]?.values ?? [];
    return values.map((row, index) => ({
      key: row.key,
      label: row.label,
      count: row.count,
      percent: row.percent,
      color: this.chartPalette[(index + colorOffset) % this.chartPalette.length],
    }));
  }

  private withScope(extra: Record<string, string | undefined>): Record<string, string | undefined> {
    return {
      bcc_id: this.bccId || undefined,
      status: this.status || undefined,
      ...extra,
    };
  }

  private initializeSearchFields(): void {
    this.searchFields = [
      {
        key: 'bcc_id',
        label: 'BCC',
        type: 'select',
        options: [{ value: 'unassigned', label: 'Unassigned' }],
      },
      {
        key: 'status',
        label: 'Family status',
        type: 'select',
        options: [
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
          { value: 'migrated', label: 'Migrated' },
        ],
      },
      {
        key: 'period',
        label: 'Period',
        type: 'select',
        options: [
          { value: '30d', label: 'Last 30 days' },
          { value: '3m', label: 'Last 3 months' },
          { value: '6m', label: 'Last 6 months' },
          { value: '12m', label: 'Last 12 months' },
          { value: 'custom', label: 'Custom' },
        ],
      },
      {
        key: 'from',
        label: 'From',
        type: 'date',
      },
      {
        key: 'to',
        label: 'To',
        type: 'date',
      },
    ];
    this.syncBccFieldOptions();
    this.syncSearchFieldValues();
  }

  private syncBccFieldOptions(): void {
    const field = this.searchFields.find((row) => row.key === 'bcc_id');
    if (!field) {
      return;
    }
    field.options = [
      { value: 'unassigned', label: 'Unassigned' },
      ...this.bccs().map((bcc) => ({ value: bcc.id, label: bcc.name })),
    ];
  }

  private syncSearchFieldValues(): void {
    const values: Record<string, string | undefined> = {
      bcc_id: this.bccId || undefined,
      status: this.status || undefined,
      period: this.period && this.period !== '12m' ? this.period : undefined,
      from: this.customFrom || undefined,
      to: this.customTo || undefined,
    };
    this.searchFields.forEach((field) => {
      field.value = values[field.key];
    });
  }

  private periodChipLabel(): string {
    if (this.period === 'custom') {
      const from = this.formatDate(this.customFrom) || this.customFrom;
      const to = this.formatDate(this.customTo) || this.customTo;
      if (from && to) {
        return `${from} – ${to}`;
      }
      if (from) {
        return `From ${from}`;
      }
      if (to) {
        return `Until ${to}`;
      }
      return 'Custom';
    }
    return {
      '30d': 'Last 30 days',
      '3m': 'Last 3 months',
      '6m': 'Last 6 months',
    }[this.period] ?? this.period;
  }
}
