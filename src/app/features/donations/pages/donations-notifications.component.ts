import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthService } from '@core/services/auth.service';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { DonationsService } from '../services/donations.service';
import { DonationNotificationLog } from '../models/donation.model';

@Component({
  selector: 'app-donations-notifications',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, CfEmptyStateComponent],
  template: `
    <section class="notifications cf-page">
      <header class="cf-hero">
        <h1>Outreach Log</h1>
        <p>WhatsApp reminders, receipts, and parish messages — see what was sent.</p>
      </header>

      <div class="cf-decision-strip" role="region" aria-label="Suggested next step" *ngIf="!loading && canView">
        <div class="cf-decision-strip__copy">
          <strong>{{ notifications.length }} message{{ notifications.length === 1 ? '' : 's' }} · {{ failedCount }} failed</strong>
          <span>{{ notificationDecisionHint }}</span>
        </div>
        <div class="cf-decision-strip__actions">
          <a routerLink="/donations/dues" class="cf-btn">Outstanding contributions</a>
          <button type="button" class="cf-btn" *ngIf="statusFilter" (click)="clearFilter()">Show all</button>
        </div>
      </div>

      <div class="cf-filters cf-panel" *ngIf="canView">
        <select [(ngModel)]="statusFilter" (ngModelChange)="load()">
          <option value="">All statuses</option>
          <option value="queued">Queued</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      <p *ngIf="!canView" class="cf-state cf-state--error">You do not have permission to view outreach notifications.</p>
      <p *ngIf="loading" class="cf-state">Loading notifications…</p>
      <p *ngIf="error" class="cf-state cf-state--error">{{ error }}</p>

      <table class="table cf-table" *ngIf="canView && notifications.length">
        <thead>
          <tr>
            <th>Type</th>
            <th>Channel</th>
            <th>Recipient</th>
            <th>Status</th>
            <th>Created</th>
            <th>Sent</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let row of notifications" [class.row-failed]="row.status === 'failed'">
            <td>{{ row.notification_type }}</td>
            <td>{{ row.channel }}</td>
            <td>{{ row.recipient || '—' }}</td>
            <td><span class="status-pill" [class]="'status-pill--' + row.status">{{ row.status }}</span></td>
            <td>{{ row.created_at | date:'medium' }}</td>
            <td>{{ row.sent_at ? (row.sent_at | date:'medium') : '—' }}</td>
          </tr>
        </tbody>
      </table>

      <app-cf-empty-state
        *ngIf="canView && !loading && !notifications.length && !error"
        icon="✉"
        title="No outreach logged yet"
        description="WhatsApp reminders and receipt notifications appear here after you queue outreach from Outstanding Contributions or the dashboard."
      >
        <a routerLink="/donations/dues" class="cf-btn cf-btn-primary">Review outstanding</a>
      </app-cf-empty-state>
    </section>
  `,
  styles: [`
    .row-failed { background: var(--cf-critical-soft); }
    .status-pill { display: inline-block; padding: 0.12rem 0.45rem; border-radius: 999px; font-size: 0.78rem; text-transform: capitalize; background: var(--cf-slate-100); }
    .status-pill--sent { background: var(--cf-forest-soft); color: var(--cf-forest); }
    .status-pill--failed { background: var(--cf-critical-soft); color: var(--cf-critical); }
    .status-pill--queued { background: var(--cf-amber-soft); color: var(--cf-amber); }
  `]
})
export class DonationsNotificationsComponent implements OnInit, OnDestroy {
  notifications: DonationNotificationLog[] = [];
  loading = false;
  error: string | null = null;
  statusFilter = '';
  canView = false;
  private routerSub?: Subscription;
  private skipNextNavReload = true;

  constructor(
    private donationsService: DonationsService,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.canView = this.authService.canAccessDonations();
    this.cdr.detectChanges();
    if (this.canView) {
      this.load();
    }
    this.routerSub = this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe((e) => {
      if (!e.urlAfterRedirects.includes('/donations/notifications')) {
        return;
      }
      if (this.skipNextNavReload) {
        this.skipNextNavReload = false;
        return;
      }
      if (this.canView) {
        this.load();
      }
    });
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  get failedCount(): number {
    return this.notifications.filter((row) => row.status === 'failed').length;
  }

  get notificationDecisionHint(): string {
    if (this.failedCount > 0) {
      return 'Failed messages may need phone number updates or WhatsApp Business API configuration.';
    }
    if (this.statusFilter === 'queued') {
      return 'Queued messages waiting for delivery — use Deliver queued on Outstanding Contributions.';
    }
    return 'Filter by status to troubleshoot delivery issues.';
  }

  clearFilter(): void {
    this.statusFilter = '';
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;
    this.cdr.detectChanges();
    const filters: Record<string, string> = {};
    if (this.statusFilter) {
      filters['status'] = this.statusFilter;
    }
    this.donationsService.listNotifications(filters).subscribe({
      next: (res) => {
        this.notifications = res.data?.data ?? [];
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.error = 'Failed to load notifications.';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }
}
