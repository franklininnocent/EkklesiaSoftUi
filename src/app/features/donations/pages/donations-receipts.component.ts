import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { debounceTime, distinctUntilChanged, Subject, Subscription } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import {
  AdvancedSearchPanelComponent,
  ActiveFilter,
  SearchField,
} from '@shared/components/advanced-search-panel/advanced-search-panel.component';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { CfIconActionButtonComponent } from '@shared/components/cf-icon-action-button/cf-icon-action-button.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { ListToolbarComponent } from '@shared/components/list-toolbar/list-toolbar.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { StatusBadgeComponent } from '@shared/components/status-badge/status-badge.component';
import {
  StewardshipConfirmDialogComponent,
  StewardshipConfirmResult
} from '../components/stewardship-confirm-dialog/stewardship-confirm-dialog.component';
import { DonationReceiptListItem } from '../models/donation.model';
import { DonationsService } from '../services/donations.service';
import { QuickCollectService } from '../services/quick-collect.service';
import { ReceiptPrintService } from '../services/receipt-print.service';

type ReceiptVoidFilter = '' | 'active' | 'void';
import { CfCurrencyPipe } from '@shared/pipes/cf-currency.pipe';
import { CfActionIconComponent } from '@shared/components/cf-action-icon/cf-action-icon.component';
import { CfDatePipe } from '@shared/pipes/cf-date.pipe';
import { cfFormatDate } from '@shared/utils/cf-intl.util';
import {
  StewardshipActiveFilterChipsComponent,
  StewardshipFilterChip,
} from '../components/stewardship-active-filter-chips/stewardship-active-filter-chips.component';
import { StewardshipTablePanelComponent } from '../components/stewardship-table-panel/stewardship-table-panel.component';
import { SortableDirective, SortDirection, SortEvent } from '@shared/directives/sortable.directive';

