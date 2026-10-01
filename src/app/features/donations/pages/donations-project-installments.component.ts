import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { BCCService } from '@core/services/bcc.service';
import { FamilyService } from '@core/services/family.service';
import { BCC, Family, FamilyFilters } from '@core/models/family.model';
import {
  AdvancedSearchPanelComponent,
  SearchField,
} from '@shared/components/advanced-search-panel/advanced-search-panel.component';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { DonationsService } from '../services/donations.service';
import { QuickCollectService } from '../services/quick-collect.service';
import { DonationProject, ProjectInstallmentDue } from '../models/donation.model';
import { refreshStewardshipView, setupStewardshipRouteReload } from '../utils/stewardship-view.util';
import { CfCurrencyPipe } from '@shared/pipes/cf-currency.pipe';
import { CfActionIconComponent } from '@shared/components/cf-action-icon/cf-action-icon.component';
import { CfDatePipe } from '@shared/pipes/cf-date.pipe';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { ListToolbarComponent } from '@shared/components/list-toolbar/list-toolbar.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '@shared/components/status-badge/status-badge.component';
import {
  StewardshipActiveFilterChipsComponent,
  StewardshipFilterChip,
} from '../components/stewardship-active-filter-chips/stewardship-active-filter-chips.component';
import { SortableDirective, SortDirection, SortEvent } from '@shared/directives/sortable.directive';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { formatFamilyHeadCell, mapFamiliesToSelectOptions } from '@shared/utils/family-display.util';
import { cfFormatDate } from '@shared/utils/cf-intl.util';

type InstallmentSortColumn =
  | 'family_name'
  | 'project_name'
  | 'installment_label'
  | 'due_date'
  | 'outstanding'
  | 'status';

const INSTALLMENT_SORT_COLUMNS: InstallmentSortColumn[] = [
  'family_name',
  'project_name',
  'installment_label',
  'due_date',
  'outstanding',
  'status',
];

const INSTALLMENT_STATUS_FILTERS = ['pending', 'partially_paid', 'paid', 'waived', 'cancelled'] as const;
type InstallmentStatusFilter = (typeof INSTALLMENT_STATUS_FILTERS)[number];
type InstallmentFilterChipKey =
  | 'search'
  | 'bcc'
  | 'family'
  | 'project'
  | 'status'
  | 'overdue'
  | 'due_date_from'
  | 'due_date_to';

