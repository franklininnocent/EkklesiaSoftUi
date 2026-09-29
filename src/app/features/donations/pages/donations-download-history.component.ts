import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import {
  ActiveFilter,
  AdvancedSearchPanelComponent,
  SearchField,
} from '@shared/components/advanced-search-panel/advanced-search-panel.component';
import { CfActionIconComponent } from '@shared/components/cf-action-icon/cf-action-icon.component';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { SortableDirective, SortEvent, SortDirection } from '@shared/directives/sortable.directive';
import { ListToolbarComponent } from '@shared/components/list-toolbar/list-toolbar.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { DonationsService } from '../services/donations.service';
import { DonationReportCatalogItem, DonationReportExport } from '../models/donation.model';
import { donationReportExportFormatLabelForRow } from './reports/donation-report-export-format.util';

const STATUS_OPTIONS = [
  { value: 'queued', label: 'Queued' },
  { value: 'processing', label: 'Preparing' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'expired', label: 'Expired' },
];

@Component({
  selector: 'app-donations-download-history',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    PageHeaderComponent,
    ListToolbarComponent,
    AdvancedSearchPanelComponent,
    CfActionIconComponent,
    CfEmptyStateComponent,
    SortableDirective,
    PaginationComponent,
  ],
  template: `
    <section class="download-history cf-page">
      <app-page-header
        title="Download history"
        subtitle="Every report download requested for this parish (CSV, Excel, or PDF)."
      >
        <app-list-toolbar
          *ngIf="canView"
          searchPlaceholder="Report or person"
          [searchValue]="search"
          [filterCount]="activeChips.length"
          (searchChange)="onSearchChange($event)"
          (filtersOpened)="openFilters()"
        ></app-list-toolbar>
      </app-page-header>

      <p *ngIf="!canView" class="cf-state cf-state--error">
        You don't have permission to view download history. Ask your parish administrator to grant Access Donation Reports.
      </p>

      <div
        class="download-history__chips"
        *ngIf="canView && activeChips.length"
        role="region"
        aria-label="Active filters"
      >
        <span class="cf-meta">Active filters</span>
        <div class="download-history__chip-list">
          <span class="cf-badge cf-badge--info" *ngFor="let filter of activeChips">
            {{ filter.label }}: {{ filter.displayValue }}
            <button
              type="button"
              class="download-history__chip-remove"
              (click)="removeFilter(filter)"
              [attr.aria-label]="'Remove filter: ' + filter.label"
            >
              ×
            </button>
          </span>
        </div>
        <button
          type="button"
          class="cf-btn cf-btn-icon cf-btn--sm"
          (click)="clearAllFilters()"
          aria-label="Clear all filters"
          title="Clear all filters"
        >
          <app-cf-action-icon name="filter" />
        </button>
      </div>

      <p *ngIf="filterError" class="cf-state cf-state--error">{{ filterError }}</p>
      <p *ngIf="canView && loading" class="cf-state" role="status" aria-busy="true">Loading download history…</p>
      <p *ngIf="error" class="cf-state cf-state--error">
        {{ error }}
        <button type="button" class="cf-btn cf-btn--sm" (click)="load()">Try again</button>
      </p>

      <div class="download-history__table-scroll" *ngIf="canView && !loading && rows.length">
        <table class="table cf-table">
          <thead>
            <tr>
              <th scope="col" appSortable="report" [direction]="sortColumn === 'report' ? sortDirection : null" (sort)="onSort($event)">Report</th>
              <th scope="col">Format</th>
              <th scope="col" appSortable="requested_by" [direction]="sortColumn === 'requested_by' ? sortDirection : null" (sort)="onSort($event)">Requested by</th>
              <th scope="col" appSortable="created_at" [direction]="sortColumn === 'created_at' ? sortDirection : null" (sort)="onSort($event)">Requested</th>
              <th scope="col" appSortable="status" [direction]="sortColumn === 'status' ? sortDirection : null" (sort)="onSort($event)">Status</th>
              <th scope="col" appSortable="completed_at" [direction]="sortColumn === 'completed_at' ? sortDirection : null" (sort)="onSort($event)">Completed</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let row of rows">
              <td>{{ reportLabel(row.report_type) }}</td>
              <td>
                <span class="cf-badge cf-badge--neutral">{{ exportFormatLabel(row) }}</span>
              </td>
              <td>{{ row.requested_by_name || '—' }}</td>
              <td>{{ row.created_at | date:'medium' }}</td>
              <td>
                <span class="status-pill" [class]="'status-pill--' + statusTone(row)">{{ statusLabel(row) }}</span>
              </td>
              <td>{{ row.completed_at ? (row.completed_at | date:'medium') : '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <app-pagination
        *ngIf="canView && !loading && totalItems > 0"
        [currentPage]="page"
        [pageSize]="perPage"
        [totalItems]="totalItems"
        [pageSizeOptions]="perPageOptions"
        [showPageSizeSelector]="true"
        [showPageInfo]="true"
        (pageChange)="goToPage($event)"
        (pageSizeChange)="onPageSizeChange($event)"
      ></app-pagination>

      <app-cf-empty-state
        *ngIf="canView && !loading && !rows.length && !error && !filterError"
        icon="↓"
        [title]="hasActiveFilters ? 'No matching downloads' : 'No downloads yet'"
        [description]="hasActiveFilters
          ? 'Try a different report, status, or date range.'
          : 'Download a report and it will appear here.'"
        [hasActions]="!hasActiveFilters"
      >
        <a *ngIf="!hasActiveFilters" routerLink="/donations/reports" class="cf-btn cf-btn-primary">Go to reports</a>
      </app-cf-empty-state>

      <app-advanced-search-panel
        mode="sidepanel"
        [fields]="searchFields"
        [isExpanded]="showFilters"
        (search)="onFiltersApplied($event)"
        (clear)="clearAllFilters()"
        (close)="showFilters = false"
      ></app-advanced-search-panel>
    </section>
  `,
  styles: [`
    .download-history__chips {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--cf-space-2);
      margin-bottom: var(--cf-space-3);
    }
    .download-history__chip-list {
      display: flex;
      flex-wrap: wrap;
      gap: var(--cf-space-1);
      align-items: center;
      flex: 1;
      min-width: 0;
    }
    .download-history__chip-remove {
      margin-left: 0.25rem;
      border: 0;
      background: transparent;
      color: inherit;
      cursor: pointer;
      font-size: 1rem;
      line-height: 1;
      padding: 0 0.1rem;
    }
    .download-history__table-scroll {
      overflow-x: auto;
      max-width: 100%;
      -webkit-overflow-scrolling: touch;
    }
    .download-history__table-scroll .cf-table {
      min-width: 46rem;
    }
    .status-pill {
      display: inline-block;
      padding: 0.12rem 0.45rem;
      border-radius: 999px;
      font-size: 0.78rem;
      background: var(--cf-slate-100);
      white-space: nowrap;
    }
    .status-pill--completed { background: var(--cf-forest-soft); color: var(--cf-forest); }
    .status-pill--failed { background: var(--cf-critical-soft); color: var(--cf-critical); }
    .status-pill--queued,
    .status-pill--processing { background: var(--cf-amber-soft); color: var(--cf-amber); }
    .status-pill--expired { background: var(--cf-slate-100); color: var(--cf-color-text-muted); }
  `],
})
export class DonationsDownloadHistoryComponent implements OnInit {
  rows: DonationReportExport[] = [];
  catalog: DonationReportCatalogItem[] = [];
  loading = false;
  error: string | null = null;
  filterError: string | null = null;
  canView = false;
  sortColumn = 'created_at';
  sortDirection: SortDirection = 'desc';
  showFilters = false;
  search = '';
  report = '';
  status = '';
  dateFrom = '';
  dateTo = '';
  page = 1;
  perPage = 20;
  perPageOptions = [10, 20, 50, 100];
  totalItems = 0;
  searchFields: SearchField[] = [];

