import { Component, OnDestroy, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TenantService } from '@core/services/tenant.service';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { StatusBadgeComponent, StatusBadgeTone } from '@shared/components/status-badge/status-badge.component';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { Subject, takeUntil } from 'rxjs';

export interface MySubscriptionSummary {
  status: string;
  plan_key?: string;
  plan_name: string;
  trial_ends_at?: string | null;
  subscription_ends_at?: string | null;
  subscription_suspended_at?: string | null;
  grace_ends_at?: string | null;
  days_until_end?: number | null;
  grace_period_days?: number;
  expiring_warning_days?: number;
  allows_gated_access: boolean;
  max_users?: number;
  max_storage_mb?: number;
  features?: string[];
  gated_modules?: string[];
}

@Component({
  selector: 'app-my-subscription',
  standalone: true,
  imports: [
    CommonModule,
    PageHeaderComponent,
    LoadingSkeletonComponent,
    StatusBadgeComponent,
    CfEmptyStateComponent,
  ],
  templateUrl: './my-subscription.component.html',
  styleUrl: './my-subscription.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MySubscriptionComponent implements OnInit, OnDestroy {
  private tenantService = inject(TenantService);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  loading = true;
  error: string | null = null;
  summary: MySubscriptionSummary | null = null;

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(): void {
    this.loading = true;
    this.error = null;
    this.summary = null;
    this.cdr.markForCheck();

    this.tenantService
      .getMySubscription()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.summary = res.data as MySubscriptionSummary;
          } else {
            this.error = this.friendlyError(res.message, null);
          }
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          const message = err?.message || err?.error?.message || null;
          const status = typeof err?.status === 'number' ? err.status : null;
          this.error = this.friendlyError(message, status);
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      TRIAL: 'Trial',
      ACTIVE: 'Active',
      LIFETIME: 'Lifetime',
      EXPIRING: 'Expiring soon',
      GRACE_PERIOD: 'Grace period',
      EXPIRED: 'Expired',
      SUSPENDED: 'Suspended',
    };
    return map[status] || status;
  }

  statusTone(status: string): StatusBadgeTone {
    switch (status) {
      case 'ACTIVE':
      case 'LIFETIME':
      case 'TRIAL':
        return 'success';
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

  formatDate(value: string | null | undefined): string {
    if (!value) {
      return '—';
    }
    try {
      return new Date(value).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return value;
    }
  }

  formatUsers(value: number | null | undefined): string {
    if (value == null) {
      return '—';
    }
    if (value >= 999999) {
      return 'Unlimited';
    }
    return value.toLocaleString();
  }

  formatStorage(value: number | null | undefined): string {
    if (value == null) {
      return '—';
    }
    if (value >= 1024) {
      const gb = value / 1024;
      const rounded = gb >= 10 ? Math.round(gb) : Math.round(gb * 10) / 10;
      return `${rounded.toLocaleString()} GB`;
    }
    return `${value.toLocaleString()} MB`;
  }

  featureLabel(feature: string): string {
    const map: Record<string, string> = {
      events: 'Events',
      donations: 'Donations',
      groups: 'Groups',
      messaging: 'Messaging',
      custom_branding: 'Custom branding',
      api_access: 'API access',
      dedicated_support: 'Dedicated support',
      advanced_reporting: 'Advanced reporting',
      multi_location: 'Multi-location',
      volunteer_management: 'Volunteer management',
      ministries_associations: 'Ministries & Associations',
    };
    return map[feature] || feature.replace(/_/g, ' ');
  }

  showTrialField(summary: MySubscriptionSummary): boolean {
    if (summary.status === 'TRIAL') {
      return true;
    }
    if (!summary.trial_ends_at) {
      return false;
    }
    try {
      return new Date(summary.trial_ends_at).getTime() > Date.now();
    } catch {
      return false;
    }
  }

  subscriptionEndsLabel(summary: MySubscriptionSummary): string {
    if (summary.status === 'LIFETIME' || !summary.subscription_ends_at) {
      return 'No end date';
    }
    return this.formatDate(summary.subscription_ends_at);
  }

  accessHeadline(summary: MySubscriptionSummary): string {
    if (summary.allows_gated_access) {
      return 'Included features are available';
    }
    return 'Some features are unavailable';
  }

  accessDetail(summary: MySubscriptionSummary): string {
    switch (summary.status) {
      case 'EXPIRING':
        return summary.days_until_end != null
          ? `Your subscription ends in ${summary.days_until_end} day${summary.days_until_end === 1 ? '' : 's'}. Ask your administrator to renew access.`
          : 'Your subscription is ending soon. Ask your administrator to renew access.';
      case 'GRACE_PERIOD':
        return summary.grace_ends_at
          ? `Your end date has passed. Access continues until ${this.formatDate(summary.grace_ends_at)}. Contact your administrator to renew.`
          : 'Your end date has passed and you are in a grace period. Contact your administrator to renew.';
      case 'EXPIRED':
        return 'Your subscription has ended. Contact EkklesiaSoft or your administrator to restore access.';
      case 'SUSPENDED':
        return 'Subscription access is suspended. Contact EkklesiaSoft or your administrator.';
      case 'TRIAL':
        return summary.trial_ends_at
          ? `You are on a trial until ${this.formatDate(summary.trial_ends_at)}.`
          : 'You are on a trial plan.';
      case 'LIFETIME':
        return 'This church has lifetime access with no end date.';
      default:
        return summary.allows_gated_access
          ? 'Your church can use the features included in this plan.'
          : 'Contact your administrator if you need access restored.';
    }
  }

  showAccessNotice(summary: MySubscriptionSummary): boolean {
    return ['EXPIRING', 'GRACE_PERIOD', 'EXPIRED', 'SUSPENDED'].includes(summary.status);
  }

  private friendlyError(message: string | null | undefined, status: number | null): string {
    if (status === 403) {
      return 'You do not have permission to view this church\'s subscription.';
    }
    if (status === 404) {
      return 'We could not find a subscription for this church.';
    }
    if (message && !/exception|stack|sql|internal server/i.test(message)) {
      return message;
    }
    return 'Unable to load subscription details. Please try again.';
  }
}
