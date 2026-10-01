import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, DestroyRef, OnDestroy, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, forkJoin, of, skip, Subject, Subscription } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { BCCService } from '@core/services/bcc.service';
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
import { StatusBadgeComponent, StatusBadgeTone } from '@shared/components/status-badge/status-badge.component';
import { SortableDirective, SortDirection, SortEvent } from '@shared/directives/sortable.directive';
import { CfCurrencyPipe } from '@shared/pipes/cf-currency.pipe';
import { CfActionIconComponent } from '@shared/components/cf-action-icon/cf-action-icon.component';
import {
  StewardshipActiveFilterChipsComponent,
  StewardshipFilterChip,
} from '../components/stewardship-active-filter-chips/stewardship-active-filter-chips.component';
import {
  StewardshipConfirmDialogComponent,
  StewardshipConfirmResult
} from '../components/stewardship-confirm-dialog/stewardship-confirm-dialog.component';
import { DonationPayment, DonationPaymentListMeta, DonationProject } from '../models/donation.model';
import { DonationsService } from '../services/donations.service';
import { QuickCollectService } from '../services/quick-collect.service';
import { ReceiptPrintService } from '../services/receipt-print.service';

type KpiFocus = '' | 'amount' | 'families' | 'average' | 'completion';
const KPI_FOCUS_VALUES: KpiFocus[] = ['amount', 'families', 'average', 'completion'];

