import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@core/services/toast.service';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { CatalogPlan, OverLimitBehavior, PoliciesPayload, PoliciesUpdate } from '../../models/subscription-admin.models';
import { SubscriptionAdminService, subscriptionErrorMessage } from '../../services/subscription-admin.service';
import { subscriptionAdminCapabilities } from '../../services/subscription-admin-access';

const FLOW_LABELS: Record<string, { label: string; help: string }> = {
  sacrament_recipient: {
    label: 'Recording a sacrament',
    help: 'A person receiving a sacrament can always be added, even at the people limit.',
  },
  marriage_transition: {
    label: 'Marriage household changes',
    help: 'Creating a new household or adding a spouse after a marriage.',
  },
  family_split: {
    label: 'Splitting a family',
    help: 'Moving a member into their own new family.',
  },
};

interface PolicyForm {
  default_plan_id: number | null;
  thresholds: string;
  over_limit_behavior: OverLimitBehavior;
  exempt: Record<string, boolean>;
  currency_code: string;
  allow_trial_on_assignment: boolean;
  max_trial_days: number;
  upgrade_requests_enabled: boolean;
  reason: string;
}

@Component({
  selector: 'app-subscription-policies-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, LoadingSkeletonComponent],
  templateUrl: './subscription-policies.page.html',
  styleUrls: ['../../styles/subscription-admin.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubscriptionPoliciesPage implements OnInit, OnDestroy {
  private readonly api = inject(SubscriptionAdminService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  readonly can = subscriptionAdminCapabilities(this.auth);

  payload: PoliciesPayload | null = null;
  defaultPlanOptions: CatalogPlan[] = [];
  form: PolicyForm | null = null;
  loading = false;
  saving = false;
  error: string | null = null;

  get readonly(): boolean {
    return !this.can.policies;
  }

  flowLabel(flow: string): { label: string; help: string } {
    return FLOW_LABELS[flow] ?? { label: flow.replace(/_/g, ' '), help: '' };
  }

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
    this.cdr.markForCheck();
    forkJoin({ policies: this.api.getPolicies(), plans: this.api.listPlans() })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ policies, plans }) => {
          this.apply(policies);
          this.defaultPlanOptions = plans.filter(
            (p) => p.is_assignable && !p.is_legacy && p.status !== 'ARCHIVED' && p.pricing_type !== 'CUSTOM' && !!p.active_version,
          );
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error = subscriptionErrorMessage(err, 'Unable to load subscription policies.');
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  save(): void {
    const f = this.form;
    if (!f || this.readonly || this.saving) return;
    const thresholds = f.thresholds
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .map(Number);
    if (!thresholds.length || thresholds.length > 6 || thresholds.some((t) => !Number.isInteger(t) || t < 1 || t > 100)) {
      this.toast.error('Warnings must be 1 to 6 whole percentages between 1 and 100.', 'Check your entries');
      return;
    }
    if (new Set(thresholds).size !== thresholds.length) {
      this.toast.error('Each warning percentage can only appear once.', 'Check your entries');
      return;
    }
    const currency = f.currency_code.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      this.toast.error('Currency must be a 3-letter code.', 'Check your entries');
      return;
    }
    const maxTrial = Number(f.max_trial_days);
    if (!Number.isInteger(maxTrial) || maxTrial < 0 || maxTrial > 365) {
      this.toast.error('Longest trial must be a whole number from 0 to 365.', 'Check your entries');
      return;
    }
    const reason = f.reason.trim();
    if (reason && reason.length < 3) {
      this.toast.error('The note must be at least 3 characters.', 'Check your entries');
      return;
    }

    const update: PoliciesUpdate = {
      default_plan_id: f.default_plan_id,
      usage_thresholds: thresholds,
      over_limit_behavior: f.over_limit_behavior,
      limit_exempt_flows: Object.entries(f.exempt)
        .filter(([, on]) => on)
        .map(([flow]) => flow),
      currency_code: currency,
      trial: { allow_trial_on_assignment: f.allow_trial_on_assignment, max_trial_days: maxTrial },
      upgrade_requests: { enabled: f.upgrade_requests_enabled },
      reason: reason || null,
    };

    this.saving = true;
    this.cdr.markForCheck();
    this.api
      .updatePolicies(update)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (payload) => {
          this.saving = false;
          this.apply(payload);
          this.toast.success('Subscription policies saved.', 'Saved');
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.saving = false;
          this.toast.error(subscriptionErrorMessage(err, 'Unable to save policies.'), 'Not saved');
          this.cdr.markForCheck();
        },
      });
  }

  private apply(payload: PoliciesPayload): void {
    this.payload = payload;
    const p = payload.policies;
    const exempt: Record<string, boolean> = {};
    for (const flow of payload.options.limit_exempt_flows) {
      exempt[flow] = p.limit_exempt_flows.includes(flow);
    }
    this.form = {
      default_plan_id: payload.default_plan?.id ?? null,
      thresholds: p.usage_thresholds.join(', '),
      over_limit_behavior: p.over_limit_behavior,
      exempt,
      currency_code: p.currency_code,
      allow_trial_on_assignment: p.trial.allow_trial_on_assignment,
      max_trial_days: p.trial.max_trial_days,
      upgrade_requests_enabled: p.upgrade_requests.enabled,
      reason: '',
    };
  }
}
