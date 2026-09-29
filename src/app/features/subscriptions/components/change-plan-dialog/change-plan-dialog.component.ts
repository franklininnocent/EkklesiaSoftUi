import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { ToastService } from '@core/services/toast.service';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { CfCurrencyPipe } from '@shared/pipes/cf-currency.pipe';
import {
  AdminTenantSubscription,
  BillingInterval,
  CatalogPlan,
  PlanChangePreview,
} from '../../models/subscription-admin.models';
import { SubscriptionAdminService, subscriptionErrorCode, subscriptionErrorMessage } from '../../services/subscription-admin.service';

const MONEY_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;
const INTERVAL_LABELS: Record<BillingInterval, string> = { MONTHLY: 'Monthly', ANNUAL: 'Yearly', CUSTOM: 'Custom term' };

/**
 * Change a church's plan: pick a plan, see what changes, then confirm with a reason.
 * The tenant comes from the page route; the API re-checks permissions and impact.
 */
@Component({
  selector: 'app-change-plan-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalShellComponent, LoadingSkeletonComponent, CfCurrencyPipe],
  templateUrl: './change-plan-dialog.component.html',
  styleUrls: ['../../styles/subscription-admin.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangePlanDialogComponent implements OnInit, OnDestroy {
  private readonly api = inject(SubscriptionAdminService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();
  private readonly preview$ = new Subject<void>();

  @Input({ required: true }) tenantId!: number;
  @Input({ required: true }) current!: AdminTenantSubscription;
  @Output() closed = new EventEmitter<void>();
  @Output() changed = new EventEmitter<AdminTenantSubscription>();

  plans: CatalogPlan[] = [];
  plansLoading = true;
  plansError: string | null = null;

  selected: CatalogPlan | null = null;
  interval: BillingInterval | null = null;
  contractedPrice = '';
  durationMonths: number | null = 12;
  startTrial = false;
  scheduleLater = false;
  scheduledFor = '';
  reason = '';
  confirmImpact = false;

  preview: PlanChangePreview | null = null;
  previewLoading = false;
  submitting = false;

  get intervals(): BillingInterval[] {
    return this.selected?.active_version?.billing_intervals ?? [];
  }

  get listPrice(): string | null {
    const v = this.selected?.active_version;
    if (!v) return null;
    if (this.interval === 'ANNUAL') return v.annual_price;
    if (this.interval === 'MONTHLY') return v.monthly_price;
    return null;
  }

  get isCurrentPlan(): boolean {
    return !!this.selected && this.selected.code === this.current.plan?.code;
  }

  intervalLabel(i: BillingInterval): string {
    return INTERVAL_LABELS[i];
  }

  ngOnInit(): void {
    this.api
      .listPlans()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (plans) => {
          this.plans = plans.filter((p) => p.is_assignable && p.status !== 'ARCHIVED' && !!p.active_version);
          this.plansLoading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.plansError = subscriptionErrorMessage(err, 'Unable to load plans.');
          this.plansLoading = false;
          this.cdr.markForCheck();
        },
      });
  }

  ngOnDestroy(): void {
    this.preview$.next();
    this.destroy$.next();
    this.destroy$.complete();
  }

  close(): void {
    if (!this.submitting) this.closed.emit();
  }

  choose(plan: CatalogPlan): void {
    if (this.submitting) return;
    this.selected = plan;
    const intervals = plan.active_version?.billing_intervals ?? [];
    const currentInterval = this.current.terms?.billing_interval ?? null;
    this.interval = currentInterval && intervals.includes(currentInterval) ? currentInterval : (intervals[0] ?? null);
    this.contractedPrice = '';
    this.startTrial = false;
    this.confirmImpact = false;
    this.loadPreview(plan);
  }

  formatChange(value: number | null): string {
    return value === null ? 'Unlimited' : value.toLocaleString();
  }

  submit(): void {
    const plan = this.selected;
    if (!plan || this.submitting || this.previewLoading) return;
    const reason = this.reason.trim();
    if (reason.length < 3) {
      this.toast.error('Add a short reason (at least 3 characters).', 'Reason required');
      return;
    }
    const price = this.contractedPrice.trim();
    if (price !== '' && !MONEY_PATTERN.test(price)) {
      this.toast.error('Agreed price: numbers only, up to 2 decimals.', 'Check your entries');
      return;
    }
    const months = this.durationMonths === null || `${this.durationMonths}` === '' ? null : Number(this.durationMonths);
    if (months !== null && (!Number.isInteger(months) || months < 1 || months > 120)) {
      this.toast.error('Duration must be 1 to 120 months.', 'Check your entries');
      return;
    }
    let scheduledFor: string | null = null;
    if (this.scheduleLater) {
      const at = this.scheduledFor ? new Date(this.scheduledFor) : null;
      if (!at || Number.isNaN(at.getTime()) || at.getTime() <= Date.now()) {
        this.toast.error('Choose a future date for the change.', 'Check the date');
        return;
      }
      scheduledFor = at.toISOString();
    }
    if (this.preview?.requires_confirmation && !this.confirmImpact) {
      this.toast.warning('Confirm that you understand what this church will lose.', 'Please confirm');
      return;
    }

    this.submitting = true;
    this.cdr.markForCheck();
    this.api
      .assignPlan(this.tenantId, {
        plan_id: plan.id,
        billing_interval: this.interval,
        contracted_price: price === '' ? null : price,
        duration_months: months,
        start_trial: this.startTrial,
        scheduled_for: scheduledFor,
        confirm_impact: this.confirmImpact,
        reason,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.submitting = false;
          this.toast.success(res.message || 'Plan updated.', scheduledFor ? 'Scheduled' : 'Saved');
          this.changed.emit(res.data);
        },
        error: (err) => {
          this.submitting = false;
          if (subscriptionErrorCode(err) === 'PLAN_CHANGE_REQUIRES_CONFIRMATION') {
            this.toast.warning('Usage changed since the preview. Please review again.', 'Review needed');
            this.loadPreview(plan);
          } else {
            this.toast.error(subscriptionErrorMessage(err, 'Unable to change the plan.'), 'Not changed');
          }
          this.cdr.markForCheck();
        },
      });
  }

  private loadPreview(plan: CatalogPlan): void {
    this.preview$.next();
    this.preview = null;
    this.previewLoading = true;
    this.confirmImpact = false;
    this.cdr.markForCheck();
    this.api
      .previewPlanChange(this.tenantId, plan.id)
      .pipe(takeUntil(this.preview$), takeUntil(this.destroy$))
      .subscribe({
        next: (preview) => {
          this.preview = preview;
          this.previewLoading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.previewLoading = false;
          this.toast.error(subscriptionErrorMessage(err, 'Unable to preview this change.'), 'Preview failed');
          this.cdr.markForCheck();
        },
      });
  }
}