  constructor(
    private donationsService: DonationsService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.canView = this.authService.hasAnyPermission(['donations.reports']);
    this.buildSearchFields();
    if (!this.canView) {
      return;
    }
    this.donationsService.getReportCatalog().subscribe({
      next: (res) => {
        this.catalog = Array.isArray(res.data) ? res.data : [];
        this.syncReportOptions();
        this.cdr.detectChanges();
      },
    });
    this.load();
  }

  get hasActiveFilters(): boolean {
    return this.activeChips.length > 0;
  }

  get activeChips(): ActiveFilter[] {
    const chips: ActiveFilter[] = [];
    const search = this.search.trim();
    if (search.length >= 2) {
      chips.push({ key: 'search', label: 'Search', value: search, displayValue: search });
    }
    if (this.report) {
      chips.push({
        key: 'report',
        label: 'Report',
        value: this.report,
        displayValue: this.reportLabel(this.report),
      });
    }
    if (this.status) {
      chips.push({
        key: 'status',
        label: 'Status',
        value: this.status,
        displayValue: this.statusOptionLabel(this.status),
      });
    }
    if (this.dateFrom) {
      chips.push({
        key: 'date_from',
        label: 'From',
        value: this.dateFrom,
        displayValue: this.formatFilterDate(this.dateFrom),
      });
    }
    if (this.dateTo) {
      chips.push({
        key: 'date_to',
        label: 'To',
        value: this.dateTo,
        displayValue: this.formatFilterDate(this.dateTo),
      });
    }
    return chips;
  }

