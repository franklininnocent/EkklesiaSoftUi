import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, forkJoin, of, Subject, switchMap } from 'rxjs';
import { FamilyService } from '@core/services/family.service';
import { AuthService } from '@core/services/auth.service';
import { Family } from '@core/models/family.model';
import { DonationsService } from '../services/donations.service';
import { ReceiptPrintService } from '../services/receipt-print.service';
import {
  DonationDashboardSummary,
  DonationFamilyFinancialProfile,
  DonationPayment,
  DonationReceiptPreview,
  PaginatedResponse
} from '../models/donation.model';
import { refreshStewardshipView, setupStewardshipRouteReload } from '../utils/stewardship-view.util';
import { localDateOnly, requiresGatewayReference } from '../utils/local-date-only';

type CollectType = 'general' | 'mandatory' | 'project' | 'offering';
type SearchMode = 'name' | 'id' | 'mobile' | 'qr';

interface KpiCard {
  label: string;
  value: string;
  trend?: string;
  trendUp?: boolean;
  tone: 'indigo' | 'emerald' | 'amber' | 'violet' | 'sky' | 'rose';
  iconPath: string;
  sparkline: string;
}

interface ActivityFeedItem {
  type: 'payment' | 'alert';
  title: string;
  subtitle: string;
  time: string;
  amount?: number;
}

interface AmountSuggestion {
  label: string;
  amount: number;
}

interface AllocationRow {
  label: string;
  amount: number;
}

@Component({
  selector: 'app-collection-day',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './collection-day.component.html',
  styleUrls: ['./collection-day.component.scss']
})
export class CollectionDayComponent implements OnInit {
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;
  @ViewChild('amountInput') amountInput?: ElementRef<HTMLInputElement>;

  private readonly search$ = new Subject<string>();

  searchQuery = '';
  searchMode: SearchMode = 'name';
  searchResults: Family[] = [];
  selectedFamily: Family | null = null;
  familyProfile: DonationFamilyFinancialProfile | null = null;
  profileLoading = false;
  collectType: CollectType = 'general';
  payerName = '';
  amount: number | null = null;
  method = 'cash';
  gatewayReference = '';
  notes = '';
  saving = false;
  error: string | null = null;
  successMessage: string | null = null;
  receiptPreview: DonationReceiptPreview | null = null;
  lastPaymentId: string | null = null;
  sessionCount = 0;
  sessionTotal = 0;
  familiesProcessedToday = 0;
  todayPayments: DonationPayment[] = [];
  dashboardSummary: DonationDashboardSummary | null = null;
  sessionLoading = false;
  highlightedIndex = -1;
  quickActionsOpen = false;
  shortcutsOpen = false;
  currencyCode = 'INR';

  readonly searchModes: Array<{ id: SearchMode; label: string }> = [
    { id: 'name', label: 'Name' },
    { id: 'id', label: 'Family ID' },
    { id: 'mobile', label: 'Mobile' },
    { id: 'qr', label: 'QR Code' }
  ];

  readonly collectTypes: Array<{ id: CollectType; label: string; hint: string }> = [
    { id: 'general', label: 'General', hint: 'Flexible allocation' },
    { id: 'mandatory', label: 'Mandatory', hint: 'Plan contributions' },
    { id: 'project', label: 'Project', hint: 'Campaign / project' },
    { id: 'offering', label: 'Offering', hint: 'Voluntary gift' }
  ];

  readonly keyboardShortcuts = [
    { label: 'Search family', keys: '⌘ / Ctrl + K' },
    { label: 'Save collection', keys: 'Enter' },
    { label: 'Cancel / clear', keys: 'Esc' },
    { label: 'Focus amount', keys: 'F2' },
    { label: 'Focus payment method', keys: 'F3' },
    { label: 'Post collection', keys: 'F4' },
    { label: 'Show shortcuts', keys: '?' }
  ];

