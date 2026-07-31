import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, Subject, switchMap } from 'rxjs';
import { QuickCollectService } from '../services/quick-collect.service';
import { CommandCenterDataService } from './services/command-center-data.service';
import { FinancialCommandCenterPayload, DioceseRollupDashboard } from '../models/donation.model';
import { refreshStewardshipView, setupStewardshipRouteReload } from '../utils/stewardship-view.util';
import { isFocLayerVisible } from './utils/foc-format.util';
import { FocCommandBarComponent } from './components/foc-command-bar/foc-command-bar.component';
import { FocHealthZoneComponent } from './components/foc-health-zone/foc-health-zone.component';
import { FocActionCenterComponent } from './components/foc-action-center/foc-action-center.component';
import { FocAnalyticsCenterComponent } from './components/foc-analytics-center/foc-analytics-center.component';
import { FocSatellitesGridComponent } from './components/foc-satellites-grid/foc-satellites-grid.component';
import { FocRollupPanelComponent } from './components/foc-rollup-panel/foc-rollup-panel.component';
import { FocExpenseModalComponent, FocExpenseFormValue, FocExpenseSubmitPayload } from './components/foc-expense-modal/foc-expense-modal.component';
import { ParishExpenseRecord } from '../models/donation.model';

@Component({
  selector: 'app-financial-command-center',
  standalone: true,
  imports: [
    CommonModule,
    FocCommandBarComponent,
    FocHealthZoneComponent,
    FocActionCenterComponent,
    FocAnalyticsCenterComponent,
    FocSatellitesGridComponent,
    FocRollupPanelComponent,
    FocExpenseModalComponent
  ],
  templateUrl: './financial-command-center.page.html',
  styleUrls: ['./financial-command-center.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FinancialCommandCenterPageComponent implements OnInit {
  private readonly dataService = inject(CommandCenterDataService);
  private readonly quickCollectService = inject(QuickCollectService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload$ = new Subject<void>();

  data: FinancialCommandCenterPayload | null = null;
  rollup: DioceseRollupDashboard | null = null;
  dashboardView: 'local' | 'rollup' = 'local';
  loading = true;
  error: string | null = null;
  period = 'month';
  showExpenseForm = false;
  expenseSaving = false;
  expenseSubmittedRecord: ParishExpenseRecord | null = null;
  expenseRecordedAt: string | null = null;
  expenseForm: FocExpenseFormValue = this.createEmptyExpenseForm();

  get currencyCode(): string {
    return this.data?.meta?.currency_code || this.data?.tenant_context?.currency_code || 'INR';
  }

  get monthExpenses(): number {
    return this.data?.expense_summary?.month_total ?? 0;
  }

  get monthCollected(): number {
    return this.data?.period_collections?.current_month_collected
      ?? this.data?.executive_cards?.find((card) => card.key === 'month_collected')?.value
      ?? 0;
  }

  get expenseRatioPct(): number {
    return this.data?.expense_summary?.expense_ratio_pct ?? 0;
  }

  get operatorName(): string {
    return this.data?.meta?.operator_name || 'Administrator';
  }

  get operatorRole(): string {
    return this.data?.meta?.operator_role || this.data?.persona?.label?.replace(/\s*View$/i, '') || 'Administrator';
  }

  get financialYear(): string | null {
    return this.data?.meta?.financial_year ?? null;
  }

  ngOnInit(): void {
    setupStewardshipRouteReload(this.router, this.destroyRef, '/donations', () => this.reload());

    this.reload$.pipe(
      switchMap(() => {
        this.loading = !this.data;
        this.error = null;
        refreshStewardshipView(this.cdr);
        return this.dataService.loadCommandCenter(this.period);
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (payload) => {
        this.data = payload;
        this.dashboardView = this.data?.persona?.default_dashboard_view === 'rollup' ? 'rollup' : 'local';
        this.loading = false;
        this.loadRollupIfNeeded();
        refreshStewardshipView(this.cdr);
      },
      error: () => {
        this.error = 'Unable to load the financial command center.';
        this.loading = false;
        refreshStewardshipView(this.cdr);
      }
    });

    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((event) => {
      if (event.urlAfterRedirects.split('?')[0].replace(/\/$/, '').endsWith('/donations')) {
        this.reload();
      }
    });

    this.reload();
  }

  onPeriodChange(period: string): void {
    this.period = period;
    this.reload();
  }

  reload(): void {
    this.reload$.next();
  }

  openQuickCollect(): void {
    this.quickCollectService.open();
  }

  scrollToAdvisor(): void {
    document.getElementById('foc-ai-advisor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  showLayer(layer: string): boolean {
    return isFocLayerVisible(this.data?.persona?.sections, layer);
  }

  setDashboardView(view: 'local' | 'rollup'): void {
    this.dashboardView = view;
    refreshStewardshipView(this.cdr);
  }

  private loadRollupIfNeeded(): void {
    if (!this.showLayer('diocese_rollup') && !this.data?.tenant_context?.supports_child_rollup) {
      return;
    }
    this.dataService.loadRollup().subscribe({
      next: (rollup) => {
        this.rollup = rollup;
        refreshStewardshipView(this.cdr);
      }
    });
  }

  scrollToSection(sectionId: string): void {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  runQuickAction(actionId: string): void {
    switch (actionId) {
      case 'collect':
        this.openQuickCollect();
        break;
      case 'attention':
      case 'rollup':
        this.scrollToSection('foc-action-center');
        break;
      case 'projects':
        void this.router.navigate(['/donations/projects']);
        break;
      case 'reports':
      case 'forecast':
        void this.router.navigate(['/donations/reports'], { queryParams: { period: this.period } });
        break;
      case 'receipts':
        void this.router.navigate(['/donations/receipts']);
        break;
      case 'parishes':
        this.setDashboardView('rollup');
        break;
      case 'dashboard':
        this.reload();
        break;
      default:
        break;
    }
  }

  submitExpense(payload: FocExpenseSubmitPayload): void {
    if (!payload.category || (payload.status === 'recorded' && (!payload.amount || !payload.payee?.trim()))) {
      return;
    }
    this.expenseSaving = true;
    refreshStewardshipView(this.cdr);
    this.dataService.createExpense({
      category: payload.category,
      amount: payload.amount,
      expense_date: payload.expense_date,
      payee: payload.payee?.trim() || undefined,
      method: payload.method,
      notes: this.buildExpenseNotes(payload),
      status: payload.status,
      currency: this.currencyCode
    }).subscribe({
      next: (record) => {
        this.expenseSaving = false;
        this.expenseSubmittedRecord = record;
        this.expenseRecordedAt = new Date().toISOString();
        this.reload();
        refreshStewardshipView(this.cdr);
      },
      error: () => {
        this.expenseSaving = false;
        refreshStewardshipView(this.cdr);
      }
    });
  }

  closeExpenseModal(): void {
    this.showExpenseForm = false;
    this.expenseSubmittedRecord = null;
    this.expenseRecordedAt = null;
    this.expenseForm = this.createEmptyExpenseForm();
    refreshStewardshipView(this.cdr);
  }

  recordAnotherExpense(): void {
    this.expenseSubmittedRecord = null;
    this.expenseRecordedAt = null;
    this.expenseForm = this.createEmptyExpenseForm();
    refreshStewardshipView(this.cdr);
  }

  private createEmptyExpenseForm(): FocExpenseFormValue {
    return {
      category: '',
      amount: null,
      expense_date: new Date().toISOString().slice(0, 10),
      payee: '',
      method: 'cash',
      notes: '',
      phone: '',
      reference_number: '',
      invoice_number: '',
      cheque_number: ''
    };
  }

  private buildExpenseNotes(form: FocExpenseSubmitPayload): string | undefined {
    const lines: string[] = [];
    if (form.notes?.trim()) {
      lines.push(form.notes.trim());
    }
    const meta: string[] = [];
    if (form.phone?.trim()) {
      meta.push(`Phone: ${form.phone.trim()}`);
    }
    if (form.reference_number?.trim()) {
      meta.push(`Reference: ${form.reference_number.trim()}`);
    }
    if (form.invoice_number?.trim()) {
      meta.push(`Invoice: ${form.invoice_number.trim()}`);
    }
    if (form.cheque_number?.trim()) {
      meta.push(`Cheque: ${form.cheque_number.trim()}`);
    }
    if (meta.length) {
      lines.push(meta.join(' · '));
    }
    return lines.length ? lines.join('\n\n') : undefined;
  }
}
