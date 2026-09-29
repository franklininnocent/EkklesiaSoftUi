import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, filter, switchMap, takeUntil } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { ConfirmationDialogService } from '@core/services/confirmation-dialog.service';
import { ToastService } from '@core/services/toast.service';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { StatusBadgeComponent, StatusBadgeTone } from '@shared/components/status-badge/status-badge.component';
import { CfCurrencyPipe } from '@shared/pipes/cf-currency.pipe';
import {
  AdminTenantSubscription,
  CatalogFeature,
  EntitlementOverride,
  OverrideMode,
  UsageRow,
} from '../../models/subscription-admin.models';
import { SubscriptionAdminService, subscriptionErrorMessage } from '../../services/subscription-admin.service';
import { subscriptionAdminCapabilities } from '../../services/subscription-admin-access';
import { ChangePlanDialogComponent } from '../change-plan-dialog/change-plan-dialog.component';

const NUMERIC_TYPES = new Set(['LIMIT', 'QUOTA', 'USAGE']);
const MODE_LABELS: Record<OverrideMode, string> = {
  ENABLE: 'Turn on',
  DISABLE: 'Turn off',
  SET_LIMIT: 'Set a different limit',
  UNLIMITED: 'Make unlimited',
  SET_TIER: 'Set a level',
};

interface GrantForm {
  feature_code: string;
  mode: OverrideMode;
  numeric_value: number | null;
  tier_value: string | null;
  effective_until: string;
  reason: string;
}

/**
 * A church's plan on the platform tenant page: current plan, usage against limits,
 * plan changes and per-church exceptions (overrides). Platform staff only.
 */
