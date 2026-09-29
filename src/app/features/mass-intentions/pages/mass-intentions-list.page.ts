import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import {
  ActiveFilter,
  AdvancedSearchPanelComponent,
  SearchField,
} from '@shared/components/advanced-search-panel/advanced-search-panel.component';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { ListToolbarComponent } from '@shared/components/list-toolbar/list-toolbar.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { StatusBadgeComponent } from '@shared/components/status-badge/status-badge.component';
import { MassIntentionFormModalComponent } from '../components/mass-intention-form-modal.component';
import { MassIntentionViewModalComponent } from '../components/mass-intention-view-modal.component';
import { MassIntentionRecord, MassIntentionsApiService } from '../services/mass-intentions-api.service';
import { DisableWhenReadOnlyDirective } from '@shared/directives/disable-when-read-only.directive';
import { canCreateMassIntention, canExportMassRegister } from '../utils/mass-intentions-auth.util';
import { CfActionIconComponent } from '@shared/components/cf-action-icon/cf-action-icon.component';
import { ToastService } from '@core/services/toast.service';
import {
  buildMassIntentionsExportFilename,
  downloadMassIntentionsPdf,
  openMassIntentionsPrintWindow,
  printMassIntentionsList,
} from '../utils/mass-intentions-list-export.util';
import {
  formatMassIntentionScheduledDay,
  massIntentionListDescription,
  massIntentionBeneficiaryIdentification,
  massIntentionListType,
  massIntentionNeedsCategory,
} from '../utils/mass-intention-list-display';
import { massIntentionStageLabel, massIntentionStageTone } from '../utils/mass-intention-status-display';

type StatusFilterValue = '' | 'open' | 'closed';

type MassIntentionSortColumn =
  | 'requested_date'
  | 'beneficiary_name'
  | 'intention_text'
  | 'intention_description'
  | 'status';

type SortDirection = 'asc' | 'desc';

const DEFAULT_SORT_COLUMN: MassIntentionSortColumn = 'requested_date';
const DEFAULT_SORT_DIRECTION: SortDirection = 'asc';
const SORT_COLUMNS: MassIntentionSortColumn[] = [
  'requested_date',
  'beneficiary_name',
  'intention_text',
  'intention_description',
  'status',
];

@Component({
  selector: 'app-mass-intentions-list-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    PageHeaderComponent,
    CfEmptyStateComponent,
    ListToolbarComponent,
    LoadingSkeletonComponent,
    PaginationComponent,
    StatusBadgeComponent,
    DataTableComponent,
    MassIntentionFormModalComponent,
    MassIntentionViewModalComponent,
    DisableWhenReadOnlyDirective,
    AdvancedSearchPanelComponent,
    CfActionIconComponent,
  ],
  templateUrl: './mass-intentions-list.page.html',
  styleUrl: './mass-intentions-list.page.scss',
})
export class MassIntentionsListPageComponent {
  readonly pageSizeOptions = [10, 20, 50];
  readonly pageSize = signal(20);

