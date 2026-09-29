import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { IfFeatureDirective } from '@shared/directives/if-feature.directive';
import { DonationsService } from '../services/donations.service';
import { QuickCollectService } from '../services/quick-collect.service';
import { ContributionDue, WhatsAppDeliverySummary, WhatsAppOutreachPreview } from '../models/donation.model';
import { refreshStewardshipView, setupStewardshipRouteReload } from '../utils/stewardship-view.util';
import { CfCurrencyPipe } from '@shared/pipes/cf-currency.pipe';
import { CfActionIconComponent } from '@shared/components/cf-action-icon/cf-action-icon.component';
@Component({
  selector: 'app-donations-dues',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, CfEmptyStateComponent, IfFeatureDirective, CfCurrencyPipe, CfActionIconComponent],
  template: `
    <section class="dues-page cf-page">
      <header class="cf-hero">
        <h1>Outstanding Contributions</h1>
        <p>See who owes what — then collect or send a reminder.</p>
      </header>

      <div class="cf-decision-strip" role="region" aria-label="Suggested next step" *ngIf="!loading">
        <div class="cf-decision-strip__copy">
          <strong>{{ overdueCount }} overdue · {{ outstandingTotal | cfCurrency }} outstanding</strong>
          <span>{{ decisionHint }}</span>
        </div>
        <div class="cf-decision-strip__actions">
          <button
          aria-label="Collect Payment"
          title="Collect Payment" type="button" class="cf-btn cf-btn-icon cf-btn-primary" (click)="openQuickCollect()">
          <app-cf-action-icon name="collect-payment" />
          </button>
          <button type="button" class="cf-btn cf-btn-icon" *ngIf="overdueCount" (click)="showOverdueOnly()" aria-label="Show overdue only" title="Show overdue only"><app-cf-action-icon name="filter" /></button>
          <button
          aria-label="WhatsApp all overdue"
          title="WhatsApp all overdue" type="button" class="cf-btn cf-btn-icon" *ngIf="canManage && overdueCount" (click)="queueBulkWhatsApp()" [disabled]="whatsAppQueueing">
          <app-cf-action-icon name="message-circle" />
          </button>
          <ng-container *appIfFeature="'CONTRIBUTION_PLANS'">
            <button
          aria-label="Catch up auto plans"
          title="Catch up auto plans" type="button" class="cf-btn cf-btn-icon" *ngIf="canManage" (click)="generateScheduled()">
          <app-cf-action-icon name="refresh" />
            </button>
          </ng-container>
        </div>
      </div>

      <section class="outreach-panel cf-panel" *ngIf="!loading && overdueCount && whatsAppPreview?.eligible_count">
        <div class="outreach-head">
          <strong>{{ whatsAppPreview?.eligible_count || 0 }} families eligible for WhatsApp reminders</strong>
          <span *ngIf="whatsAppDelivery">{{ whatsAppDelivery.queued }} queued · {{ whatsAppDelivery.sent }} sent</span>
        </div>
        <ul class="outreach-list" *ngIf="whatsAppPreview?.targets?.length">
          <li *ngFor="let target of whatsAppPreview?.targets?.slice(0, 5) ?? []">
            <span>{{ target.family_name }} · {{ target.overdue_amount | cfCurrency }}</span>
            <a *ngIf="target.whatsapp_url" [href]="target.whatsapp_url" target="_blank" rel="noopener" class="cf-link">Open</a>
          </li>
        </ul>
        <div class="outreach-actions">
          <button
          aria-label="Try again"
          title="Try again" type="button" class="cf-btn cf-btn-icon" (click)="loadWhatsAppPreview()" [disabled]="whatsAppLoading">
          <app-cf-action-icon name="refresh" />
          </button>
          <button
          aria-label="Queue reminders"
          title="Queue reminders" type="button" class="cf-btn cf-btn-icon cf-btn-primary" (click)="queueBulkWhatsApp()" [disabled]="whatsAppQueueing">
          <app-cf-action-icon name="send" />
          </button>
          <button
          aria-label="Deliver queued"
          title="Deliver queued" type="button" class="cf-btn cf-btn-icon" (click)="deliverPendingWhatsApp()" [disabled]="whatsAppDelivering || !(whatsAppDelivery?.queued)">
          <app-cf-action-icon name="check-check" />
          </button>
        </div>
        <p *ngIf="whatsAppMessage" class="cf-state cf-state--success">{{ whatsAppMessage }}</p>
      </section>

      <div class="filters cf-filters cf-panel">
        <input type="search" [(ngModel)]="tableSearch" placeholder="Filter families or plans…" />
        <label><input type="checkbox" [(ngModel)]="overdueOnly" (change)="loadDues()" /> Overdue only</label>
        <select [(ngModel)]="statusFilter" (change)="loadDues()">
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="partially_paid">Partially paid</option>
          <option value="paid">Paid</option>
          <option value="waived">Waived</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <p *ngIf="message" class="cf-state cf-state--success">{{ message }}</p>
      <p *ngIf="error" class="cf-state cf-state--error">{{ error }}</p>
      <p *ngIf="loading" class="cf-state">Loading dues…</p>

      <table *ngIf="filteredDues.length" class="table cf-table">
        <thead>
          <tr>
            <th>Family</th>
            <th>Plan</th>
            <th>Period</th>
            <th>Due Date</th>
            <th>Outstanding</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let due of filteredDues" [class.row-overdue]="isDueOverdue(due)">
            <td>
              <a *ngIf="due.family_id" [routerLink]="['/families', due.family_id]" class="cf-link">{{ due.family?.family_name || due.family_id }}</a>
              <span *ngIf="!due.family_id">{{ due.family?.family_name || due.family_id }}</span>
            </td>
            <td>{{ due.plan?.name || due.plan_id }}</td>
            <td>{{ due.period_label }}</td>
            <td>{{ due.due_date | date }}</td>
            <td>{{ (due.outstanding_amount ?? (due.amount_due - due.amount_paid)) | cfCurrency }}</td>
            <td>
              <span class="status-pill" [class.status-pill--overdue]="isDueOverdue(due)">{{ isDueOverdue(due) ? 'Overdue' : due.status }}</span>
            </td>
            <td class="row-actions">
              <button
          aria-label="Collect"
          title="Collect" type="button" class="cf-btn cf-btn-icon cf-btn-primary cf-btn--sm" *ngIf="due.family_id" (click)="collectForFamily(due.family_id)">
          <app-cf-action-icon name="collect-payment" />
              </button>
              <button
          aria-label="Remind"
          title="Remind" type="button" class="cf-btn cf-btn-icon cf-btn--sm" (click)="remind(due)">
          <app-cf-action-icon name="message-circle" />
              </button>
              <button
          aria-label="Waive"
          title="Waive" type="button" class="cf-btn cf-btn-icon cf-btn--sm" *ngIf="canManage && (due.status === 'pending' || due.status === 'partially_paid')" (click)="waive(due)">
          <app-cf-action-icon name="badge-minus" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <p *ngIf="dues.length && !filteredDues.length && !loading" class="cf-state">No dues match your filter.</p>

      <app-cf-empty-state
        *ngIf="!dues.length && !loading"
        icon="✓"
        title="All caught up"
        description="No outstanding contributions match your filters. Families are up to date — or try clearing filters to see paid history."
      >
        <button
          aria-label="Collect Payment"
          title="Collect Payment" type="button" class="cf-btn cf-btn-icon cf-btn-primary" (click)="openQuickCollect()">
          <app-cf-action-icon name="collect-payment" />
        </button>
        <a routerLink="/families" class="cf-btn cf-btn-icon" aria-label="Browse Families" title="Browse Families">
          <app-cf-action-icon name="users" />
        </a>
      </app-cf-empty-state>
    </section>
  `,
  styles: [`
    .row-actions { display: flex; gap: 0.35rem; flex-wrap: wrap; }
    .row-overdue { background: var(--cf-amber-soft); }
    .status-pill { display: inline-block; padding: 0.12rem 0.45rem; border-radius: 999px; background: var(--cf-slate-100); font-size: 0.78rem; }
    .status-pill--overdue { background: var(--cf-critical-soft); color: var(--cf-critical); }
    .outreach-panel { display: grid; gap: 0.65rem; }
    .outreach-head { display: flex; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap; align-items: center; }
    .outreach-head span { color: var(--cf-muted); font-size: 0.85rem; }
    .outreach-list { margin: 0; padding-left: 1.1rem; color: var(--cf-slate-700); }
    .outreach-list li { display: flex; justify-content: space-between; gap: 0.5rem; align-items: center; }
    .outreach-actions { display: flex; flex-wrap: wrap; gap: 0.45rem; }
  `]
})
export class DonationsDuesComponent implements OnInit {
  dues: ContributionDue[] = [];
  tableSearch = '';
  loading = false;
  overdueOnly = false;
  statusFilter = '';
  message: string | null = null;
  error: string | null = null;
  canManage = false;
  whatsAppPreview: WhatsAppOutreachPreview | null = null;
  whatsAppDelivery: WhatsAppDeliverySummary | null = null;
  whatsAppLoading = false;
  whatsAppQueueing = false;
  whatsAppDelivering = false;
  whatsAppMessage: string | null = null;