@Component({
  selector: 'app-tenant-plan-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LoadingSkeletonComponent,
    ModalShellComponent,
    StatusBadgeComponent,
    CfCurrencyPipe,
    ChangePlanDialogComponent,
  ],
  templateUrl: './tenant-plan-panel.component.html',
  styleUrls: ['../../styles/subscription-admin.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TenantPlanPanelComponent implements OnChanges, OnDestroy {
  private readonly api = inject(SubscriptionAdminService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmationDialogService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  @Input({ required: true }) tenantId!: number;
  /** Emitted after a plan change so the host page can refresh lifecycle details. */
  @Output() planChanged = new EventEmitter<void>();

  readonly can = subscriptionAdminCapabilities(this.auth);

  data: AdminTenantSubscription | null = null;
  loading = false;
  error: string | null = null;
  changeOpen = false;

  features: CatalogFeature[] = [];
  grantOpen = false;
  grantSaving = false;
  grant: GrantForm = this.blankGrant();

  get activeOverrides(): EntitlementOverride[] {
    return (this.data?.overrides ?? []).filter((o) => !o.revoked_at && !this.isExpired(o));
  }

  get pastOverrides(): EntitlementOverride[] {
    return (this.data?.overrides ?? []).filter((o) => !!o.revoked_at || this.isExpired(o)).slice(0, 10);
  }

  get limitedUsage(): UsageRow[] {
    return this.data?.usage ?? [];
  }

  get selectedFeature(): CatalogFeature | null {
    return this.features.find((f) => f.code === this.grant.feature_code) ?? null;
  }

  get modeOptions(): { value: OverrideMode; label: string }[] {
    const f = this.selectedFeature;
    if (!f) return [];
    let modes: OverrideMode[];
    if (NUMERIC_TYPES.has(f.feature_type)) modes = ['SET_LIMIT', 'UNLIMITED'];
    else if (f.feature_type === 'TIER') modes = ['SET_TIER', 'DISABLE'];
    else modes = f.is_core ? ['ENABLE'] : ['ENABLE', 'DISABLE'];
    return modes.map((value) => ({ value, label: MODE_LABELS[value] }));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['tenantId'] && this.tenantId) this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(): void {
    if (!this.can.usage) return;
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();
    this.api
      .tenantSubscription(this.tenantId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.data = data;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error = subscriptionErrorMessage(err, 'Unable to load this church’s plan.');
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  usageTone(row: UsageRow): StatusBadgeTone {
    switch (row.level) {
      case 'over_limit':
        return 'critical';
      case 'at_limit':
      case 'critical':
      case 'warning':
        return 'warning';
      case 'notice':
        return 'info';
      default:
        return 'success';
    }
  }

  usageLabel(row: UsageRow): string {
    if (row.unlimited) return `${row.usage.toLocaleString()} (unlimited)`;
    return `${row.usage.toLocaleString()} of ${(row.limit ?? 0).toLocaleString()}${row.unit ? ' ' + row.unit : ''}`;
  }

  usagePercent(row: UsageRow): number {
    return Math.min(100, Math.max(0, row.percent_used ?? 0));
  }

  intervalLabel(interval: string | undefined | null): string {
    return interval === 'ANNUAL' ? 'Yearly' : interval === 'MONTHLY' ? 'Monthly' : 'Custom term';
  }

  overrideLabel(o: EntitlementOverride): string {
    switch (o.mode) {
      case 'SET_LIMIT':
        return `Limit set to ${(o.numeric_value ?? 0).toLocaleString()}`;
      case 'UNLIMITED':
        return 'Unlimited';
      case 'SET_TIER':
        return `Level: ${o.tier_value}`;
      case 'DISABLE':
        return 'Turned off';
      default:
        return 'Turned on';
    }
  }

  openChange(): void {
    this.changeOpen = true;
    this.cdr.markForCheck();
  }

  onPlanChanged(data: AdminTenantSubscription): void {
    this.data = data;
    this.changeOpen = false;
    this.planChanged.emit();
    this.cdr.markForCheck();
  }

  cancelPending(): void {
    const pending = this.data?.pending_change;
    if (!pending) return;
    this.confirm
      .confirm({
        title: 'Cancel the scheduled plan change?',
        message: `The change to ${pending.plan_name ?? 'the new plan'} will not happen. The current plan stays.`,
        confirmText: 'Cancel change',
        showDescriptionInput: true,
        descriptionLabel: 'Reason (kept in history)',
      })
      .pipe(
        filter((r) => r.confirmed),
        switchMap((r) => this.api.cancelPendingChange(this.tenantId, r.description?.trim() || null)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: () => {
          this.toast.success('Scheduled change cancelled.', 'Cancelled');
          this.load();
        },
        error: (err) => this.toast.error(subscriptionErrorMessage(err, 'Unable to cancel the change.'), 'Not cancelled'),
      });
  }

  openGrant(): void {
    this.grant = this.blankGrant();
    this.grantOpen = true;
    if (!this.features.length) {
      this.api
        .listFeatures()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (features) => {
            this.features = features.filter((f) => f.is_active);
            this.cdr.markForCheck();
          },
          error: (err) => this.toast.error(subscriptionErrorMessage(err, 'Unable to load features.'), 'Error'),
        });
    }
    this.cdr.markForCheck();
  }

  closeGrant(): void {
    if (this.grantSaving) return;
    this.grantOpen = false;
    this.cdr.markForCheck();
  }

  onFeatureChosen(): void {
    this.grant.mode = this.modeOptions[0]?.value ?? 'ENABLE';
    this.grant.numeric_value = null;
    this.grant.tier_value = null;
  }

  submitGrant(): void {
    const g = this.grant;
    if (this.grantSaving) return;
    if (!g.feature_code) {
      this.toast.error('Choose a feature.', 'Check your entries');
      return;
    }
    if (g.mode === 'SET_LIMIT') {
      const v = Number(g.numeric_value);
      if (!Number.isInteger(v) || v < 0) {
        this.toast.error('Enter a whole number of 0 or more.', 'Check your entries');
        return;
      }
    }
    if (g.mode === 'SET_TIER' && !g.tier_value) {
      this.toast.error('Choose a level.', 'Check your entries');
      return;
    }
    let until: string | null = null;
    if (g.effective_until) {
      const at = new Date(g.effective_until);
      if (Number.isNaN(at.getTime()) || at.getTime() <= Date.now()) {
        this.toast.error('The end date must be in the future.', 'Check your entries');
        return;
      }
      until = at.toISOString();
    }
    const reason = g.reason.trim();
    if (reason.length < 3) {
      this.toast.error('Add a short reason (at least 3 characters).', 'Reason required');
      return;
    }

    this.grantSaving = true;
    this.cdr.markForCheck();
    this.api
      .grantOverride(this.tenantId, {
        feature_code: g.feature_code,
        mode: g.mode,
        numeric_value: g.mode === 'SET_LIMIT' ? Number(g.numeric_value) : null,
        tier_value: g.mode === 'SET_TIER' ? g.tier_value : null,
        effective_until: until,
        reason,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.grantSaving = false;
          this.grantOpen = false;
          this.toast.success('Exception added for this church.', 'Saved');
          this.load();
        },
        error: (err) => {
          this.grantSaving = false;
          this.toast.error(subscriptionErrorMessage(err, 'Unable to add the exception.'), 'Not saved');
          this.cdr.markForCheck();
        },
      });
  }

  revoke(o: EntitlementOverride): void {
    this.confirm
      .confirm({
        title: `End the exception for ${o.feature_name ?? o.feature_code}?`,
        message: 'The church goes back to what its plan includes. No records are deleted.',
        confirmText: 'End exception',
        variant: 'danger',
        showDescriptionInput: true,
        descriptionLabel: 'Reason (kept in history)',
      })
      .pipe(
        filter((r) => r.confirmed),
        switchMap((r) => this.api.revokeOverride(this.tenantId, o.id, r.description?.trim() || null)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: () => {
          this.toast.success('Exception ended.', 'Done');
          this.load();
        },
        error: (err) => this.toast.error(subscriptionErrorMessage(err, 'Unable to end the exception.'), 'Not ended'),
      });
  }

  private isExpired(o: EntitlementOverride): boolean {
    return !!o.effective_until && new Date(o.effective_until).getTime() <= Date.now();
  }

  private blankGrant(): GrantForm {
    return { feature_code: '', mode: 'ENABLE', numeric_value: null, tier_value: null, effective_until: '', reason: '' };
  }
}
