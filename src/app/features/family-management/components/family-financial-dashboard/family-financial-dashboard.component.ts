import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { QuickCollectService } from '@features/donations/services/quick-collect.service';
import { ReceiptPrintService } from '@features/donations/services/receipt-print.service';
import { FinancialActivityTimelineComponent } from '@features/donations/components/financial-activity-timeline/financial-activity-timeline.component';
import {
  ContributionDue,
  DonationFamilyFinancialProfile,
  FamilyContributionPlanSummary
} from '@features/donations/models/donation.model';

type DashboardSection = 'breakdown' | 'projects' | 'donations' | 'analytics';

@Component({
  selector: 'app-family-financial-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FinancialActivityTimelineComponent],
  template: `
    <section class="family-financial-dashboard cf-panel" *ngIf="profile">
      <header class="dashboard-header">
        <div>
          <h3>Family Financial Relationship</h3>
          <p class="subtitle">Outstanding balances, giving activity, and next steps — at a glance.</p>
        </div>
        <button type="button" class="cf-btn" (click)="refresh.emit()">Refresh</button>
      </header>

      <article
        class="health-strip"
        [class]="financialStatusClass"
        role="status"
        [attr.aria-label]="financialStatusTitle + '. ' + financialStatusHint"
      >
        <div class="health-badge">
          <strong>{{ financialStatusTitle }}</strong>
          <p class="health-hint">{{ financialStatusHint }}</p>
        </div>
      </article>

      <div class="cf-decision-strip" role="region" aria-label="Suggested next step">
        <div class="cf-decision-strip__copy">
          <strong>{{ primaryDecision }}</strong>
          <span>{{ primaryDecisionHint }}</span>
        </div>
        <div class="cf-decision-strip__actions">
          <button type="button" class="cf-btn cf-btn-primary" (click)="collectForFamily()">Collect Payment</button>
          <button type="button" class="cf-btn" (click)="printStatement()">Print Statement</button>
        </div>
      </div>

      <div class="quick-kpis cf-kpi-grid">
        <article class="kpi cf-kpi"><span>Outstanding</span><strong>{{ formatCurrency(profile.outstanding_balances?.total || profile.totals.pending_due) }}</strong></article>
        <article class="kpi cf-kpi"><span>Overdue</span><strong>{{ formatCurrency(profile.totals.overdue_amount || 0) }}</strong></article>
        <article class="kpi cf-kpi"><span>Total Paid</span><strong>{{ formatCurrency(profile.totals.total_paid) }}</strong></article>
        <article class="kpi cf-kpi"><span>Punctuality</span><strong>{{ profile.analytics?.punctuality?.score || 0 }}%</strong></article>
      </div>

      <article class="contribution-plans-panel cf-panel">
        <header class="contribution-plans-panel__header">
          <div>
            <h4>Contribution Plans</h4>
            <p>Active plan assignments and payment progress for this family.</p>
          </div>
        </header>

        <table class="table cf-table contribution-plans-table" *ngIf="contributionPlans.length">
          <thead>
            <tr>
              <th>Plan</th>
              <th>Assigned</th>
              <th>Paid</th>
              <th>Outstanding</th>
              <th>Installments</th>
              <th>Next Due</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let plan of contributionPlans">
              <td>
                <strong>{{ plan.plan_name || plan.plan_id }}</strong>
                <span class="plan-meta">{{ plan.plan_code || '—' }} · {{ plan.frequency || '—' }}</span>
              </td>
              <td>{{ formatCurrency(plan.assigned_amount) }}</td>
              <td>{{ formatCurrency(plan.amount_paid) }}</td>
              <td>{{ formatCurrency(plan.outstanding_balance ?? plan.amount_pending) }}</td>
              <td>{{ plan.installment_count || 0 }}</td>
              <td>{{ plan.next_due_date ? (plan.next_due_date | date) : '—' }}</td>
              <td><span class="badge" [ngClass]="planStatusClass(plan.status)">{{ planStatusLabel(plan.status) }}</span></td>
            </tr>
          </tbody>
        </table>

        <div class="contribution-plans-empty" *ngIf="!contributionPlans.length">
          <p class="empty-note">No contribution plans are assigned to this family yet.</p>
          <a routerLink="/donations/plans" class="cf-btn">Manage Contribution Plans</a>
        </div>

        <div class="outstanding-dues-block" *ngIf="outstandingDues.length">
          <h5>Outstanding Period Dues</h5>
          <table class="table cf-table">
            <thead><tr><th>Period</th><th>Due Date</th><th>Outstanding</th><th>Status</th></tr></thead>
            <tbody>
              <tr *ngFor="let due of outstandingDues">
                <td>{{ due.plan?.name || due.period_label }}</td>
                <td>{{ due.due_date | date }}</td>
                <td>{{ formatCurrency(due.outstanding_amount ?? ((due.amount_due || 0) - (due.amount_paid || 0))) }}</td>
                <td><span class="badge" [class.overdue]="due.is_overdue">{{ due.is_overdue ? 'Overdue' : due.status }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <app-financial-activity-timeline
        class="activity-feed"
        subjectType="family"
        [subjectId]="profile.family_id"
        title="Activity Feed"
      ></app-financial-activity-timeline>

      <div class="cf-disclosure">
        <button type="button" class="cf-disclosure__trigger" (click)="toggleSection('breakdown')">
          <strong>Balance by Type</strong>
          <span>{{ isExpanded('breakdown') ? 'Hide' : 'Show' }}</span>
        </button>
        <div class="cf-disclosure__body" *ngIf="isExpanded('breakdown')">
          <div class="split-grid">
            <div>
              <h4>Collected</h4>
              <ul class="metric-list">
                <li>Mandatory: {{ formatCurrency(profile.totals.mandatory_paid) }}</li>
                <li>Projects: {{ formatCurrency(profile.totals.project_paid) }}</li>
                <li>Voluntary: {{ formatCurrency(profile.totals.voluntary_paid || profile.totals.voluntary_collected) }}</li>
                <li>Net position: {{ formatCurrency(profile.totals.net) }}</li>
              </ul>
            </div>
            <div>
              <h4>Outstanding</h4>
              <ul class="metric-list">
                <li>Mandatory: {{ formatCurrency(profile.outstanding_balances?.mandatory || profile.totals.pending_mandatory_due) }}</li>
                <li>Mandatory overdue: {{ formatCurrency(profile.outstanding_balances?.mandatory_overdue) }}</li>
                <li>Project balance: {{ formatCurrency(profile.outstanding_balances?.project) }}</li>
                <li>Project installments: {{ formatCurrency(profile.outstanding_balances?.project_installments || profile.totals.pending_project_due) }}</li>
                <li>Voluntary pledged: {{ formatCurrency(profile.outstanding_balances?.voluntary_pledged) }}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div class="cf-disclosure" *ngIf="hasProjects">
        <button type="button" class="cf-disclosure__trigger" (click)="toggleSection('projects')">
          <strong>Projects & Campaigns</strong>
          <span>{{ profile.project_contributions?.projects?.length || 0 }} active</span>
        </button>
        <div class="cf-disclosure__body" *ngIf="isExpanded('projects')">
        <div class="panel">
          <h4>Special Project Contributions</h4>
          <table class="table" *ngIf="profile.project_contributions?.projects?.length">
            <thead><tr><th>Project</th><th>Assigned</th><th>Collected</th><th>Balance</th><th>Installments</th><th>Status</th></tr></thead>
            <tbody>
              <tr *ngFor="let project of profile.project_contributions?.projects">
                <td>{{ project.project_name }}</td>
                <td>{{ project.target_amount | number:'1.2-2' }}</td>
                <td>{{ project.amount_collected | number:'1.2-2' }}</td>
                <td>{{ project.outstanding_amount | number:'1.2-2' }}</td>
                <td>
                  Paid {{ project.installment_status?.paid || 0 }} /
                  Pending {{ project.installment_status?.pending || 0 }} /
                  Overdue {{ project.installment_status?.overdue || 0 }}
                </td>
                <td>{{ project.status }}</td>
              </tr>
            </tbody>
          </table>
          <table class="table" *ngIf="profile.project_contributions?.installment_ledger?.length">
            <thead><tr><th>Installment</th><th>Due</th><th>Paid</th><th>Outstanding</th><th>Status</th></tr></thead>
            <tbody>
              <tr *ngFor="let row of profile.project_contributions?.installment_ledger">
                <td>{{ row.project_name }} — {{ row.installment_label }}</td>
                <td>{{ row.due_date | date }}</td>
                <td>{{ row.amount_paid | number:'1.2-2' }}</td>
                <td>{{ row.outstanding_amount | number:'1.2-2' }}</td>
                <td><span class="badge" [class.overdue]="row.is_overdue">{{ row.is_overdue ? 'Overdue' : row.status }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
        </div>
      </div>

      <div class="cf-disclosure" *ngIf="hasDonations">
        <button type="button" class="cf-disclosure__trigger" (click)="toggleSection('donations')">
          <strong>Donations & Offerings</strong>
          <span>{{ profile.donations_offerings?.lifetime_collected || profile.totals.voluntary_collected || 0 | number:'1.2-2' }} lifetime</span>
        </button>
        <div class="cf-disclosure__body" *ngIf="isExpanded('donations')">
        <div class="panel">
          <div class="mini-metrics">
            <span>Lifetime {{ profile.donations_offerings?.lifetime_collected || 0 | number:'1.2-2' }}</span>
            <span>FY {{ profile.donations_offerings?.financial_year || profile.financial_year }}: {{ profile.donations_offerings?.current_financial_year_collected || 0 | number:'1.2-2' }}</span>
            <span>Last gift: {{ profile.donations_offerings?.last_donation_date ? (profile.donations_offerings?.last_donation_date | date) : '—' }}</span>
          </div>
          <table class="table" *ngIf="profile.donations_offerings?.by_category?.length">
            <thead><tr><th>Category</th><th>Collected</th></tr></thead>
            <tbody>
              <tr *ngFor="let row of profile.donations_offerings?.by_category">
                <td>{{ row.category_name }}</td>
                <td>{{ row.collected | number:'1.2-2' }}</td>
              </tr>
            </tbody>
          </table>
          <table class="table" *ngIf="profile.donations_offerings?.recent_donations?.length || profile.voluntary_donations?.recent_donations?.length">
            <thead><tr><th>Donation</th><th>Donor</th><th>Collected</th><th>Date</th></tr></thead>
            <tbody>
              <tr *ngFor="let donation of profile.donations_offerings?.recent_donations || profile.voluntary_donations?.recent_donations">
                <td>{{ donation.title || donation.category || 'Donation' }}</td>
                <td>{{ donation.is_anonymous ? 'Anonymous' : (donation.donor || 'Donor') }}</td>
                <td>{{ donation.collected_amount | number:'1.2-2' }}</td>
                <td>{{ donation.received_at | date }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        </div>
      </div>

      <div class="cf-disclosure">
        <button type="button" class="cf-disclosure__trigger" (click)="toggleSection('analytics')">
          <strong>Analytics & Trends</strong>
          <span>Rank #{{ profile.analytics?.ranking?.by_total_giving || '-' }}</span>
        </button>
        <div class="cf-disclosure__body" *ngIf="isExpanded('analytics')">
        <div class="panel">
          <div class="split-grid">
            <div>
              <h4>Punctuality Score</h4>
              <p class="score">{{ profile.analytics?.punctuality?.score || 0 }}% — {{ profile.analytics?.punctuality?.label || 'N/A' }}</p>
              <ul class="metric-list">
                <li>Evaluated periods: {{ profile.analytics?.punctuality?.evaluated_periods || 0 }}</li>
                <li>Paid on time: {{ profile.analytics?.punctuality?.paid_on_time || 0 }}</li>
                <li>Open overdue: {{ profile.analytics?.punctuality?.overdue_open || 0 }}</li>
              </ul>
            </div>
            <div>
              <h4>Family Ranking</h4>
              <ul class="metric-list">
                <li>Rank by giving: #{{ profile.analytics?.ranking?.by_total_giving || '-' }} of {{ profile.analytics?.ranking?.participating_families || 0 }}</li>
                <li>Percentile: {{ profile.analytics?.ranking?.percentile || 0 }}%</li>
                <li>Total giving: {{ profile.analytics?.ranking?.total_paid || 0 | number:'1.2-2' }}</li>
              </ul>
            </div>
            <div>
              <h4>Comparison</h4>
              <ul class="metric-list">
                <li>Tenant average: {{ profile.analytics?.comparison?.tenant_average_giving || 0 | number:'1.2-2' }}</li>
                <li>Tenant median: {{ profile.analytics?.comparison?.tenant_median_giving || 0 | number:'1.2-2' }}</li>
                <li>Vs average: {{ profile.analytics?.comparison?.vs_average_pct || 0 }}%</li>
                <li>Vs median: {{ profile.analytics?.comparison?.vs_median_pct || 0 }}%</li>
              </ul>
            </div>
          </div>
          <h4>Contribution Trend (12 months)</h4>
          <table class="table" *ngIf="profile.analytics?.trend?.length">
            <thead><tr><th>Period</th><th>Mandatory</th><th>Projects</th><th>Voluntary</th><th>Total</th></tr></thead>
            <tbody>
              <tr *ngFor="let row of profile.analytics?.trend">
                <td>{{ row.label }}</td>
                <td>{{ row.mandatory_paid | number:'1.2-2' }}</td>
                <td>{{ row.project_paid | number:'1.2-2' }}</td>
                <td>{{ row.voluntary_paid | number:'1.2-2' }}</td>
                <td>{{ row.total_paid | number:'1.2-2' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        </div>
      </div>

    </section>
  `,
  styles: [`
    .family-financial-dashboard { margin-bottom: 0; }
    .dashboard-header { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; margin-bottom: 0.85rem; }
    .subtitle { margin: 0.2rem 0 0; color: var(--cf-muted); font-size: 0.92rem; }
    .quick-kpis { margin-bottom: 0.85rem; }
    .panel { margin-top: 0; }
    .split-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; }
    .section-head { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; align-items: center; margin-bottom: 0.65rem; }
    .mini-metrics { display: flex; flex-wrap: wrap; gap: 0.75rem; color: var(--cf-slate-700); font-size: 0.92rem; }
    .metric-list { margin: 0; padding-left: 1.1rem; color: var(--cf-slate-700); }
    .metric-list li + li { margin-top: 0.25rem; }
    .badge { display: inline-block; padding: 0.15rem 0.45rem; border-radius: 999px; background: var(--cf-indigo-soft); color: var(--cf-indigo); font-size: 0.78rem; }
    .badge.overdue { background: var(--cf-critical-soft); color: var(--cf-critical); }
    .score { font-size: 1.2rem; font-weight: 700; margin: 0.2rem 0 0.6rem; color: var(--cf-slate-900); }
    .health-strip { display: flex; padding: 0.75rem 0.9rem; border-radius: var(--cf-radius); margin-bottom: 0.85rem; border: 1px solid var(--cf-indigo-soft); background: var(--cf-slate-50); }
    .health-strip.healthy { border-color: var(--cf-forest-soft); background: var(--cf-forest-soft); }
    .health-strip.attention { border-color: var(--cf-amber-soft); background: var(--cf-amber-soft); }
    .health-strip.risk { border-color: var(--cf-critical-soft); background: var(--cf-critical-soft); }
    .health-badge { display: grid; gap: 0.2rem; min-width: 0; }
    .health-badge strong { font-size: 1rem; color: var(--cf-slate-900); }
    .health-hint { margin: 0; font-size: 0.88rem; color: var(--cf-slate-700); line-height: 1.45; }
    .empty-note { color: var(--cf-muted); margin: 0.5rem 0 0; }
    .contribution-plans-panel { margin-bottom: 0.85rem; display: grid; gap: 0.85rem; }
    .activity-feed { display: block; margin-bottom: 0.85rem; }
    .contribution-plans-panel__header h4 { margin: 0; font-size: 1rem; color: var(--cf-slate-900); }
    .contribution-plans-panel__header p { margin: 0.2rem 0 0; color: var(--cf-muted); font-size: 0.88rem; }
    .contribution-plans-table .plan-meta { display: block; color: var(--cf-muted); font-size: 0.78rem; margin-top: 0.1rem; }
    .outstanding-dues-block { display: grid; gap: 0.5rem; }
    .outstanding-dues-block h5 { margin: 0; font-size: 0.9rem; color: var(--cf-slate-900); }
    .badge.active { background: var(--cf-forest-soft); color: var(--cf-forest); }
    .badge.completed { background: var(--cf-indigo-soft); color: var(--cf-indigo); }
    .badge.inactive { background: var(--cf-slate-100); color: var(--cf-muted); }
    .contribution-plans-empty { display: grid; gap: 0.65rem; justify-items: start; padding: 0.5rem 0; }
  `]
})
export class FamilyFinancialDashboardComponent {
  @Input({ required: true }) profile!: DonationFamilyFinancialProfile;
  @Output() refresh = new EventEmitter<void>();