  private readonly api = inject(MassIntentionsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly loaded = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly items = signal<MassIntentionRecord[]>([]);
  readonly search = signal('');
  readonly filterStatus = signal<StatusFilterValue>('');
  readonly filterRequestedDate = signal('');
  readonly showAdvancedSearch = signal(false);
  readonly currentPage = signal(1);
  readonly totalItems = signal(0);
  readonly registerEmpty = signal(false);
  readonly showFormModal = signal(false);
  readonly showViewModal = signal(false);
  readonly editId = signal<string | null>(null);
  readonly viewId = signal<string | null>(null);
  readonly exportBusy = signal(false);
  readonly sortColumn = signal<MassIntentionSortColumn>(DEFAULT_SORT_COLUMN);
  readonly sortDirection = signal<SortDirection>(DEFAULT_SORT_DIRECTION);

  searchFields: SearchField[] = [];

  constructor() {
    this.initSearchFields();
    this.route.queryParamMap.subscribe((params) => {
      const view = params.get('view') ?? '';
      const create = params.get('create') ?? '';
      const search = params.get('search') ?? '';
      const requestedDate = params.get('requested_date') ?? '';
      const page = Math.max(1, Number(params.get('page') || 1) || 1);
      const perPageRaw = Number(params.get('per_page') || 20);
      const perPage = this.pageSizeOptions.includes(perPageRaw) ? perPageRaw : 20;
      this.filterStatus.set(this.parseStatusFromQuery(params.get('status'), params.has('status')));
      this.filterRequestedDate.set(this.isIsoDate(requestedDate) ? requestedDate : '');
      this.search.set(search);
      this.currentPage.set(page);
      this.pageSize.set(perPage);
      this.sortColumn.set(this.parseSortColumn(params.get('sort')));
      this.sortDirection.set(this.parseSortDirection(params.get('direction')));
      this.syncSearchFieldValues();
      this.reload();
      if (view) {
        this.openView(view);
      }
      if (create === '1' && this.canCreate()) {
        this.openCreate();
      }
    });
  }

  canCreate(): boolean {
    return canCreateMassIntention(this.auth);
  }

  canExport(): boolean {
    return canExportMassRegister(this.auth);
  }

  downloadList(): void {
    if (this.exportBusy()) {
      return;
    }
    this.exportBusy.set(true);
    const filters = this.currentFilterSummary();
    this.api.downloadRegisterPdf(this.buildListQueryParams()).subscribe({
      next: (blob) => {
        this.exportBusy.set(false);
        downloadMassIntentionsPdf(blob, buildMassIntentionsExportFilename(filters));
        this.toast.success('Downloaded register (PDF).');
      },
      error: (err) => {
        this.exportBusy.set(false);
        const message = err?.status === 404
          ? 'No intentions match the current filters.'
          : 'Could not download the register. Try again.';
        if (err?.status === 404) {
          this.toast.info(message);
        } else {
          this.toast.error(message);
        }
      },
    });
  }

  printList(): void {
    const printWindow = openMassIntentionsPrintWindow();
    if (!printWindow) {
      this.toast.warning('Allow pop-ups to print the register.', 'Pop-up blocked');
      return;
    }
    this.runExport(
      (rows) => {
        printMassIntentionsList(rows, this.currentFilterSummary(), printWindow);
      },
      () => printWindow.close(),
    );
  }

  drawerFilterCount(): number {
    let count = 0;
    if (this.isNonDefaultStatusFilter()) {
      count += 1;
    }
    if (this.filterRequestedDate()) {
      count += 1;
    }
    return count;
  }

  getActiveFilters(): ActiveFilter[] {
    const filters: ActiveFilter[] = [];
    const status = this.filterStatus();
    if (status === 'closed') {
      filters.push({ key: 'status', label: 'Status', value: status, displayValue: 'Closed' });
    } else if (status === '') {
      filters.push({ key: 'status', label: 'Status', value: 'all', displayValue: 'All statuses' });
    } else if (this.route.snapshot.queryParamMap.get('status') === 'open') {
      filters.push({ key: 'status', label: 'Status', value: status, displayValue: 'Open' });
    }
    const day = this.filterRequestedDate();
    if (day) {
      filters.push({
        key: 'requested_date',
        label: 'Scheduled day',
        value: day,
        displayValue: formatMassIntentionScheduledDay(day),
      });
    }
    return filters;
  }

  isEmptyRegister(): boolean {
    return (
      this.registerEmpty() &&
      !this.search().trim() &&
      this.filterStatus() === 'open' &&
      !this.filterRequestedDate()
    );
  }

  sortBy(column: MassIntentionSortColumn): void {
    const nextColumn = column;
    const nextDirection: SortDirection =
      this.sortColumn() === column && this.sortDirection() === 'asc' ? 'desc' : 'asc';
    const isDefaultSort =
      nextColumn === DEFAULT_SORT_COLUMN && nextDirection === DEFAULT_SORT_DIRECTION;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        sort: isDefaultSort ? null : nextColumn,
        direction: isDefaultSort ? null : nextDirection,
        page: null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  sortIcon(column: MassIntentionSortColumn): string {
    if (this.sortColumn() !== column) {
      return '↕';
    }
    return this.sortDirection() === 'asc' ? '↑' : '↓';
  }

  sortAriaSort(column: MassIntentionSortColumn): 'ascending' | 'descending' | 'none' {
    if (this.sortColumn() !== column) {
      return 'none';
    }
    return this.sortDirection() === 'asc' ? 'ascending' : 'descending';
  }

  resultsSummary(): string {
    const total = this.totalItems();
    const page = this.currentPage();
    const size = this.pageSize();
    if (total <= size) {
      return `${total} intention${total === 1 ? '' : 's'}`;
    }
    const from = (page - 1) * size + 1;
    const to = Math.min(page * size, total);
    return `Showing ${from}–${to} of ${total} intentions`;
  }

  openFilters(): void {
    this.syncSearchFieldValues();
    this.showAdvancedSearch.set(true);
  }

  onAdvancedSearch(values: Record<string, unknown>): void {
    const rawStatus = String(values['status'] ?? 'open');
    const status = this.statusFromDrawerValue(rawStatus);
    const rawDate = String(values['requested_date'] ?? '');
    const requestedDate = this.isIsoDate(rawDate) ? rawDate : '';
    this.applyDrawerFiltersToRoute({ status, requestedDate });
    this.showAdvancedSearch.set(false);
  }

  onClearAdvancedSearch(): void {
    this.applyDrawerFiltersToRoute({ status: 'open', requestedDate: '' });
    this.showAdvancedSearch.set(false);
  }

  removeFilter(filter: ActiveFilter): void {
    if (filter.key === 'status') {
      this.applyDrawerFiltersToRoute({ status: 'open' });
      return;
    }
    if (filter.key === 'requested_date') {
      this.applyDrawerFiltersToRoute({ requestedDate: '' });
    }
  }

  clearAllFilters(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        status: null,
        requested_date: null,
        search: null,
        page: null,
        sort: null,
        direction: null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  openCreate(): void {
    this.editId.set(null);
    this.showFormModal.set(true);
  }

  openEdit(id: string): void {
    this.editId.set(id);
    this.showFormModal.set(true);
  }

  openView(id: string): void {
    this.viewId.set(id);
    this.showViewModal.set(true);
  }

  closeFormModal(): void {
    this.showFormModal.set(false);
    this.editId.set(null);
  }

  closeViewModal(): void {
    this.showViewModal.set(false);
    this.viewId.set(null);
  }

  onEditFromView(id: string): void {
    this.closeViewModal();
    this.openEdit(id);
  }

  onSaved(): void {
    this.closeFormModal();
    this.reload();
  }

  onSearch(term: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { search: term.trim() || null, page: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  goToPage(page: number): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: page > 1 ? page : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  onPageSizeChange(size: number): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        per_page: size !== 20 ? size : null,
        page: null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  statusLabel(row: MassIntentionRecord): string {
    return massIntentionStageLabel(row.status, row.said_progress);
  }

  statusTone(row: MassIntentionRecord) {
    return massIntentionStageTone(row.status, row.said_progress);
  }

  intentionType(row: MassIntentionRecord): string {
    return massIntentionListType(row);
  }

  intentionDescription(row: MassIntentionRecord): string | null {
    return massIntentionListDescription(row);
  }

  needsCategory(row: MassIntentionRecord): boolean {
    return massIntentionNeedsCategory(row);
  }

  scheduledDay(row: MassIntentionRecord): string {
    return formatMassIntentionScheduledDay(row.requested_date);
  }

  beneficiaryIdentification(row: MassIntentionRecord): string | null {
    return massIntentionBeneficiaryIdentification(row);
  }

  private applyDrawerFiltersToRoute(partial: {
    status?: StatusFilterValue;
    requestedDate?: string;
  }): void {
    const status = partial.status !== undefined ? partial.status : this.filterStatus();
    const requestedDate =
      partial.requestedDate !== undefined ? partial.requestedDate : this.filterRequestedDate();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        status: this.statusToQueryParam(status),
        requested_date: requestedDate || null,
        page: null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private parseStatusFromQuery(value: string | null, hasParam: boolean): StatusFilterValue {
    if (!hasParam) {
      return 'open';
    }
    if (value === 'all' || value === '') {
      return '';
    }
    if (value === 'closed') {
      return 'closed';
    }
    if (value === 'open') {
      return 'open';
    }
    return 'open';
  }

  private statusToQueryParam(status: StatusFilterValue): string | null {
    if (status === 'open') {
      return null;
    }
    if (status === '') {
      return 'all';
    }
    return status;
  }

  private statusFromDrawerValue(raw: string): StatusFilterValue {
    if (raw === 'all') {
      return '';
    }
    if (raw === 'closed') {
      return 'closed';
    }
    return 'open';
  }

  private statusDrawerValue(): string {
    const status = this.filterStatus();
    if (status === '') {
      return 'all';
    }
    return status;
  }

  private isNonDefaultStatusFilter(): boolean {
    const status = this.filterStatus();
    return status === 'closed' || status === '';
  }

  private parseSortColumn(value: string | null): MassIntentionSortColumn {
    if (value && SORT_COLUMNS.includes(value as MassIntentionSortColumn)) {
      return value as MassIntentionSortColumn;
    }
    return DEFAULT_SORT_COLUMN;
  }

  private parseSortDirection(value: string | null): SortDirection {
    return value === 'desc' ? 'desc' : DEFAULT_SORT_DIRECTION;
  }

  private isIsoDate(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(value);
  }

  private currentFilterSummary(): { search?: string; status?: string; requestedDate?: string } {
    return {
      search: this.search().trim() || undefined,
      status: this.filterStatus() || undefined,
      requestedDate: this.filterRequestedDate() || undefined,
    };
  }

  private buildListQueryParams(): Record<string, string | number> {
    const query: Record<string, string | number> = {};
    const status = this.filterStatus();
    if (status) {
      query['status'] = status;
    }
    if (this.search().trim()) {
      query['search'] = this.search().trim();
    }
    if (this.filterRequestedDate()) {
      query['requested_date'] = this.filterRequestedDate();
    }
    query['sort'] = this.sortColumn();
    query['direction'] = this.sortDirection();
    return query;
  }

  private runExport(handler: (rows: MassIntentionRecord[]) => void, onError?: () => void): void {
    if (this.exportBusy()) {
      return;
    }
    this.exportBusy.set(true);
    this.api.listAllRequests(this.buildListQueryParams()).subscribe({
      next: (rows) => {
        this.exportBusy.set(false);
        if (!rows.length) {
          this.toast.info('No intentions match the current filters.');
          onError?.();
          return;
        }
        handler(rows);
      },
      error: () => {
        this.exportBusy.set(false);
        onError?.();
        this.toast.error('Could not export the register. Try again.');
      },
    });
  }

  private initSearchFields(): void {
    this.searchFields = [
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        value: this.filterStatus() || undefined,
        options: [
          { value: 'open', label: 'Open' },
          { value: 'closed', label: 'Closed' },
          { value: 'all', label: 'All statuses' },
        ],
      },
      {
        key: 'requested_date',
        label: 'Scheduled day',
        type: 'date',
        value: this.filterRequestedDate() || undefined,
      },
    ];
  }

  private syncSearchFieldValues(): void {
    this.searchFields = this.searchFields.map((field) => {
      if (field.key === 'status') {
        return { ...field, value: this.statusDrawerValue() };
      }
      if (field.key === 'requested_date') {
        return { ...field, value: this.filterRequestedDate() || undefined };
      }
      return field;
    });
  }

  reload(): void {
    this.loading.set(true);
    this.loadError.set(null);
    const query: Record<string, string | number> = {
      ...this.buildListQueryParams(),
      per_page: this.pageSize(),
      page: this.currentPage(),
    };
    this.api.listRequests(query).subscribe({
      next: (res) => {
        this.items.set(res.data ?? []);
        this.totalItems.set(res.total ?? this.items().length);
        if (res.current_page) {
          this.currentPage.set(res.current_page);
        }
        this.loading.set(false);
        this.loaded.set(true);
        if (
          !this.search().trim() &&
          this.filterStatus() === 'open' &&
          !this.filterRequestedDate() &&
          this.currentPage() === 1
        ) {
          this.registerEmpty.set((res.total ?? 0) === 0);
        }
      },
      error: () => {
        this.loading.set(false);
        this.loaded.set(true);
        this.loadError.set('Could not load the Mass intention register. Check your connection and try again.');
      },
    });
  }
}
