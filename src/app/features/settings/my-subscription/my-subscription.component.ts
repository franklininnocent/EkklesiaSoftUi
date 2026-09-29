import { Component, OnDestroy, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TenantService } from '@core/services/tenant.service';
import { EntitlementService } from '@core/services/entitlement.service';
import { ToastService } from '@core/services/toast.service';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { StatusBadgeComponent, StatusBadgeTone } from '@shared/components/status-badge/status-badge.component';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { CfCurrencyPipe } from '@shared/pipes/cf-currency.pipe';
import { PlanComparisonComponent } from '@features/subscriptions/components/plan-comparison/plan-comparison.component';
import { TenantSubscriptionService } from '@features/subscriptions/services/tenant-subscription.service';
import { subscriptionErrorMessage } from '@features/subscriptions/services/subscription-admin.service';
import { BillingInterval, PublicPlanCard } from '@features/subscriptions/models/subscription-admin.models';
import {
  TenantSubscriptionOverview,
  UpgradeRequest,
  UpgradeRequestStatus,
  UsageLevel,
  UsageRow,
} from '@features/subscriptions/models/tenant-subscription.models';
import { Subject, catchError, finalize, forkJoin, of, takeUntil } from 'rxjs';

const FEATURE_CODE_PATTERN = /^[A-Za-z][A-Za-z0-9_]{1,63}$/;

