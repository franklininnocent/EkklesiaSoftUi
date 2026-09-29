import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subject, catchError, forkJoin, of, takeUntil } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { StatusBadgeComponent, StatusBadgeTone } from '@shared/components/status-badge/status-badge.component';
import { CfCurrencyPipe } from '@shared/pipes/cf-currency.pipe';
import { CfDatePipe } from '@shared/pipes/cf-date.pipe';
import { SubscriptionOverview, SubscriptionRevenue } from '../../models/subscription-admin.models';
import { SubscriptionAdminService, subscriptionErrorMessage } from '../../services/subscription-admin.service';
import { subscriptionAdminCapabilities } from '../../services/subscription-admin-access';

const STATUS_LABELS: Record<string, string> = {
  TRIAL: 'Trial',
  ACTIVE: 'Active',
  LIFETIME: 'Lifetime',
  EXPIRING: 'Ending soon',
  GRACE_PERIOD: 'Grace period',
  EXPIRED: 'Ended',
  SUSPENDED: 'Suspended',
};

/** Platform snapshot: churches per plan, lifecycle, requests, usage pressure and contracted revenue. */
@Component({
  selector: 'app-subscription-overview-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    LoadingSkeletonComponent,
    DataTableComponent,
    StatusBadgeComponent,
    CfCurrencyPipe,
    CfDatePipe,
  ],
  templateUrl: './subscription-overview.page.html',
  styleUrls: ['../../styles/subscription-admin.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubscriptionOverviewPage implements OnInit, OnDestroy {
  private readonly api = inject(SubscriptionAdminService);
  private readonly auth = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  readonly can = subscriptionAdminCapabilities(this.auth);
  overview: SubscriptionOverview | null = null;
  revenue: SubscriptionRevenue | null = null;
  loading = false;
  error: string | null = null;

  ngOnInit(): void {
    if (this.can.usage) this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get statusRows(): { status: string; label: string; count: number }[] {
    const counts = this.overview?.status_counts ?? {};
    return Object.keys(STATUS_LABELS)
      .filter((status) => (counts[status] ?? 0) > 0)
      .map((status) => ({ status, label: STATUS_LABELS[status], count: counts[status] }));
  }

  get unassigned(): number {
    return Math.max(0, (this.overview?.total_tenants ?? 0) - (this.overview?.assigned_tenants ?? 0));
  }

  get showDecisionStrip(): boolean {
    const overview = this.overview;
    if (!overview) return false;
    return overview.open_requests > 0 || overview.tenants_needing_attention > 0;
  }

  get decisionTitle(): string {
    const overview = this.overview;
    if (!overview) return '';
    const requests = overview.open_requests;
    const attention = overview.tenants_needing_attention;
    if (requests > 0 && attention > 0) {
      return 'Work waiting on subscriptions';
    }
    if (requests > 0) {
      return `${requests} plan ${requests === 1 ? 'request' : 'requests'} waiting`;
    }
    return `${attention} ${attention === 1 ? 'church' : 'churches'} near a limit`;
  }

  get decisionDetail(): string {
    const overview = this.overview;
    if (!overview) return '';
    const requests = overview.open_requests;
    const attention = overview.tenants_needing_attention;
    if (requests > 0 && attention > 0) {
      return `${requests} plan ${requests === 1 ? 'request' : 'requests'} and ${attention} ${
        attention === 1 ? 'church' : 'churches'
      } near a limit.`;
    }
    if (requests > 0) {
      return 'Review which churches asked to change plan.';
    }
    return 'See churches using most of their plan.';
  }

  statusTone(status: string): StatusBadgeTone {
    switch (status) {
      case 'ACTIVE':
      case 'LIFETIME':
        return 'success';
      case 'TRIAL':
        return 'info';
      case 'EXPIRING':
      case 'GRACE_PERIOD':
        return 'warning';
      case 'EXPIRED':
      case 'SUSPENDED':
        return 'critical';
      default:
        return 'neutral';
    }
  }

  mrrRowsForPlan(planId: number): { mrr: string; currency_code: string }[] {
    return (this.revenue?.by_plan ?? []).filter((row) => row.plan_id === planId);
  }

  load(): void {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();
    forkJoin({
      overview: this.api.overview(),
      revenue: this.can.revenue ? this.api.revenue().pipe(catchError(() => of(null))) : of(null),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ overview, revenue }) => {
          this.overview = overview;
          this.revenue = revenue;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error = subscriptionErrorMessage(err, 'Unable to load the subscription overview.');
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }
}
