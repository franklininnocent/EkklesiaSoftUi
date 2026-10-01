import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { FamilyService } from '@core/services/family.service';
import { Family } from '@core/models/family.model';
import {
  AdvancedSearchPanelComponent,
  SearchField,
} from '@shared/components/advanced-search-panel/advanced-search-panel.component';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { CfIconActionButtonComponent } from '@shared/components/cf-icon-action-button/cf-icon-action-button.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { ListToolbarComponent } from '@shared/components/list-toolbar/list-toolbar.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { SortableDirective, SortDirection, SortEvent } from '@shared/directives/sortable.directive';
import { CfDatePipe } from '@shared/pipes/cf-date.pipe';
import { DonationsService } from '../services/donations.service';
import { QuickCollectService } from '../services/quick-collect.service';
import { ReceiptPrintService } from '../services/receipt-print.service';
import {
  DonationCategory,
  DonationEntry,
  DonationPayment,
  DonationReceiptPreview,
  Donor,
} from '../models/donation.model';
import { refreshStewardshipView, setupStewardshipRouteReload } from '../utils/stewardship-view.util';
import { localDateOnly } from '../utils/local-date-only';
import { CfCurrencyPipe } from '@shared/pipes/cf-currency.pipe';
import { CfFamilyPickerLabelPipe } from '@shared/pipes/cf-family-picker-label.pipe';
import { CfActionIconComponent } from '@shared/components/cf-action-icon/cf-action-icon.component';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';

type RegisterFilterChipKey = 'search' | 'status';
type RegisterSortColumn = 'payment_number' | 'payer_name' | 'payment_date' | 'method' | 'status' | 'amount';

