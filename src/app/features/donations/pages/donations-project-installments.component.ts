import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { DonationsService } from '../services/donations.service';
import { QuickCollectService } from '../services/quick-collect.service';
import { DonationProject, ProjectInstallmentDue } from '../models/donation.model';
import { refreshStewardshipView, setupStewardshipRouteReload } from '../utils/stewardship-view.util';

@Component({
  selector: 'app-donations-project-installments',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, CfEmptyStateComponent],
  template: `
    <section class="installments-page cf-page">
      <header class="cf-hero">
        <h1>Project Installments</h1>
        <p>Track who owes project installments — collect or follow up before deadlines.</p>
      </header>

      <div class="cf-decision-strip" role="region" aria-label="Suggested next step" *ngIf="!loading">
        <div class="cf-decision-strip__copy">
          <strong>{{ overdueCount }} overdue · {{ outstandingTotal | number:'1.2-2' }} outstanding</strong>
          <span>{{ decisionHint }}</span>
        </div>
        <div class="cf-decision-strip__actions">
          <button type="button" class="cf-btn cf-btn-primary" (click)="openQuickCollect()">Collect Payment</button>
          <button type="button" class="cf-btn" *ngIf="overdueCount" (click)="showOverdueOnly()">Show overdue only</button>
          <a routerLink="/donations/projects" class="cf-btn">View Projects</a>
        </div>
      </div>

      <div class="filters cf-filters cf-panel">
        <input type="search" [(ngModel)]="tableSearch" placeholder="Filter family or project…" />
        <select [(ngModel)]="projectFilter" (change)="loadInstallments()">
          <option value="">All projects</option>
          <option *ngFor="let project of projects" [value]="project.id">{{ project.name }}</option>
        </select>
        <label><input type="checkbox" [(ngModel)]="overdueOnly" (change)="loadInstallments()" /> Overdue only</label>
        <select [(ngModel)]="statusFilter" (change)="loadInstallments()">
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
      <p *ngIf="loading" class="cf-state">Loading installments…</p>

      <table *ngIf="filteredInstallments.length" class="table cf-table">
        <thead>
          <tr>
            <th>Family</th>
            <th>Project</th>
            <th>Installment</th>
            <th>Due Date</th>
            <th>Outstanding</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let row of filteredInstallments" [class.row-overdue]="isOverdue(row)">
            <td>
              <a *ngIf="row.family_id" [routerLink]="['/families', row.family_id]" class="cf-link">{{ row.family?.family_name || row.family_id }}</a>
            </td>
            <td>{{ row.project?.name || row.project_id }}</td>
            <td>{{ row.installment_label }}</td>
            <td>{{ row.due_date | date }}</td>
            <td>{{ (row.outstanding_amount ?? (row.amount_due - row.amount_paid)) | number:'1.2-2' }}</td>
            <td>
              <span class="status-pill" [class.status-pill--overdue]="isOverdue(row)">{{ isOverdue(row) ? 'Overdue' : row.status }}</span>
            </td>
            <td class="row-actions">
              <button type="button" class="cf-btn cf-btn-primary" *ngIf="row.family_id" (click)="collectForFamily(row.family_id)">Collect</button>
              <button type="button" class="cf-btn" *ngIf="canManage && (row.status === 'pending' || row.status === 'partially_paid')" (click)="waive(row)">Waive</button>
            </td>
          </tr>
        </tbody>
      </table>

      <p *ngIf="installments.length && !filteredInstallments.length && !loading" class="cf-state">No installments match your filter.</p>

      <app-cf-empty-state
        *ngIf="!installments.length && !loading"
        icon="▣"
        title="No project installments"
        description="Installments appear when families are enrolled in special projects with a payment schedule."
      >
        <a routerLink="/donations/projects" class="cf-btn cf-btn-primary">View Projects</a>
        <button type="button" class="cf-btn" (click)="openQuickCollect()">Collect Payment</button>
      </app-cf-empty-state>
    </section>
  `,
  styles: [`
    .row-actions { display: flex; gap: 0.35rem; flex-wrap: wrap; }
    .row-overdue { background: var(--cf-amber-soft); }
    .status-pill { display: inline-block; padding: 0.12rem 0.45rem; border-radius: 999px; background: var(--cf-slate-100); font-size: 0.78rem; }
    .status-pill--overdue { background: var(--cf-critical-soft); color: var(--cf-critical); }
  `]
})
export class DonationsProjectInstallmentsComponent implements OnInit {
  installments: ProjectInstallmentDue[] = [];
  projects: DonationProject[] = [];
  tableSearch = '';
  loading = false;
  projectFilter = '';
  overdueOnly = false;
  statusFilter = '';
  message: string | null = null;
  error: string | null = null;
  canManage = false;

