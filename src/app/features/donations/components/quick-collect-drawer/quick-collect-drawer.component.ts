import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, ElementRef, HostListener, ViewChild, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, Subject, switchMap, of } from 'rxjs';
import { FamilyService } from '@core/services/family.service';
import { Family } from '@core/models/family.model';
import { ToastService } from '@core/services/toast.service';
import { DonationsService } from '../../services/donations.service';
import { QuickCollectRecentFamily, QuickCollectService } from '../../services/quick-collect.service';
import { ReceiptPrintService } from '../../services/receipt-print.service';
import {
  DonationFamilyFinancialProfile,
  DonationPayment,
  DonationReceiptPreview,
  UpiPaymentIntent
} from '../../models/donation.model';

type CollectPhase = 'collect' | 'success';
type CollectType = 'general' | 'mandatory' | 'project' | 'offering';

interface AllocationOption {
  label: string;
  amount: number;
  type: CollectType;
  allocatable_type: 'due' | 'project_installment' | 'fund';
  allocatable_id: string;
}

interface ActivityRow {
  id: string;
  family_name: string;
  amount: number;
  method: string;
  time_label: string;
  status: string;
}

@Component({
  selector: 'app-quick-collect-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="qc-backdrop" *ngIf="isOpen" (click)="close()" aria-hidden="true"></div>

    <aside
      class="qc-drawer"
      *ngIf="isOpen"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qc-title"
      (keydown)="onDrawerKeydown($event)"
    >
      <header class="qc-header">
        <div>
          <h2 id="qc-title">Quick Collect</h2>
          <p>Fast payment collection for families</p>
        </div>
        <button type="button" class="qc-close" (click)="close()" aria-label="Close Quick Collect">×</button>
      </header>

      <div class="qc-body">
        <div class="qc-workspace">
          <div class="qc-main">
            <section class="qc-success" *ngIf="phase === 'success' && lastSuccess" role="status" aria-live="polite">
              <div class="qc-success__icon" aria-hidden="true">✓</div>
              <h3>Payment recorded successfully</h3>
              <dl class="qc-success__details">
                <div><dt>Family</dt><dd>{{ lastSuccess.familyName }}</dd></div>
                <div><dt>Amount</dt><dd>₹{{ lastSuccess.amount | number:'1.0-0' }}</dd></div>
                <div><dt>Category</dt><dd>{{ lastSuccess.categoryLabel }}</dd></div>
                <div *ngIf="lastSuccess.receiptNumber"><dt>Receipt #</dt><dd>{{ lastSuccess.receiptNumber }}</dd></div>
                <div *ngIf="!lastSuccess.receiptNumber"><dt>Receipt</dt><dd>{{ lastSuccess.receiptGenerated ? 'Generating…' : 'Not requested' }}</dd></div>
              </dl>
              <p class="qc-success__hint" *ngIf="lastPaymentId">
                Print a receipt for the payer now, or find it later under Stewardship → Receipts.
              </p>
              <div class="qc-success__actions">
                <button type="button" class="cf-btn cf-btn-primary" *ngIf="lastPaymentId" (click)="printReceipt()">Print receipt</button>
                <button type="button" class="cf-btn" *ngIf="lastPaymentId" (click)="viewReceipt()">Preview receipt</button>
                <button type="button" class="cf-btn" (click)="collectAnother()">Collect another payment</button>
                <a class="cf-btn" routerLink="/donations/receipts" (click)="close()">All receipts</a>
              </div>
            </section>

            <ng-container *ngIf="phase === 'collect'">
              <section class="qc-section" aria-labelledby="qc-family-heading">
                <h3 id="qc-family-heading" class="qc-section__title">Family</h3>

                <label class="qc-field">
                  <span class="sr-only">Search family</span>
                  <input
                    #searchInput
                    type="search"
                    [(ngModel)]="searchQuery"
                    (ngModelChange)="onSearchChange($event)"
                    (keydown)="onSearchKeydown($event)"
                    placeholder="Search by name, ID, phone, or member…"
                    autocomplete="off"
                    aria-label="Search family"
                    [attr.aria-controls]="searchResults.length ? 'qc-search-results' : null"
                    aria-autocomplete="list"
                    [attr.aria-expanded]="searchResults.length > 0"
                  />
                </label>

                <ul
                  id="qc-search-results"
                  class="qc-results"
                  role="listbox"
                  aria-label="Matching families"
                  *ngIf="searchResults.length"
                >
                  <li role="presentation" *ngFor="let family of searchResults; let i = index">
                    <button
                      type="button"
                      role="option"
                      class="qc-result"
                      [class.highlighted]="highlightedIndex === i"
                      [class.selected]="selectedFamily?.id === family.id"
                      [attr.aria-selected]="selectedFamily?.id === family.id"
                      (click)="selectFamily(family)"
                    >
                      <strong>{{ family.family_name }}</strong>
                      <span>{{ family.family_code }}</span>
                      <small *ngIf="family.head_of_family">{{ family.head_of_family }}</small>
                    </button>
                  </li>
                </ul>

                <div class="qc-recent" *ngIf="!searchQuery && recentFamilies.length && !selectedFamily">
                  <span class="qc-recent__label">Recent families</span>
                  <div class="qc-recent__chips">
                    <button
                      type="button"
                      class="qc-recent-chip"
                      *ngFor="let family of recentFamilies"
                      (click)="selectRecentFamily(family)"
                    >
                      {{ family.family_name }}
                    </button>
                  </div>
                </div>

                <article class="qc-selected" *ngIf="selectedFamily">
                  <div class="qc-selected__head">
                    <div>
                      <strong>{{ selectedFamily.family_name }}</strong>
                      <span>{{ selectedFamily.family_code }}</span>
                    </div>
                    <button type="button" class="qc-link" (click)="clearFamily()">Change</button>
                  </div>
                  <p *ngIf="familyProfile" class="qc-selected__meta">
                    Outstanding ₹{{ familyProfile.totals.pending_due | number:'1.0-0' }}
                    · Paid ₹{{ familyProfile.totals.total_paid | number:'1.0-0' }}
                  </p>
                </article>

                <div class="qc-suggestions" *ngIf="selectedFamily && allocationOptions.length">
                  <span class="qc-suggestions__label">Suggested amounts</span>
                  <div class="qc-suggestions__chips">
                    <button
                      type="button"
                      class="qc-suggestion-chip"
                      *ngFor="let option of allocationOptions"
                      [class.active]="selectedAllocation?.allocatable_id === option.allocatable_id"
                      (click)="applyAllocation(option)"
                    >
                      {{ option.label }} · ₹{{ option.amount | number:'1.0-0' }}
                    </button>
                  </div>
                </div>
              </section>

              <section class="qc-section" *ngIf="selectedFamily" aria-labelledby="qc-payment-heading">
                <h3 id="qc-payment-heading" class="qc-section__title">Payment details</h3>

                <div class="qc-grid">
                  <label class="qc-field">
                    <span>Amount <span class="req" aria-hidden="true">*</span></span>
                    <div class="qc-amount" [class.is-invalid]="submitAttempted && (!amount || amount <= 0)">
                      <span aria-hidden="true">₹</span>
                      <input
                        #amountInput
                        type="number"
                        min="0.01"
                        step="0.01"
                        [(ngModel)]="amount"
                        (ngModelChange)="onAmountChange($event)"
                        placeholder="500"
                        aria-required="true"
                        inputmode="decimal"
                      />
                    </div>
                  </label>

                  <label class="qc-field">
                    <span>Contribution category <span class="req" aria-hidden="true">*</span></span>
                    <select [(ngModel)]="fundId" aria-required="true" [class.is-invalid]="submitAttempted && !fundId">
                      <option value="">Choose category</option>
                      <option *ngFor="let fund of funds" [value]="fund.id">{{ fund.name }}</option>
                    </select>
                  </label>

                  <label class="qc-field">
                    <span>Payment method</span>
                    <select [(ngModel)]="method" (ngModelChange)="onMethodChange($event)">
                      <option value="cash">Cash</option>
                      <option value="bank_transfer">Bank transfer</option>
                      <option value="cheque">Cheque</option>
                      <option value="upi">UPI</option>
                      <option value="online_placeholder">Online</option>
                    </select>
                  </label>

                  <label class="qc-field">
                    <span>Collection date</span>
                    <input type="date" [(ngModel)]="paymentDate" />
                  </label>

                  <label class="qc-field qc-field--full">
                    <span>Payer name</span>
                    <input type="text" [(ngModel)]="payerName" placeholder="Head of family" />
                  </label>

                  <label class="qc-field qc-field--full">
                    <span>Notes <span class="optional">optional</span></span>
                    <input type="text" [(ngModel)]="notes" placeholder="Sunday collection, festival offering…" />
                  </label>
                </div>

                <div class="qc-upi" *ngIf="method === 'upi'">
                  <p *ngIf="upiLoading" class="qc-upi__hint">Generating UPI QR…</p>
                  <ng-container *ngIf="!upiLoading && upiIntent?.available">
                    <img [src]="upiIntent!.qr_data_uri" alt="UPI payment QR code" width="180" height="180" />
                    <p class="qc-upi__hint">{{ upiIntent!.payee_name }} · ₹{{ upiIntent!.amount | number:'1.0-0' }}</p>
                  </ng-container>
                  <p *ngIf="!upiLoading && upiIntent && !upiIntent.available" class="qc-upi__hint">
                    {{ upiIntent.message || 'Configure UPI in Donations Settings to enable QR collection.' }}
                  </p>
                </div>
              </section>

              <section class="qc-section qc-section--compact" *ngIf="selectedFamily" aria-labelledby="qc-receipt-heading">
                <h3 id="qc-receipt-heading" class="qc-section__title">Receipt</h3>
                <label class="qc-check">
                  <input type="checkbox" [(ngModel)]="generateReceipt" />
                  <span>Generate receipt automatically</span>
                </label>
              </section>
            </ng-container>

            <p class="qc-alert qc-alert--error" *ngIf="error" role="alert">{{ error }}</p>
          </div>

          <aside class="qc-activity" aria-labelledby="qc-activity-heading">
            <h3 id="qc-activity-heading" class="qc-activity__title">Recent payments</h3>
            <p class="qc-activity__empty" *ngIf="!activityRows.length">Today's collections will appear here.</p>
            <ul class="qc-activity__list" *ngIf="activityRows.length">
              <li *ngFor="let row of activityRows">
                <div class="qc-activity__row">
                  <strong>{{ row.family_name }}</strong>
                  <span>₹{{ row.amount | number:'1.0-0' }}</span>
                </div>
                <div class="qc-activity__meta">
                  <span>{{ row.time_label }}</span>
                  <span>{{ methodLabel(row.method) }}</span>
                </div>
              </li>
            </ul>
          </aside>
        </div>
      </div>

      <footer class="qc-footer">
        <label class="qc-check qc-check--footer" *ngIf="phase === 'collect'">
          <input type="checkbox" [(ngModel)]="keepQuickCollectOpen" (ngModelChange)="onKeepOpenChange($event)" />
          <span>Keep Quick Collect open</span>
        </label>
        <div class="qc-footer__actions">
          <button type="button" class="cf-btn" (click)="close()">{{ phase === 'success' ? 'Close' : 'Cancel' }}</button>
          <button
            type="button"
            class="cf-btn cf-btn-primary"
            *ngIf="phase === 'collect'"
            [disabled]="!canSubmit || saving"
            (click)="submit()"
          >
            {{ submitLabel }}
          </button>
        </div>
      </footer>
    </aside>
  `,
  styles: [`
    .sr-only {
      position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
      overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
    }
    .qc-backdrop {
      position: fixed; inset: 0; background: rgba(15, 23, 42, 0.5); z-index: 1200;
    }
    .qc-drawer {
      position: fixed; top: 0; right: 0; width: min(760px, 100vw); height: 100vh; z-index: 1201;
      background: var(--cf-panel-bg); box-shadow: var(--cf-shadow-lg);
      display: flex; flex-direction: column; font-family: var(--cf-font-sans);
    }
    .qc-header, .qc-footer {
      padding: 1rem 1.15rem; display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start;
    }
    .qc-header { border-bottom: 1px solid var(--cf-panel-border); }
    .qc-footer {
      border-top: 1px solid var(--cf-panel-border); margin-top: auto;
      align-items: center; flex-wrap: wrap;
    }
    .qc-header h2 { margin: 0; font-size: 1.1rem; font-weight: 650; color: var(--cf-slate-900); }
    .qc-header p { margin: 0.2rem 0 0; color: var(--cf-muted); font-size: 0.86rem; }
    .qc-close {
      border: 0; background: transparent; font-size: 1.45rem; line-height: 1;
      color: var(--cf-muted); padding: 0.15rem 0.45rem; cursor: pointer;
    }
    .qc-body { padding: 1rem 1.15rem; overflow: auto; flex: 1; }
    .qc-workspace { display: grid; grid-template-columns: minmax(0, 1fr) 220px; gap: 1rem; align-items: start; }
    .qc-main { display: grid; gap: 1rem; min-width: 0; }
    .qc-section { display: grid; gap: 0.75rem; }
    .qc-section--compact { gap: 0.5rem; }
    .qc-section__title {
      margin: 0; font-size: 0.72rem; font-weight: 650; letter-spacing: 0.06em;
      text-transform: uppercase; color: var(--cf-muted);
    }
    .qc-field { display: grid; gap: 0.3rem; min-width: 0; }
    .qc-field--full { grid-column: 1 / -1; }
    .qc-field span { font-size: 0.78rem; font-weight: 500; color: var(--cf-slate-700); }
    .req { color: var(--cf-critical); }
    .optional { color: var(--cf-muted); font-weight: 400; }
    .qc-field input, .qc-field select {
      width: 100%; border: 1px solid var(--cf-panel-border); border-radius: var(--cf-radius-sm);
      padding: 0.55rem 0.65rem; font-size: 0.9rem; background: #fff;
    }
    .qc-field input:focus, .qc-field select:focus {
      outline: none; border-color: var(--cf-primary); box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
    }
    .qc-field input.is-invalid, .qc-field select.is-invalid, .qc-amount.is-invalid {
      border-color: var(--cf-critical);
    }
    .qc-amount {
      display: flex; align-items: stretch; border: 1px solid var(--cf-panel-border);
      border-radius: var(--cf-radius-sm); overflow: hidden; background: #fff;
    }
    .qc-amount span {
      display: inline-flex; align-items: center; padding: 0 0.55rem;
      background: var(--cf-slate-50); color: var(--cf-slate-500); border-right: 1px solid var(--cf-panel-border);
    }
    .qc-amount input { border: 0; flex: 1; border-radius: 0; }
    .qc-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; }
    .qc-results {
      list-style: none; margin: 0; padding: 0; border: 1px solid var(--cf-panel-border);
      border-radius: var(--cf-radius); max-height: 200px; overflow: auto;
    }
    .qc-result {
      width: 100%; text-align: left; border: 0; background: transparent; cursor: pointer;
      padding: 0.65rem 0.75rem; border-bottom: 1px solid var(--cf-slate-100); display: grid; gap: 0.1rem;
    }
    .qc-result:last-child { border-bottom: 0; }
    .qc-result.highlighted, .qc-result:hover { background: var(--cf-indigo-soft); }
    .qc-result.selected { background: var(--cf-indigo-soft); }
    .qc-result span, .qc-result small { color: var(--cf-muted); font-size: 0.82rem; }
    .qc-recent { display: grid; gap: 0.45rem; }
    .qc-recent__label { font-size: 0.78rem; color: var(--cf-muted); font-weight: 600; }
    .qc-recent__chips { display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .qc-recent-chip {
      border: 1px solid var(--cf-panel-border); background: var(--cf-slate-50);
      border-radius: 999px; padding: 0.35rem 0.7rem; font-size: 0.82rem; cursor: pointer;
    }
    .qc-recent-chip:hover { border-color: var(--cf-primary); color: var(--cf-primary); }
    .qc-selected {
      padding: 0.75rem; border-radius: var(--cf-radius); background: var(--cf-slate-50);
      border: 1px solid var(--cf-panel-border);
    }
    .qc-selected__head { display: flex; justify-content: space-between; gap: 0.75rem; align-items: flex-start; }
    .qc-selected span { display: block; color: var(--cf-muted); font-size: 0.82rem; margin-top: 0.1rem; }
    .qc-selected__meta { margin: 0.45rem 0 0; font-size: 0.84rem; color: var(--cf-slate-700); }
    .qc-link { border: 0; background: none; padding: 0; color: var(--cf-primary); font-size: 0.82rem; cursor: pointer; }
    .qc-suggestions { display: grid; gap: 0.4rem; }
    .qc-suggestions__label { font-size: 0.78rem; color: var(--cf-muted); font-weight: 600; }
    .qc-suggestions__chips { display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .qc-suggestion-chip {
      border: 1px solid var(--cf-panel-border); background: #fff; border-radius: 999px;
      padding: 0.35rem 0.65rem; font-size: 0.8rem; cursor: pointer;
    }
    .qc-suggestion-chip.active, .qc-suggestion-chip:hover {
      border-color: var(--cf-primary); background: var(--cf-indigo-soft);
    }
    .qc-check { display: inline-flex; align-items: center; gap: 0.45rem; font-size: 0.85rem; color: var(--cf-slate-700); cursor: pointer; }
    .qc-check input { width: auto; }
    .qc-check--footer { margin-right: auto; }
    .qc-upi {
      padding: 0.75rem; border: 1px dashed var(--cf-panel-border); border-radius: var(--cf-radius);
      display: grid; gap: 0.45rem; justify-items: center; text-align: center;
    }
    .qc-upi__hint { margin: 0; font-size: 0.84rem; color: var(--cf-muted); }
    .qc-upi img { border-radius: var(--cf-radius-sm); background: #fff; padding: 0.35rem; }
    .qc-alert { margin: 0; padding: 0.65rem 0.75rem; border-radius: var(--cf-radius-sm); font-size: 0.85rem; }
    .qc-alert--error { background: var(--cf-critical-soft); color: var(--cf-critical); border: 1px solid #fecaca; }
    .qc-success {
      padding: 1rem; border-radius: var(--cf-radius); border: 1px solid var(--cf-forest-soft);
      background: linear-gradient(180deg, #f0fdf4 0%, #fff 100%); display: grid; gap: 0.75rem;
    }
    .qc-success__icon {
      width: 2.2rem; height: 2.2rem; border-radius: 999px; background: var(--cf-forest);
      color: #fff; display: inline-flex; align-items: center; justify-content: center; font-weight: 700;
    }
    .qc-success h3 { margin: 0; font-size: 1rem; }
    .qc-success__details { margin: 0; display: grid; gap: 0.45rem; }
    .qc-success__details div { display: flex; justify-content: space-between; gap: 1rem; font-size: 0.88rem; }
    .qc-success__details dt { margin: 0; color: var(--cf-muted); font-weight: 500; }
    .qc-success__details dd { margin: 0; font-weight: 600; text-align: right; }
    .qc-success__hint { margin: 0; font-size: 0.82rem; color: var(--cf-slate-600); line-height: 1.4; }
    .qc-success__actions { display: flex; flex-wrap: wrap; gap: 0.45rem; }
    .qc-activity {
      border: 1px solid var(--cf-panel-border); border-radius: var(--cf-radius);
      padding: 0.75rem; background: var(--cf-slate-50); min-height: 180px;
    }
    .qc-activity__title { margin: 0 0 0.65rem; font-size: 0.78rem; font-weight: 650; color: var(--cf-muted); text-transform: uppercase; letter-spacing: 0.05em; }
    .qc-activity__empty { margin: 0; font-size: 0.82rem; color: var(--cf-muted); }
    .qc-activity__list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.55rem; }
    .qc-activity__row { display: flex; justify-content: space-between; gap: 0.5rem; font-size: 0.84rem; }
    .qc-activity__meta { display: flex; justify-content: space-between; gap: 0.5rem; font-size: 0.75rem; color: var(--cf-muted); margin-top: 0.1rem; }
    .qc-footer__actions { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-left: auto; }
    .cf-btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }
    @media (max-width: 720px) {
      .qc-workspace { grid-template-columns: 1fr; }
      .qc-grid { grid-template-columns: 1fr; }
      .qc-check--footer { width: 100%; }
      .qc-footer__actions { width: 100%; justify-content: flex-end; }
    }
  `]
})
export class QuickCollectDrawerComponent implements OnInit {
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;
  @ViewChild('amountInput') amountInput?: ElementRef<HTMLInputElement>;

  private readonly quickCollectService = inject(QuickCollectService);
  private readonly familyService = inject(FamilyService);
  private readonly donationsService = inject(DonationsService);
  private readonly receiptPrintService = inject(ReceiptPrintService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly search$ = new Subject<string>();
  private autoResetTimer: ReturnType<typeof setTimeout> | null = null;

  isOpen = false;
  phase: CollectPhase = 'collect';
  searchQuery = '';
  searchResults: Family[] = [];
  highlightedIndex = -1;
  recentFamilies: QuickCollectRecentFamily[] = [];
  selectedFamily: Family | null = null;
  familyProfile: DonationFamilyFinancialProfile | null = null;
  funds: Array<{ id: string; name: string; code: string }> = [];
  fundId = '';
  collectType: CollectType = 'general';
  payerName = '';
  amount: number | null = null;
  method = 'cash';
  paymentDate = new Date().toISOString().slice(0, 10);
  notes = '';
  generateReceipt = true;
  keepQuickCollectOpen = true;
  saving = false;
  submitAttempted = false;
  error: string | null = null;
  lastPaymentId: string | null = null;
  receiptPreview: DonationReceiptPreview | null = null;
  upiIntent: UpiPaymentIntent | null = null;
  upiLoading = false;
  allocationOptions: AllocationOption[] = [];
  selectedAllocation: AllocationOption | null = null;
  activityRows: ActivityRow[] = [];
  lastSuccess: {
    familyName: string;
    amount: number;
    categoryLabel: string;
    receiptGenerated: boolean;
    receiptNumber?: string | null;
  } | null = null;

  get canSubmit(): boolean {
    return !!this.selectedFamily
      && !!this.payerName.trim()
      && !!this.amount
      && this.amount > 0
      && !!this.fundId;
  }

  get submitLabel(): string {
    if (this.saving) {
      return 'Recording…';
    }
    if (this.error) {
      return 'Error — try again';
    }
    return 'Record payment';
  }

  ngOnInit(): void {
    this.keepQuickCollectOpen = this.quickCollectService.getKeepOpen();
    this.method = this.quickCollectService.getDefaultMethod();
    this.recentFamilies = this.quickCollectService.getRecentFamilies();

    this.quickCollectService.open$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.openDrawer());

    this.quickCollectService.openForFamily$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((familyId) => {
        this.openDrawer();
        this.familyService.getFamily(familyId).subscribe({
          next: (response) => {
            if (response?.data) {
              this.selectFamily(response.data);
            }
          },
          error: () => {
            this.error = 'Unable to load family. Please search manually.';
            this.toastService.error(this.error, 'Quick Collect');
          }
        });
      });

    this.search$.pipe(
      debounceTime(150),
      distinctUntilChanged(),
      switchMap((query) => {
        const trimmed = query.trim();
        if (!trimmed) {
          return of({ data: [] as Family[] });
        }
        return this.familyService.getFamilies({ search: trimmed, status: 'active', per_page: 8 });
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (response) => {
        this.searchResults = response?.data ?? [];
        this.highlightedIndex = this.searchResults.length ? 0 : -1;
      },
      error: () => {
        this.searchResults = [];
        this.error = 'Unable to search families. Please try again.';
      }
    });
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (!this.isOpen || event.key !== 'Escape') {
      return;
    }
    event.preventDefault();
    this.close();
  }

  onDrawerKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || this.phase !== 'collect' || !this.canSubmit || this.saving) {
      return;
    }
    const target = event.target as HTMLElement;
    if (target.tagName === 'TEXTAREA') {
      return;
    }
    if (this.searchResults.length && !this.selectedFamily) {
      return;
    }
    event.preventDefault();
    this.submit();
  }

  onSearchKeydown(event: KeyboardEvent): void {
    if (!this.searchResults.length) {
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.highlightedIndex = Math.min(this.highlightedIndex + 1, this.searchResults.length - 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.highlightedIndex = Math.max(this.highlightedIndex - 1, 0);
    } else if (event.key === 'Enter' && this.highlightedIndex >= 0) {
      event.preventDefault();
      this.selectFamily(this.searchResults[this.highlightedIndex]);
    }
  }

  openDrawer(): void {
    this.isOpen = true;
    this.phase = 'collect';
    this.error = null;
    this.recentFamilies = this.quickCollectService.getRecentFamilies();
    this.loadFunds();
    this.loadRecentActivity();
    setTimeout(() => this.searchInput?.nativeElement.focus(), 0);
  }

  close(): void {
    this.clearAutoReset();
    this.isOpen = false;
  }

  onSearchChange(value: string): void {
    this.error = null;
    this.search$.next(value);
  }

  selectRecentFamily(family: QuickCollectRecentFamily): void {
    this.selectFamily({
      id: family.id,
      family_name: family.family_name,
      family_code: family.family_code,
      head_of_family: family.head_of_family,
      tenant_id: '',
      status: 'active'
    } as Family);
  }

  selectFamily(family: Family): void {
    this.selectedFamily = family;
    this.payerName = family.head_of_family || family.family_name;
    this.searchResults = [];
    this.highlightedIndex = -1;
    this.searchQuery = family.family_name;
    this.familyProfile = null;
    this.error = null;
    this.selectedAllocation = null;
    this.quickCollectService.rememberFamily(family);
    this.recentFamilies = this.quickCollectService.getRecentFamilies();

    this.donationsService.getFamilyFinancialProfile(family.id).subscribe({
      next: (res) => {
        this.familyProfile = res.data ?? null;
        if (!this.fundId && this.funds.length) {
          this.fundId = this.funds[0].id;
        }
        this.allocationOptions = this.buildAllocationOptions(this.familyProfile);
        if (this.familyProfile && !this.amount) {
          const pending = this.familyProfile.totals.pending_due;
          this.amount = pending > 0 ? pending : null;
        }
        this.refreshUpiIntent();
        setTimeout(() => this.amountInput?.nativeElement.focus(), 0);
      },
      error: () => {
        this.error = 'Unable to load family financial details.';
      }
    });
  }

  clearFamily(): void {
    this.selectedFamily = null;
    this.familyProfile = null;
    this.allocationOptions = [];
    this.selectedAllocation = null;
    this.searchQuery = '';
    setTimeout(() => this.searchInput?.nativeElement.focus(), 0);
  }

  applyAllocation(option: AllocationOption): void {
    this.selectedAllocation = option;
    this.collectType = option.type;
    this.amount = option.amount;
    if (option.allocatable_type === 'fund') {
      this.fundId = option.allocatable_id;
    }
    this.refreshUpiIntent();
    this.amountInput?.nativeElement.focus();
  }

  onAmountChange(value: number | null): void {
    this.amount = value;
    this.refreshUpiIntent();
  }

  onMethodChange(method: string): void {
    this.method = method;
    this.quickCollectService.setDefaultMethod(method);
    this.refreshUpiIntent();
  }

  onKeepOpenChange(value: boolean): void {
    this.quickCollectService.setKeepOpen(value);
  }

  submit(): void {
    if (!this.canSubmit || !this.selectedFamily || this.saving) {
      this.submitAttempted = true;
      if (!this.fundId) {
        this.error = 'Select a contribution category.';
      } else if (!this.amount || this.amount <= 0) {
        this.error = 'Enter a valid amount.';
      }
      return;
    }

    this.saving = true;
    this.submitAttempted = true;
    this.error = null;

    const payload: Record<string, unknown> = {
      family_id: this.selectedFamily.id,
      payer_name: this.payerName.trim(),
      payment_date: this.paymentDate,
      amount: this.amount,
      method: this.mapMethodForApi(this.method),
      source_type: this.collectType === 'offering' ? 'voluntary' : 'general',
      notes: this.notes.trim() || null
    };

    const allocations = this.buildAllocations();
    if (allocations?.length) {
      payload['allocations'] = allocations;
    }

    this.donationsService.createPayment(payload).subscribe({
      next: (res: { success: boolean; message: string; data?: DonationPayment }) => {
        this.saving = false;
        this.lastPaymentId = res.data?.id ?? null;
        const categoryLabel = this.funds.find((fund) => fund.id === this.fundId)?.name || 'Contribution';
        this.lastSuccess = {
          familyName: this.selectedFamily!.family_name,
          amount: this.amount!,
          categoryLabel,
          receiptGenerated: this.generateReceipt,
          receiptNumber: null
        };

        this.toastService.success('Payment recorded successfully.', 'Quick Collect');
        this.loadRecentActivity();
        this.phase = 'success';
        this.cdr.markForCheck();

        if (this.lastPaymentId) {
          this.donationsService.getReceiptPreview(this.lastPaymentId).subscribe({
            next: (preview: { success: boolean; data: DonationReceiptPreview }) => {
              this.receiptPreview = preview.data;
              this.lastSuccess = {
                ...this.lastSuccess!,
                receiptGenerated: !!preview.data,
                receiptNumber: preview.data?.receipt?.receipt_number ?? null
              };
              this.cdr.markForCheck();
            },
            error: () => {
              this.cdr.markForCheck();
            }
          });
        }
      },
      error: (err: { error?: { message?: string; errors?: Record<string, string[]> } }) => {
        this.saving = false;
        this.error = this.parseApiError(err) || 'Unable to save payment. Please try again.';
        this.toastService.error(this.error, 'Quick Collect');
        this.cdr.markForCheck();
        console.error('Quick Collect payment failed', err);
      }
    });
  }

  collectAnother(): void {
    this.clearAutoReset();
    this.resetForNext();
  }

  printReceipt(): void {
    if (!this.lastPaymentId) {
      return;
    }
    this.receiptPrintService.printPaymentReceipt(this.lastPaymentId);
  }

  viewReceipt(): void {
    if (!this.lastPaymentId) {
      return;
    }
    this.receiptPrintService.viewPaymentReceipt(this.lastPaymentId);
  }

  methodLabel(method: string): string {
    const labels: Record<string, string> = {
      cash: 'Cash',
      bank_transfer: 'Bank',
      cheque: 'Cheque',
      upi: 'UPI',
      online_placeholder: 'Online',
      adjustment: 'Adjustment'
    };
    return labels[method] || method;
  }

  private buildAllocationOptions(profile: DonationFamilyFinancialProfile | null): AllocationOption[] {
    if (!profile) {
      return [];
    }
    const options: AllocationOption[] = [];
    for (const due of profile.mandatory_contributions?.outstanding_dues?.slice(0, 3) ?? []) {
      options.push({
        label: due.plan?.name || due.period_label || 'Mandatory due',
        amount: due.outstanding_amount ?? Math.max(0, due.amount_due - due.amount_paid),
        type: 'mandatory',
        allocatable_type: 'due',
        allocatable_id: due.id
      });
    }
    for (const installment of profile.project_contributions?.outstanding_installments?.slice(0, 2) ?? []) {
      options.push({
        label: `${installment.project_name || 'Project'} · ${installment.installment_label}`,
        amount: installment.outstanding_amount,
        type: 'project',
        allocatable_type: 'project_installment',
        allocatable_id: installment.id
      });
    }
    if (this.fundId) {
      const fund = this.funds.find((item) => item.id === this.fundId);
      if (fund) {
        options.unshift({
          label: fund.name,
          amount: profile.totals.pending_due > 0 ? profile.totals.pending_due : 500,
          type: 'general',
          allocatable_type: 'fund',
          allocatable_id: fund.id
        });
      }
    }
    return options;
  }

  private buildAllocations(): Array<{ allocatable_type: string; allocatable_id: string; amount: number }> | undefined {
    if (this.selectedAllocation) {
      return [{
        allocatable_type: this.selectedAllocation.allocatable_type,
        allocatable_id: this.selectedAllocation.allocatable_id,
        amount: Number(this.amount)
      }];
    }
    if (this.fundId) {
      return [{
        allocatable_type: 'fund',
        allocatable_id: this.fundId,
        amount: Number(this.amount)
      }];
    }
    return undefined;
  }

  private mapMethodForApi(method: string): string {
    return method === 'upi' ? 'online_placeholder' : method;
  }

  private refreshUpiIntent(): void {
    if (this.method !== 'upi' || !this.selectedFamily || !this.amount || this.amount <= 0) {
      this.upiIntent = null;
      return;
    }

    this.upiLoading = true;
    this.donationsService.getUpiIntent(this.amount, this.selectedFamily.id).subscribe({
      next: (res) => {
        this.upiIntent = res.data ?? null;
        this.upiLoading = false;
      },
      error: () => {
        this.upiIntent = { available: false, message: 'Unable to generate UPI QR right now.' };
        this.upiLoading = false;
      }
    });
  }

  private loadFunds(): void {
    this.donationsService.getFunds().subscribe({
      next: (res) => {
        this.funds = res.data || [];
        if (!this.fundId && this.funds.length) {
          this.fundId = this.funds[0].id;
        }
        if (this.familyProfile) {
          this.allocationOptions = this.buildAllocationOptions(this.familyProfile);
        }
      },
      error: () => {
        this.toastService.error('Unable to load contribution categories.', 'Quick Collect');
      }
    });
  }

  private loadRecentActivity(): void {
    const today = new Date().toISOString().slice(0, 10);
    this.donationsService.getPayments({ payment_date_from: today, payment_date_to: today, per_page: '8' }).subscribe({
      next: (res) => {
        const rows = res.data?.data ?? [];
        this.activityRows = rows.map((payment) => ({
          id: payment.id,
          family_name: payment.family?.family_name || payment.payer_name || 'Family',
          amount: payment.amount,
          method: payment.method,
          time_label: this.formatTime(payment.created_at || payment.payment_date),
          status: payment.status
        }));
      },
      error: () => {
        this.activityRows = [];
      }
    });
  }

  private formatTime(value?: string): string {
    if (!value) {
      return 'Today';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Today';
    }
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  private clearAutoReset(): void {
    if (this.autoResetTimer) {
      clearTimeout(this.autoResetTimer);
      this.autoResetTimer = null;
    }
  }

  private resetForNext(): void {
    this.phase = 'collect';
    this.selectedFamily = null;
    this.familyProfile = null;
    this.searchQuery = '';
    this.payerName = '';
    this.amount = null;
    this.notes = '';
    this.receiptPreview = null;
    this.lastPaymentId = null;
    this.lastSuccess = null;
    this.error = null;
    this.submitAttempted = false;
    this.collectType = 'general';
    this.allocationOptions = [];
    this.selectedAllocation = null;
    this.upiIntent = null;
    this.searchResults = [];
    this.highlightedIndex = -1;
    setTimeout(() => this.searchInput?.nativeElement.focus(), 0);
  }

  private parseApiError(err: { error?: { message?: string; errors?: Record<string, string[]> } }): string {
    const errors = err?.error?.errors;
    if (errors) {
      const firstField = Object.keys(errors)[0];
      const firstMessage = firstField ? errors[firstField]?.[0] : undefined;
      if (firstMessage) {
        return firstMessage;
      }
    }
    if (err?.error?.message && err.error.message !== 'Validation error') {
      return err.error.message;
    }
    return 'Unable to save payment. Please try again.';
  }
}
