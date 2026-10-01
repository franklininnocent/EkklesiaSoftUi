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
import { CfDatePipe } from '@shared/pipes/cf-date.pipe';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import {
  AdvancedSearchPanelComponent,
  SearchField,
} from '@shared/components/advanced-search-panel/advanced-search-panel.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { ListToolbarComponent } from '@shared/components/list-toolbar/list-toolbar.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { StatusBadgeComponent, StatusBadgeTone } from '@shared/components/status-badge/status-badge.component';
import { SortableDirective, SortDirection, SortEvent } from '@shared/directives/sortable.directive';

type NotificationSortColumn =
  | 'notification_type'
  | 'channel'
  | 'recipient'
  | 'status'
  | 'created_at'
  | 'sent_at';

const NOTIFICATION_SORT_COLUMNS: NotificationSortColumn[] = [
  'notification_type',
  'channel',
  'recipient',
  'status',
  'created_at',
  'sent_at',
];

@Component({
  selector: 'app-donations-notifications',
  standalone: true,
  imports: [
    CfDatePipe,
    CommonModule,
    FormsModule,
    RouterModule,
    CfEmptyStateComponent,
    CfActionIconComponent,
    PaginationComponent,
    PageHeaderComponent,
    ListToolbarComponent,
    AdvancedSearchPanelComponent,
    DataTableComponent,
    LoadingSkeletonComponent,
    StatusBadgeComponent,
    SortableDirective,
  ],
  styleUrls: ['../styles/stewardship-dashboard-shared.scss'],
  template: `
    <section class="notifications cf-page cf-financial-dashboard" [attr.aria-busy]="loading">
      <app-page-header
        title="Outreach Log"
        subtitle="WhatsApp reminders, receipts, and parish messages — see what was sent."
      >
        <app-list-toolbar
          *ngIf="canView"
          [showSearch]="false"
          [filterCount]="statusFilter ? 1 : 0"
          (filtersOpened)="showFilters = true"
        >
          <a routerLink="/donations/dues" class="cf-btn cf-btn-icon" aria-label="Outstanding contributions" title="Outstanding contributions">
            <app-cf-action-icon name="clipboard-list" />
          </a>
        </app-list-toolbar>
      </app-page-header>

      <div
        class="dashboard-active-filters"
        *ngIf="canView && statusFilter"
        role="region"
        aria-label="Active filters"
      >
        <span class="cf-meta">Active filters</span>
        <div class="dashboard-active-filters__list">
          <span class="cf-badge cf-badge--info">
            Status: {{ statusFilterLabel(statusFilter) }}
            <button type="button" class="dashboard-active-filters__remove" (click)="clearStatusFilter()" aria-label="Remove status filter">×</button>
          </span>
        </div>
        <button type="button" class="cf-btn cf-btn--sm" (click)="clearStatusFilter()">Clear all</button>
      </div>

      <p *ngIf="!canView" class="cf-state cf-state--error">You do not have permission to view outreach notifications.</p>
      <div class="cf-loading-block cf-panel" *ngIf="loading && canView" role="status" aria-live="polite" aria-busy="true">
        <app-loading-skeleton label="Loading notifications…" type="table" [rows]="6" [columns]="6"></app-loading-skeleton>
      </div>
      <p *ngIf="error" class="cf-inline-alert cf-panel" role="alert">{{ error }}</p>

      <div class="cf-panel stewardship-table-panel" *ngIf="canView && !loading && notifications.length">
        <app-data-table>
          <thead>
            <tr>
              <th
                scope="col"
                appSortable="notification_type"
                [direction]="sortColumn === 'notification_type' ? sortDirection : null"
                (sort)="onSort($event)"
              >
                Type
              </th>
              <th
                scope="col"
                appSortable="channel"
                [direction]="sortColumn === 'channel' ? sortDirection : null"
                (sort)="onSort($event)"
              >
                Channel
              </th>
              <th
                scope="col"
                appSortable="recipient"
                [direction]="sortColumn === 'recipient' ? sortDirection : null"
                (sort)="onSort($event)"
              >
                Recipient
              </th>
              <th
                scope="col"
                appSortable="status"
                [direction]="sortColumn === 'status' ? sortDirection : null"
                (sort)="onSort($event)"
              >
                Status
              </th>
              <th
                scope="col"
                appSortable="created_at"
                [direction]="sortColumn === 'created_at' ? sortDirection : null"
                (sort)="onSort($event)"
              >
                Created
              </th>
              <th
                scope="col"
                appSortable="sent_at"
                [direction]="sortColumn === 'sent_at' ? sortDirection : null"
                (sort)="onSort($event)"
              >
                Sent
              </th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let row of notifications" [class.notifications__row-failed]="row.status === 'failed'">
              <td>{{ row.notification_type }}</td>
              <td>{{ row.channel }}</td>
              <td>{{ row.recipient || '—' }}</td>
              <td>
                <app-status-badge [label]="row.status" [tone]="statusTone(row.status)"></app-status-badge>
              </td>
              <td>{{ row.created_at | cfDate:'datetime' }}</td>
              <td>{{ row.sent_at ? (row.sent_at | cfDate:'datetime') : '—' }}</td>
            </tr>
          </tbody>
        </app-data-table>
        <app-pagination
          *ngIf="totalItems > 0"
          [currentPage]="page"
          [pageSize]="perPage"
          [totalItems]="totalItems"
          [pageSizeOptions]="perPageOptions"
          [showPageSizeSelector]="true"
          [showPageInfo]="true"
          (pageChange)="goToPage($event)"
          (pageSizeChange)="onPageSizeChange($event)"
        ></app-pagination>
      </div>

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

      <app-advanced-search-panel
        mode="sidepanel"
        [fields]="searchFields"
        [isExpanded]="showFilters"
        (search)="onAdvancedSearch($event)"
        (clear)="onClearAdvancedSearch()"
        (close)="showFilters = false"
      ></app-advanced-search-panel>
    </section>
  `,
  styles: [`
    .notifications__row-failed { background: var(--cf-critical-soft); }
  `]
})
export class DonationsNotificationsComponent implements OnInit, OnDestroy {
  notifications: DonationNotificationLog[] = [];
  loading = false;
  error: string | null = null;
  statusFilter = '';
  showFilters = false;
  searchFields: SearchField[] = [];
  canView = false;
  page = 1;
  perPage = 20;
  perPageOptions = [10, 20, 50, 100];
  totalItems = 0;
  sortColumn: NotificationSortColumn = 'created_at';
  sortDirection: SortDirection = 'desc';
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
    this.initSearchFields();
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