  constructor(
    private donationsService: DonationsService,
    private authService: AuthService,
    private quickCollectService: QuickCollectService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private destroyRef: DestroyRef
  ) {}

  ngOnInit(): void {
    this.canManage = this.authService.hasPermission('donations.manage');
    this.loadProjects();
    this.loadInstallments();
    setupStewardshipRouteReload(this.router, this.destroyRef, '/donations/project-installments', () => {
      this.loadProjects();
      this.loadInstallments();
    });
  }

  openQuickCollect(): void {
    this.quickCollectService.open();
  }

  collectForFamily(familyId: string): void {
    this.quickCollectService.openForFamily(familyId);
  }

  get filteredInstallments(): ProjectInstallmentDue[] {
    const query = this.tableSearch.trim().toLowerCase();
    if (!query) {
      return this.installments;
    }
    return this.installments.filter((row) => {
      const haystack = [
        row.family?.family_name,
        row.project?.name,
        row.installment_label,
        row.status
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }

  get overdueCount(): number {
    return this.installments.filter((row) => this.isOverdue(row)).length;
  }

  get outstandingTotal(): number {
    return this.installments.reduce((sum, row) => {
      const outstanding = row.outstanding_amount ?? (row.amount_due - row.amount_paid);
      return sum + Math.max(0, outstanding);
    }, 0);
  }

  get decisionHint(): string {
    if (this.overdueCount > 0) {
      return 'Prioritize overdue installments — collect payment or contact families directly.';
    }
    if (this.installments.length) {
      return 'Installments on track. Use Collect for early payments.';
    }
    return 'No installment dues loaded.';
  }

  showOverdueOnly(): void {
    this.overdueOnly = true;
    this.loadInstallments();
  }

  isOverdue(row: ProjectInstallmentDue): boolean {
    if (row.status === 'paid' || row.status === 'waived' || row.status === 'cancelled') {
      return false;
    }
    return new Date(row.due_date).getTime() < Date.now();
  }

  loadProjects(): void {
    this.donationsService.getProjects().subscribe({
      next: (res) => {
        this.projects = res.data || [];
        refreshStewardshipView(this.cdr);
      }
    });
  }

  loadInstallments(): void {
    this.loading = true;
    this.error = null;
    refreshStewardshipView(this.cdr);
    const filters: Record<string, string | boolean> = { per_page: '100' };
    if (this.projectFilter) {
      filters['project_id'] = this.projectFilter;
    }
    if (this.overdueOnly) {
      filters['overdue_only'] = true;
    }
    if (this.statusFilter) {
      filters['status'] = this.statusFilter;
    }

    this.donationsService.getProjectInstallments(filters).subscribe({
      next: (res) => {
        this.installments = res.data?.data || [];
        this.loading = false;
        refreshStewardshipView(this.cdr);
      },
      error: () => {
        this.error = 'Failed to load project installments.';
        this.loading = false;
        refreshStewardshipView(this.cdr);
      }
    });
  }

  waive(row: ProjectInstallmentDue): void {
    this.donationsService.waiveProjectInstallment(row.id).subscribe({
      next: (res) => {
        this.message = res.message;
        this.loadInstallments();
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to waive installment.';
        refreshStewardshipView(this.cdr);
      }
    });
  }

  cancel(row: ProjectInstallmentDue): void {
    this.donationsService.cancelProjectInstallment(row.id).subscribe({
      next: (res) => {
        this.message = res.message;
        this.loadInstallments();
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to cancel installment.';
        refreshStewardshipView(this.cdr);
      }
    });
  }
}