  private readonly iconPaths = {
    collections: 'M4 6h16v12H4V6zm2 2v8h12V8H6zm3 1h6v2H9V9zm0 3h4v2H9v-2z',
    amount: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z',
    pending: 'M12 2a10 10 0 100 20 10 10 0 000-20zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z',
    families: 'M16 11c1.66 0 3-1.34 3-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
    average: 'M3 17h2v-7H3v7zm4 0h2V7H7v10zm4 0h2v-4h-2v4zm4 0h2V4h-2v13zm4 0h2v-6h-2v6z',
    completion: 'M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z'
  };

  get canSubmit(): boolean {
    return !!this.selectedFamily
      && !!this.payerName.trim()
      && !!this.amount
      && this.amount > 0
      && (!this.needsReference || !!this.gatewayReference.trim());
  }

  get needsReference(): boolean {
    return requiresGatewayReference(this.method === 'upi' ? 'online_placeholder' : this.method);
  }

  get operatorName(): string {
    return this.authService.currentUserValue?.name || 'Operator';
  }

  get collectionDateLabel(): string {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date());
  }

  get sessionStatusLabel(): string {
    return 'Active';
  }

  get currencySymbol(): string {
    try {
      const parts = new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: this.currencyCode,
        currencyDisplay: 'narrowSymbol'
      }).formatToParts(0);
      return parts.find((part) => part.type === 'currency')?.value || '₹';
    } catch {
      return '₹';
    }
  }

  get searchPlaceholder(): string {
    switch (this.searchMode) {
      case 'id':
        return 'Search by family code or ID…';
      case 'mobile':
        return 'Search by mobile number…';
      case 'qr':
        return 'Paste or scan QR family reference…';
      default:
        return 'Search by family name…';
    }
  }

  get outstandingBalance(): number {
    return this.familyProfile?.outstanding_balances?.total
      ?? this.familyProfile?.totals.pending_due
      ?? 0;
  }

  get currentPlanLabel(): string {
    const plans = this.familyProfile?.mandatory_contributions?.contribution_plans
      ?? this.familyProfile?.mandatory_contributions?.plan_summaries
      ?? [];
    if (!plans.length) {
      return 'No active plan';
    }
    const primary = plans[0];
    return primary.plan_name || primary.plan_code || 'Assigned plan';
  }

  get lastPaymentLabel(): string {
    const ledger = this.familyProfile?.payment_history?.ledger
      ?? this.familyProfile?.recent_payments
      ?? [];
    const latest = ledger[0];
    if (!latest) {
      return 'No prior payment';
    }
    const date = latest.payment_date ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(latest.payment_date)) : '—';
    return `${this.formatCurrency(latest.amount)} · ${date}`;
  }

  get methodLabel(): string {
    switch (this.method) {
      case 'bank_transfer':
        return 'Bank Transfer';
      case 'cheque':
        return 'Cheque';
      case 'upi':
        return 'UPI / Digital';
      default:
        return 'Cash';
    }
  }

  get amountSuggestions(): AmountSuggestion[] {
    const suggestions: AmountSuggestion[] = [];
    const outstanding = this.outstandingBalance;
    if (outstanding > 0) {
      suggestions.push({ label: `Full balance (${this.formatCurrency(outstanding)})`, amount: outstanding });
    }
    const dues = this.familyProfile?.mandatory_contributions?.outstanding_dues ?? [];
    dues.slice(0, 2).forEach((due) => {
      const dueAmount = due.outstanding_amount ?? ((due.amount_due || 0) - (due.amount_paid || 0));
      if (dueAmount > 0) {
        suggestions.push({
          label: `${due.period_label || 'Period'} (${this.formatCurrency(dueAmount)})`,
          amount: dueAmount
        });
      }
    });
    return suggestions;
  }

  get allocationPreview(): AllocationRow[] {
    if (!this.amount || this.amount <= 0) {
      return [];
    }
    const rows: AllocationRow[] = [];
    if (this.collectType === 'mandatory' && this.outstandingBalance > 0) {
      rows.push({
        label: 'Mandatory contribution',
        amount: Math.min(this.amount, this.outstandingBalance)
      });
      if (this.amount > this.outstandingBalance) {
        rows.push({ label: 'Advance / credit', amount: this.amount - this.outstandingBalance });
      }
      return rows;
    }
    rows.push({
      label: this.collectType === 'general' || this.collectType === 'offering'
        ? 'Family credit (unallocated)'
        : (this.collectTypes.find((type) => type.id === this.collectType)?.label || 'Contribution'),
      amount: this.amount
    });
    return rows;
  }

  get pendingCollectionsCount(): number {
    return this.dashboardSummary?.attention_summary?.count
      ?? this.dashboardSummary?.families_requiring_attention?.length
      ?? 0;
  }

  get averageCollectionValue(): number {
    return this.sessionCount > 0 ? this.sessionTotal / this.sessionCount : 0;
  }

  get collectionTarget(): number {
    const monthCollected = this.dashboardSummary?.period_collections?.current_month_collected ?? 0;
    if (monthCollected > 0) {
      const dayOfMonth = new Date().getDate();
      const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
      return Math.max((monthCollected / Math.max(dayOfMonth, 1)) * daysInMonth * 0.15, this.sessionTotal || 1);
    }
    return Math.max(this.sessionTotal * 1.25, 1000);
  }

  get collectionRemaining(): number {
    return Math.max(this.collectionTarget - this.sessionTotal, 0);
  }

  get completionPercent(): number {
    if (this.collectionTarget <= 0) {
      return 0;
    }
    return Math.min(100, (this.sessionTotal / this.collectionTarget) * 100);
  }

  get gaugeArc(): string {
    const circumference = Math.PI * 48;
    const filled = (this.completionPercent / 100) * circumference;
    return `${filled} ${circumference}`;
  }

  get attentionFamilies(): NonNullable<DonationDashboardSummary['families_requiring_attention']> {
    return this.dashboardSummary?.families_requiring_attention ?? [];
  }

  get activityFeed(): ActivityFeedItem[] {
    const payments: ActivityFeedItem[] = this.todayPayments.slice(0, 12).map((payment) => ({
      type: 'payment' as const,
      title: payment.family?.family_name || payment.payer_name || 'Payment received',
      subtitle: `${payment.method} · ${payment.payment_number || 'Receipt pending'}`,
      time: this.formatTime(payment.created_at || payment.payment_date),
      amount: Number(payment.amount || 0)
    }));

    const alerts: ActivityFeedItem[] = this.attentionFamilies.slice(0, 3).map((family) => ({
      type: 'alert' as const,
      title: `${family.family_name || family.family_code} overdue`,
      subtitle: `${family.days_overdue} days · ${this.formatCurrency(family.overdue_amount)}`,
      time: 'Attention'
    }));

    return [...payments, ...alerts];
  }

  get kpiCards(): KpiCard[] {
    const spark = this.buildSparkline(this.todayPayments.map((payment) => Number(payment.amount || 0)));
    return [
      {
        label: "Today's Collections",
        value: String(this.sessionCount),
        trend: this.sessionCount > 0 ? 'Live session' : 'Awaiting first post',
        trendUp: this.sessionCount > 0,
        tone: 'indigo',
        iconPath: this.iconPaths.collections,
        sparkline: spark
      },
      {
        label: 'Total Collected',
        value: this.formatCurrency(this.sessionTotal),
        trend: this.formatTrend(this.sessionTotal),
        trendUp: true,
        tone: 'emerald',
        iconPath: this.iconPaths.amount,
        sparkline: spark
      },
      {
        label: 'Pending Collections',
        value: String(this.pendingCollectionsCount),
        trend: this.pendingCollectionsCount ? 'Requires follow-up' : 'Queue clear',
        trendUp: this.pendingCollectionsCount === 0,
        tone: 'amber',
        iconPath: this.iconPaths.pending,
        sparkline: spark
      },
      {
        label: 'Families Processed',
        value: String(this.familiesProcessedToday),
        trend: `${this.familiesProcessedToday} unique today`,
        trendUp: this.familiesProcessedToday > 0,
        tone: 'violet',
        iconPath: this.iconPaths.families,
        sparkline: spark
      },
      {
        label: 'Avg Collection',
        value: this.formatCurrency(this.averageCollectionValue),
        trend: this.sessionCount ? 'Per transaction' : '—',
        trendUp: true,
        tone: 'sky',
        iconPath: this.iconPaths.average,
        sparkline: spark
      },
      {
        label: 'Completion',
        value: `${this.completionPercent.toFixed(0)}%`,
        trend: `${this.formatCurrency(this.collectionRemaining)} remaining`,
        trendUp: this.completionPercent >= 50,
        tone: 'rose',
        iconPath: this.iconPaths.completion,
        sparkline: spark
      }
    ];
  }

  constructor(
    private readonly familyService: FamilyService,
    private readonly donationsService: DonationsService,
    private readonly receiptPrintService: ReceiptPrintService,
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly destroyRef: DestroyRef,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.refreshSession();
    this.loadCurrency();
    setupStewardshipRouteReload(this.router, this.destroyRef, '/donations/collection-day', () => this.refreshSession());

    this.search$.pipe(
      debounceTime(200),
      distinctUntilChanged(),
      switchMap((query) => {
        const trimmed = query?.trim() ?? '';
        if (!trimmed || trimmed.length < 2) {
          return of({ data: [] as Family[] });
        }
        return this.familyService.getFamilies({ search: this.normalizeSearchQuery(trimmed), status: 'active', per_page: 8 });
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((response) => {
      this.searchResults = response?.data ?? [];
      this.highlightedIndex = this.searchResults.length ? 0 : -1;
      refreshStewardshipView(this.cdr);
    });

    setTimeout(() => this.searchInput?.nativeElement.focus(), 0);
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.focusSearch();
      return;
    }

    if (event.key === '?' && !this.isTypingInField(event)) {
      event.preventDefault();
      this.openShortcuts();
      return;
    }

    if (this.shortcutsOpen && event.key === 'Escape') {
      event.preventDefault();
      this.closeShortcuts();
      return;
    }

    if (event.key === 'F2') {
      event.preventDefault();
      this.amountInput?.nativeElement.focus();
      return;
    }

    if (event.key === 'F3') {
      event.preventDefault();
      document.querySelector<HTMLSelectElement>('.coc-field select')?.focus();
      return;
    }

    if (event.key === 'F4') {
      event.preventDefault();
      if (this.canSubmit && !this.saving) {
        this.submit();
      }
      return;
    }

    if (event.key === 'Escape') {
      if (this.selectedFamily) {
        event.preventDefault();
        this.resetForNext();
        return;
      }
      void this.router.navigate(['/donations/payments']);
      return;
    }

    const target = event.target as HTMLElement | null;
    const tag = target?.tagName.toLowerCase() ?? '';
    const inField = tag === 'input' || tag === 'textarea' || tag === 'select';
    const inSearch = tag === 'input' && (target as HTMLInputElement).type === 'search';

    if (inSearch && this.searchResults.length) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.highlightedIndex = Math.min(this.highlightedIndex + 1, this.searchResults.length - 1);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        this.highlightedIndex = Math.max(this.highlightedIndex - 1, 0);
        return;
      }
      if (event.key === 'Enter' && this.highlightedIndex >= 0) {
        event.preventDefault();
        this.selectFamily(this.searchResults[this.highlightedIndex]);
        return;
      }
    }

    if (event.key === 'Enter' && this.canSubmit && !this.saving && !inSearch && !this.shortcutsOpen) {
      event.preventDefault();
      this.submit();
      return;
    }

    if (inField) {
      return;
    }
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.quickActionsOpen = false;
    refreshStewardshipView(this.cdr);
  }

  refreshSession(): void {
    this.sessionLoading = true;
    const today = localDateOnly();

    forkJoin({
      payments: this.donationsService.getPayments({ payment_date_from: today, payment_date_to: today, per_page: '200' }),
      dashboard: this.donationsService.getDashboardSummary()
    }).subscribe({
      next: ({ payments, dashboard }) => {
        const rows = payments.data?.data ?? [];
        this.todayPayments = rows;
        this.sessionCount = rows.length;
        this.sessionTotal = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
        this.familiesProcessedToday = new Set(rows.map((row) => row.family?.id).filter(Boolean)).size;
        this.dashboardSummary = dashboard.data ?? null;
        this.sessionLoading = false;
        refreshStewardshipView(this.cdr);
      },
      error: () => {
        this.sessionLoading = false;
        refreshStewardshipView(this.cdr);
      }
    });
  }

  onSearchChange(value: string): void {
    this.search$.next(value);
  }

  setSearchMode(mode: SearchMode): void {
    this.searchMode = mode;
    this.focusSearch();
    if (this.searchQuery.trim().length >= 2) {
      this.search$.next(this.searchQuery);
    }
  }

  setCollectType(type: CollectType): void {
    this.collectType = type;
    this.onAmountChange();
    setTimeout(() => this.amountInput?.nativeElement.focus(), 0);
  }

  selectFamily(family: Family): void {
    this.selectedFamily = family;
    this.payerName = family.head_of_family || family.family_name;
    this.searchResults = [];
    this.highlightedIndex = -1;
    this.searchQuery = family.family_name;
    this.error = null;
    this.successMessage = null;
    this.receiptPreview = null;
    this.profileLoading = true;
    refreshStewardshipView(this.cdr);

    this.donationsService.getFamilyFinancialProfile(family.id).subscribe({
      next: (res) => {
        this.familyProfile = res.data ?? null;
        this.profileLoading = false;
        if (this.outstandingBalance > 0 && !this.amount) {
          this.amount = this.outstandingBalance;
        }
        refreshStewardshipView(this.cdr);
        setTimeout(() => this.amountInput?.nativeElement.focus(), 0);
      },
      error: () => {
        this.profileLoading = false;
        refreshStewardshipView(this.cdr);
      }
    });
  }

  searchAndSelectAttentionFamily(family: NonNullable<DonationDashboardSummary['families_requiring_attention']>[number]): void {
    const query = family.family_code || family.family_name || '';
    this.searchQuery = query;
    this.searchMode = 'id';
    this.search$.next(query);
    this.familyService.getFamilies({ search: query, status: 'active', per_page: 1 }).subscribe({
      next: (response) => {
        const match = response.data?.[0];
        if (match) {
          this.selectFamily(match);
        }
      }
    });
  }

  applySuggestedAmount(suggestion: AmountSuggestion): void {
    this.amount = suggestion.amount;
    this.onAmountChange();
    this.amountInput?.nativeElement.focus();
  }

  onAmountChange(): void {
    this.error = null;
    refreshStewardshipView(this.cdr);
  }

  submit(): void {
    if (!this.canSubmit || !this.selectedFamily || !this.amount) {
      return;
    }

    this.saving = true;
    this.error = null;
    this.successMessage = null;
    refreshStewardshipView(this.cdr);
    const sourceType = this.collectType === 'offering' ? 'voluntary' : 'general';

    this.donationsService.createPayment({
      family_id: this.selectedFamily.id,
      payer_name: this.payerName.trim(),
      payment_date: localDateOnly(),
      amount: this.amount,
      method: this.method === 'upi' ? 'online_placeholder' : this.method,
      source_type: sourceType,
      notes: this.notes.trim() || undefined,
      ...(this.needsReference ? { gateway_reference: this.gatewayReference.trim() } : {})
    }).subscribe({
      next: (res) => {
        this.saving = false;
        this.successMessage = res.message || 'Collection posted successfully.';
        this.lastPaymentId = res.data?.id ?? null;
        this.refreshSession();
        if (this.lastPaymentId) {
          this.donationsService.getReceiptPreview(this.lastPaymentId).subscribe({
            next: (preview) => {
              this.receiptPreview = preview.data;
              refreshStewardshipView(this.cdr);
            }
          });
        }
        refreshStewardshipView(this.cdr);
        setTimeout(() => this.resetForNext(), 1800);
      },
      error: (err: { error?: { message?: string } }) => {
        this.saving = false;
        this.error = err?.error?.message || 'Unable to post collection.';
        refreshStewardshipView(this.cdr);
      }
    });
  }

  printReceipt(): void {
    if (this.lastPaymentId) {
      this.receiptPrintService.printPaymentReceipt(this.lastPaymentId);
    }
  }

  resetForNext(): void {
    this.selectedFamily = null;
    this.familyProfile = null;
    this.searchQuery = '';
    this.payerName = '';
    this.amount = null;
    this.notes = '';
    this.receiptPreview = null;
    this.lastPaymentId = null;
    this.successMessage = null;
    this.error = null;
    this.collectType = 'general';
    this.method = 'cash';
    this.gatewayReference = '';
    setTimeout(() => this.searchInput?.nativeElement.focus(), 0);
    refreshStewardshipView(this.cdr);
  }

  exportTodayCollections(): void {
    if (!this.todayPayments.length) {
      return;
    }
    const header = ['Receipt', 'Family', 'Payer', 'Amount', 'Method', 'Date'];
    const rows = this.todayPayments.map((payment) => [
      payment.payment_number,
      payment.family?.family_name || '',
      payment.payer_name,
      String(payment.amount),
      payment.method,
      payment.payment_date
    ]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `collection-day-${localDateOnly()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  toggleQuickActions(event?: Event): void {
    event?.stopPropagation();
    this.quickActionsOpen = !this.quickActionsOpen;
    refreshStewardshipView(this.cdr);
  }

  navigateTo(path: string): void {
    this.quickActionsOpen = false;
    void this.router.navigate([path]);
  }

  openShortcuts(): void {
    this.shortcutsOpen = true;
    refreshStewardshipView(this.cdr);
  }

  closeShortcuts(): void {
    this.shortcutsOpen = false;
    refreshStewardshipView(this.cdr);
  }

  focusSearch(): void {
    this.searchInput?.nativeElement.focus();
  }

  familyAreaLabel(family: Family): string {
    return family.city || family.bcc?.name || family.address_line_1 || 'Parish area';
  }

  familyInitials(family: Family): string {
    const parts = (family.family_name || 'F').trim().split(/\s+/).slice(0, 2);
    return parts.map((part) => part.charAt(0).toUpperCase()).join('') || 'F';
  }

  formatCurrency(value: number | null | undefined): string {
    const amount = Number(value ?? 0);
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: this.currencyCode,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount);
    } catch {
      return new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount);
    }
  }

  private loadCurrency(): void {
    this.donationsService.getSettings().subscribe({
      next: (res) => {
        this.currencyCode = res.data?.default_currency || 'INR';
        refreshStewardshipView(this.cdr);
      }
    });
  }

  private normalizeSearchQuery(query: string): string {
    if (this.searchMode === 'mobile') {
      return query.replace(/\s+/g, '');
    }
    if (this.searchMode === 'qr') {
      return query.replace(/^family[:#]/i, '').trim();
    }
    return query;
  }

  private formatTime(value?: string): string {
    if (!value) {
      return 'Today';
    }
    try {
      return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
    } catch {
      return 'Today';
    }
  }

  private formatTrend(amount: number): string {
    if (amount <= 0) {
      return 'No collections yet';
    }
    return `+${this.formatCurrency(amount)} today`;
  }

  private buildSparkline(values: number[]): string {
    const data = values.length ? values : [0, 0, 0, 0, 0];
    const max = Math.max(...data, 1);
    const width = 80;
    const height = 24;
    const step = data.length > 1 ? width / (data.length - 1) : width;
    return data
      .map((value, index) => {
        const x = Math.round(index * step);
        const y = Math.round(height - (value / max) * (height - 2)) - 1;
        return `${x},${y}`;
      })
      .join(' ');
  }

  private isTypingInField(event: KeyboardEvent): boolean {
    const target = event.target as HTMLElement | null;
    const tag = target?.tagName.toLowerCase() ?? '';
    return tag === 'input' || tag === 'textarea' || tag === 'select';
  }
}