@Component({
  selector: 'app-today-collections',
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
    StewardshipActiveFilterChipsComponent,
    CfCurrencyPipe,
    CfActionIconComponent,
    SortableDirective
  ],
  template: `
    <section class="today-collections cf-page cf-financial-dashboard">
      <app-page-header
        title="Today's Collections"
        [subtitle]="pageSubtitle"
      >
        <app-list-toolbar
          *ngIf="canView"
          searchPlaceholder="Payment #, payer, family, receipt, or reference…"
          [searchValue]="search"
          [filterCount]="drawerFilterCount"
          (searchChange)="onSearchChange($event)"
          (filtersOpened)="showFilters = true"
        >
          <a
            routerLink="/donations/collection-day"
            class="cf-btn cf-btn-icon"
            aria-label="Collection Day"
            title="Collection Day"
          >
            <app-cf-action-icon name="layout-grid" />
          </a>
          <button
            *ngIf="canCollect"
            type="button"
            class="cf-btn cf-btn-icon cf-btn-primary"
            aria-label="Collect Payment"
            title="Collect Payment"
            (click)="openQuickCollect()"
          >
            <app-cf-action-icon name="collect-payment" />
          </button>
        </app-list-toolbar>
      </app-page-header>

      <p *ngIf="!canView" class="cf-state cf-state--error">
        You don't have permission to view today's collections. Ask your parish administrator to grant Access Donations.
      </p>

      <app-stewardship-active-filter-chips
        *ngIf="canView && getActiveFilters().length"
        [chips]="todayCollectionFilterChips"
        (remove)="onTodayCollectionFilterChipRemove($event)"
        (clearAll)="clearAllFilters()"
      ></app-stewardship-active-filter-chips>

      <div
        class="cf-loading-block cf-panel"
        *ngIf="canView && !loaded"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <app-loading-skeleton label="Loading today's collections…" type="table" [rows]="6" [columns]="8"></app-loading-skeleton>
      </div>

      <div class="cf-inline-alert cf-panel" *ngIf="canView && loaded && loadError" role="alert">
        <p>{{ loadError }}</p>
        <button
          type="button"
          class="cf-btn cf-btn-icon cf-btn-primary"
          aria-label="Try again"
          title="Try again"
          (click)="load()"
        >
          <app-cf-action-icon name="refresh" />
        </button>
      </div>

      <ng-container *ngIf="canView && loaded && !loadError">
        <div
          class="cf-panel today-collections__panel"
          *ngIf="payments.length"
          [class.today-collections__panel--refreshing]="refreshing"
          [attr.aria-busy]="refreshing"
        >
          <div class="today-collections__table-scroll">
            <app-data-table [ariaBusy]="refreshing">
              <thead>
                <tr>
                  <th scope="col" appSortable="payment_number" [direction]="sortColumn === 'payment_number' ? sortDirection : null" (sort)="onSort($event)">Payment</th>
                  <th scope="col" appSortable="family_name" [direction]="sortColumn === 'family_name' ? sortDirection : null" (sort)="onSort($event)">Family</th>
                  <th scope="col" appSortable="payer_name" [direction]="sortColumn === 'payer_name' ? sortDirection : null" (sort)="onSort($event)">Payer</th>
                  <th scope="col" appSortable="method" [direction]="sortColumn === 'method' ? sortDirection : null" (sort)="onSort($event)">Method</th>
                  <th scope="col" appSortable="status" [direction]="sortColumn === 'status' ? sortDirection : null" (sort)="onSort($event)">Status</th>
                  <th scope="col" class="today-collections__num" appSortable="amount" [direction]="sortColumn === 'amount' ? sortDirection : null" (sort)="onSort($event)">Amount</th>
                  <th scope="col">Receipt</th>
                  <th scope="col" class="cf-table__actions-col"><span class="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let payment of payments; trackBy: trackPayment">
                  <td>
                    <strong>{{ payment.payment_number }}</strong>
                  </td>
                  <td class="cf-table__cell--truncate" [attr.title]="familyLabel(payment)">
                    <a *ngIf="familyLink(payment) as familyId" [routerLink]="['/families', familyId]" class="cf-link">
                      {{ familyLabel(payment) }}
                    </a>
                    <span *ngIf="!familyLink(payment)">{{ familyLabel(payment) }}</span>
                  </td>
                  <td>{{ payerLabel(payment) }}</td>
                  <td>{{ methodLabel(payment.method) }}</td>
                  <td>
                    <app-status-badge [label]="statusLabel(payment.status)" [tone]="statusTone(payment.status)"></app-status-badge>
                  </td>
                  <td class="today-collections__num">{{ payment.amount | cfCurrency }}</td>
                  <td>{{ payment.receipt?.receipt_number || '—' }}</td>
                  <td class="cf-table__actions-cell">
                    <div class="cf-row-actions">
                      <app-cf-icon-action-button
                        action="view"
                        size="sm"
                        [ariaLabel]="'View receipt for ' + payment.payment_number"
                        [title]="'View receipt for ' + payment.payment_number"
                        (clicked)="viewReceipt(payment)"
                      ></app-cf-icon-action-button>
                      <app-cf-icon-action-button
                        action="print"
                        size="sm"
                        [ariaLabel]="'Print receipt for ' + payment.payment_number"
                        [title]="'Print receipt for ' + payment.payment_number"
                        (clicked)="printReceipt(payment)"
                      ></app-cf-icon-action-button>
                      <button
                        type="button"
                        class="cf-btn cf-btn-icon cf-btn--sm"
                        *ngIf="canReverse && payment.status === 'succeeded'"
                        (click)="openReverse(payment)"
                        aria-label="Reverse"
                        title="Reverse"
                      >
                        <app-cf-action-icon name="undo-2" />
                      </button>
                      <button
                        type="button"
                        class="cf-btn cf-btn-icon cf-btn--sm"
                        *ngIf="canRefund && (payment.status === 'succeeded')"
                        [disabled]="(payment.refundable_remaining ?? payment.amount) <= 0"
                        (click)="openRefund(payment)"
                        aria-label="Refund"
                        title="Refund"
                      >
                        <app-cf-action-icon name="corner-down-left" />
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </app-data-table>
          </div>

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
          *ngIf="!payments.length"
          icon="💳"
          [title]="hasActiveFilters ? 'No payments match' : 'No payments recorded today'"
          [description]="
            hasActiveFilters
              ? 'Try clearing filters or a broader search.'
              : 'Collect a payment in Collection Day or Quick Collect. It will appear here for the parish business date.'
          "
        >
          <button
            *ngIf="canCollect"
            type="button"
            class="cf-btn cf-btn-icon cf-btn-primary"
            aria-label="Collect Payment"
            title="Collect Payment"
            (click)="openQuickCollect()"
          >
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

      <app-stewardship-confirm-dialog
        *ngIf="pendingAction"
        [title]="pendingAction.type === 'reverse' ? 'Reverse this payment?' : 'Request a refund?'"
        [message]="pendingAction.type === 'reverse'
          ? 'Reversing voids the receipt and puts the amount back on the family record.'
          : 'A treasurer must approve the refund before family balances change.'"
        [confirmLabel]="pendingAction.type === 'reverse' ? 'Reverse payment' : 'Request refund'"
        [showAmount]="pendingAction.type === 'refund'"
        [amount]="pendingAction.payment.refundable_remaining ?? pendingAction.payment.amount"
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
    .today-collections__panel--refreshing {
      opacity: 0.72;
      pointer-events: none;
    }
    .today-collections__table-scroll {
      overflow-x: auto;
      max-width: 100%;
      -webkit-overflow-scrolling: touch;
    }
    .today-collections__table-scroll table {
      min-width: 52rem;
    }
    .today-collections__num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
  `]
})
export class TodaysCollectionsComponent implements OnInit, OnDestroy {
  private readonly destroyRef = inject(DestroyRef);
  payments: DonationPayment[] = [];
  search = '';
  status = '';
  method = '';
  bccId = '';
  projectId = '';
  collectionDate = '';
  page = 1;
  perPage = 20;
  perPageOptions = [10, 20, 50, 100];
  totalItems = 0;
  loaded = false;
  refreshing = false;
  loadError: string | null = null;
  showFilters = false;
  searchFields: SearchField[] = [];
  canView = false;
  canCollect = false;
  canReverse = false;
  canRefund = false;
  sortColumn = 'payment_date';
  sortDirection: SortDirection = 'desc';
  meta: DonationPaymentListMeta | null = null;
  pendingAction: { type: 'reverse' | 'refund'; payment: DonationPayment } | null = null;
  actionSaving = false;
  actionError: string | null = null;
  bccOptions: Array<{ value: string; label: string }> = [];
  projectOptions: Array<{ value: string; label: string }> = [];
  kpiFocus: KpiFocus = '';
  monthCollectedForCompletion: number | null = null;