@Component({
  selector: 'app-donations-register',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    CfEmptyStateComponent,
    CfCurrencyPipe,
    CfDatePipe,
    CfActionIconComponent,
    CfIconActionButtonComponent,
    PageHeaderComponent,
    ListToolbarComponent,
    AdvancedSearchPanelComponent,
    DataTableComponent,
    LoadingSkeletonComponent,
    SortableDirective,
    ModalShellComponent,
    CfFamilyPickerLabelPipe,
  ],
  templateUrl: './donations-register.component.html',
  styleUrls: ['./donations-register.component.scss', '../styles/stewardship-dashboard-shared.scss'],
})
export class DonationsRegisterComponent implements OnInit {
  categories: DonationCategory[] = [];
  donors: Donor[] = [];
  families: Family[] = [];
  payments: DonationPayment[] = [];
  displayPayments: DonationPayment[] = [];
  pledgedEntries: DonationEntry[] = [];
  lastReceipt: DonationReceiptPreview | null = null;
  saving = false;
  canCollect = false;
  canExport = false;
  message = '';
  searchTerm = '';
  statusFilter = '';
  paymentsLoading = false;
  showFilters = false;
  showVoluntaryDonationModal = false;
  searchFields: SearchField[] = [];
  sortColumn: RegisterSortColumn = 'payment_date';
  sortDirection: SortDirection = 'desc';

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
    is_anonymous: [false],
  });

  constructor(
    private fb: FormBuilder,
    private donationsService: DonationsService,
    private familyService: FamilyService,
    private authService: AuthService,
    private quickCollectService: QuickCollectService,
    private receiptPrintService: ReceiptPrintService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private destroyRef: DestroyRef
  ) {}

  ngOnInit(): void {
    this.canCollect = this.authService.hasPermission('donations.collect');
    this.canExport = this.authService.hasAnyPermission(['donations.reports', 'donations.export']);
    this.initSearchFields();
    this.donationsService.getCategories().subscribe({
      next: (res) => {
        this.categories = res.data ?? [];
        refreshStewardshipView(this.cdr);
      },
    });
    this.donationsService.getDonors().subscribe({
      next: (res) => {
        this.donors = res.data?.data ?? [];
        refreshStewardshipView(this.cdr);
      },
    });
    this.familyService.getFamilies({ per_page: 100, status: 'active' }).subscribe({
      next: (res) => {
        this.families = res.data ?? [];
        refreshStewardshipView(this.cdr);
      },
    });
    this.loadPayments();
    this.loadPledgedEntries();
    setupStewardshipRouteReload(this.router, this.destroyRef, '/donations/register', () => {
      this.loadPayments();
      this.loadPledgedEntries();
    });
  }

  get activeFilterCount(): number {
    let count = 0;
    if (this.searchTerm.trim()) count += 1;
    if (this.statusFilter) count += 1;
    return count;
  }

  get activeFilterChips(): { key: RegisterFilterChipKey; label: string }[] {
    const chips: { key: RegisterFilterChipKey; label: string }[] = [];
    if (this.searchTerm.trim()) {
      chips.push({ key: 'search', label: `Search: ${this.searchTerm.trim()}` });
    }
    if (this.statusFilter) {
      chips.push({ key: 'status', label: `Status: ${this.statusFilterLabel(this.statusFilter)}` });
    }
    return chips;
  }

  openQuickCollect(): void {
    this.quickCollectService.open();
  }

  openVoluntaryDonationModal(): void {
    this.showVoluntaryDonationModal = true;
  }

  closeVoluntaryDonationModal(): void {
    if (this.saving) {
      return;
    }
    this.showVoluntaryDonationModal = false;
  }

  outstanding(entry: DonationEntry): number {
    return Math.max(Number(entry.pledged_amount) - Number(entry.collected_amount), 0);
  }

  trackPayment(_index: number, payment: DonationPayment): string {
    return payment.id;
  }

  onSort(event: SortEvent): void {
    const allowed: RegisterSortColumn[] = [
      'payment_number',
      'payer_name',
      'payment_date',
      'method',
      'status',
      'amount',
    ];
    if (!allowed.includes(event.column as RegisterSortColumn)) {
      return;
    }
    this.sortColumn = event.column as RegisterSortColumn;
    this.sortDirection = event.direction ?? 'desc';
    this.loadPayments();
  }

  viewReceipt(paymentId: string): void {
    this.receiptPrintService.viewPaymentReceipt(paymentId);
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
      amount: this.outstanding(entry),
    });
  }

  onAdvancedSearch(values: { [key: string]: unknown }): void {
    this.searchTerm = String(values['search'] ?? '').trim();
    this.statusFilter = String(values['status'] ?? '').trim();
    this.showFilters = false;
    this.syncSearchFieldValues();
    this.loadPayments();
  }

  onClearAdvancedSearch(): void {
    this.searchTerm = '';
    this.statusFilter = '';
    this.showFilters = false;
    this.syncSearchFieldValues();
    this.loadPayments();
  }

  clearAllFilters(): void {
    this.onClearAdvancedSearch();
  }

  removeFilterChip(key: RegisterFilterChipKey): void {
    if (key === 'search') {
      this.searchTerm = '';
    } else if (key === 'status') {
      this.statusFilter = '';
    }
    this.syncSearchFieldValues();
    this.loadPayments();
  }

  loadPayments(): void {
    this.paymentsLoading = true;
    const filters: Record<string, string> = {
      today_only: '1',
      per_page: '100',
      sort: this.sortColumn,
      direction: this.sortDirection || 'desc',
    };
    if (this.statusFilter) {
      filters['status'] = this.statusFilter;
    }
    if (this.searchTerm.trim()) {
      filters['search'] = this.searchTerm.trim();
    }
    this.donationsService.getPayments(filters).subscribe({
      next: (res) => {
        this.payments = res.data?.data ?? [];
        this.displayPayments = this.payments;
        this.paymentsLoading = false;
        refreshStewardshipView(this.cdr);
      },
      error: () => {
        this.paymentsLoading = false;
        refreshStewardshipView(this.cdr);
      },
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
          },
        });
      },
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
      payer_name: raw.is_anonymous ? 'Anonymous Donor' : (raw.donor_name || undefined),
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
            },
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
          is_anonymous: false,
        });
        this.showVoluntaryDonationModal = false;
        this.loadPayments();
        this.loadPledgedEntries();
        refreshStewardshipView(this.cdr);
      },
      error: () => {
        this.saving = false;
        this.message = 'Failed to collect donation.';
        refreshStewardshipView(this.cdr);
      },
    });
  }

  export(): void {
    this.donationsService.exportReport({ report_type: 'donation_entries' }).subscribe();
  }

  private statusFilterLabel(status: string): string {
    return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private initSearchFields(): void {
    this.searchFields = [
      {
        key: 'search',
        label: 'Payment or payer',
        type: 'text',
        placeholder: 'Payment #, payer, or reference…',
        value: this.searchTerm.trim() || undefined,
      },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'pending', label: 'Pending' },
          { value: 'succeeded', label: 'Succeeded' },
          { value: 'failed', label: 'Failed' },
          { value: 'reversed', label: 'Reversed' },
          { value: 'refunded', label: 'Refunded' },
        ],
        value: this.statusFilter || undefined,
      },
    ];
  }

  private syncSearchFieldValues(): void {
    const search = this.searchFields.find((f) => f.key === 'search');
    const status = this.searchFields.find((f) => f.key === 'status');
    if (search) search.value = this.searchTerm.trim() || undefined;
    if (status) status.value = this.statusFilter || undefined;
  }
}