  private expandedSections = new Set<DashboardSection>();

  constructor(
    private quickCollectService: QuickCollectService,
    private receiptPrintService: ReceiptPrintService
  ) {}

  get contributionPlans(): FamilyContributionPlanSummary[] {
    return this.profile?.mandatory_contributions?.contribution_plans
      ?? this.profile?.mandatory_contributions?.plan_summaries
      ?? [];
  }

  get outstandingDues(): Array<ContributionDue & { is_overdue?: boolean }> {
    return this.profile?.mandatory_contributions?.outstanding_dues ?? [];
  }

  get hasProjects(): boolean {
    const projects = this.profile?.project_contributions;
    return !!(projects?.projects?.length || projects?.installment_ledger?.length);
  }

  get hasDonations(): boolean {
    const donations = this.profile?.donations_offerings;
    const recent = donations?.recent_donations?.length || this.profile?.voluntary_donations?.recent_donations?.length;
    return !!(
      (donations?.lifetime_collected ?? 0) > 0
      || (donations?.current_financial_year_collected ?? 0) > 0
      || donations?.by_category?.length
      || recent
    );
  }

  get currencyCode(): string {
    return this.profile?.currency || 'INR';
  }

  get hasOverdue(): boolean {
    return (this.profile?.totals.overdue_amount ?? 0) > 0
      || (this.profile?.mandatory_contributions?.totals?.overdue_amount ?? 0) > 0;
  }