  openFilters(): void {
    this.filterError = null;
    this.syncSearchFieldValues();
    this.showFilters = true;
  }

  onSearchChange(value: string): void {
    this.search = value ?? '';
    this.syncSearchFieldValues();
    this.page = 1;
    this.load();
  }

  onFiltersApplied(values: { [key: string]: unknown }): void {
    const search = String(values['search'] ?? '').trim();
    const dateFrom = String(values['date_from'] ?? '');
    const dateTo = String(values['date_to'] ?? '');
    if (search.length === 1) {
      this.filterError = 'Search needs at least 2 characters.';
      this.cdr.detectChanges();
      return;
    }
    if (dateFrom && dateTo && dateFrom > dateTo) {
      this.filterError = 'The start date is after the end date.';
      this.cdr.detectChanges();
      return;
    }
    this.filterError = null;
    this.search = search;
    this.report = String(values['report'] ?? '');
    this.status = String(values['status'] ?? '');
    this.dateFrom = dateFrom;
    this.dateTo = dateTo;
    this.syncSearchFieldValues();
    this.page = 1;
    this.showFilters = false;
    this.load();
  }

  clearAllFilters(): void {
    this.search = '';
    this.report = '';
    this.status = '';
    this.dateFrom = '';
    this.dateTo = '';
    this.filterError = null;
    this.syncSearchFieldValues();
    this.page = 1;
    this.showFilters = false;
    this.load();
  }

  removeFilter(filter: ActiveFilter): void {
    if (filter.key === 'search') {
      this.search = '';
    } else if (filter.key === 'report') {
      this.report = '';
    } else if (filter.key === 'status') {
      this.status = '';
    } else if (filter.key === 'date_from') {
      this.dateFrom = '';
    } else if (filter.key === 'date_to') {
      this.dateTo = '';
    }
    this.syncSearchFieldValues();
    this.page = 1;
    this.load();
  }

  goToPage(page: number): void {
    this.page = page;
    this.load();
  }

  onPageSizeChange(size: number): void {
    this.perPage = size;
    this.page = 1;
    this.load();
  }

