import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { EMPTY, Observable, Subject, debounceTime, filter, map, switchMap, takeUntil } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { ConfirmationDialogService } from '@core/services/confirmation-dialog.service';
import { ToastService } from '@core/services/toast.service';
import { CfCurrencyPipe } from '@shared/pipes/cf-currency.pipe';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { TaxConfigurationPayload, TaxPreviewBreakdown } from '../../models/subscription-admin.models';
import { SubscriptionAdminService, subscriptionErrorMessage } from '../../services/subscription-admin.service';
import { subscriptionAdminCapabilities } from '../../services/subscription-admin-access';
import { cfFormatDate } from '@shared/utils/cf-intl.util';

interface TaxForm {
  label: string;
  rate_percent: string;
  prices_include_tax: boolean;
  country_code: string;
  tax_system: string;
}

@Component({
  selector: 'app-subscription-tax-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, LoadingSkeletonComponent, CfCurrencyPipe],
  templateUrl: './subscription-tax.page.html',
  styleUrls: ['../../styles/subscription-admin.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubscriptionTaxPage implements OnInit, OnDestroy {
  private readonly api = inject(SubscriptionAdminService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmationDialogService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();
  private readonly preview$ = new Subject<void>();
  private savedSnapshot = '';

  readonly can = subscriptionAdminCapabilities(this.auth);

  payload: TaxConfigurationPayload | null = null;
  form: TaxForm | null = null;
  previewAmount = '2999.00';
  preview: TaxPreviewBreakdown | null = null;
  previewLoading = false;
  loading = false;
  saving = false;
  error: string | null = null;

  get readonly(): boolean {
    return !this.can.policies;
  }

  get dirty(): boolean {
    return this.form !== null && this.savedSnapshot !== '' && JSON.stringify(this.form) !== this.savedSnapshot;
  }

  ngOnInit(): void {
    this.preview$
      .pipe(
        debounceTime(400),
        switchMap(() => {
          if (!this.form) {
            return EMPTY;
          }
          this.previewLoading = true;
          this.cdr.markForCheck();
          const amount = this.previewAmount.trim();
          if (!/^\d{1,10}(\.\d{1,2})?$/.test(amount)) {
            this.previewLoading = false;
            this.cdr.markForCheck();
            return EMPTY;
          }
          return this.api.previewTax(amount, {
            rate_percent: this.form.rate_percent.trim(),
            prices_include_tax: this.form.prices_include_tax,
          });
        }),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (data) => {
          this.preview = data;
          this.previewLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.previewLoading = false;
          this.cdr.markForCheck();
        },
      });

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
      .getTaxConfiguration()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (payload) => {
          this.apply(payload);
          this.loading = false;
          this.cdr.markForCheck();
          this.queuePreview();
        },
        error: (err) => {
          this.error = subscriptionErrorMessage(err, 'Unable to load tax configuration.');
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  onFormChange(): void {
    this.queuePreview();
    this.cdr.markForCheck();
  }

  discard(): void {
    if (!this.payload) return;
    this.apply(this.payload);
    this.queuePreview();
    this.cdr.markForCheck();
  }

  reviewAndSave(): void {
    const f = this.form;
    const baseline = this.payload;
    if (!f || !baseline || this.readonly || this.saving) return;

    const rate = f.rate_percent.trim();
    if (!/^\d{1,3}(\.\d{1,2})?$/.test(rate) || Number(rate) > 100) {
      this.toast.error('Tax rate must be between 0 and 100.', 'Check your entries');
      return;
    }
    const label = f.label.trim();
    if (Number(rate) > 0 && !label) {
      this.toast.error('Tax name is required when the rate is greater than zero.', 'Check your entries');
      return;
    }
    const country = f.country_code.trim().toUpperCase();
    if (country && !/^[A-Z]{2}$/.test(country)) {
      this.toast.error('Country must be a 2-letter code.', 'Check your entries');
      return;
    }

    const current = baseline.tax;
    const treatment = (inclusive: boolean) => (inclusive ? 'Inclusive' : 'Exclusive');
    const impact = baseline.impact;
    const inheritingNames = impact.catalog.inheriting_plans
      .slice(0, 8)
      .map((p) => p.name)
      .join(', ');
    const more =
      impact.catalog.inheriting_count > 8 ? ` and ${impact.catalog.inheriting_count - 8} more` : '';
    const message = [
      `Current: ${current.label} ${current.rate_percent}% ${treatment(current.prices_include_tax)}.`,
      `New: ${label || 'Tax'} ${rate}% ${treatment(f.prices_include_tax)}.`,
      `${impact.catalog.inheriting_count} published plan(s) inherit the platform rate (${impact.subscriptions.inheriting_count} churches).`,
      `${impact.catalog.overridden_count} plan(s) use their own tax (${impact.subscriptions.overridden_count} churches) and will not change.`,
      inheritingNames ? `Plans that inherit: ${inheritingNames}${more}.` : '',
    ]
      .filter(Boolean)
      .join(' ');

    this.confirm
      .confirm({
        title: 'Save tax configuration?',
        message,
        confirmText: 'Save tax',
        variant: 'primary',
        showDescriptionInput: true,
        descriptionLabel: 'Note for change history (optional)',
        descriptionPlaceholder: 'Why you are changing tax',
        descriptionRequired: false,
      })
      .pipe(
        filter((r) => r.confirmed),
        takeUntil(this.destroy$),
      )
      .subscribe((result) => {
        const reason = result.description?.trim();
        if (reason && reason.length < 3) {
          this.toast.error('The note must be at least 3 characters.', 'Check your entries');
          return;
        }
        this.persist(f, label, rate, country, reason || null);
      });
  }

  canDeactivate(): boolean | Observable<boolean> {
    if (!this.dirty) {
      return true;
    }
    return this.confirm.confirmDiscardChanges('You have unsaved tax changes. Leave without saving?').pipe(map((r) => r.confirmed));
  }

  impactSummary(): string | null {
    const impact = this.payload?.impact;
    if (!impact) return null;
    const c = impact.catalog;
    const s = impact.subscriptions;
    return `${c.inheriting_count} plan${c.inheriting_count === 1 ? '' : 's'} inherit this rate · ${c.overridden_count} use their own · ${s.inheriting_count} church${s.inheriting_count === 1 ? '' : 'es'} on an inherited rate · ${s.overridden_count} on an override`;
  }

  metaLine(): string | null {
    const at = this.payload?.updated_at;
    const by = this.payload?.updated_by;
    if (!at && !by?.updated_at) return null;
    const parts: string[] = [];
    if (at) parts.push(`Settings saved ${cfFormatDate(at, 'datetime')}`);
    if (by?.actor_role) parts.push(`Last policy change by ${by.actor_role}`);
    return parts.join(' · ');
  }

  private persist(f: TaxForm, label: string, rate: string, country: string, reason: string | null): void {
    this.saving = true;
    this.cdr.markForCheck();
    this.api
      .updateTaxConfiguration({
        tax: {
          label: label || 'Tax',
          rate_percent: rate,
          prices_include_tax: f.prices_include_tax,
          jurisdiction: {
            country_code: country || 'IN',
            tax_system: f.tax_system.trim() || 'GST',
          },
        },
        reason,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (payload) => {
          this.saving = false;
          this.apply(payload);
          this.toast.success('Tax configuration saved.', 'Saved');
          this.queuePreview();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.saving = false;
          this.toast.error(subscriptionErrorMessage(err, 'Unable to save tax configuration.'), 'Not saved');
          this.cdr.markForCheck();
        },
      });
  }

  private apply(payload: TaxConfigurationPayload): void {
    this.payload = payload;
    const t = payload.tax;
    this.form = {
      label: t.label,
      rate_percent: t.rate_percent,
      prices_include_tax: t.prices_include_tax,
      country_code: t.jurisdiction?.country_code ?? 'IN',
      tax_system: t.jurisdiction?.tax_system ?? 'GST',
    };
    this.savedSnapshot = JSON.stringify(this.form);
  }

  private queuePreview(): void {
    this.preview$.next();
  }
}
