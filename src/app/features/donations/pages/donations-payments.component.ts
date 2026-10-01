import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterModule, ActivatedRoute } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { CfIconActionButtonComponent } from '@shared/components/cf-icon-action-button/cf-icon-action-button.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { DonationsService } from '../services/donations.service';
import { QuickCollectService } from '../services/quick-collect.service';
import { ReceiptPrintService } from '../services/receipt-print.service';
import { DonationPayment } from '../models/donation.model';
import { FinancialActivityTimelineComponent } from '../components/financial-activity-timeline/financial-activity-timeline.component';
import {
  StewardshipConfirmDialogComponent,
  StewardshipConfirmResult
} from '../components/stewardship-confirm-dialog/stewardship-confirm-dialog.component';
import { localDateOnly } from '../utils/local-date-only';
import { CfCurrencyPipe } from '@shared/pipes/cf-currency.pipe';
import { CfActionIconComponent } from '@shared/components/cf-action-icon/cf-action-icon.component';
import { CfDatePipe } from '@shared/pipes/cf-date.pipe';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import {
  AdvancedSearchPanelComponent,
  SearchField,
} from '@shared/components/advanced-search-panel/advanced-search-panel.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { ListToolbarComponent } from '@shared/components/list-toolbar/list-toolbar.component';
import { SortableDirective, SortDirection, SortEvent } from '@shared/directives/sortable.directive';

type PaymentSortColumn = 'payment_number' | 'payer_name' | 'payment_date' | 'method' | 'status' | 'amount';