  onSort(event: SortEvent): void {
    if (!event.direction) {
      return;
    }
    this.sortColumn = event.column;
    this.sortDirection = event.direction;
    this.page = 1;
    this.load();
  }

  reportLabel(reportType: string): string {
    return this.catalog.find((item) => item.key === reportType)?.label
      ?? reportType.replace(/_/g, ' ');
  }

  exportFormatLabel(row: DonationReportExport): string {
    return donationReportExportFormatLabelForRow(row);
  }

  statusLabel(row: DonationReportExport): string {
    if (row.status === 'completed' && row.downloadable === false) {
      return 'Expired';
    }
    return this.statusOptionLabel(row.status);
  }

  statusTone(row: DonationReportExport): string {
    if (row.status === 'completed' && row.downloadable === false) {
      return 'expired';
    }
    return row.status;
  }

  load(): void {
    if (!this.canView) {
      return;
    }
    this.loading = true;
    this.error = null;
    this.cdr.detectChanges();
    const filters: Record<string, string> = {
      page: String(this.page),
      per_page: String(this.perPage),
      sort: this.sortColumn,
      direction: this.sortDirection ?? 'desc',
    };
    const search = this.search.trim();
    if (search.length >= 2) {
      filters['search'] = search;
    }
    if (this.report) {
      filters['report'] = this.report;
    }
    if (this.status) {
      filters['status'] = this.status;
    }
    if (this.dateFrom) {
      filters['date_from'] = this.dateFrom;
    }
    if (this.dateTo) {
      filters['date_to'] = this.dateTo;
    }
    this.donationsService.listExports(filters).subscribe({
      next: (res) => {
        this.rows = res.data?.data ?? [];
        this.page = res.data?.current_page ?? this.page;
        this.totalItems = res.data?.total ?? this.rows.length;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err: { status?: number }) => {
        this.rows = [];
        this.totalItems = 0;
        this.loading = false;
        this.error = err?.status === 403
          ? "You don't have permission to view download history."
          : 'Could not load download history.';
        this.cdr.detectChanges();
      },
    });
  }

  private buildSearchFields(): void {
    this.searchFields = [
      {
        key: 'search',
        label: 'Search',
        type: 'text',
        placeholder: 'Report or person',
        group: 'Search',
        value: this.search || undefined,
      },
      {
        key: 'report',
        label: 'Report',
        type: 'select',
        group: 'Report',
        options: this.reportOptions(),
        value: this.report || undefined,
      },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        group: 'Status',
        options: STATUS_OPTIONS,
        value: this.status || undefined,
      },
      {
        key: 'date_from',
        label: 'From',
        type: 'date',
        group: 'Requested date',
        value: this.dateFrom || undefined,
      },
      {
        key: 'date_to',
        label: 'To',
        type: 'date',
        group: 'Requested date',
        value: this.dateTo || undefined,
      },
    ];
  }

  private syncReportOptions(): void {
    const reportField = this.searchFields.find((field) => field.key === 'report');
    if (reportField) {
      reportField.options = this.reportOptions();
    }
  }

  private syncSearchFieldValues(): void {
    this.setFieldValue('search', this.search);
    this.setFieldValue('report', this.report);
    this.setFieldValue('status', this.status);
    this.setFieldValue('date_from', this.dateFrom);
    this.setFieldValue('date_to', this.dateTo);
  }

  private setFieldValue(key: string, value: string): void {
    const field = this.searchFields.find((item) => item.key === key);
    if (field) {
      field.value = value || undefined;
    }
  }

  private reportOptions(): Array<{ value: string; label: string }> {
    return this.catalog.map((item) => ({ value: item.key, label: item.label }));
  }

  private statusOptionLabel(status: string): string {
    return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
  }

  private formatFilterDate(value: string): string {
    const [year, month, day] = value.split('-').map((part) => Number(part));
    if (!year || !month || !day) {
      return value;
    }
    return new Date(year, month - 1, day).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
}
