import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, OnInit } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { FamilyService } from '@core/services/family.service';
import { Family } from '@core/models/family.model';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { DonationsService } from '../services/donations.service';
import { QuickCollectService } from '../services/quick-collect.service';
import { DonationCategory, DonationEntry, DonationReceiptPreview, Donor } from '../models/donation.model';
import { refreshStewardshipView, setupStewardshipRouteReload } from '../utils/stewardship-view.util';
import { localDateOnly } from '../utils/local-date-only';

@Component({
  selector: 'app-donations-register',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, CfEmptyStateComponent],
  template: `
    <section class="register cf-page">
      <header class="cf-hero">
        <h1>Today's Offerings</h1>
        <p>Record voluntary gifts and pledges — Quick Collect handles most Sunday collections.</p>
      </header>

      <div class="cf-decision-strip" role="region" aria-label="Suggested next step">
        <div class="cf-decision-strip__copy">
          <strong>{{ openPledgeCount }} open pledge{{ openPledgeCount === 1 ? '' : 's' }}</strong>
          <span>{{ decisionHint }}</span>
        </div>
        <div class="cf-decision-strip__actions">
          <button type="button" class="cf-btn cf-btn-primary" (click)="openQuickCollect()">Collect Payment</button>
          <a routerLink="/donations/collection-day" class="cf-btn">Collection Day</a>
        </div>
      </div>

      <details class="cf-disclosure" role="group" *ngIf="canCollect">
        <summary class="cf-disclosure__trigger">
          <strong>Record voluntary donation</strong>
          <span>Full form for pledges, anonymous gifts, and categories</span>
        </summary>
        <div class="cf-disclosure__body">
      <form [formGroup]="collectForm" (ngSubmit)="collect()" class="collect-form cf-form-grid">
        <select formControlName="donation_id" (change)="onPledgeSelected()">
          <option value="">New donation</option>
          <option *ngFor="let entry of pledgedEntries" [value]="entry.id">
            {{ entry.title || entry.category?.name || 'Pledge' }} — Outstanding {{ outstanding(entry) | number:'1.2-2' }}
          </option>
        </select>

        <select formControlName="family_id">
          <option value="">No family link</option>
          <option *ngFor="let family of families" [value]="family.id">{{ family.family_name }}</option>
        </select>

        <select formControlName="donation_category_id" [attr.disabled]="collectForm.value.donation_id ? true : null">
          <option value="">Select category</option>
          <option *ngFor="let cat of categories" [value]="cat.id">{{ cat.name }}</option>
        </select>
        <input formControlName="title" placeholder="Title (optional)" [readonly]="!!collectForm.value.donation_id" />
        <input formControlName="amount" type="number" placeholder="Amount" />
        <select formControlName="method">
          <option value="cash">Cash</option>
          <option value="bank_transfer">Bank Transfer</option>
          <option value="cheque">Cheque</option>
          <option value="online_placeholder">Online</option>
        </select>
        <input formControlName="payment_date" type="date" />

        <select formControlName="donor_id">
          <option value="">New / walk-in donor</option>
          <option *ngFor="let donor of donors" [value]="donor.id">{{ donor.name }}</option>
        </select>
        <input *ngIf="!collectForm.value.donor_id && !collectForm.value.is_anonymous" formControlName="donor_name" placeholder="Donor name" />
        <input *ngIf="!collectForm.value.is_anonymous" formControlName="donor_email" placeholder="Donor email" />
        <select formControlName="donor_type">
          <option value="external">External Donor</option>
          <option value="individual">Individual</option>
          <option value="family">Family</option>
          <option value="organization">Organization</option>
        </select>

        <label class="checkbox"><input type="checkbox" formControlName="is_anonymous" /> Anonymous donation</label>
        <button type="submit" class="cf-btn cf-btn-primary" [disabled]="collectForm.invalid || saving">{{ saving ? 'Collecting...' : 'Collect Donation' }}</button>
      </form>
        </div>
      </details>

      <p *ngIf="message" class="cf-state" [class.cf-state--success]="message !== 'Failed to collect donation.'" [class.cf-state--error]="message === 'Failed to collect donation.'">{{ message }}</p>

      <div *ngIf="lastReceipt" class="receipt-preview cf-preview">
        <h3>Receipt {{ lastReceipt.receipt.receipt_number }}</h3>
        <p><strong>Payer:</strong> {{ lastReceipt.payer.name }}</p>
        <p><strong>Amount:</strong> {{ lastReceipt.totals.amount | number:'1.2-2' }} {{ lastReceipt.totals.currency }}</p>
        <p *ngIf="lastReceipt.tax_acknowledgement.has_tax_deductible_portion">
          Tax-deductible portion: {{ lastReceipt.tax_acknowledgement.tax_deductible_amount | number:'1.2-2' }}
        </p>
        <p *ngIf="lastReceipt.tax_acknowledgement.note">{{ lastReceipt.tax_acknowledgement.note }}</p>
      </div>

      <div class="toolbar cf-filters cf-panel">
        <input [(ngModel)]="searchTerm" (ngModelChange)="loadEntries()" placeholder="Search title..." />
        <select [(ngModel)]="statusFilter" (change)="loadEntries()">
          <option value="">All Status</option>
          <option value="pledged">Pledged</option>
          <option value="partially_paid">Partially Paid</option>
          <option value="paid">Paid</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <label class="checkbox"><input type="checkbox" [(ngModel)]="anonymousOnly" (change)="loadEntries()" /> Anonymous only</label>
        <button *ngIf="canExport" type="button" class="cf-btn" (click)="export()">Export</button>
      </div>

      <table class="table cf-table" *ngIf="entries.length">
        <thead>
          <tr>
            <th>Title / Category</th>
            <th>Donor</th>
            <th>Status</th>
            <th>Pledged</th>
            <th>Collected</th>
            <th>Anonymous</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let row of entries">
            <td>{{ row.title || row.category?.name || '-' }}</td>
            <td>{{ row.is_anonymous ? 'Anonymous' : (row.donor?.name || '-') }}</td>
            <td>{{ row.status }}</td>
            <td>{{ row.pledged_amount | number:'1.2-2' }}</td>
            <td>{{ row.collected_amount | number:'1.2-2' }}</td>
            <td>{{ row.is_anonymous ? 'Yes' : 'No' }}</td>
          </tr>
        </tbody>
      </table>

      <app-cf-empty-state
        *ngIf="!entries.length"
        icon="♡"
        title="No offerings recorded yet"
        description="Collect a voluntary gift using Quick Collect, or expand the form above for pledges and anonymous donations."
      >
        <button type="button" class="cf-btn cf-btn-primary" (click)="openQuickCollect()">Collect Payment</button>
      </app-cf-empty-state>
    </section>
  `,
  styles: [`
    .checkbox { display: flex; align-items: center; gap: 0.4rem; font-size: 0.9rem; }
    details summary { list-style: none; cursor: pointer; }
    details summary::-webkit-details-marker { display: none; }
  `]
})
export class DonationsRegisterComponent implements OnInit {
  categories: DonationCategory[] = [];
  donors: Donor[] = [];
  families: Family[] = [];
  entries: DonationEntry[] = [];
  pledgedEntries: DonationEntry[] = [];
  lastReceipt: DonationReceiptPreview | null = null;
  saving = false;
  canCollect = false;
  canExport = false;
  message = '';
  searchTerm = '';
  statusFilter = '';
  anonymousOnly = false;