function isInstallmentStatusFilter(value: string | null | undefined): value is InstallmentStatusFilter {
  return value != null && (INSTALLMENT_STATUS_FILTERS as readonly string[]).includes(value);
}
@Component({
  selector: 'app-donations-project-installments',
  standalone: true,
  imports: [
    CfDatePipe,
    CommonModule,
    RouterModule,
    CfEmptyStateComponent,
    CfCurrencyPipe,
    CfActionIconComponent,
    AdvancedSearchPanelComponent,
    PageHeaderComponent,
    ListToolbarComponent,
    StewardshipActiveFilterChipsComponent,
    LoadingSkeletonComponent,
    DataTableComponent,
    StatusBadgeComponent,
    SortableDirective,
    PaginationComponent,
  ],
  styleUrls: ['../styles/stewardship-dashboard-shared.scss'],
  template: `
    <section class="installments-page cf-page cf-financial-dashboard">
      <app-page-header
        title="Project Installments"
        subtitle="Track who owes project installments — collect or follow up before deadlines."
        [titleMetaCount]="activeFilterCount"
      >
        <app-list-toolbar
          [showSearch]="false"
          [filterCount]="0"
          (filtersOpened)="showFilters = true"
        >
          <button
            type="button"
            class="cf-btn cf-btn-icon"
            (click)="openQuickCollect()"
            aria-label="Collect Payment"
            title="Collect Payment"
          >
            <app-cf-action-icon name="collect-payment" />
          </button>
          <a routerLink="/donations/projects" class="cf-btn cf-btn-icon" aria-label="View Projects" title="View Projects">
            <app-cf-action-icon name="layout-grid" />
          </a>
          <button
            type="button"
            class="cf-btn cf-btn-icon"
            *ngIf="overdueCount && !overdueOnly && !loading"
            (click)="showOverdueOnly()"
            aria-label="Show overdue only"
            title="Show overdue only"
          >
            <app-cf-action-icon name="calendar-clock" />
          </button>
        </app-list-toolbar>

        <div pageHeaderBelow *ngIf="activeFilterChips.length" class="installments-page__active-filters">
          <app-stewardship-active-filter-chips
            [chips]="activeFilterChips"
            [showClearAll]="false"
            [embedded]="true"
            (remove)="onActiveFilterChipRemove($event)"
          ></app-stewardship-active-filter-chips>
        </div>
      </app-page-header>

      <p *ngIf="message" class="cf-state cf-state--success">{{ message }}</p>
      <p *ngIf="error" class="cf-inline-alert cf-panel" role="alert">{{ error }}</p>

      <div
        class="cf-loading-block cf-panel"
        *ngIf="loading"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <app-loading-skeleton label="Loading installments…" type="table" [rows]="6" [columns]="7"></app-loading-skeleton>
      </div>

      <div
        class="cf-panel stewardship-table-panel"
        *ngIf="!loading && installments.length"
      >
        <app-data-table>
          <thead>
            <tr>
              <th
                scope="col"
                appSortable="family_name"
                [direction]="sortColumn === 'family_name' ? sortDirection : null"
                (sort)="onSort($event)"
              >
                Family
              </th>
              <th
                scope="col"
                appSortable="project_name"
                [direction]="sortColumn === 'project_name' ? sortDirection : null"
                (sort)="onSort($event)"
              >
                Project
              </th>
              <th
                scope="col"
                appSortable="installment_label"
                [direction]="sortColumn === 'installment_label' ? sortDirection : null"
                (sort)="onSort($event)"
              >
                Installment
              </th>
              <th
                scope="col"
                appSortable="due_date"
                [direction]="sortColumn === 'due_date' ? sortDirection : null"
                (sort)="onSort($event)"
              >
                Due Date
              </th>
              <th
                scope="col"
                class="cf-table__num"
                appSortable="outstanding"
                [direction]="sortColumn === 'outstanding' ? sortDirection : null"
                (sort)="onSort($event)"
              >
                Outstanding
              </th>
              <th
                scope="col"
                appSortable="status"
                [direction]="sortColumn === 'status' ? sortDirection : null"
                (sort)="onSort($event)"
              >
                Status
              </th>
              <th scope="col" class="cf-table__actions-col"><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let row of installments" [class.row-overdue]="isOverdue(row)">
              <td>
                <a *ngIf="row.family_id" [routerLink]="['/families', row.family_id]" class="cf-link">{{ installmentFamilyHead(row) }}</a>
              </td>
              <td>{{ row.project?.name || row.project_id }}</td>
              <td>{{ row.installment_label }}</td>
              <td>{{ row.due_date | cfDate }}</td>
              <td class="cf-table__num">{{ (row.outstanding_amount ?? (row.amount_due - row.amount_paid)) | cfCurrency }}</td>
              <td>
                <app-status-badge
                  [label]="isOverdue(row) ? 'Overdue' : row.status"
                  [tone]="isOverdue(row) ? 'critical' : 'neutral'"
                ></app-status-badge>
              </td>
              <td class="cf-table__actions-cell">
                <div class="cf-row-actions">
                  <button
                    aria-label="Collect"
                    title="Collect"
                    type="button"
                    class="cf-btn cf-btn-icon cf-btn--sm"
                    *ngIf="row.family_id"
                    (click)="collectForInstallment(row)"
                  >
                    <app-cf-action-icon name="collect-payment" />
                  </button>
                  <button
                    aria-label="Waive"
                    title="Waive"
                    type="button"
                    class="cf-btn cf-btn-icon cf-btn--sm"
                    *ngIf="canManage && (row.status === 'pending' || row.status === 'partially_paid')"
                    (click)="waive(row)"
                  >
                    <app-cf-action-icon name="badge-minus" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </app-data-table>

        <app-pagination
          *ngIf="totalItems > 0"
          [currentPage]="page"
          [pageSize]="perPage"
          [totalItems]="totalItems"
          [pageSizeOptions]="perPageOptions"
          [showPageSizeSelector]="true"
          [showPageInfo]="true"
          (pageChange)="goToPage($event)"
          (pageSizeChange)="onPageSizeChange($event)"
        ></app-pagination>
      </div>

      <app-cf-empty-state
        *ngIf="!totalItems && !loading"
        icon="▣"
        [title]="hasActiveListFilters ? 'No installments match' : 'No project installments'"
        [description]="
          hasActiveListFilters
            ? 'Try clearing filters or widening the due date range.'
            : 'Installments appear when families are enrolled in special projects with a payment schedule.'
        "
      >
        <a routerLink="/donations/projects" class="cf-btn cf-btn-icon cf-btn-primary">
          <app-cf-action-icon name="layout-grid" />
        </a>
        <button
          aria-label="Collect Payment"
          title="Collect Payment" type="button" class="cf-btn cf-btn-icon" (click)="openQuickCollect()">
          <app-cf-action-icon name="collect-payment" />
        </button>
      </app-cf-empty-state>

      <app-advanced-search-panel
        mode="sidepanel"
        [fields]="searchFields"
        [isExpanded]="showFilters"
        (search)="onAdvancedSearch($event)"
        (clear)="onClearAdvancedSearch()"
        (fieldChange)="onFilterFieldChange($event)"
        (close)="showFilters = false"
      ></app-advanced-search-panel>
    </section>
  `,
  styles: [`
    .installments-page__active-filters {
      width: 100%;
      min-width: 0;
    }
    .row-actions { display: flex; gap: 0.35rem; flex-wrap: wrap; }
    .row-overdue { background: var(--cf-amber-soft); }
    .status-pill { display: inline-block; padding: 0.12rem 0.45rem; border-radius: 999px; background: var(--cf-slate-100); font-size: 0.78rem; }
    .status-pill--overdue { background: var(--cf-critical-soft); color: var(--cf-critical); }
  `]
})
export class DonationsProjectInstallmentsComponent implements OnInit {
  installments: ProjectInstallmentDue[] = [];
  projects: DonationProject[] = [];
  tableSearch = '';
  loading = false;
  projectFilter = '';
  bccFilter = '';
  familyFilter = '';
  dueDateFrom = '';
  dueDateTo = '';
  overdueOnly = false;
  statusFilter = '';
  showFilters = false;
  bccOptions: Array<{ value: string; label: string }> = [];
  familyOptions: Array<{ value: string; label: string }> = [];
  familiesLoading = false;
  private familiesRequestSeq = 0;
  searchFields: SearchField[] = [];
  sortColumn: InstallmentSortColumn = 'outstanding';
  sortDirection: SortDirection = 'desc';
  message: string | null = null;
  error: string | null = null;
  canManage = false;
  page = 1;
  perPage = 20;
  readonly perPageOptions = [10, 20, 50, 100];
  totalItems = 0;

