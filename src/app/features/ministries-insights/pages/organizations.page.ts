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
  MinistriesInsightsHealthSummary,
  MinistriesInsightsOrgFilters,
  MinistriesInsightsOrgRow,
} from '../models/ministries-insights.model';
import { insightsStatusLabel } from '../utils/insights-labels';

@Component({
  selector: 'app-ministries-insights-organizations-page',
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
  templateUrl: './organizations.page.html',
  styleUrl: './organizations.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MinistriesInsightsOrganizationsPageComponent implements OnInit, OnDestroy {
  private readonly api = inject(MinistriesInsightsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  loading = true;
  error: string | null = null;
  rows: MinistriesInsightsOrgRow[] = [];
  health: MinistriesInsightsHealthSummary | null = null;
  total = 0;
  page = 1;
  perPage = 25;
  showFilters = false;
  searchFields: SearchField[] = [];

  filters: MinistriesInsightsOrgFilters = {
    search: '',
    status: '',
    health: '',
    sort: 'name',
    direction: 'asc',
    page: 1,
    per_page: 25,
  };

  get drawerFilterCount(): number {
    return [this.filters.status, this.filters.health].filter(Boolean).length;
  }

  ngOnInit(): void {
    this.initSearchFields();

    this.api
      .getHealth()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (health) => {
          this.health = health;
          this.cdr.markForCheck();
        },
        error: () => {
          // Health strip is secondary; table can still load.
        },
      });

    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.filters = {
        search: params.get('search') || '',
        status: params.get('status') || '',
        health: params.get('health') || '',
        tenant_id: params.get('tenant_id') || '',
        sort: params.get('sort') || 'name',
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
      status: (values['status'] as string) || null,
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
      status: null,
      health: null,
      page: 1,
    });
    this.cdr.markForCheck();
  }

  applyHealthFilter(health: string): void {
    this.patchQuery({ health, page: 1 });
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

  openTenant(row: MinistriesInsightsOrgRow): void {
    if (!row.tenant?.id) {
      return;
    }
    this.router.navigate(['/platform/ministries/tenants', row.tenant.id]);
  }

  onRowKeydown(event: KeyboardEvent, row: MinistriesInsightsOrgRow): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.openTenant(row);
    }
  }

  statusLabel(value: string): string {
    return insightsStatusLabel(value);
  }

  toneForStatus(status: string): StatusBadgeTone {
    switch (status) {
      case 'active':
      case 'ok':
        return 'success';
      case 'attention':
      case 'inactive':
        return 'warning';
      case 'critical':
        return 'critical';
      default:
        return 'neutral';
    }
  }

  private initSearchFields(): void {
    this.searchFields = [
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
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
          { value: 'stale', label: 'Stale' },
        ],
      },
    ];
    this.syncSearchFieldValues();
  }

  private syncSearchFieldValues(): void {
    const values: Record<string, string | undefined> = {
      status: this.filters.status || undefined,
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
      .getOrganizations(this.filters)
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
              ? 'You do not have permission to view organizations.'
              : 'Unable to load organizations.';
          this.cdr.markForCheck();
        },
      });
  }

  private patchQuery(patch: Record<string, string | number | null>): void {
    const queryParams: Record<string, string | number | null> = {
      search: this.filters.search || null,
      status: this.filters.status || null,
      health: this.filters.health || null,
      tenant_id: this.filters.tenant_id || null,
      sort: this.filters.sort || 'name',
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
}