type ReceiptSortColumn = 'receipt_number' | 'issued_on' | 'family_name' | 'payer_name' | 'method' | 'amount';
@Component({
  selector: 'app-donations-receipts',
  standalone: true,
  imports: [
    CfDatePipe,
    CommonModule,
    FormsModule,
    RouterModule,
    PageHeaderComponent,
    ListToolbarComponent,
    AdvancedSearchPanelComponent,
    DataTableComponent,
    PaginationComponent,
    StatusBadgeComponent,
    CfEmptyStateComponent,
    CfIconActionButtonComponent,
    LoadingSkeletonComponent,
    StewardshipConfirmDialogComponent,
    StewardshipActiveFilterChipsComponent,
    StewardshipTablePanelComponent,
    SortableDirective,
    CfCurrencyPipe,
    CfActionIconComponent],
  template: `
    <section class="receipts-hub cf-page cf-financial-dashboard">
      <app-page-header
        title="Receipts"
        subtitle="Find, verify, and reprint contribution receipts in one click."
      >
        <app-list-toolbar
          [showSearch]="false"
          [filterCount]="drawerFilterCount"
          (filtersOpened)="showFilters = true"
        >
          <button
          aria-label="Collect Payment"
          title="Collect Payment" type="button" class="cf-btn cf-btn-icon cf-btn-primary" (click)="openQuickCollect()">
          <app-cf-action-icon name="collect-payment" />
          </button>
        </app-list-toolbar>
      </app-page-header>

      <app-stewardship-active-filter-chips
        *ngIf="getActiveFilters().length"
        [chips]="receiptFilterChips"
        (remove)="onReceiptFilterChipRemove($event)"
        (clearAll)="clearAllFilters()"
      ></app-stewardship-active-filter-chips>

      <div
        class="cf-loading-block cf-panel"
        *ngIf="!receiptsLoaded"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <app-loading-skeleton label="Loading receipts…" type="table" [rows]="6" [columns]="7"></app-loading-skeleton>
      </div>

      <div class="cf-inline-alert cf-panel" *ngIf="receiptsLoaded && loadError" role="alert">
        <p>{{ loadError }}</p>
        <button
          aria-label="Try again"
          title="Try again" type="button" class="cf-btn cf-btn-icon cf-btn-primary" (click)="loadReceipts()">
          <app-cf-action-icon name="refresh" />
        </button>
      </div>

      <ng-container *ngIf="receiptsLoaded && !loadError">
        <app-stewardship-table-panel
          *ngIf="receipts.length"
          [refreshing]="refreshing"
          [ariaBusy]="refreshing"
          extraPanelClass="receipts-hub__panel"
        >
          <app-data-table [ariaBusy]="refreshing">
            <thead>
              <tr>
                <th
                  scope="col"
                  appSortable="receipt_number"
                  [direction]="sortColumn === 'receipt_number' ? sortDirection : null"
                  (sort)="onSort($event)"
                >
                  Receipt
                </th>
                <th
                  scope="col"
                  appSortable="issued_on"
                  [direction]="sortColumn === 'issued_on' ? sortDirection : null"
                  (sort)="onSort($event)"
                >
                  Date
                </th>
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
                  appSortable="payer_name"
                  [direction]="sortColumn === 'payer_name' ? sortDirection : null"
                  (sort)="onSort($event)"
                >
                  Payer
                </th>
                <th
                  scope="col"
                  appSortable="method"
                  [direction]="sortColumn === 'method' ? sortDirection : null"
                  (sort)="onSort($event)"
                >
                  Method
                </th>
                <th
                  scope="col"
                  class="cf-table__num"
                  appSortable="amount"
                  [direction]="sortColumn === 'amount' ? sortDirection : null"
                  (sort)="onSort($event)"
                >
                  Amount
                </th>
                <th scope="col" class="cf-table__actions-col">
                  <span class="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let receipt of receipts; trackBy: trackReceipt">
                <td>
                  <div class="receipts-hub__receipt-cell">
                    <strong>{{ receipt.receipt_number }}</strong>
                    <app-status-badge
                      *ngIf="receipt.is_void"
                      label="Void"
                      tone="critical"
                    ></app-status-badge>
                  </div>
                </td>
                <td>{{ receipt.issued_on | cfDate }}</td>
                <td>
                  <a *ngIf="receipt.family_id" [routerLink]="['/families', receipt.family_id]">
                    {{ receipt.family_name || receipt.family_code }}
                  </a>
                  <span *ngIf="!receipt.family_id">—</span>
                </td>
                <td>{{ receipt.payer_name }}</td>
                <td>{{ methodLabel(receipt.method) }}</td>
                <td>{{ receipt.amount | cfCurrency }}</td>
                <td class="cf-table__actions-cell">
                  <div class="cf-row-actions">
                    <app-cf-icon-action-button
                      action="view"
                      size="sm"
                      [ariaLabel]="'View receipt ' + receipt.receipt_number"
                      [title]="'View receipt ' + receipt.receipt_number"
                      [disabled]="!receipt.payment_id"
                      (clicked)="viewReceipt(receipt)"
                    ></app-cf-icon-action-button>
                    <app-cf-icon-action-button
                      action="print"
                      size="sm"
                      [ariaLabel]="'Print receipt ' + receipt.receipt_number"
                      [title]="'Print receipt ' + receipt.receipt_number"
                      [disabled]="!receipt.payment_id"
                      (clicked)="printReceipt(receipt)"
                    ></app-cf-icon-action-button>
                    <app-cf-icon-action-button
                      *ngIf="canManageReceipts && !receipt.is_void"
                      action="void"
                      size="sm"
                      [ariaLabel]="'Void receipt ' + receipt.receipt_number"
                      [title]="'Void receipt ' + receipt.receipt_number"
                      (clicked)="openVoid(receipt)"
                    ></app-cf-icon-action-button>
                    <app-cf-icon-action-button
                      *ngIf="canManageReceipts && !receipt.is_void"
                      action="reissue"
                      size="sm"
                      [ariaLabel]="'Reissue receipt ' + receipt.receipt_number"
                      [title]="'Reissue receipt ' + receipt.receipt_number"
                      (clicked)="openReissue(receipt)"
                    ></app-cf-icon-action-button>
                  </div>
                </td>
              </tr>
            </tbody>
          </app-data-table>

          <app-pagination
            *ngIf="totalItems > perPage"
            [currentPage]="page"
            [pageSize]="perPage"
            [totalItems]="totalItems"
            [pageSizeOptions]="perPageOptions"
            (pageChange)="goToPage($event)"
            (pageSizeChange)="onPageSizeChange($event)"
          ></app-pagination>
        </app-stewardship-table-panel>

        <app-cf-empty-state
          *ngIf="!receipts.length"
          icon="🧾"
          [title]="hasActiveFilters ? 'No receipts match' : 'No receipts yet'"
          [description]="
            hasActiveFilters
              ? 'Try clearing filters or use broader dates.'
              : 'Collect a payment — a receipt is generated automatically.'
          "
        >
          <button
          aria-label="Collect Payment"
          title="Collect Payment" type="button" class="cf-btn cf-btn-icon cf-btn-primary" (click)="openQuickCollect()">
          <app-cf-action-icon name="collect-payment" />
          </button>
          <button
            type="button"
            class="cf-btn cf-btn-icon"
            *ngIf="hasActiveFilters"
            (click)="clearAllFilters()"
            aria-label="Clear filters"
            title="Clear filters"
          >
            <app-cf-action-icon name="filter" />
          </button>
        </app-cf-empty-state>
      </ng-container>

      <p *ngIf="actionMessage" class="cf-state cf-state--success">{{ actionMessage }}</p>

      <app-stewardship-confirm-dialog
        *ngIf="pendingAction"
        [title]="pendingAction.type === 'void' ? 'Void this receipt?' : 'Reissue this receipt?'"
        [message]="pendingAction.type === 'void'
          ? 'The original receipt stays on file as void. The payment itself is not reversed.'
          : 'The original receipt is voided and a new receipt number is issued. The payment amount does not change.'"
        [confirmLabel]="pendingAction.type === 'void' ? 'Void receipt' : 'Reissue receipt'"
        [saving]="actionSaving"
        [error]="actionError"
        (cancelled)="closeAction()"
        (confirmed)="confirmAction($event)"
      ></app-stewardship-confirm-dialog>

      <app-advanced-search-panel
        mode="sidepanel"
        [fields]="searchFields"
        [isExpanded]="showFilters"
        (search)="onAdvancedSearch($event)"
        (clear)="onClearAdvancedSearch()"
        (close)="showFilters = false"
      ></app-advanced-search-panel>
    </section>
  `,
  styleUrls: ['../styles/stewardship-dashboard-shared.scss'],
  styles: [`
    .stewardship-panel-head__copy {
      display: grid;
      gap: 0.08rem;
    }

    .receipts-hub__panel--refreshing {
      opacity: 0.72;
      pointer-events: none;
    }

    .receipts-hub__receipt-cell {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--cf-space-1);
    }
  `]
})
export class DonationsReceiptsComponent implements OnInit, OnDestroy {
  receipts: DonationReceiptListItem[] = [];
  search = '';
  dateFrom = '';
  dateTo = '';
  voidStatusFilter: ReceiptVoidFilter = '';
  page = 1;
  perPage = 20;
  perPageOptions = [10, 20, 50];
  totalItems = 0;
  receiptsLoaded = false;
  refreshing = false;
  loadError: string | null = null;
  showFilters = false;
  searchFields: SearchField[] = [];
  canManageReceipts = false;
  pendingAction: { type: 'void' | 'reissue'; receipt: DonationReceiptListItem } | null = null;
  actionSaving = false;
  actionError: string | null = null;
  actionMessage = '';
  sortColumn: ReceiptSortColumn = 'issued_on';
  sortDirection: SortDirection = 'desc';
  private loadReceiptsSeq = 0;
  private searchChanges$ = new Subject<string>();
  private searchSub?: Subscription;