@Component({
  selector: 'app-donations-payments',
  standalone: true,
  imports: [
    CfDatePipe, CommonModule, RouterModule, FinancialActivityTimelineComponent, CfEmptyStateComponent, CfIconActionButtonComponent, LoadingSkeletonComponent, StewardshipConfirmDialogComponent, CfCurrencyPipe, CfActionIconComponent, PageHeaderComponent, ListToolbarComponent, AdvancedSearchPanelComponent, DataTableComponent, SortableDirective],
  styleUrls: ['../styles/stewardship-dashboard-shared.scss'],
  template: `
    <section class="payments cf-page cf-financial-dashboard">
      <app-page-header
        title="Payment Register"
        subtitle="Review today's collections and reprint receipts in one click."
      >
        <app-list-toolbar
          [showSearch]="false"
          [filterCount]="tableSearch.trim() ? 1 : 0"
          (filtersOpened)="showFilters = true"
        >
          <button
            type="button"
            class="cf-btn cf-btn-icon cf-btn-primary"
            (click)="openQuickCollect()"
            aria-label="Collect Payment"
            title="Collect Payment"
          >
            <app-cf-action-icon name="collect-payment" />
          </button>
          <a routerLink="/donations/collection-day" class="cf-btn cf-btn-icon" aria-label="Collection Day" title="Collection Day">
            <app-cf-action-icon name="calendar-check" />
          </a>
        </app-list-toolbar>
      </app-page-header>

      <div
        class="dashboard-active-filters"
        *ngIf="tableSearch.trim()"
        role="region"
        aria-label="Active filters"
      >
        <span class="cf-meta">Active filters</span>
        <div class="dashboard-active-filters__list">
          <span class="cf-badge cf-badge--info">
            Search: {{ tableSearch.trim() }}
            <button type="button" class="dashboard-active-filters__remove" (click)="clearTableSearch()" aria-label="Remove search filter">×</button>
          </span>
        </div>
        <button type="button" class="cf-btn cf-btn--sm" (click)="clearTableSearch()">Clear all</button>
      </div>

      <div class="cf-loading-block cf-panel" *ngIf="!paymentsLoaded" role="status" aria-live="polite" aria-busy="true">
        <app-loading-skeleton label="Loading payments…" type="table" [rows]="6" [columns]="6"></app-loading-skeleton>
      </div>

      <ng-container *ngIf="paymentsLoaded">
      <p *ngIf="!canCollectPayments" class="cf-state cf-state--error">
        You do not have permission to collect payments.
      </p>

      <p *ngIf="message" class="cf-state cf-state--success">{{ message }}</p>

      <app-financial-activity-timeline
        *ngIf="selectedPaymentId"
        class="timeline-panel cf-panel"
        subjectType="payment"
        [subjectId]="selectedPaymentId"
        title="Payment Activity"
      ></app-financial-activity-timeline>

      <div class="cf-panel stewardship-table-panel" *ngIf="payments.length">
        <header class="stewardship-panel-head" *ngIf="displayPayments.length">
          <div class="stewardship-panel-head__copy">
            <h2 class="cf-section-title">Payments</h2>
            <p class="cf-meta">{{ displayPayments.length }} of {{ payments.length }} on this page</p>
          </div>
        </header>

      <app-data-table *ngIf="displayPayments.length">
        <thead>
          <tr>
            <th scope="col" appSortable="payment_number" [direction]="sortColumn === 'payment_number' ? sortDirection : null" (sort)="onSort($event)">No</th>
            <th scope="col" appSortable="payer_name" [direction]="sortColumn === 'payer_name' ? sortDirection : null" (sort)="onSort($event)">Payer</th>
            <th scope="col" appSortable="payment_date" [direction]="sortColumn === 'payment_date' ? sortDirection : null" (sort)="onSort($event)">Date</th>
            <th scope="col" appSortable="method" [direction]="sortColumn === 'method' ? sortDirection : null" (sort)="onSort($event)">Method</th>
            <th scope="col" appSortable="status" [direction]="sortColumn === 'status' ? sortDirection : null" (sort)="onSort($event)">Status</th>
            <th scope="col" class="cf-table__num" appSortable="amount" [direction]="sortColumn === 'amount' ? sortDirection : null" (sort)="onSort($event)">Amount</th>
            <th scope="col" class="cf-table__actions-col"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let payment of displayPayments; trackBy: trackPayment">
            <td>{{ payment.payment_number }}</td>
            <td>{{ payment.is_anonymous ? 'Anonymous' : payment.payer_name }}</td>
            <td>{{ payment.payment_date | cfDate }}</td>
            <td>{{ payment.method }}</td>
            <td>{{ payment.status }}</td>
            <td class="cf-table__num">{{ payment.amount | cfCurrency }}</td>
            <td class="cf-table__actions-cell">
              <div class="cf-row-actions">
                <app-cf-icon-action-button
                  action="view"
                  size="sm"
                  [ariaLabel]="'View receipt for ' + payment.payment_number"
                  [title]="'View receipt for ' + payment.payment_number"
                  (clicked)="viewReceipt(payment.id)"
                ></app-cf-icon-action-button>
                <button
                  type="button"
                  class="cf-btn cf-btn-icon cf-btn--sm"
                  *ngIf="canReverse && payment.status === 'succeeded'"
                  (click)="openReverse(payment)"
                
          aria-label="Reverse"
          title="Reverse">
          <app-cf-action-icon name="undo-2" />
                </button>
                <button
                  type="button"
                  class="cf-btn cf-btn-icon cf-btn--sm"
                  *ngIf="canRefund && (payment.status === 'succeeded' || payment.status === 'partially_refunded')"
                  [disabled]="(payment.refundable_remaining ?? payment.amount) <= 0"
                  (click)="openRefund(payment)"
                
          aria-label="Refund"
          title="Refund">
          <app-cf-action-icon name="corner-down-left" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </app-data-table>

      <p *ngIf="payments.length && !displayPayments.length" class="cf-meta stewardship-table-panel__empty">
        No payments match your search. Try another term or clear filters.
      </p>
      </div>

      <app-cf-empty-state
        *ngIf="!paymentsLoadError && !payments.length"
        icon="💳"
        title="No payments recorded yet"
        description="Start collecting with Quick Collect or Collection Day mode for high-volume Sundays."
      >
        <button
          aria-label="Collect Payment"
          title="Collect Payment" type="button" class="cf-btn cf-btn-icon cf-btn-primary" (click)="openQuickCollect()">
          <app-cf-action-icon name="collect-payment" />
        </button>
        <a routerLink="/donations/collection-day" class="cf-btn cf-btn-icon" aria-label="Collection Day" title="Collection Day">
          <app-cf-action-icon name="calendar-check" />
        </a>
      </app-cf-empty-state>

      <div class="cf-inline-alert cf-panel" *ngIf="paymentsLoadError" role="alert">
        <p class="payments-load-error__text">{{ paymentsLoadError }}</p>
        <button
          aria-label="Try again"
          title="Try again" type="button" class="cf-btn cf-btn-icon cf-btn-primary" (click)="load()">
          <app-cf-action-icon name="refresh" />
        </button>
      </div>
      </ng-container>

      <app-stewardship-confirm-dialog
        *ngIf="pendingAction"
        [title]="pendingAction.type === 'reverse' ? 'Reverse this payment?' : 'Request a refund?'"
        [message]="pendingAction.type === 'reverse'
          ? 'This undoes the payment and voids the current receipt. The family will owe this amount again. This cannot be undone.'
          : 'A treasurer must approve the refund before family balances change. Partial refunds keep the original payment on the books.'"
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
    .stewardship-panel-head__copy { display: grid; gap: 0.08rem; }
    .stewardship-table-panel__empty { margin: 0; padding: 0 var(--cf-panel-pad) var(--cf-space-3); text-align: center; }
  `]
})
export class DonationsPaymentsComponent implements OnInit, OnDestroy {
  payments: DonationPayment[] = [];
  displayPayments: DonationPayment[] = [];
  paymentsLoaded = false;
  paymentsLoadError: string | null = null;
  private loadPaymentsSeq = 0;
  private routerSub?: Subscription;
  private ledgerSub?: Subscription;
  private skipNextNavReload = true;
  tableSearch = '';
  showFilters = false;
  searchFields: SearchField[] = [];
  sortColumn: PaymentSortColumn = 'payment_date';
  sortDirection: SortDirection = 'desc';
  selectedPaymentId: string | null = null;
  message = '';
  canCollectPayments = false;
  canReverse = false;
  canRefund = false;
  pendingAction: { type: 'reverse' | 'refund'; payment: DonationPayment } | null = null;
  actionSaving = false;
  actionError: string | null = null;