  constructor(
    private donationsService: DonationsService,
    private authService: AuthService,
    private quickCollectService: QuickCollectService,
    private bccService: BCCService,
    private familyService: FamilyService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private destroyRef: DestroyRef
  ) {}

  ngOnInit(): void {
    this.canManage = this.authService.hasPermission('donations.manage');
    const projectId = this.route.snapshot.queryParamMap.get('project_id');
    if (projectId) {
      this.projectFilter = projectId;
    }
    this.initSearchFields();
    this.loadProjects();
    this.loadBccOptions();
    this.loadFamiliesForPicker(this.bccFilter);
    this.loadInstallments();
    setupStewardshipRouteReload(this.router, this.destroyRef, '/donations/project-installments', () => {
      this.loadProjects();
      this.loadInstallments();
    });
    this.donationsService.ledgerMutated$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadInstallments());
  }

  get hasActiveListFilters(): boolean {
    return this.activeFilterCount > 0;
  }

  /** Family column: head person name only — never household family_name. */
  installmentFamilyHead(row: ProjectInstallmentDue): string {
    const fromApi = row.family_head_name?.trim();
    if (fromApi) {
      return fromApi;
    }
    return formatFamilyHeadCell(row.family);
  }

  openQuickCollect(): void {
    this.quickCollectService.open();
  }

  collectForFamily(familyId: string): void {
    this.quickCollectService.openForFamily(familyId);
  }

  collectForInstallment(row: ProjectInstallmentDue): void {
    this.quickCollectService.open({
      familyId: row.family_id || undefined,
      projectId: row.project_id,
      installmentId: row.id,
    });
  }

  get overdueCount(): number {
    return this.installments.filter((row) => this.isOverdue(row)).length;
  }

  get activeFilterCount(): number {
    let count = 0;
    if (this.tableSearch.trim()) {
      count += 1;
    }
    if (this.bccFilter) {
      count += 1;
    }
    if (this.familyFilter) {
      count += 1;
    }
    if (this.projectFilter) {
      count += 1;
    }
    if (this.dueDateFrom || this.dueDateTo) {
      count += 1;
    }
    if (this.overdueOnly) {
      count += 1;
    }
    if (this.statusFilter) {
      count += 1;
    }
    return count;
  }

  get activeFilterChips(): { key: InstallmentFilterChipKey; label: string; value?: string }[] {
    const chips: { key: InstallmentFilterChipKey; label: string; value?: string }[] = [];
    if (this.tableSearch.trim()) {
      chips.push({ key: 'search', label: 'Search', value: this.tableSearch.trim() });
    }
    if (this.bccFilter) {
      chips.push({ key: 'bcc', label: 'BCC', value: this.bccFilterLabel(this.bccFilter) });
    }
    if (this.familyFilter) {
      chips.push({ key: 'family', label: 'Family', value: this.familyFilterLabel(this.familyFilter) });
    }
    if (this.projectFilter) {
      chips.push({ key: 'project', label: 'Project', value: this.projectFilterLabel(this.projectFilter) });
    }
    if (this.dueDateFrom) {
      chips.push({ key: 'due_date_from', label: 'Due from', value: cfFormatDate(this.dueDateFrom) });
    }
    if (this.dueDateTo) {
      chips.push({ key: 'due_date_to', label: 'Due to', value: cfFormatDate(this.dueDateTo) });
    }
    if (this.overdueOnly) {
      chips.push({ key: 'overdue', label: 'Overdue only' });
    }
    if (this.statusFilter) {
      chips.push({ key: 'status', label: 'Status', value: this.statusFilterLabel(this.statusFilter) });
    }
    return chips;
  }

  onAdvancedSearch(values: { [key: string]: unknown }): void {
    const prevBcc = this.bccFilter;
    this.applyFilterValues(values);
    const requestedFamily = String(values['family_id'] ?? '').trim();
    this.showFilters = false;
    this.page = 1;

    const afterFamiliesReady = (): void => {
      this.reconcileFamilyForBcc(this.bccFilter, requestedFamily);
      this.syncSearchFieldValues();
      this.loadInstallments();
    };

    if (prevBcc !== this.bccFilter) {
      this.loadFamiliesForPicker(this.bccFilter, afterFamiliesReady);
    } else {
      this.reconcileFamilyForBcc(this.bccFilter, requestedFamily);
      this.syncSearchFieldValues();
      this.loadInstallments();
    }
  }

  onClearAdvancedSearch(): void {
    this.tableSearch = '';
    this.bccFilter = '';
    this.familyFilter = '';
    this.projectFilter = '';
    this.dueDateFrom = '';
    this.dueDateTo = '';
    this.overdueOnly = false;
    this.statusFilter = '';
    this.showFilters = false;
    this.loadFamiliesForPicker('');
    this.syncSearchFieldValues();
    this.page = 1;
    this.loadInstallments();
  }

  onFilterFieldChange(event: { field: SearchField; value: unknown }): void {
    if (event.field.key !== 'bcc_id') {
      return;
    }
    const nextBcc = String(event.value ?? '').trim();
    this.bccFilter = nextBcc;
    this.familyFilter = '';
    this.loadFamiliesForPicker(nextBcc);
    this.syncSearchFieldValues();
    refreshStewardshipView(this.cdr);
  }

  private applyFilterValues(values: { [key: string]: unknown }): void {
    this.tableSearch = String(values['search'] ?? '').trim();
    this.bccFilter = String(values['bcc_id'] ?? '').trim();
    this.projectFilter = String(values['project_id'] ?? '').trim();
    this.dueDateFrom = String(values['due_date_from'] ?? '').trim();
    this.dueDateTo = String(values['due_date_to'] ?? '').trim();
    this.overdueOnly = values['overdue_only'] === true || values['overdue_only'] === 'true';
    const nextStatus = values['status'] as string;
    this.statusFilter = isInstallmentStatusFilter(nextStatus) ? nextStatus : '';
  }

  onSort(event: SortEvent): void {
    if (!INSTALLMENT_SORT_COLUMNS.includes(event.column as InstallmentSortColumn)) {
      return;
    }
    this.sortColumn = event.column as InstallmentSortColumn;
    this.sortDirection = event.direction ?? 'asc';
    this.page = 1;
    this.loadInstallments();
  }

  goToPage(page: number): void {
    this.page = page;
    this.loadInstallments();
  }

  onPageSizeChange(size: number): void {
    this.perPage = size;
    this.page = 1;
    this.loadInstallments();
  }

  onActiveFilterChipRemove(chip: StewardshipFilterChip): void {
    const key = chip.key as InstallmentFilterChipKey | undefined;
    if (key) {
      this.removeFilterChip(key);
    }
  }

  removeFilterChip(key: InstallmentFilterChipKey): void {
    if (key === 'search') {
      this.tableSearch = '';
      this.syncSearchFieldValues();
      refreshStewardshipView(this.cdr);
      return;
    }
    if (key === 'bcc') {
      this.bccFilter = '';
      this.familyFilter = '';
      this.loadFamiliesForPicker('');
    } else if (key === 'family') {
      this.familyFilter = '';
    } else if (key === 'project') {
      this.projectFilter = '';
    } else if (key === 'due_date_from') {
      this.dueDateFrom = '';
    } else if (key === 'due_date_to') {
      this.dueDateTo = '';
    } else if (key === 'overdue') {
      this.overdueOnly = false;
    } else if (key === 'status') {
      this.statusFilter = '';
    }
    this.syncSearchFieldValues();
    this.page = 1;
    this.loadInstallments();
  }

  clearAllFilters(): void {
    this.onClearAdvancedSearch();
  }

  showOverdueOnly(): void {
    this.overdueOnly = true;
    this.syncSearchFieldValues();
    this.page = 1;
    this.loadInstallments();
  }

  isOverdue(row: ProjectInstallmentDue): boolean {
    if (row.status === 'paid' || row.status === 'waived' || row.status === 'cancelled') {
      return false;
    }
    return new Date(row.due_date).getTime() < Date.now();
  }

  loadProjects(): void {
    this.donationsService.getProjects().subscribe({
      next: (res) => {
        this.projects = res.data || [];
        this.syncSearchFieldValues();
        refreshStewardshipView(this.cdr);
      }
    });
  }

  loadInstallments(): void {
    this.loading = true;
    this.error = null;
    refreshStewardshipView(this.cdr);
    const filters: Record<string, string | boolean> = {
      page: String(this.page),
      per_page: String(this.perPage),
    };
    if (this.tableSearch.trim()) {
      filters['search'] = this.tableSearch.trim();
    }
    if (this.bccFilter) {
      filters['bcc_id'] = this.bccFilter;
    }
    if (this.familyFilter) {
      filters['family_id'] = this.familyFilter;
    }
    if (this.projectFilter) {
      filters['project_id'] = this.projectFilter;
    }
    if (this.dueDateFrom) {
      filters['due_date_from'] = this.dueDateFrom;
    }
    if (this.dueDateTo) {
      filters['due_date_to'] = this.dueDateTo;
    }
    if (this.overdueOnly) {
      filters['overdue_only'] = true;
    }
    if (this.statusFilter) {
      filters['status'] = this.statusFilter;
    }
    filters['sort'] = this.sortColumn;
    filters['direction'] = this.sortDirection ?? 'asc';

    this.donationsService.getProjectInstallments(filters).subscribe({
      next: (res) => {
        this.installments = res.data?.data || [];
        this.page = res.data?.current_page ?? this.page;
        this.totalItems = res.data?.total ?? this.installments.length;
        this.loading = false;
        refreshStewardshipView(this.cdr);
      },
      error: () => {
        this.error = 'Failed to load project installments.';
        this.loading = false;
        refreshStewardshipView(this.cdr);
      }
    });
  }

  waive(row: ProjectInstallmentDue): void {
    this.donationsService.waiveProjectInstallment(row.id).subscribe({
      next: (res) => {
        this.message = res.message;
        this.loadInstallments();
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to waive installment.';
        refreshStewardshipView(this.cdr);
      }
    });
  }

  cancel(row: ProjectInstallmentDue): void {
    this.donationsService.cancelProjectInstallment(row.id).subscribe({
      next: (res) => {
        this.message = res.message;
        this.loadInstallments();
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to cancel installment.';
        refreshStewardshipView(this.cdr);
      }
    });
  }

  private initSearchFields(): void {
    this.searchFields = [
      {
        key: 'search',
        label: 'Search',
        type: 'text',
        placeholder: 'Code, head name, project, or installment…',
        value: this.tableSearch.trim() || undefined,
      },
      {
        key: 'bcc_id',
        label: 'BCC',
        type: 'select',
        options: this.bccOptions,
        value: this.bccFilter || undefined,
      },
      {
        key: 'family_id',
        label: 'Family',
        type: 'select',
        options: this.familyOptions,
        placeholder: this.familiesLoading ? 'Loading families…' : 'All families',
        value: this.familyFilter || undefined,
      },
      {
        key: 'project_id',
        label: 'Project',
        type: 'select',
        options: this.projectSelectOptions,
        value: this.projectFilter || undefined,
      },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'pending', label: 'Pending' },
          { value: 'partially_paid', label: 'Partially paid' },
          { value: 'paid', label: 'Paid' },
          { value: 'waived', label: 'Waived' },
          { value: 'cancelled', label: 'Cancelled' },
        ],
        value: this.statusFilter || undefined,
      },
      {
        key: 'due_date_from',
        label: 'Due from',
        type: 'date',
        value: this.dueDateFrom || undefined,
      },
      {
        key: 'due_date_to',
        label: 'Due to',
        type: 'date',
        value: this.dueDateTo || undefined,
      },
      {
        key: 'overdue_only',
        label: 'Overdue only',
        type: 'boolean',
        placeholder: 'Show overdue installments only',
        value: this.overdueOnly ? true : undefined,
      },
    ];
  }

  private syncSearchFieldValues(): void {
    if (!this.searchFields.length) {
      this.initSearchFields();
      return;
    }
    this.searchFields = this.searchFields.map((field) => ({
      ...field,
      value: ({
        search: this.tableSearch.trim() || undefined,
        bcc_id: this.bccFilter || undefined,
        family_id: this.familyFilter || undefined,
        project_id: this.projectFilter || undefined,
        due_date_from: this.dueDateFrom || undefined,
        due_date_to: this.dueDateTo || undefined,
        overdue_only: this.overdueOnly ? true : undefined,
        status: this.statusFilter || undefined,
      } as Record<string, string | boolean | undefined>)[field.key],
      options:
        field.key === 'project_id'
          ? this.projectSelectOptions
          : field.key === 'bcc_id'
            ? this.bccOptions
            : field.key === 'family_id'
              ? this.familyOptions
              : field.options,
      placeholder:
        field.key === 'family_id'
          ? this.familiesLoading
            ? 'Loading families…'
            : field.placeholder
          : field.placeholder,
    }));
  }

  private loadBccOptions(): void {
    this.bccService.getBCCs({ status: 'active', per_page: 500, sort_by: 'name', sort_order: 'asc' }).subscribe({
      next: (response) => {
        this.bccOptions = [
          { value: 'unassigned', label: 'Unassigned area' },
          ...(response?.data ?? []).map((bcc) => ({
            value: String(bcc.id),
            label: this.bccOptionLabel(bcc),
          })),
        ];
        this.syncSearchFieldValues();
        refreshStewardshipView(this.cdr);
      },
    });
  }

  private loadFamiliesForPicker(bccId: string, onComplete?: () => void): void {
    const seq = ++this.familiesRequestSeq;
    this.familiesLoading = true;
    const filters: FamilyFilters = {
      status: 'active',
      per_page: 500,
      sort_by: 'family_code',
      sort_order: 'asc',
    };
    if (bccId) {
      filters.bcc_id = bccId;
    }
    this.familyService.getFamilies(filters).subscribe({
      next: (response) => {
        if (seq !== this.familiesRequestSeq) {
          return;
        }
        const families = response?.data ?? [];
        this.familyOptions = mapFamiliesToSelectOptions(families as Family[]);
        this.familiesLoading = false;
        this.syncSearchFieldValues();
        refreshStewardshipView(this.cdr);
        onComplete?.();
      },
      error: () => {
        if (seq !== this.familiesRequestSeq) {
          return;
        }
        this.familyOptions = [];
        this.familyFilter = '';
        this.familiesLoading = false;
        this.syncSearchFieldValues();
        refreshStewardshipView(this.cdr);
        onComplete?.();
      },
    });
  }

  private reconcileFamilyForBcc(bccId: string, candidateFamilyId?: string): void {
    const familyId = candidateFamilyId ?? this.familyFilter;
    if (!familyId) {
      return;
    }
    const allowed = this.familyOptions.some((option) => option.value === familyId);
    if (!allowed) {
      this.familyFilter = '';
      return;
    }
    this.familyFilter = familyId;
  }

  private bccOptionLabel(bcc: BCC): string {
    const code = bcc.bcc_code?.trim();
    const name = bcc.name?.trim();
    if (code && name) {
      return `${code} - ${name}`;
    }
    return name || code || 'BCC';
  }

  private bccFilterLabel(bccId: string): string {
    if (bccId === 'unassigned') {
      return 'Unassigned area';
    }
    return this.bccOptions.find((option) => option.value === bccId)?.label ?? bccId;
  }

  private familyFilterLabel(familyId: string): string {
    return this.familyOptions.find((option) => option.value === familyId)?.label ?? familyId;
  }

  private get projectSelectOptions(): Array<{ value: string; label: string }> {
    return this.projects.map((project) => ({
      value: String(project.id),
      label: project.name ?? String(project.id),
    }));
  }

  private projectFilterLabel(projectId: string): string {
    const match = this.projects.find((project) => String(project.id) === projectId);
    return match?.name ?? projectId;
  }

  private statusFilterLabel(status: string): string {
    return status.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
}
