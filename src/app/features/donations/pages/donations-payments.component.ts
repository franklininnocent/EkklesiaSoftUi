import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
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
import { localDateOnly, requiresGatewayReference } from '../utils/local-date-only';

@Component({
  selector: 'app-donations-payments',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, FinancialActivityTimelineComponent, CfEmptyStateComponent, CfIconActionButtonComponent, LoadingSkeletonComponent, StewardshipConfirmDialogComponent],
  template: `
    <section class="payments cf-page">
      <header class="cf-hero">
        <h1>Payment Register</h1>
        <p>Review today's collections and reprint receipts in one click.</p>
      </header>

      <div class="payments-loading cf-panel" *ngIf="!paymentsLoaded" role="status" aria-live="polite" aria-busy="true">
        <p class="payments-loading__label">Loading payments…</p>
        <app-loading-skeleton type="table" [rows]="6" [columns]="6"></app-loading-skeleton>
      </div>

      <ng-container *ngIf="paymentsLoaded">
      <div class="cf-decision-strip" role="region" aria-label="Suggested next step">
        <div class="cf-decision-strip__copy">
          <strong>{{ todayCount }} payment{{ todayCount === 1 ? '' : 's' }} today · {{ todayTotal | number:'1.2-2' }} collected</strong>
          <span>{{ decisionHint }}</span>
        </div>
        <div class="cf-decision-strip__actions">
          <button type="button" class="cf-btn cf-btn-primary" (click)="openQuickCollect()">Collect Payment</button>
          <a routerLink="/donations/collection-day" class="cf-btn">Collection Day</a>
        </div>
      </div>

      <details class="cf-disclosure manual-entry" role="group" *ngIf="canCollectPayments">
        <summary class="cf-disclosure__trigger">
          <strong>Manual payment entry</strong>
          <span>Advanced — use Quick Collect for most collections</span>
        </summary>
        <div class="cf-disclosure__body">
      <form [formGroup]="paymentForm" (ngSubmit)="submit()" class="manual-entry-form">
        <div class="payment-form cf-form-grid">
          <input formControlName="payer_name" placeholder="Payer name" />
          <input formControlName="amount" type="number" placeholder="Amount" />
          <select formControlName="method">
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="cheque">Cheque</option>
            <option value="online_placeholder">Online</option>
          </select>
          <input formControlName="gateway_reference" placeholder="Cheque / transfer reference" *ngIf="needsReference" />
          <input formControlName="payment_date" type="date" />
          <button type="button" class="cf-btn" (click)="addAllocation()">+ Allocation</button>
          <button type="submit" class="cf-btn cf-btn-primary" [disabled]="paymentForm.invalid || saving">{{ saving ? 'Saving...' : 'Add Payment' }}</button>
        </div>

        <div formArrayName="allocations" class="allocations cf-panel" *ngIf="allocations.length">
          <div *ngFor="let allocation of allocations.controls; let i = index" [formGroupName]="i" class="allocation-row cf-form-grid">
            <select formControlName="allocatable_type">
              <option value="due">Due</option>
              <option value="project_installment">Project Installment</option>
              <option value="project">Project</option>
              <option value="donation">Donation</option>
              <option value="fund">Fund</option>
              <option value="plan">Plan</option>
            </select>
            <input formControlName="allocatable_id" placeholder="Target UUID" />
            <input formControlName="amount" type="number" placeholder="Amount" />
            <button type="button" class="cf-btn" (click)="removeAllocation(i)">Remove</button>
          </div>
        </div>
      </form>
        </div>
      </details>

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

      <div class="cf-filters cf-panel" *ngIf="payments.length">
        <input type="search" [(ngModel)]="tableSearch" (ngModelChange)="onTableSearchChange()" placeholder="Filter by payer, receipt #, method…" />
      </div>

      <table *ngIf="displayPayments.length" class="table cf-table">
        <thead><tr><th>No</th><th>Payer</th><th>Date</th><th>Method</th><th>Status</th><th>Amount</th><th class="cf-table__actions-col" aria-label="Actions"></th></tr></thead>
        <tbody>
          <tr *ngFor="let payment of displayPayments; trackBy: trackPayment">
            <td>{{ payment.payment_number }}</td>
            <td>{{ payment.is_anonymous ? 'Anonymous' : payment.payer_name }}</td>
            <td>{{ payment.payment_date | date }}</td>
            <td>{{ payment.method }}</td>
            <td>{{ payment.status }}</td>
            <td>{{ payment.amount | number:'1.2-2' }}</td>
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
                  class="cf-btn"
                  *ngIf="canReverse && payment.status === 'succeeded'"
                  (click)="openReverse(payment)"
                >Reverse</button>
                <button
                  type="button"
                  class="cf-btn"
                  *ngIf="canRefund && (payment.status === 'succeeded' || payment.status === 'partially_refunded')"
                  [disabled]="(payment.refundable_remaining ?? payment.amount) <= 0"
                  (click)="openRefund(payment)"
                >Refund</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <app-cf-empty-state
        *ngIf="!paymentsLoadError && !payments.length"
        icon="₹"
        title="No payments recorded yet"
        description="Start collecting with Quick Collect or Collection Day mode for high-volume Sundays."
      >
        <button type="button" class="cf-btn cf-btn-primary" (click)="openQuickCollect()">Collect Payment</button>
        <a routerLink="/donations/collection-day" class="cf-btn">Collection Day</a>
      </app-cf-empty-state>

      <p *ngIf="payments.length && !displayPayments.length" class="cf-state">No payments match your filter.</p>

      <div class="payments-load-error cf-panel" *ngIf="paymentsLoadError" role="alert">
        <p class="payments-load-error__text">{{ paymentsLoadError }}</p>
        <button type="button" class="cf-btn cf-btn-primary" (click)="load()">Try again</button>
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
    </section>
  `,
  styles: [`
    .payments-loading { display: grid; gap: 0.75rem; padding: 1rem; }
    .payments-loading__label { margin: 0; font-size: 0.88rem; color: var(--cf-muted); }
    .payments-load-error {
      display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem;
      padding: 1rem; border-color: #fecaca; background: var(--cf-critical-soft);
    }
    .payments-load-error__text { margin: 0; color: var(--cf-critical); font-size: 0.9rem; }
    .manual-entry { margin-bottom: 0.85rem; }
    .manual-entry summary { list-style: none; }
    .manual-entry summary::-webkit-details-marker { display: none; }
    .payment-form { grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); margin-bottom: 0; }
    .allocations { display: grid; gap: 0.45rem; margin-top: 0.65rem; }
    .allocation-row { grid-template-columns: 150px 1fr 140px 100px; }
    .cf-row-actions { display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; }
  `]
})
export class DonationsPaymentsComponent implements OnInit, OnDestroy {
  payments: DonationPayment[] = [];
  displayPayments: DonationPayment[] = [];
  paymentsLoaded = false;
  paymentsLoadError: string | null = null;
  private loadPaymentsSeq = 0;
  private routerSub?: Subscription;
  private skipNextNavReload = true;
  tableSearch = '';
  selectedPaymentId: string | null = null;
  saving = false;
  message = '';
  canCollectPayments = false;
  canReverse = false;
  canRefund = false;
  pendingAction: { type: 'reverse' | 'refund'; payment: DonationPayment } | null = null;
  actionSaving = false;
  actionError: string | null = null;