  constructor(
    private donationsService: DonationsService,
    private authService: AuthService,
    private quickCollectService: QuickCollectService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private destroyRef: DestroyRef
  ) {}

  ngOnInit(): void {
    this.canManage = this.authService.hasPermission('donations.manage');
    const overdueParam = this.route.snapshot.queryParamMap.get('overdue_only');
    if (overdueParam === '1' || overdueParam === 'true') {
      this.overdueOnly = true;
    }
    this.loadDues();
    setupStewardshipRouteReload(this.router, this.destroyRef, '/donations/dues', () => this.loadDues());
  }

  openQuickCollect(): void {
    this.quickCollectService.open();
  }

  collectForFamily(familyId: string): void {
    this.quickCollectService.openForFamily(familyId);
  }

  get filteredDues(): ContributionDue[] {
    const query = this.tableSearch.trim().toLowerCase();
    if (!query) {
      return this.dues;
    }
    return this.dues.filter((due) => {
      const haystack = [
        due.family?.family_name,
        due.family?.family_code,
        due.plan?.name,
        due.period_label,
        due.status
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }

  get overdueFamilyIds(): string[] {
    return [...new Set(
      this.dues.filter((due) => this.isDueOverdue(due) && due.family_id).map((due) => due.family_id)
    )];
  }

  get overdueCount(): number {
    return this.dues.filter((due) => this.isDueOverdue(due)).length;
  }

  get outstandingTotal(): number {
    return this.dues.reduce((sum, due) => {
      const outstanding = due.outstanding_amount ?? (due.amount_due - due.amount_paid);
      return sum + Math.max(0, outstanding);
    }, 0);
  }

  get decisionHint(): string {
    if (this.overdueCount > 0) {
      return 'Collect payment, send WhatsApp reminders, or open each family for follow-up.';
    }
    if (this.dues.length) {
      return 'Pending contributions are on track. Collect early if families prefer.';
    }
    return 'No outstanding items right now.';
  }

  showOverdueOnly(): void {
    this.overdueOnly = true;
    this.loadDues();
  }

  isDueOverdue(due: ContributionDue): boolean {
    if (due.is_overdue !== undefined) {
      return !!due.is_overdue;
    }
    if (due.status === 'paid' || due.status === 'waived' || due.status === 'cancelled') {
      return false;
    }
    return due.schedule_state === 'overdue';
  }

  loadDues(): void {
    this.loading = true;
    this.error = null;
    refreshStewardshipView(this.cdr);
    const filters: Record<string, string | boolean> = { per_page: '100', actionable: true };
    if (this.overdueOnly) {
      filters['overdue_only'] = true;
    }
    if (this.statusFilter) {
      filters['status'] = this.statusFilter;
    }

    this.donationsService.getDues(filters).subscribe({
      next: (res) => {
        this.dues = res.data?.data || [];
        this.loading = false;
        if (this.overdueFamilyIds.length) {
          this.loadWhatsAppPreview();
          this.loadWhatsAppDeliverySummary();
        } else {
          this.whatsAppPreview = null;
        }
        refreshStewardshipView(this.cdr);
      },
      error: () => {
        this.error = 'Failed to load contribution dues.';
        this.loading = false;
        refreshStewardshipView(this.cdr);
      }
    });
  }

  loadWhatsAppPreview(): void {
    if (!this.overdueFamilyIds.length) {
      return;
    }
    this.whatsAppLoading = true;
    this.donationsService.previewWhatsAppOutreach(this.overdueFamilyIds).subscribe({
      next: (res) => {
        this.whatsAppPreview = res.data ?? null;
        this.whatsAppLoading = false;
        refreshStewardshipView(this.cdr);
      },
      error: () => {
        this.whatsAppLoading = false;
        refreshStewardshipView(this.cdr);
      }
    });
  }

  loadWhatsAppDeliverySummary(): void {
    this.donationsService.getWhatsAppDeliverySummary().subscribe({
      next: (res) => {
        this.whatsAppDelivery = res.data ?? null;
        refreshStewardshipView(this.cdr);
      }
    });
  }

  queueBulkWhatsApp(): void {
    const familyIds = (this.whatsAppPreview?.targets ?? [])
      .filter((target) => !!target.phone)
      .map((target) => target.family_id);

    const ids = familyIds.length ? familyIds : this.overdueFamilyIds;
    if (!ids.length) {
      this.whatsAppMessage = 'No overdue families with phone numbers found.';
      return;
    }

    this.whatsAppQueueing = true;
    this.whatsAppMessage = null;
    this.donationsService.queueWhatsAppOutreach(ids).subscribe({
      next: (res) => {
        this.whatsAppQueueing = false;
        this.whatsAppMessage = res.message;
        this.loadWhatsAppDeliverySummary();
      },
      error: () => {
        this.whatsAppQueueing = false;
        this.whatsAppMessage = 'Unable to queue WhatsApp reminders right now.';
      }
    });
  }

  deliverPendingWhatsApp(): void {
    this.whatsAppDelivering = true;
    this.donationsService.deliverPendingWhatsApp().subscribe({
      next: (res) => {
        this.whatsAppDelivering = false;
        this.whatsAppMessage = res.message;
        this.loadWhatsAppDeliverySummary();
      },
      error: () => {
        this.whatsAppDelivering = false;
        this.whatsAppMessage = 'Unable to deliver queued messages right now.';
      }
    });
  }

  generateScheduled(): void {
    this.donationsService.generateScheduledContributions().subscribe({
      next: (res) => {
        this.message = `${res.message} Created ${res.data.generated} new due(s) across auto-generate plans.`;
        this.loadDues();
      },
      error: (err) => {
        this.error = err?.error?.message || 'Scheduled generation failed.';
      }
    });
  }

  waive(due: ContributionDue): void {
    this.donationsService.waiveDue(due.id).subscribe({
      next: (res) => {
        this.message = res.message;
        this.loadDues();
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to waive due.';
      }
    });
  }

  cancel(due: ContributionDue): void {
    this.donationsService.cancelDue(due.id).subscribe({
      next: (res) => {
        this.message = res.message;
        this.loadDues();
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to cancel due.';
      }
    });
  }

  remind(due: ContributionDue): void {
    this.donationsService.remindDue(due.id).subscribe({
      next: (res) => { this.message = res.message; },
      error: (err) => { this.error = err?.error?.message || 'Failed to queue reminder.'; }
    });
  }
}
