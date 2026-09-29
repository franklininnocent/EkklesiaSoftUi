import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';
import {
  AdvancedSearchPanelComponent,
  SearchField,
} from '@shared/components/advanced-search-panel/advanced-search-panel.component';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { ListToolbarComponent } from '@shared/components/list-toolbar/list-toolbar.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { StatusBadgeComponent, StatusBadgeTone } from '@shared/components/status-badge/status-badge.component';
import { SortEvent, SortableDirective } from '@shared/directives/sortable.directive';
import { MinistriesInsightsApiService } from '../services/ministries-insights-api.service';
import {
  MinistriesInsightsTenantFilters,
  MinistriesInsightsTenantRow,
  MinistriesInsightsWindowDays,
} from '../models/ministries-insights.model';
import { insightsStatusLabel } from '../utils/insights-labels';

@Component({
  selector: 'app-ministries-insights-tenants-page',
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
    StatusBadgeComponent,
    SortableDirective,
  ],
  templateUrl: './tenants.page.html',
  styleUrl: './tenants.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MinistriesInsightsTenantsPageComponent implements OnInit, OnDestroy {
  private readonly api = inject(MinistriesInsightsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  readonly windows: MinistriesInsightsWindowDays[] = [7, 30, 90];
  readonly adoptionOptions = [
    'not_started',
    'activated',
    'active',
    'highly_engaged',
    'inactive',
    'declining',
    'disabled',
  ];

  loading = true;
  exporting = false;
  error: string | null = null;
  rows: MinistriesInsightsTenantRow[] = [];
  total = 0;
  page = 1;
  perPage = 25;
  showFilters = false;
  searchFields: SearchField[] = [];

  filters: MinistriesInsightsTenantFilters = {
    window_days: 30,
    search: '',
    module_status: '',
    adoption_status: '',
    usage_status: '',
    health: '',
    sort: 'tenant_name',
    direction: 'asc',
    page: 1,
    per_page: 25,
  };

  get drawerFilterCount(): number {
    return [
      this.filters.module_status,
      this.filters.adoption_status,
      this.filters.usage_status,
      this.filters.health,
    ].filter(Boolean).length;
  }

  ngOnInit(): void {
    this.initSearchFields();

    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.filters = {
        ...this.filters,
        window_days: this.parseWindow(params.get('window_days')),
        search: params.get('search') || '',
        module_status: params.get('module_status') || '',
        adoption_status: params.get('adoption_status') || '',
        usage_status: params.get('usage_status') || '',
        health: params.get('health') || params.get('health_flag') || '',
        sort: params.get('sort') || 'tenant_name',
        direction: params.get('direction') === 'desc' ? 'desc' : 'asc',
        page: Math.max(1, Number(params.get('page') || 1)),
        per_page: Math.min(100, Math.max(1, Number(params.get('per_page') || 25))),
      };
      this.page = this.filters.page || 1;
      this.perPage = this.filters.per_page || 25;
      this.syncSearchFieldValues();
      this.load();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearchChange(value: string): void {
    this.filters.search = value;
    this.patchQuery({ search: value || null, page: 1 });
  }

  openFilters(): void {
    this.syncSearchFieldValues();
    this.showFilters = true;
    this.cdr.markForCheck();
  }

  onAdvancedSearch(values: { [key: string]: unknown }): void {
    this.patchQuery({
      module_status: (values['module_status'] as string) || null,
      adoption_status: (values['adoption_status'] as string) || null,
      usage_status: (values['usage_status'] as string) || null,
      health: (values['health'] as string) || null,
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
      module_status: null,
      adoption_status: null,
      usage_status: null,
      health: null,
      page: 1,
    });
    this.cdr.markForCheck();
  }

  setWindow(days: MinistriesInsightsWindowDays): void {
    this.patchQuery({ window_days: days, page: 1 });
  }

  sortBy(column: string): void {
    const same = this.filters.sort === column;
    const direction = same && this.filters.direction === 'asc' ? 'desc' : 'asc';
    this.patchQuery({ sort: column, direction, page: 1 });
  }

  onSort(event: SortEvent): void {
    if (!event.column || !event.direction) {
      return;
    }
    this.patchQuery({ sort: event.column, direction: event.direction, page: 1 });
  }

  sortDirectionFor(column: string): 'asc' | 'desc' | null {
    return this.filters.sort === column ? this.filters.direction || 'asc' : null;
  }

  onPageChange(page: number): void {
    this.patchQuery({ page });
  }

  onPageSizeChange(size: number): void {
    this.patchQuery({ per_page: size, page: 1 });
  }

  openDetail(row: MinistriesInsightsTenantRow): void {
    this.router.navigate(['/platform/ministries/tenants', row.tenant_id], {
      queryParams: { window_days: this.filters.window_days || 30 },
    });
  }

  exportCsv(): void {
    if (this.exporting) {
      return;
    }
    this.exporting = true;
    this.api.downloadTenantsCsv(this.filters).pipe(takeUntil(this.destroy$)).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ministries-insights-tenants-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        this.exporting = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.exporting = false;
        this.error = 'Could not export tenant adoption CSV.';
        this.cdr.markForCheck();
      },
    });
  }

  toneForStatus(status: string): StatusBadgeTone {
    switch (status) {
      case 'enabled':
      case 'active':
      case 'highly_engaged':
      case 'ok':
      case 'up':
        return 'success';
      case 'attention':
      case 'not_started':
      case 'inactive':
      case 'declining':
      case 'flat':
        return 'warning';
      case 'critical':
      case 'disabled':
      case 'down':
        return 'critical';
      default:
        return 'neutral';
    }
  }

  statusLabel(value: string): string {
    return insightsStatusLabel(value);
  }

  onRowKeydown(event: KeyboardEvent, row: MinistriesInsightsTenantRow): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.openDetail(row);
    }
  }

  private initSearchFields(): void {
    this.searchFields = [
      {
        key: 'module_status',
        label: 'Module status',
        type: 'select',
        options: [
          { value: 'enabled', label: 'Enabled' },
          { value: 'disabled', label: 'Disabled' },
        ],
      },
      {
        key: 'adoption_status',
        label: 'Adoption status',
        type: 'select',
        options: this.adoptionOptions.map((opt) => ({
          value: opt,
          label: insightsStatusLabel(opt),
        })),
      },
      {
        key: 'usage_status',
        label: 'Usage trend',
        type: 'select',
        options: [
          { value: 'up', label: 'Up' },
          { value: 'flat', label: 'Flat' },
          { value: 'down', label: 'Down' },
        ],
      },
      {
        key: 'health',
        label: 'Health',
        type: 'select',
        options: [
          { value: 'ok', label: 'Ok' },
          { value: 'attention', label: 'Attention' },
          { value: 'critical', label: 'Critical' },
          { value: 'without_members', label: 'Without members' },
          { value: 'without_leadership', label: 'Without leadership' },
          { value: 'stale', label: 'Stale orgs' },
        ],
      },
    ];
    this.syncSearchFieldValues();
  }

  private syncSearchFieldValues(): void {
    const values: Record<string, string | undefined> = {
      module_status: this.filters.module_status || undefined,
      adoption_status: this.filters.adoption_status || undefined,
      usage_status: this.filters.usage_status || undefined,
      health: this.filters.health || undefined,
    };
    this.searchFields.forEach((field) => {
      field.value = values[field.key];
    });
  }

  private load(): void {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    this.api
      .getTenants(this.filters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.rows = res.data;
          this.total = res.meta.total;
          this.page = res.meta.current_page;
          this.perPage = res.meta.per_page;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err: HttpErrorResponse) => {
          this.loading = false;
          this.error =
            err.status === 401 || err.status === 403
              ? 'You do not have permission to view tenant adoption.'
              : 'Unable to load tenant adoption.';
          this.cdr.markForCheck();
        },
      });
  }

  private patchQuery(patch: Record<string, string | number | null>): void {
    const queryParams: Record<string, string | number | null> = {
      window_days: this.filters.window_days || 30,
      search: this.filters.search || null,
      module_status: this.filters.module_status || null,
      adoption_status: this.filters.adoption_status || null,
      usage_status: this.filters.usage_status || null,
      health: this.filters.health || null,
      sort: this.filters.sort || 'tenant_name',
      direction: this.filters.direction || 'asc',
      page: this.filters.page || 1,
      per_page: this.filters.per_page || 25,
      ...patch,
    };

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: '',
      replaceUrl: true,
    });
  }

  private parseWindow(raw: string | null): MinistriesInsightsWindowDays {
    const n = Number(raw);
    return n === 7 || n === 90 ? n : 30;
  }
}