  collectForm = this.fb.group({
    donation_id: [''],
    family_id: [''],
    donation_category_id: [''],
    title: [''],
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    method: ['cash', Validators.required],
    payment_date: [localDateOnly(), Validators.required],
    donor_id: [''],
    donor_name: [''],
    donor_email: [''],
    donor_type: ['external'],
    is_anonymous: [false]
  });

  constructor(
    private fb: FormBuilder,
    private donationsService: DonationsService,
    private familyService: FamilyService,
    private authService: AuthService,
    private quickCollectService: QuickCollectService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private destroyRef: DestroyRef
  ) {}

  ngOnInit(): void {
    this.canCollect = this.authService.hasPermission('donations.collect');
    this.canExport = this.authService.hasAnyPermission(['donations.reports', 'donations.export']);
    this.donationsService.getCategories().subscribe({
      next: (res) => {
        this.categories = res.data ?? [];
        refreshStewardshipView(this.cdr);
      }
    });
    this.donationsService.getDonors().subscribe({
      next: (res) => {
        this.donors = res.data?.data ?? [];
        refreshStewardshipView(this.cdr);
      }
    });
    this.familyService.getFamilies({ per_page: 100, status: 'active' }).subscribe({
      next: (res) => {
        this.families = res.data ?? [];
        refreshStewardshipView(this.cdr);
      }
    });
    this.loadEntries();
    this.loadPledgedEntries();
    setupStewardshipRouteReload(this.router, this.destroyRef, '/donations/register', () => {
      this.loadEntries();
      this.loadPledgedEntries();
    });
  }

