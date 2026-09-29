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
@Component({
  selector: 'app-donations-receipts',
  standalone: true,
  imports: [
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
    CfCurrencyPipe,
    CfActionIconComponent],
  template: `
    <section class="receipts-hub cf-page">
      <app-page-header
        title="Receipts"
        subtitle="Find, verify, and reprint contribution receipts in one click."
      >
        <app-list-toolbar
          searchPlaceholder="Receipt #, payer, or family…"
          [searchValue]="search"
          [filterCount]="drawerFilterCount"
          (searchChange)="onSearchChange($event)"
          (filtersOpened)="showFilters = true"
        >
          <button
          aria-label="Collect Payment"
          title="Collect Payment" type="button" class="cf-btn cf-btn-icon cf-btn-primary" (click)="openQuickCollect()">
          <app-cf-action-icon name="collect-payment" />
          </button>
        </app-list-toolbar>
      </app-page-header>

      <div
        class="receipts-hub__chips"
        *ngIf="getActiveFilters().length"
        role="region"
        aria-label="Active filters"
      >
        <span class="cf-meta">Active filters</span>
        <div class="receipts-hub__chip-list">
          <span class="cf-badge cf-badge--info" *ngFor="let filter of getActiveFilters()">
            {{ filter.label }}: {{ filter.displayValue }}
            <button
              type="button"
              class="receipts-hub__chip-remove"
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

      <div
        class="cf-decision-strip"
        role="region"
        aria-label="Suggested next step"
        *ngIf="receiptsLoaded && !loadError"
      >
        <div class="cf-decision-strip__copy">
          <strong>{{ totalItems }} receipt{{ totalItems === 1 ? '' : 's' }} found</strong>
          <span>{{ decisionHint }}</span>
        </div>
        <div class="cf-decision-strip__actions" *ngIf="hasActiveFilters">
          <button type="button" class="cf-btn cf-btn-icon" (click)="clearAllFilters()" aria-label="Clear filters" title="Clear filters"><app-cf-action-icon name="filter" /></button>
        </div>
      </div>

      <div
        class="cf-loading-block cf-panel"
        *ngIf="!receiptsLoaded"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <p class="cf-loading-block__label">Loading receipts…</p>
        <app-loading-skeleton type="table" [rows]="6" [columns]="7"></app-loading-skeleton>
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
        <div
          class="cf-panel receipts-hub__panel"
          *ngIf="receipts.length"
          [class.receipts-hub__panel--refreshing]="refreshing"
          [attr.aria-busy]="refreshing"
        >
          <app-data-table [ariaBusy]="refreshing">
            <thead>
              <tr>
                <th scope="col">Receipt</th>
                <th scope="col">Date</th>
                <th scope="col">Family</th>
                <th scope="col">Payer</th>
                <th scope="col">Method</th>
                <th scope="col">Amount</th>
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
                <td>{{ receipt.issued_on | date }}</td>
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
        </div>

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
  styles: [`
    .receipts-hub__chips {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--cf-space-2);
    }

    .receipts-hub__chip-list {
      display: flex;
      flex-wrap: wrap;
      gap: var(--cf-space-1);
      align-items: center;
      flex: 1;
      min-width: 0;
    }

    .receipts-hub__chip-remove {
      margin-left: 0.25rem;
      border: 0;
      background: transparent;
      color: inherit;
      cursor: pointer;
      font-size: 1rem;
      line-height: 1;
      padding: 0 0.1rem;
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

  get decisionHint(): string {
    if (this.hasActiveFilters && !this.receipts.length) {
      return 'No matches for your search — try broader dates or clear filters.';
    }
    if (this.receipts.length) {
      return 'Use the view or print icons on any row — receipts open in a preview window.';
    }
    return 'Receipts appear automatically after every collection.';
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

  onAdvancedSearch(values: { [key: string]: unknown }): void {
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

  removeFilter(filter: ActiveFilter): void {
    if (filter.key === 'date_from') {
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
    const dateFromField = this.searchFields.find((field) => field.key === 'date_from');
    const dateToField = this.searchFields.find((field) => field.key === 'date_to');
    const statusField = this.searchFields.find((field) => field.key === 'void_status');

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
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
}