  get totalOutstanding(): number {
    return this.profile?.outstanding_balances?.total ?? this.profile?.totals.pending_due ?? 0;
  }

  get totalPaid(): number {
    return this.profile?.totals.total_paid ?? 0;
  }

  get financialStatusClass(): 'healthy' | 'attention' | 'risk' {
    if (this.hasOverdue) {
      return 'risk';
    }
    if (this.totalOutstanding > 0) {
      return 'attention';
    }
    return 'healthy';
  }

  get financialStatusTitle(): string {
    if (this.hasOverdue) {
      return 'Overdue contributions';
    }
    if (this.totalOutstanding > 0) {
      return 'Balance due';
    }
    if (this.totalPaid > 0) {
      return 'Up to date';
    }
    if (this.contributionPlans.length > 0) {
      return 'Payments expected';
    }
    return 'Not yet enrolled';
  }

  get financialStatusHint(): string {
    if (this.hasOverdue) {
      const overdue = this.profile?.totals.overdue_amount ?? this.profile?.mandatory_contributions?.totals?.overdue_amount ?? 0;
      return `${this.formatCurrency(overdue)} is past the due date. ${this.formatCurrency(this.totalOutstanding)} total outstanding.`;
    }
    if (this.totalOutstanding > 0) {
      if (this.totalPaid > 0) {
        return `${this.formatCurrency(this.totalOutstanding)} still owed · ${this.formatCurrency(this.totalPaid)} collected so far.`;
      }
      return `${this.formatCurrency(this.totalOutstanding)} owed on assigned contribution plans.`;
    }
    if (this.totalPaid > 0) {
      return `${this.formatCurrency(this.totalPaid)} collected. No outstanding balance on assigned plans.`;
    }
    if (this.contributionPlans.length > 0) {
      return 'Plans are assigned but no payments have been recorded yet.';
    }
    return 'Assign contribution plans to start tracking this family\'s giving.';
  }