export interface MySubscriptionSummary {
  status: string;
  access_mode?: 'full' | 'read_only';
  is_read_only?: boolean;
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
    CfCurrencyPipe,
    FormsModule,
    PlanComparisonComponent,
  ],
  templateUrl: './my-subscription.component.html',
  styleUrl: './my-subscription.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MySubscriptionComponent implements OnInit, OnDestroy {
  private tenantService = inject(TenantService);
  private subscriptions = inject(TenantSubscriptionService);
  private entitlements = inject(EntitlementService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  loading = true;
  error: string | null = null;
  summary: MySubscriptionSummary | null = null;
  overview: TenantSubscriptionOverview | null = null;
  plans: PublicPlanCard[] = [];
  requests: UpgradeRequest[] = [];

  /** Feature the church was trying to use when it landed here (from the feature-unavailable page). */
  askedFeature: string | null = null;
  selectedPlan: PublicPlanCard | null = null;
  requestInterval: BillingInterval | null = null;
  requestMessage = '';
  submitting = false;
  requestError: string | null = null;

  ngOnInit(): void {
    const asked = this.route.snapshot.queryParamMap.get('request');
    this.askedFeature = asked && FEATURE_CODE_PATTERN.test(asked) ? asked.toUpperCase() : null;
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
            this.loadPlanDetails();
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

  /** Plan, usage, catalog and requests are extras: if any fail, the lifecycle view still shows. */
  private loadPlanDetails(): void {
    forkJoin({
      overview: this.subscriptions.overview().pipe(catchError(() => of(null))),
      plans: this.subscriptions.publicPlans(),
      requests: this.subscriptions.upgradeRequests().pipe(catchError(() => of([] as UpgradeRequest[]))),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ overview, plans, requests }) => {
        this.overview = overview;
        this.plans = plans;
        this.requests = requests;
        this.cdr.markForCheck();
      });
  }

  get planName(): string {
    return this.overview?.plan?.name || this.summary?.plan_name || '—';
  }

  get currentPlanCode(): string | null {
    return this.overview?.plan?.code ?? null;
  }

  get openRequest(): UpgradeRequest | null {
    return this.requests.find((r) => r.status === 'PENDING' || r.status === 'INFO_REQUESTED') ?? null;
  }

  /** A pending request blocks new ones; an info request lets the church answer by re-sending. */
  get canRequest(): boolean {
    return !this.submitting && this.openRequest?.status !== 'PENDING';
  }

  get enabledFeatures(): { code: string; name: string }[] {
    return (this.overview?.entitlements ?? []).filter((e) => e.enabled && !e.is_core);
  }

  get askedFeatureName(): string | null {
    return this.askedFeature ? this.entitlements.featureName(this.askedFeature) : null;
  }

  intervalLabel(interval: string | null | undefined): string {
    switch (interval) {
      case 'MONTHLY':
        return 'per month';
      case 'ANNUAL':
        return 'per year';
      case 'CUSTOM':
        return 'custom agreement';
      default:
        return '';
    }
  }

  intervalOptionLabel(interval: BillingInterval): string {
    return interval === 'MONTHLY' ? 'Monthly' : interval === 'ANNUAL' ? 'Yearly' : 'Custom agreement';
  }

  usageText(row: UsageRow): string {
    if (row.unlimited || row.limit === null) {
      return `${row.usage.toLocaleString()} used · no limit`;
    }
    return `${row.usage.toLocaleString()} of ${row.limit.toLocaleString()} used`;
  }

  usagePercent(row: UsageRow): number {
    if (row.unlimited || row.limit === null || row.limit <= 0) {
      return 0;
    }
    return Math.min(100, Math.round((row.usage / row.limit) * 100));
  }

  /** Text accompanies the bar colour so the level never depends on colour alone. */
  usageLevelLabel(level: UsageLevel): string {
    switch (level) {
      case 'notice':
        return 'Getting busy';
      case 'warning':
        return 'Nearly full';
      case 'critical':
        return 'Almost full';
      case 'at_limit':
        return 'Full';
      case 'over_limit':
        return 'Over the limit';
      default:
        return 'Plenty of room';
    }
  }

  requestStatusLabel(status: UpgradeRequestStatus): string {
    switch (status) {
      case 'PENDING':
        return 'Waiting for review';
      case 'INFO_REQUESTED':
        return 'More information needed';
      case 'APPROVED':
        return 'Approved';
      case 'REJECTED':
        return 'Not approved';
      default:
        return 'Cancelled';
    }
  }

  requestStatusTone(status: UpgradeRequestStatus): StatusBadgeTone {
    switch (status) {
      case 'APPROVED':
        return 'success';
      case 'PENDING':
      case 'INFO_REQUESTED':
        return 'warning';
      case 'REJECTED':
        return 'critical';
      default:
        return 'neutral';
    }
  }

  choosePlan(plan: PublicPlanCard): void {
    this.selectedPlan = plan;
    this.requestError = null;
    const intervals = plan.billing_intervals ?? [];
    this.requestInterval = intervals.includes('ANNUAL') ? 'ANNUAL' : intervals[0] ?? null;
    this.cdr.markForCheck();
  }

  cancelRequest(): void {
    this.selectedPlan = null;
    this.requestError = null;
    this.cdr.markForCheck();
  }

  submitRequest(): void {
    const plan = this.selectedPlan;
    if (!plan || this.submitting) {
      return;
    }
    this.submitting = true;
    this.requestError = null;
    this.cdr.markForCheck();

    const featureCode =
      this.askedFeature && (plan.features ?? []).some((f) => f.code === this.askedFeature) ? this.askedFeature : null;

    this.subscriptions
      .submitUpgradeRequest({
        plan_code: plan.code,
        billing_interval: plan.pricing_type === 'CUSTOM' ? null : this.requestInterval,
        feature_code: featureCode,
        message: this.requestMessage.trim() || null,
      })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.submitting = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: ({ request, message }) => {
          this.requests = [request, ...this.requests.filter((r) => r.id !== request.id)];
          this.selectedPlan = null;
          this.requestMessage = '';
          this.toast.success(message, 'Request sent');
        },
        error: (err) => {
          this.requestError = subscriptionErrorMessage(err, 'We could not send your request. Please try again.');
        },
      });
  }

  trackByRequest(_index: number, request: UpgradeRequest): number {
    return request.id;
  }

  trackByUsage(_index: number, row: UsageRow): string {
    return row.code;
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

  /** Legacy module keys (shown only when the plan catalog is unavailable). */
  featureLabel(feature: string): string {
    return this.entitlements.featureName(feature);
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
    if (summary.status === 'EXPIRED' || summary.status === 'SUSPENDED') {
      return 'Read-only mode';
    }
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
        return 'Your subscription has ended. You can view, print, and download records, but you cannot save changes. Contact EkklesiaSoft or your administrator to renew.';
      case 'SUSPENDED':
        return 'Subscription access is suspended. You can view records, but you cannot save changes. Contact EkklesiaSoft or your administrator.';
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