  private loadSeq = 0;
  private queryHadExplicitSort = false;
  private searchChanges$ = new Subject<string>();
  private searchSub?: Subscription;
  private ledgerSub?: Subscription;

  constructor(
    private donationsService: DonationsService,
    private receiptPrintService: ReceiptPrintService,
    private quickCollectService: QuickCollectService,
    private authService: AuthService,
    private bccService: BCCService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.canView = this.authService.hasPermission('donations.view');
    this.canCollect = this.authService.hasPermission('donations.collect');
    this.canReverse = this.authService.hasPermission('donations.reverse');
    this.canRefund = this.authService.hasPermission('donations.refund');
    this.readQuery(this.route.snapshot.queryParamMap);
    this.initSearchFields();
    this.route.queryParamMap.pipe(skip(1), takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.readQuery(params);
      this.initSearchFields();
      if (this.canView) {
        this.load();
      }
    });
    if (!this.canView) {
      this.loaded = true;
      return;
    }
    this.searchSub = this.searchChanges$.pipe(debounceTime(300), distinctUntilChanged()).subscribe((value) => {
      this.search = value;
      this.page = 1;
      this.syncQueryAndLoad();
    });
    this.ledgerSub = this.donationsService.ledgerMutated$.subscribe(() => this.load());
    this.loadFilterOptions();
    this.load();
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
    this.ledgerSub?.unsubscribe();
  }

  get totals() {
    return this.meta?.totals ?? {
      payment_count: 0,
      collected_gross: 0,
      refunded_total: 0,
      net_collected: 0,
      families_count: 0,
      currency_code: ''
    };
  }

  readonly pageSubtitle = 'Every payment recorded for this parish on the current business date.';

  get drawerFilterCount(): number {
    return [this.status, this.method, this.bccId, this.projectId, this.collectionDate].filter(Boolean).length;
  }

  get hasActiveFilters(): boolean {
    return !!(this.search.trim() || this.drawerFilterCount);
  }

  onSearchChange(value: string): void {
    this.searchChanges$.next(value);
  }

  onSort(event: SortEvent): void {
    this.sortColumn = event.column;
    this.sortDirection = event.direction || 'desc';
    this.page = 1;
    this.syncQueryAndLoad();
  }

  goToPage(page: number): void {
    this.page = page;
    this.syncQueryAndLoad();
  }

  onPageSizeChange(size: number): void {
    this.perPage = size;
    this.page = 1;
    this.syncQueryAndLoad();
  }

  onAdvancedSearch(values: { [key: string]: unknown }): void {
    this.status = String(values['status'] ?? '');
    this.method = String(values['method'] ?? '');
    this.bccId = String(values['bcc_id'] ?? '');
    this.projectId = String(values['project_id'] ?? '');
    this.collectionDate = String(values['collection_date'] ?? '');
    this.syncSearchFieldValues();
    this.page = 1;
    this.showFilters = false;
    this.syncQueryAndLoad();
  }

  onClearAdvancedSearch(): void {
    this.status = '';
    this.method = '';
    this.bccId = '';
    this.projectId = '';
    this.collectionDate = '';
    this.syncSearchFieldValues();
    this.page = 1;
    this.showFilters = false;
    this.syncQueryAndLoad();
  }

  clearAllFilters(): void {
    this.search = '';
    this.onClearAdvancedSearch();
  }

  getActiveFilters(): ActiveFilter[] {
    const filters: ActiveFilter[] = [];
    if (this.status) {
      filters.push({ key: 'status', label: 'Status', value: this.status, displayValue: this.statusLabel(this.status) });
    }
    if (this.method) {
      filters.push({ key: 'method', label: 'Method', value: this.method, displayValue: this.methodLabel(this.method) });
    }
    if (this.bccId) {
      const label = this.bccOptions.find((row) => row.value === this.bccId)?.label ?? this.bccId;
      filters.push({ key: 'bcc_id', label: 'BCC', value: this.bccId, displayValue: label });
    }
    if (this.projectId) {
      const label = this.projectOptions.find((row) => row.value === this.projectId)?.label ?? this.projectId;
      filters.push({ key: 'project_id', label: 'Project', value: this.projectId, displayValue: label });
    }
    if (this.collectionDate) {
      filters.push({ key: 'collection_date', label: 'Collection date', value: this.collectionDate, displayValue: this.collectionDate });
    }
    return filters;
  }

  get todayCollectionFilterChips(): StewardshipFilterChip[] {
    return this.getActiveFilters().map((filter) => ({
      key: filter.key,
      label: filter.label,
      displayValue: filter.displayValue,
    }));
  }

  onTodayCollectionFilterChipRemove(chip: StewardshipFilterChip): void {
    const match = this.getActiveFilters().find((f) => f.key === chip.key);
    if (match) {
      this.removeFilter(match);
    }
  }

  removeFilter(filter: ActiveFilter): void {
    if (filter.key === 'status') this.status = '';
    if (filter.key === 'method') this.method = '';
    if (filter.key === 'bcc_id') this.bccId = '';
    if (filter.key === 'project_id') this.projectId = '';
    if (filter.key === 'collection_date') this.collectionDate = '';
    this.syncSearchFieldValues();
    this.page = 1;
    this.syncQueryAndLoad();
  }

  openQuickCollect(): void {
    this.quickCollectService.open();
  }

  trackPayment(_index: number, payment: DonationPayment): string {
    return payment.id;
  }

  familyLink(payment: DonationPayment): string | null {
    if (payment.is_anonymous) {
      return null;
    }
    return payment.family?.id || payment.family_id || null;
  }

  familyLabel(payment: DonationPayment): string {
    if (payment.is_anonymous) {
      return 'Anonymous';
    }
    return payment.family?.family_name || payment.family?.family_code || '—';
  }

  payerLabel(payment: DonationPayment): string {
    return payment.is_anonymous ? 'Anonymous' : (payment.payer_name || '—');
  }

  methodLabel(method: string | null | undefined): string {
    if (!method) {
      return '—';
    }
    return method.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  }

  statusLabel(status: string): string {
    return status.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  statusTone(status: string): StatusBadgeTone {
    if (status === 'succeeded') return 'success';
    if (status === 'pending') return 'warning';
    if (status === 'failed' || status === 'reversed' || status === 'refunded') return 'critical';
    return 'neutral';
  }

  viewReceipt(payment: DonationPayment): void {
    this.receiptPrintService.viewPaymentReceipt(payment.id);
  }

  printReceipt(payment: DonationPayment): void {
    this.receiptPrintService.printPaymentReceipt(payment.id);
  }

  openReverse(payment: DonationPayment): void {
    this.actionError = null;
    this.pendingAction = { type: 'reverse', payment };
  }

  openRefund(payment: DonationPayment): void {
    this.actionError = null;
    this.pendingAction = { type: 'refund', payment };
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
    const payment = this.pendingAction.payment;
    if (this.pendingAction.type === 'reverse') {
      this.donationsService.reversePayment(payment.id, result.reason).subscribe({
        next: () => this.afterLedgerAction(),
        error: (err: { error?: { message?: string } }) => this.afterLedgerError(err)
      });
      return;
    }
    this.donationsService.requestRefund(payment.id, {
      amount: Number(result.amount),
      refund_date: this.meta?.business_date || this.collectionDate || '',
      reason: result.reason
    }).subscribe({
      next: () => this.afterLedgerAction(),
      error: (err: { error?: { message?: string } }) => this.afterLedgerError(err)
    });
  }

  load(): void {
    if (!this.canView) {
      return;
    }
    const seq = ++this.loadSeq;
    this.refreshing = this.loaded;
    this.loadError = null;
    const filters = this.buildFilters();
    const payments$ = this.donationsService.getPayments(filters);
    const dashboard$ = this.kpiFocus === 'completion'
      ? this.donationsService.getDashboardSummary().pipe(catchError(() => of(null)))
      : of(null);

    forkJoin({ payments: payments$, dashboard: dashboard$ }).subscribe({
      next: ({ payments: res, dashboard }) => {
        if (seq !== this.loadSeq) {
          return;
        }
        this.payments = res.data?.data ?? [];
        this.totalItems = res.data?.total ?? 0;
        this.page = res.data?.current_page ?? this.page;
        this.meta = res.meta ?? null;
        if (this.kpiFocus === 'completion') {
          this.monthCollectedForCompletion = dashboard?.data?.period_collections?.current_month_collected ?? 0;
        } else {
          this.monthCollectedForCompletion = null;
        }
        this.loaded = true;
        this.refreshing = false;
        this.cdr.markForCheck();
      },
      error: (err: HttpErrorResponse) => {
        if (seq !== this.loadSeq) {
          return;
        }
        this.loaded = true;
        this.refreshing = false;
        this.payments = [];
        if (err.status === 403) {
          this.canView = false;
          this.loadError = null;
        } else {
          this.loadError = err.error?.message || 'Unable to load today\'s collections. Try again.';
        }
        this.cdr.markForCheck();
      }
    });
  }

  private afterLedgerAction(): void {
    this.actionSaving = false;
    this.pendingAction = null;
    this.load();
    this.cdr.markForCheck();
  }

  private afterLedgerError(err: { error?: { message?: string } }): void {
    this.actionSaving = false;
    this.actionError = err?.error?.message || 'Unable to complete this action.';
    this.cdr.markForCheck();
  }

  private buildFilters(): Record<string, string> {
    const filters: Record<string, string> = {
      page: String(this.page),
      per_page: String(this.perPage),
      sort: this.sortColumn,
      direction: this.sortDirection || 'desc'
    };
    if (this.collectionDate) {
      filters['collection_date'] = this.collectionDate;
    } else {
      filters['today_only'] = '1';
    }
    if (this.search.trim()) filters['search'] = this.search.trim();
    if (this.status) filters['status'] = this.status;
    if (this.method) filters['method'] = this.method;
    if (this.bccId) filters['bcc_id'] = this.bccId;
    if (this.projectId) filters['project_id'] = this.projectId;
    return filters;
  }

  private syncQueryAndLoad(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        search: this.search.trim() || null,
        status: this.status || null,
        method: this.method || null,
        bcc_id: this.bccId || null,
        project_id: this.projectId || null,
        collection_date: this.collectionDate || null,
        focus: this.kpiFocus || null,
        page: this.page > 1 ? this.page : null,
        per_page: this.perPage !== 20 ? this.perPage : null,
        sort: this.sortColumn !== 'payment_date' ? this.sortColumn : null,
        direction: this.sortDirection !== 'desc' ? this.sortDirection : null
      },
      replaceUrl: true
    });
    this.load();
  }

  private readQuery(params: { get(name: string): string | null }): void {
    this.search = params.get('search') || '';
    this.status = params.get('status') || '';
    this.method = params.get('method') || '';
    this.bccId = params.get('bcc_id') || '';
    this.projectId = params.get('project_id') || '';
    this.collectionDate = params.get('collection_date') || '';
    this.page = Number(params.get('page') || 1) || 1;
    this.perPage = Number(params.get('per_page') || 20) || 20;
    const rawFocus = params.get('focus') || '';
    this.kpiFocus = KPI_FOCUS_VALUES.includes(rawFocus as KpiFocus) ? (rawFocus as KpiFocus) : '';
    this.queryHadExplicitSort = !!params.get('sort');
    this.sortColumn = params.get('sort') || 'payment_date';
    this.sortDirection = (params.get('direction') as SortDirection) || 'desc';
    if (!this.queryHadExplicitSort) {
      this.applyFocusDefaultSort();
    }
  }

  private applyFocusDefaultSort(): void {
    switch (this.kpiFocus) {
      case 'amount':
      case 'average':
        this.sortColumn = 'amount';
        this.sortDirection = 'desc';
        break;
      case 'families':
        this.sortColumn = 'family_name';
        this.sortDirection = 'asc';
        break;
      default:
        break;
    }
  }

  private initSearchFields(): void {
    this.searchFields = [
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        value: this.status || undefined,
        options: [
          { value: 'succeeded', label: 'Succeeded' },
          { value: 'pending', label: 'Pending' },
          { value: 'failed', label: 'Failed' },
          { value: 'reversed', label: 'Reversed' },
          { value: 'refunded', label: 'Refunded' }
        ]
      },
      {
        key: 'method',
        label: 'Method',
        type: 'select',
        value: this.method || undefined,
        options: [
          { value: 'cash', label: 'Cash' },
          { value: 'bank_transfer', label: 'Bank transfer' },
          { value: 'cheque', label: 'Cheque' },
          { value: 'online_placeholder', label: 'Online' },
          { value: 'adjustment', label: 'Adjustment' }
        ]
      },
      { key: 'bcc_id', label: 'BCC', type: 'select', value: this.bccId || undefined, options: this.bccOptions },
      { key: 'project_id', label: 'Project / fund', type: 'select', value: this.projectId || undefined, options: this.projectOptions },
      { key: 'collection_date', label: 'Collection date', type: 'date', value: this.collectionDate || undefined }
    ];
  }

  private syncSearchFieldValues(): void {
    this.searchFields = this.searchFields.map((field) => ({
      ...field,
      value: ({
        status: this.status,
        method: this.method,
        bcc_id: this.bccId,
        project_id: this.projectId,
        collection_date: this.collectionDate
      } as Record<string, string>)[field.key] || undefined,
      options: field.key === 'bcc_id' ? this.bccOptions : field.key === 'project_id' ? this.projectOptions : field.options
    }));
  }

  private loadFilterOptions(): void {
    this.bccService.getBCCs({ status: 'active', per_page: 500, sort_by: 'name', sort_order: 'asc' }).subscribe({
      next: (response) => {
        this.bccOptions = [
          { value: 'unassigned', label: 'Unassigned area' },
          ...(response?.data ?? []).map((row) => ({ value: String(row.id), label: row.name ?? 'BCC' }))
        ];
        this.syncSearchFieldValues();
        this.cdr.markForCheck();
      }
    });
    this.donationsService.getProjects().subscribe({
      next: (res) => {
        const rows = (res?.data ?? []) as DonationProject[];
        this.projectOptions = rows
          .filter((project) => project.status === 'active' || project.status === 'completed')
          .map((project) => ({ value: String(project.id), label: project.name ?? project.code }));
        this.syncSearchFieldValues();
        this.cdr.markForCheck();
      }
    });
  }
}