  get primaryDecision(): string {
    const outstanding = this.profile?.outstanding_balances?.total ?? this.profile?.totals.pending_due ?? 0;
    if (this.hasOverdue) {
      return 'Collect overdue balance or send a reminder';
    }
    if (outstanding > 0) {
      return `${this.formatAmount(outstanding)} outstanding — collect when ready`;
    }
    return 'Family is up to date — thank or engage';
  }

  get primaryDecisionHint(): string {
    if (this.profile?.recommended_actions?.length) {
      return this.profile.recommended_actions[0];
    }
    if (this.profile?.ai_insights?.length) {
      return this.profile.ai_insights[0];
    }
    if (this.hasOverdue) {
      return 'Overdue items affect the family health score.';
    }
    return 'Use Collect Payment for Sunday collections or special gifts.';
  }

  isExpanded(section: DashboardSection): boolean {
    return this.expandedSections.has(section);
  }

  toggleSection(section: DashboardSection): void {
    if (this.expandedSections.has(section)) {
      this.expandedSections.delete(section);
    } else {
      this.expandedSections.add(section);
    }
  }

  private formatAmount(value: number): string {
    return this.formatCurrency(value);
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

  planStatusLabel(status: string): string {
    switch (status) {
      case 'overdue':
        return 'Overdue';
      case 'completed':
        return 'Completed';
      case 'inactive':
        return 'Inactive';
      default:
        return 'Active';
    }
  }

  planStatusClass(status: string): string {
    switch (status) {
      case 'overdue':
        return 'overdue';
      case 'completed':
        return 'completed';
      case 'inactive':
        return 'inactive';
      default:
        return 'active';
    }
  }

  collectForFamily(): void {
    this.quickCollectService.openForFamily(this.profile.family_id);
  }

  printStatement(): void {
    this.receiptPrintService.printFamilyStatement(this.profile.family_id);
  }
}