  onStatusFilterChange(): void {
    this.page = 1;
    this.load();
  }

  onAdvancedSearch(values: { [key: string]: unknown }): void {
    this.statusFilter = String(values['status'] ?? '').trim();
    this.showFilters = false;
    this.syncSearchFieldValues();
    this.onStatusFilterChange();
  }

  onClearAdvancedSearch(): void {
    this.clearStatusFilter();
    this.showFilters = false;
  }

  clearStatusFilter(): void {
    this.statusFilter = '';
    this.syncSearchFieldValues();
    this.onStatusFilterChange();
  }

  statusFilterLabel(status: string): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  statusTone(status: string): StatusBadgeTone {
    if (status === 'sent') return 'success';
    if (status === 'failed') return 'critical';
    if (status === 'queued') return 'warning';
    return 'neutral';
  }

  private initSearchFields(): void {
    this.searchFields = [
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'queued', label: 'Queued' },
          { value: 'sent', label: 'Sent' },
          { value: 'failed', label: 'Failed' },
        ],
        value: this.statusFilter || undefined,
      },
    ];
  }

  private syncSearchFieldValues(): void {
    const field = this.searchFields.find((f) => f.key === 'status');
    if (field) {
      field.value = this.statusFilter || undefined;
    }
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

  onSort(event: SortEvent): void {
    if (!NOTIFICATION_SORT_COLUMNS.includes(event.column as NotificationSortColumn)) {
      return;
    }
    this.sortColumn = event.column as NotificationSortColumn;
    this.sortDirection = event.direction ?? 'desc';
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
      sort: this.sortColumn,
      direction: this.sortDirection ?? 'desc',
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
