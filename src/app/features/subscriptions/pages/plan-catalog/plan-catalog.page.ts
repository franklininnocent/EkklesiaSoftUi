import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subject, filter, switchMap, takeUntil } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { ConfirmationDialogService } from '@core/services/confirmation-dialog.service';
import { ToastService } from '@core/services/toast.service';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { StatusBadgeComponent } from '@shared/components/status-badge/status-badge.component';
import { ActionBarIconComponent } from '@shared/components/action-bar/action-bar-icon.component';
import { CfCurrencyPipe } from '@shared/pipes/cf-currency.pipe';
import { CatalogPlan, PricingType } from '../../models/subscription-admin.models';
import { SubscriptionAdminService, subscriptionErrorMessage } from '../../services/subscription-admin.service';
import { subscriptionAdminCapabilities } from '../../services/subscription-admin-access';

const CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,63}$/;

@Component({
  selector: 'app-plan-catalog-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    CfEmptyStateComponent,
    LoadingSkeletonComponent,
    ModalShellComponent,
    StatusBadgeComponent,
    ActionBarIconComponent,
    CfCurrencyPipe,
  ],
  templateUrl: './plan-catalog.page.html',
  styleUrls: ['../../styles/subscription-admin.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanCatalogPage implements OnInit, OnDestroy {
  private readonly api = inject(SubscriptionAdminService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmationDialogService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  readonly can = subscriptionAdminCapabilities(this.auth);
  readonly pricingTypes: { value: PricingType; label: string }[] = [
    { value: 'FIXED', label: 'Fixed price' },
    { value: 'CUSTOM', label: 'Custom (quoted per church)' },
    { value: 'FREE', label: 'Free' },
  ];

  plans: CatalogPlan[] = [];
  loading = false;
  error: string | null = null;
  showLegacy = false;
  showArchived = false;

  saving = false;
  createOpen = false;
  createForm = { code: '', name: '', pricing_type: 'FIXED' as PricingType, short_description: '' };

  duplicateSource: CatalogPlan | null = null;
  duplicateForm = { code: '', name: '' };

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
    this.api
      .listPlans({ includeLegacy: this.showLegacy, includeArchived: this.showArchived })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (plans) => {
          this.plans = plans;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error = subscriptionErrorMessage(err, 'Unable to load plans.');
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  trackPlan(_: number, plan: CatalogPlan): number {
    return plan.id;
  }

  statusLabel(plan: CatalogPlan): { label: string; tone: 'success' | 'neutral' | 'warning' | 'info' } {
    if (plan.status === 'ARCHIVED') return { label: 'Archived', tone: 'neutral' };
    if (!plan.active_version) return { label: 'Not published', tone: 'warning' };
    if (plan.is_legacy) return { label: 'Legacy', tone: 'neutral' };
    return { label: plan.is_public ? 'Published' : 'Private', tone: plan.is_public ? 'success' : 'info' };
  }

  openCreate(): void {
    this.createForm = { code: '', name: '', pricing_type: 'FIXED', short_description: '' };
    this.createOpen = true;
    this.cdr.markForCheck();
  }

  closeCreate(): void {
    if (this.saving) return;
    this.createOpen = false;
    this.cdr.markForCheck();
  }

  normalizeCode(value: string): string {
    return (value || '').toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  }

  submitCreate(): void {
    const code = this.normalizeCode(this.createForm.code);
    const name = this.createForm.name.trim();
    if (!CODE_PATTERN.test(code) || code.startsWith('LEGACY_')) {
      this.toast.error('Use 2–64 capital letters, numbers or underscores, starting with a letter.', 'Check the plan code');
      return;
    }
    if (name.length < 2) {
      this.toast.error('Enter a plan name.', 'Check your entries');
      return;
    }
    this.saving = true;
    this.cdr.markForCheck();
    this.api
      .createPlan({
        code,
        name,
        pricing_type: this.createForm.pricing_type,
        short_description: this.createForm.short_description.trim() || null,
        is_public: false,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (plan) => {
          this.saving = false;
          this.createOpen = false;
          this.toast.success(`${plan.name} created as a private draft.`, 'Plan created');
          void this.router.navigate(['/settings/subscription/plans', plan.id]);
        },
        error: (err) => {
          this.saving = false;
          this.toast.error(subscriptionErrorMessage(err, 'Unable to create the plan.'), 'Not created');
          this.cdr.markForCheck();
        },
      });
  }

  openDuplicate(plan: CatalogPlan): void {
    this.duplicateSource = plan;
    this.duplicateForm = { code: `${plan.code}_COPY`.slice(0, 64), name: `${plan.name} (copy)` };
    this.cdr.markForCheck();
  }

  closeDuplicate(): void {
    if (this.saving) return;
    this.duplicateSource = null;
    this.cdr.markForCheck();
  }

  submitDuplicate(): void {
    const source = this.duplicateSource;
    if (!source) return;
    const code = this.normalizeCode(this.duplicateForm.code);
    if (!CODE_PATTERN.test(code) || code.startsWith('LEGACY_')) {
      this.toast.error('Use 2–64 capital letters, numbers or underscores, starting with a letter.', 'Check the plan code');
      return;
    }
    this.saving = true;
    this.cdr.markForCheck();
    this.api
      .duplicatePlan(source.id, { code, name: this.duplicateForm.name.trim() })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (copy) => {
          this.saving = false;
          this.duplicateSource = null;
          this.toast.success(`${copy.name} is a private draft copy of ${source.name}.`, 'Plan duplicated');
          void this.router.navigate(['/settings/subscription/plans', copy.id]);
        },
        error: (err) => {
          this.saving = false;
          this.toast.error(subscriptionErrorMessage(err, 'Unable to duplicate the plan.'), 'Not duplicated');
          this.cdr.markForCheck();
        },
      });
  }

  archive(plan: CatalogPlan): void {
    const occupied = plan.tenant_count > 0;
    const message = occupied
      ? `${plan.tenant_count} ${plan.tenant_count === 1 ? 'church is' : 'churches are'} on this plan. They keep their current version and data. New churches cannot be assigned. Scheduled moves onto this plan will not complete after archive.`
      : 'Archived plans cannot be assigned to new churches. Churches already on this plan keep their features and data.';
    this.confirm
      .confirm({
        title: `Archive ${plan.name}?`,
        message,
        confirmText: 'Archive plan',
        variant: 'danger',
        showDescriptionInput: true,
        descriptionLabel: 'Reason (kept in change history)',
      })
      .pipe(
        filter((r) => r.confirmed),
        switchMap((r) =>
          this.api.archivePlan(plan.id, r.description, { confirmAssignedChurches: occupied }),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: () => {
          this.toast.success(`${plan.name} archived.`, 'Archived');
          this.load();
        },
        error: (err) => this.toast.error(subscriptionErrorMessage(err, 'Unable to archive the plan.'), 'Not archived'),
      });
  }

  deletePlan(plan: CatalogPlan): void {
    this.confirm
      .confirm({
        title: `Delete ${plan.name}?`,
        message:
          'This permanently removes the plan from the catalog. Churches already on other plans are not changed. This cannot be undone from this screen.',
        confirmText: 'Delete plan',
        variant: 'danger',
        showDescriptionInput: true,
        descriptionLabel: 'Reason (kept in change history)',
      })
      .pipe(
        filter((r) => r.confirmed),
        switchMap((r) => this.api.deletePlan(plan.id, r.description)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: () => {
          this.toast.success(`${plan.name} deleted.`, 'Deleted');
          this.load();
        },
        error: (err) => this.toast.error(subscriptionErrorMessage(err, 'Unable to delete the plan.'), 'Not deleted'),
      });
  }

  restore(plan: CatalogPlan): void {
    this.confirm
      .confirm({
        title: `Restore ${plan.name}?`,
        message: 'The plan becomes assignable again. It stays private until you make it public.',
        confirmText: 'Restore plan',
        showDescriptionInput: true,
        descriptionLabel: 'Reason (kept in change history)',
      })
      .pipe(
        filter((r) => r.confirmed),
        switchMap((r) => this.api.restorePlan(plan.id, r.description)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: () => {
          this.toast.success(`${plan.name} restored.`, 'Restored');
          this.load();
        },
        error: (err) => this.toast.error(subscriptionErrorMessage(err, 'Unable to restore the plan.'), 'Not restored'),
      });
  }
}