  openQuickCollect(): void {
    this.quickCollectService.open();
  }

  get openPledgeCount(): number {
    return this.pledgedEntries.length;
  }

  get decisionHint(): string {
    if (this.openPledgeCount > 0) {
      return 'Fulfill open pledges from the form below or via family Quick Collect.';
    }
    return 'Most Sunday gifts are fastest through Collect Payment or Collection Day.';
  }

  outstanding(entry: DonationEntry): number {
    return Math.max(Number(entry.pledged_amount) - Number(entry.collected_amount), 0);
  }

  onPledgeSelected(): void {
    const donationId = this.collectForm.value.donation_id;
    if (!donationId) {
      return;
    }
    const entry = this.pledgedEntries.find((row) => row.id === donationId);
    if (!entry) {
      return;
    }
    this.collectForm.patchValue({
      title: entry.title || '',
      donation_category_id: entry.donation_category_id || '',
      family_id: entry.family_id || '',
      amount: this.outstanding(entry)
    });
  }

  loadEntries(): void {
    const filters: Record<string, string | boolean> = {};
    if (this.statusFilter) filters['status'] = this.statusFilter;
    if (this.searchTerm.trim()) filters['search'] = this.searchTerm.trim();
    if (this.anonymousOnly) filters['anonymous_only'] = true;
    this.donationsService.getDonationEntries(filters).subscribe({
      next: (res) => {
        this.entries = res.data?.data ?? [];
        refreshStewardshipView(this.cdr);
      }
    });
  }

  loadPledgedEntries(): void {
    this.donationsService.getDonationEntries({ status: 'pledged' }).subscribe({
      next: (res) => {
        const pledged = res.data?.data ?? [];
        this.donationsService.getDonationEntries({ status: 'partially_paid' }).subscribe({
          next: (partial) => {
            this.pledgedEntries = [...pledged, ...(partial.data?.data ?? [])];
            refreshStewardshipView(this.cdr);
          }
        });
      }
    });
  }

  collect(): void {
    if (this.collectForm.invalid) return;
    this.saving = true;
    this.message = '';
    this.lastReceipt = null;
    const raw = this.collectForm.getRawValue();
    const payload: Record<string, unknown> = {
      ...raw,
      payer_name: raw.is_anonymous ? 'Anonymous Donor' : (raw.donor_name || undefined)
    };
    ['donor_id', 'donation_category_id', 'donation_id', 'family_id'].forEach((key) => {
      if (!payload[key]) delete payload[key];
    });

    this.donationsService.collectVoluntaryDonation(payload).subscribe({
      next: (res) => {
        this.saving = false;
        this.message = res.message || 'Donation collected.';
        const paymentId = res.data?.payment?.id;
        if (paymentId) {
          this.donationsService.getReceiptPreview(paymentId).subscribe({
            next: (receiptRes) => {
              this.lastReceipt = receiptRes.data;
              refreshStewardshipView(this.cdr);
            }
          });
        }
        this.collectForm.patchValue({
          donation_id: '',
          title: '',
          amount: null,
          donor_id: '',
          donor_name: '',
          donor_email: '',
          family_id: '',
          is_anonymous: false
        });
        this.loadEntries();
        this.loadPledgedEntries();
        refreshStewardshipView(this.cdr);
      },
      error: () => {
        this.saving = false;
        this.message = 'Failed to collect donation.';
        refreshStewardshipView(this.cdr);
      }
    });
  }

  export(): void {
    this.donationsService.exportReport({ report_type: 'donation_entries' }).subscribe();
  }
}
