import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import {
  AdvancedSearchPanelComponent,
  SearchField,
} from '@shared/components/advanced-search-panel/advanced-search-panel.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { ListToolbarComponent } from '@shared/components/list-toolbar/list-toolbar.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { StatusBadgeComponent } from '@shared/components/status-badge/status-badge.component';
import { MinistriesSubNavComponent } from '../components/ministries-sub-nav/ministries-sub-nav.component';
import {
  Organization,
  OrganizationCategory,
  OrganizationType,
} from '../models/ministries.model';
import { MinistriesApiService } from '../services/ministries-api.service';

type OrganizationStatusFilter = '' | 'active' | 'inactive';

type SortBy =
  | 'name'
  | 'code'
  | 'established_date'
  | 'status'
  | 'created_at'
  | 'active_member_count';

@Component({
  selector: 'app-organization-list-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    CfEmptyStateComponent,
    LoadingSkeletonComponent,
    PaginationComponent,
    AdvancedSearchPanelComponent,
    PageHeaderComponent,
    ListToolbarComponent,
    DataTableComponent,
    StatusBadgeComponent,
    MinistriesSubNavComponent,
  ],
  templateUrl: './organization-list.page.html',
  styleUrl: './organization-list.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationListPageComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly api = inject(MinistriesApiService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  organizations: Organization[] = [];
  categories: OrganizationCategory[] = [];
  types: OrganizationType[] = [];

  loading = false;
  loaded = false;
  loadError: string | null = null;

  search = '';
  categoryId = '';
  typeId = '';
  statusFilter: OrganizationStatusFilter = '';
  sortBy: SortBy = 'created_at';
  sortDir: 'asc' | 'desc' = 'desc';

  currentPage = 1;
  perPage = 15;
  totalItems = 0;
  readonly perPageOptions = [10, 15, 20, 50];

  canCreate = false;
  categoriesLoaded = false;
  typesLoaded = false;
  showFilters = false;

  searchFields: SearchField[] = [];

  statusTone(status: Organization['status']): 'success' | 'neutral' {
    return status === 'active' ? 'success' : 'neutral';
  }

  get taxonomiesLoaded(): boolean {
    return this.categoriesLoaded && this.typesLoaded;
  }

  get hasTaxonomies(): boolean {
    return this.categories.length > 0 && this.types.length > 0;
  }

  get hasActiveFilters(): boolean {
    return !!(
      this.search.trim() ||
      this.categoryId ||
      this.typeId ||
      this.statusFilter
    );
  }

  get drawerFilterCount(): number {
    return [this.categoryId, this.typeId, this.statusFilter].filter(Boolean).length;
  }

  ngOnInit(): void {
    this.canCreate = this.authService.hasPermission('ministries.create');
    this.initSearchFields();
    this.loadFilterOptions();
    this.loadOrganizations();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearchChange(value: string): void {
    this.search = value;
    this.currentPage = 1;
    this.loadOrganizations();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadOrganizations();
  }

  onPageSizeChange(size: number): void {
    this.perPage = size;
    this.currentPage = 1;
    this.loadOrganizations();
  }

  openOrganization(organization: Organization): void {
    void this.router.navigate(['/ministries', organization.id]);
  }

  retryLoad(): void {
    this.loadOrganizations();
  }

  activeMemberCount(organization: Organization): number {
    return organization.counts?.active_members ?? 0;
  }

  statusLabel(status: Organization['status']): string {
    return status === 'active' ? 'Active' : 'Inactive';
  }

  onAdvancedSearch(values: { [key: string]: unknown }): void {
    this.categoryId = (values['categoryId'] as string) || '';
    this.typeId = (values['typeId'] as string) || '';
    this.statusFilter = ((values['statusFilter'] as OrganizationStatusFilter) || '') as OrganizationStatusFilter;
    this.sortBy = ((values['sortBy'] as SortBy) || 'created_at') as SortBy;
    this.sortDir = ((values['sortDir'] as 'asc' | 'desc') || 'desc') as 'asc' | 'desc';
    this.currentPage = 1;
    this.loadOrganizations();
    this.showFilters = false;
    this.cdr.markForCheck();
  }

  onClearAdvancedSearch(): void {
    this.categoryId = '';
    this.typeId = '';
    this.statusFilter = '';
    this.sortBy = 'created_at';
    this.sortDir = 'desc';
    this.searchFields.forEach((f) => (f.value = undefined));
    this.currentPage = 1;
    this.loadOrganizations();
    this.cdr.markForCheck();
  }

  private initSearchFields(): void {
    this.searchFields = [
      {
        key: 'categoryId',
        label: 'Category',
        type: 'select',
        options: this.categories.map((c) => ({ value: c.id, label: c.name })),
        value: this.categoryId || undefined,
      },
      {
        key: 'typeId',
        label: 'Type',
        type: 'select',
        options: this.types.map((t) => ({ value: t.id, label: t.name })),
        value: this.typeId || undefined,
      },
      {
        key: 'statusFilter',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
        ],
        value: this.statusFilter || undefined,
      },
      {
        key: 'sortBy',
        label: 'Sort by',
        type: 'select',
        options: [
          { value: 'name', label: 'Name' },
          { value: 'code', label: 'Code' },
          { value: 'established_date', label: 'Established date' },
          { value: 'status', label: 'Status' },
          { value: 'created_at', label: 'Date added' },
          { value: 'active_member_count', label: 'Active members' },
        ],
        value: this.sortBy,
      },
      {
        key: 'sortDir',
        label: 'Sort direction',
        type: 'select',
        options: [
          { value: 'asc', label: 'Ascending' },
          { value: 'desc', label: 'Descending' },
        ],
        value: this.sortDir,
      },
    ];
  }

  private refreshCategoryOptions(): void {
    const field = this.searchFields.find((f) => f.key === 'categoryId');
    if (field) {
      field.options = this.categories.map((c) => ({ value: c.id, label: c.name }));
    }
  }

  private refreshTypeOptions(): void {
    const field = this.searchFields.find((f) => f.key === 'typeId');
    if (field) {
      field.options = this.types.map((t) => ({ value: t.id, label: t.name }));
    }
  }

  private loadFilterOptions(): void {
    this.api
      .listCategories({ is_active: true, per_page: 100 })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.categories = response.data;
          this.categoriesLoaded = true;
          this.refreshCategoryOptions();
          this.cdr.markForCheck();
        },
      });

    this.api
      .listTypes({ is_active: true, per_page: 100 })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.types = response.data;
          this.typesLoaded = true;
          this.refreshTypeOptions();
          this.cdr.markForCheck();
        },
      });
  }

  private loadOrganizations(): void {
    this.loading = true;
    this.loadError = null;
    this.cdr.markForCheck();

    this.api
      .listOrganizations({
        page: this.currentPage,
        per_page: this.perPage,
        include: 'category,type,counts',
        search: this.search.trim() || undefined,
        category_id: this.categoryId || undefined,
        type_id: this.typeId || undefined,
        status: this.statusFilter || undefined,
        sort_by: this.sortBy,
        sort_dir: this.sortDir,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.organizations = response.data;
          this.totalItems = response.meta?.total ?? 0;
          this.loading = false;
          this.loaded = true;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loadError = 'Could not load organizations. Please try again.';
          this.loading = false;
          this.loaded = true;
          this.cdr.markForCheck();
        },
      });
  }
}