  paymentForm = this.fb.group({
    payer_name: ['', Validators.required],
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    method: ['cash', Validators.required],
    gateway_reference: [''],
    payment_date: [localDateOnly(), Validators.required],
    allocations: this.fb.array([])
  });

  constructor(
    private fb: FormBuilder,
    private donationsService: DonationsService,
    private authService: AuthService,
    private quickCollectService: QuickCollectService,
    private receiptPrintService: ReceiptPrintService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.canCollectPayments = this.authService.hasPermission('donations.collect');
    this.canReverse = this.authService.hasPermission('donations.reverse');
    this.canRefund = this.authService.hasPermission('donations.refund');
    this.load();
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
  }

  get allocations(): FormArray {
    return this.paymentForm.get('allocations') as FormArray;
  }

  addAllocation(): void {
    this.allocations.push(this.fb.group({
      allocatable_type: ['due', Validators.required],
      allocatable_id: ['', Validators.required],
      amount: [null as number | null, [Validators.required, Validators.min(0.01)]]
    }));
  }

  removeAllocation(index: number): void {
    this.allocations.removeAt(index);
  }

  openQuickCollect(): void {
    this.quickCollectService.open();
  }

  get needsReference(): boolean {
    return requiresGatewayReference(this.paymentForm.get('method')?.value || '');
  }

  get todayIso(): string {
    return localDateOnly();
  }

  get todayPayments(): DonationPayment[] {
    return this.payments.filter((payment) => (payment.payment_date || '').slice(0, 10) === this.todayIso);
  }

  get todayCount(): number {
    return this.todayPayments.length;
  }

  get todayTotal(): number {
    return this.todayPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  }

  get decisionHint(): string {
    if (this.todayCount > 0) {
      return 'Verify totals match your cash count, then use the view icon to open receipts as needed.';
    }
    return 'Use Collection Day mode for fast keyboard entry during services.';
  }

  trackPayment(_index: number, payment: DonationPayment): string {
    return payment.id;
  }

  onTableSearchChange(): void {
    this.syncDisplayPayments();
    this.cdr.markForCheck();
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
    this.donationsService.getPaymentsLegacy().subscribe({
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

  submit(): void {
    if (this.paymentForm.invalid) {
      return;
    }
    const raw = this.paymentForm.getRawValue();
    if (requiresGatewayReference(raw.method || '') && !String(raw.gateway_reference || '').trim()) {
      this.message = 'Cheque and bank transfer payments need a reference number.';
      return;
    }

    this.saving = true;
    this.message = '';
    const allocations = (raw.allocations ?? []).filter((a: any) => Number(a.amount) > 0);
    const payload: Record<string, unknown> = {
      payer_name: raw.payer_name,
      amount: raw.amount,
      method: raw.method,
      payment_date: raw.payment_date,
      allocations
    };
    if (requiresGatewayReference(raw.method || '')) {
      payload['gateway_reference'] = String(raw.gateway_reference).trim();
    }

    this.donationsService.createPayment(payload).subscribe({
      next: () => {
        this.saving = false;
        this.message = 'Payment saved successfully.';
        this.paymentForm.patchValue({ payer_name: '', amount: null, gateway_reference: '' });
        this.allocations.clear();
        this.load();
        this.cdr.markForCheck();
      },
      error: () => {
        this.saving = false;
        this.message = 'Failed to save payment.';
        this.cdr.markForCheck();
      }
    });
  }
}
