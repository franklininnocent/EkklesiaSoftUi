import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthService } from '@core/services/auth.service';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { DonationsService } from '../services/donations.service';
import { DonationNotificationLog } from '../models/donation.model';
import { CfActionIconComponent } from '@shared/components/cf-action-icon/cf-action-icon.component';

@Component({
  selector: 'app-donations-notifications',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    CfEmptyStateComponent,
    CfActionIconComponent,
    PaginationComponent,
  ],
  template: `
    <section class="notifications cf-page">
      <header class="cf-hero">
        <h3>Outreach Log</h3>
        <p>WhatsApp reminders, receipts, and parish messages — see what was sent.</p>
      </header>

      <div
        class="cf-decision-strip notifications-summary"
        role="region"
        aria-label="Outreach summary and filters"
        *ngIf="!loading && canView"
      >
        <div class="cf-decision-strip__copy">
          <strong>{{ totalItems }} message{{ totalItems === 1 ? '' : 's' }} · {{ failedCount }} failed</strong>
          <span>{{ notificationDecisionHint }}</span>
        </div>
        <div class="cf-decision-strip__actions notifications-summary__actions">
          <div class="cf-filters notifications-summary__filters">
            <select
              [(ngModel)]="statusFilter"
              (ngModelChange)="onStatusFilterChange()"
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              <option value="queued">Queued</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          <a routerLink="/donations/dues" class="cf-btn cf-btn-icon" aria-label="Outstanding contributions" title="Outstanding contributions">
            <app-cf-action-icon name="clipboard-list" />
          </a>
        </div>
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

      <app-pagination
        *ngIf="canView && totalItems > 0"
        [currentPage]="page"
        [pageSize]="perPage"
        [totalItems]="totalItems"
        [pageSizeOptions]="perPageOptions"
        [showPageSizeSelector]="true"
        [showPageInfo]="true"
        (pageChange)="goToPage($event)"
        (pageSizeChange)="onPageSizeChange($event)"
      ></app-pagination>

      <app-cf-empty-state
        *ngIf="canView && !loading && !notifications.length && !error"
        icon="✉"
        title="No outreach logged yet"
        description="WhatsApp reminders and receipt notifications appear here after you queue outreach from Outstanding Contributions or the dashboard."
      >
        <a
          routerLink="/donations/dues"
          class="cf-btn cf-btn-icon cf-btn-primary"
          aria-label="Outstanding contributions"
          title="Outstanding contributions"
        >
          <app-cf-action-icon name="clipboard-list" />
        </a>
      </app-cf-empty-state>
    </section>
  `,
  styles: [`
    .notifications-summary__actions {
      flex: 1 1 auto;
      justify-content: flex-end;
      min-width: 0;
      gap: var(--cf-space-2);
    }

    .notifications-summary__filters {
      flex-wrap: nowrap;
    }

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
  page = 1;
  perPage = 20;
  perPageOptions = [10, 20, 50, 100];
  totalItems = 0;
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

  onStatusFilterChange(): void {
    this.page = 1;
    this.load();
  }

  goToPage(page: number): void {
    this.page = page;
    this.load();
  }

  onPageSizeChange(size: number): void {
    this.perPage = size;
    this.page = 1;
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;
    this.cdr.detectChanges();
    const filters: Record<string, string> = {
      page: String(this.page),
      per_page: String(this.perPage),
    };
    if (this.statusFilter) {
      filters['status'] = this.statusFilter;
    }
    this.donationsService.listNotifications(filters).subscribe({
      next: (res) => {
        this.notifications = res.data?.data ?? [];
        this.page = res.data?.current_page ?? this.page;
        this.totalItems = res.data?.total ?? this.notifications.length;
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