  constructor(
    private donationsService: DonationsService,
    private receiptPrintService: ReceiptPrintService,
    private quickCollectService: QuickCollectService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.canManageReceipts = this.authService.hasPermission('donations.manage');
    this.initSearchFields();
    this.searchSub = this.searchChanges$.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(() => {
      this.page = 1;
      this.loadReceipts();
    });
    this.loadReceipts();
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
  }

  get drawerFilterCount(): number {
    let count = 0;
    if (this.search.trim()) {
      count++;
    }
    if (this.dateFrom) {
      count++;
    }
    if (this.dateTo) {
      count++;
    }
    if (this.voidStatusFilter) {
      count++;
    }
    return count;
  }

  get hasActiveFilters(): boolean {
    return !!(this.search.trim() || this.drawerFilterCount);
  }

  openQuickCollect(): void {
    this.quickCollectService.open();
  }

  trackReceipt(_index: number, receipt: DonationReceiptListItem): string {
    return receipt.id;
  }

  methodLabel(method: string | null | undefined): string {
    if (!method) {
      return '—';
    }
    return method
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  onSearchChange(value: string): void {
    this.search = value;
    this.searchChanges$.next(value);
  }

  onSort(event: SortEvent): void {
    const allowed: ReceiptSortColumn[] = [
      'receipt_number',
      'issued_on',
      'family_name',
      'payer_name',
      'method',
      'amount',
    ];
    if (!allowed.includes(event.column as ReceiptSortColumn)) {
      return;
    }
    this.sortColumn = event.column as ReceiptSortColumn;
    this.sortDirection = event.direction ?? 'desc';
    this.page = 1;
    this.loadReceipts();
  }

  onAdvancedSearch(values: { [key: string]: unknown }): void {
    this.search = String(values['search'] ?? '').trim();
    this.dateFrom = String(values['date_from'] ?? '');
    this.dateTo = String(values['date_to'] ?? '');
    this.voidStatusFilter = (values['void_status'] as ReceiptVoidFilter) || '';
    this.syncSearchFieldValues();
    this.page = 1;
    this.showFilters = false;
    this.loadReceipts();
  }

  onClearAdvancedSearch(): void {
    this.clearDrawerFilters();
    this.showFilters = false;
  }

  clearDrawerFilters(): void {
    this.search = '';
    this.dateFrom = '';
    this.dateTo = '';
    this.voidStatusFilter = '';
    this.searchFields.forEach((field) => {
      field.value = undefined;
    });
    this.page = 1;
    this.loadReceipts();
  }

  clearAllFilters(): void {
    this.search = '';
    this.clearDrawerFilters();
  }

  getActiveFilters(): ActiveFilter[] {
    const filters: ActiveFilter[] = [];

    if (this.search.trim()) {
      filters.push({
        key: 'search',
        label: 'Search',
        value: this.search.trim(),
        displayValue: this.search.trim(),
      });
    }

    if (this.dateFrom) {
      filters.push({
        key: 'date_from',
        label: 'From date',
        value: this.dateFrom,
        displayValue: this.formatFilterDate(this.dateFrom),
      });
    }

    if (this.dateTo) {
      filters.push({
        key: 'date_to',
        label: 'To date',
        value: this.dateTo,
        displayValue: this.formatFilterDate(this.dateTo),
      });
    }

    if (this.voidStatusFilter === 'active') {
      filters.push({
        key: 'void_status',
        label: 'Status',
        value: 'active',
        displayValue: 'Active',
      });
    } else if (this.voidStatusFilter === 'void') {
      filters.push({
        key: 'void_status',
        label: 'Status',
        value: 'void',
        displayValue: 'Void',
      });
    }

    return filters;
  }

  get receiptFilterChips(): StewardshipFilterChip[] {
    return this.getActiveFilters().map((filter) => ({
      key: filter.key,
      label: filter.label,
      displayValue: filter.displayValue,
    }));
  }

  onReceiptFilterChipRemove(chip: StewardshipFilterChip): void {
    const match = this.getActiveFilters().find((f) => f.key === chip.key);
    if (match) {
      this.removeFilter(match);
    }
  }

  removeFilter(filter: ActiveFilter): void {
    if (filter.key === 'search') {
      this.search = '';
    } else if (filter.key === 'date_from') {
      this.dateFrom = '';
    } else if (filter.key === 'date_to') {
      this.dateTo = '';
    } else if (filter.key === 'void_status') {
      this.voidStatusFilter = '';
    }

    const field = this.searchFields.find((item) => item.key === filter.key);
    if (field) {
      field.value = undefined;
    }

    this.page = 1;
    this.loadReceipts();
  }

  loadReceipts(): void {
    const seq = ++this.loadReceiptsSeq;
    const isInitial = !this.receiptsLoaded;
    if (isInitial) {
      this.loadError = null;
    } else {
      this.refreshing = true;
    }

    const filters: Record<string, string> = {
      page: String(this.page),
      per_page: String(this.perPage),
    };
    if (this.search.trim()) {
      filters['search'] = this.search.trim();
    }
    if (this.dateFrom) {
      filters['date_from'] = this.dateFrom;
    }
    if (this.dateTo) {
      filters['date_to'] = this.dateTo;
    }
    if (this.voidStatusFilter === 'active') {
      filters['is_void'] = 'false';
    } else if (this.voidStatusFilter === 'void') {
      filters['is_void'] = 'true';
    }
    filters['sort'] = this.sortColumn;
    filters['direction'] = this.sortDirection ?? 'desc';

    this.donationsService.getReceipts(filters).subscribe({
      next: (res) => {
        if (seq !== this.loadReceiptsSeq) {
          return;
        }
        this.receipts = res.data?.data ?? [];
        this.page = res.data?.current_page ?? 1;
        this.totalItems = res.data?.total ?? this.receipts.length;
        this.receiptsLoaded = true;
        this.refreshing = false;
        this.loadError = null;
        this.cdr.detectChanges();
      },
      error: () => {
        if (seq !== this.loadReceiptsSeq) {
          return;
        }
        this.receiptsLoaded = true;
        this.refreshing = false;
        this.loadError = 'Failed to load receipts.';
        this.cdr.detectChanges();
      }
    });
  }

  goToPage(page: number): void {
    this.page = page;
    this.loadReceipts();
  }

  onPageSizeChange(size: number): void {
    this.perPage = size;
    this.page = 1;
    this.loadReceipts();
  }

  viewReceipt(receipt: DonationReceiptListItem): void {
    if (!receipt.payment_id) {
      return;
    }
    this.receiptPrintService.viewPaymentReceipt(receipt.payment_id);
  }

  printReceipt(receipt: DonationReceiptListItem): void {
    if (!receipt.payment_id) {
      return;
    }
    this.receiptPrintService.printPaymentReceipt(receipt.payment_id);
  }

  openVoid(receipt: DonationReceiptListItem): void {
    this.actionError = null;
    this.pendingAction = { type: 'void', receipt };
  }

  openReissue(receipt: DonationReceiptListItem): void {
    this.actionError = null;
    this.pendingAction = { type: 'reissue', receipt };
  }

  closeAction(): void {
    if (!this.actionSaving) {
      this.pendingAction = null;
      this.actionError = null;
    }
  }

  confirmAction(result: StewardshipConfirmResult): void {
    if (!this.pendingAction) {
      return;
    }
    this.actionSaving = true;
    this.actionError = null;
    const receiptId = this.pendingAction.receipt.id;
    const request$ = this.pendingAction.type === 'void'
      ? this.donationsService.voidReceipt(receiptId, result.reason)
      : this.donationsService.reissueReceipt(receiptId, result.reason);

    request$.subscribe({
      next: () => {
        this.actionSaving = false;
        this.actionMessage = this.pendingAction?.type === 'void'
          ? 'Receipt marked void. The original copy is kept for history.'
          : 'A new receipt was issued with a new number.';
        this.pendingAction = null;
        this.loadReceipts();
        this.cdr.detectChanges();
      },
      error: (err: { error?: { message?: string } }) => {
        this.actionSaving = false;
        this.actionError = err?.error?.message || 'Unable to update this receipt.';
        this.cdr.detectChanges();
      }
    });
  }

  private initSearchFields(): void {
    this.searchFields = [
      {
        key: 'search',
        label: 'Receipt, payer, or family',
        type: 'text',
        placeholder: 'Receipt #, payer, or family…',
        value: this.search.trim() || undefined,
      },
      {
        key: 'date_from',
        label: 'From date',
        type: 'date',
        value: this.dateFrom || undefined,
        group: 'Date range',
      },
      {
        key: 'date_to',
        label: 'To date',
        type: 'date',
        value: this.dateTo || undefined,
        group: 'Date range',
      },
      {
        key: 'void_status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'active', label: 'Active' },
          { value: 'void', label: 'Void' },
        ],
        value: this.voidStatusFilter || undefined,
      },
    ];
  }

  private syncSearchFieldValues(): void {
    const searchField = this.searchFields.find((field) => field.key === 'search');
    const dateFromField = this.searchFields.find((field) => field.key === 'date_from');
    const dateToField = this.searchFields.find((field) => field.key === 'date_to');
    const statusField = this.searchFields.find((field) => field.key === 'void_status');

    if (searchField) {
      searchField.value = this.search.trim() || undefined;
    }
    if (dateFromField) {
      dateFromField.value = this.dateFrom || undefined;
    }
    if (dateToField) {
      dateToField.value = this.dateTo || undefined;
    }
    if (statusField) {
      statusField.value = this.voidStatusFilter || undefined;
    }
  }

  private formatFilterDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return cfFormatDate(date) || '—';
  }
}