  constructor(
    private donationsService: DonationsService,
    private authService: AuthService,
    private quickCollectService: QuickCollectService,
    private receiptPrintService: ReceiptPrintService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.canCollectPayments = this.authService.hasPermission('donations.collect');
    this.canReverse = this.authService.hasPermission('donations.reverse');
    this.canRefund = this.authService.hasPermission('donations.refund');
    this.initSearchFields();
    this.load();
    this.ledgerSub = this.donationsService.ledgerMutated$.subscribe(() => this.load());
    this.routerSub = this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe((e) => {
      if (!e.urlAfterRedirects.includes('/donations/payments')) {
        return;
      }
      if (this.skipNextNavReload) {
        this.skipNextNavReload = false;
        return;
      }
      this.load();
    });
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
    this.ledgerSub?.unsubscribe();
  }

  openQuickCollect(): void {
    this.quickCollectService.open();
  }

  get paidFrom(): string | null {
    return this.route.snapshot.queryParamMap.get('paid_from');
  }

  get paidTo(): string | null {
    return this.route.snapshot.queryParamMap.get('paid_to');
  }

  trackPayment(_index: number, payment: DonationPayment): string {
    return payment.id;
  }

  onSort(event: SortEvent): void {
    const allowed: PaymentSortColumn[] = [
      'payment_number',
      'payer_name',
      'payment_date',
      'method',
      'status',
      'amount',
    ];
    if (!allowed.includes(event.column as PaymentSortColumn)) {
      return;
    }
    this.sortColumn = event.column as PaymentSortColumn;
    this.sortDirection = event.direction ?? 'desc';
    this.load();
  }

  onTableSearchChange(): void {
    this.syncDisplayPayments();
    this.cdr.markForCheck();
  }

  onAdvancedSearch(values: { [key: string]: unknown }): void {
    this.tableSearch = String(values['search'] ?? '').trim();
    this.showFilters = false;
    this.syncSearchFieldValues();
    this.onTableSearchChange();
  }

  onClearAdvancedSearch(): void {
    this.clearTableSearch();
    this.showFilters = false;
  }

  clearTableSearch(): void {
    this.tableSearch = '';
    this.syncSearchFieldValues();
    this.onTableSearchChange();
  }

  private initSearchFields(): void {
    this.searchFields = [
      {
        key: 'search',
        label: 'Payer, receipt #, or method',
        type: 'text',
        placeholder: 'Filter payments…',
        value: this.tableSearch.trim() || undefined,
      },
    ];
  }

  private syncSearchFieldValues(): void {
    const field = this.searchFields.find((f) => f.key === 'search');
    if (field) {
      field.value = this.tableSearch.trim() || undefined;
    }
  }

  private syncDisplayPayments(): void {
    const query = this.tableSearch.trim().toLowerCase();
    if (!query) {
      this.displayPayments = this.payments;
      return;
    }
    this.displayPayments = this.payments.filter((payment) => {
      const haystack = [
        payment.payment_number,
        payment.payer_name,
        payment.method,
        payment.status
      ].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }

  load(): void {
    const seq = ++this.loadPaymentsSeq;
    this.paymentsLoaded = false;
    this.paymentsLoadError = null;
    const filters: Record<string, string> = {};
    if (this.paidFrom) {
      filters['paid_from'] = this.paidFrom;
    }
    if (this.paidTo) {
      filters['paid_to'] = this.paidTo;
    }
    if (this.paidFrom || this.paidTo) {
      filters['per_page'] = '100';
    }
    filters['sort'] = this.sortColumn;
    filters['direction'] = this.sortDirection || 'desc';
    this.donationsService.getPayments(filters).subscribe({
      next: (res) => {
        if (seq !== this.loadPaymentsSeq) {
          return;
        }
        this.payments = res.data?.data ?? [];
        this.syncDisplayPayments();
        this.paymentsLoaded = true;
        this.cdr.detectChanges();
      },
      error: () => {
        if (seq !== this.loadPaymentsSeq) {
          return;
        }
        this.paymentsLoaded = true;
        this.paymentsLoadError = 'Unable to load payments. Please try again.';
        this.cdr.detectChanges();
      }
    });
  }

  viewReceipt(paymentId: string): void {
    this.selectedPaymentId = paymentId;
    this.cdr.detectChanges();
    this.receiptPrintService.viewPaymentReceipt(paymentId);
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
        next: () => this.afterLedgerAction('Payment reversed. The receipt is void and the family owes this amount again.'),
        error: (err: { error?: { message?: string } }) => this.afterLedgerError(err)
      });
      return;
    }

    this.donationsService.requestRefund(payment.id, {
      amount: Number(result.amount),
      refund_date: localDateOnly(),
      reason: result.reason
    }).subscribe({
      next: () => this.afterLedgerAction('Refund requested. A treasurer must approve it before family balances change.'),
      error: (err: { error?: { message?: string } }) => this.afterLedgerError(err)
    });
  }

  private afterLedgerAction(message: string): void {
    this.actionSaving = false;
    this.pendingAction = null;
    this.message = message;
    this.load();
    this.cdr.markForCheck();
  }

  private afterLedgerError(err: { error?: { message?: string } }): void {
    this.actionSaving = false;
    this.actionError = err?.error?.message || 'Unable to complete this action.';
    this.cdr.markForCheck();
  }

}
