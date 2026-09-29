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
import { Subject, forkJoin, of, takeUntil } from 'rxjs';
import { ToastService } from '@core/services/toast.service';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { CfCurrencyPipe } from '@shared/pipes/cf-currency.pipe';
import { CatalogPlan, PlanVersion, VersionImpact, VersionPreview } from '../../models/subscription-admin.models';
import { SubscriptionAdminService, subscriptionErrorMessage } from '../../services/subscription-admin.service';

/**
 * Shows what a church on this version gets (pricing card, included features, limits) and,
 * in publish mode, who is affected before publishing now or on a future date.
 */
@Component({
  selector: 'app-version-review-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalShellComponent, LoadingSkeletonComponent, CfCurrencyPipe],
  templateUrl: './version-review-dialog.component.html',
  styleUrls: ['../../styles/subscription-admin.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VersionReviewDialogComponent implements OnInit, OnDestroy {
  private readonly api = inject(SubscriptionAdminService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  @Input({ required: true }) plan!: CatalogPlan;
  @Input({ required: true }) version!: PlanVersion;
  @Input() mode: 'preview' | 'publish' = 'preview';
  @Output() closed = new EventEmitter<void>();
  @Output() published = new EventEmitter<PlanVersion>();

  loading = true;
  error: string | null = null;
  preview: VersionPreview | null = null;
  impact: VersionImpact | null = null;

  when: 'now' | 'later' = 'now';
  effectiveFrom = '';
  reason = '';
  submitting = false;

  get includedModules(): VersionPreview['modules'] {
    return (this.preview?.modules ?? []).filter((m) => m.enabled);
  }

  get excludedModules(): VersionPreview['modules'] {
    return (this.preview?.modules ?? []).filter((m) => !m.enabled);
  }

  /** Local `datetime-local` value one hour from now. */
  get minDate(): string {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  ngOnInit(): void {
    const impact$ = this.mode === 'publish' ? this.api.versionImpact(this.plan.id, this.version.id) : of(null);
    forkJoin({ preview: this.api.versionPreview(this.plan.id, this.version.id), impact: impact$ })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ preview, impact }) => {
          this.preview = preview;
          this.impact = impact;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error = subscriptionErrorMessage(err, 'Unable to load this version.');
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  close(): void {
    if (!this.submitting) this.closed.emit();
  }

  formatLimit(limit: { value: number | null; unlimited: boolean; unit: string | null }): string {
    if (limit.unlimited) return 'Unlimited';
    return `${(limit.value ?? 0).toLocaleString()}${limit.unit ? ' ' + limit.unit : ''}`;
  }

  formatChange(value: number | null): string {
    return value === null ? 'Unlimited' : value.toLocaleString();
  }

  publish(): void {
    if (this.submitting) return;
    let effective: string | null = null;
    if (this.when === 'later') {
      const at = this.effectiveFrom ? new Date(this.effectiveFrom) : null;
      if (!at || Number.isNaN(at.getTime()) || at.getTime() <= Date.now()) {
        this.toast.error('Choose a future date and time.', 'Check the schedule');
        return;
      }
      effective = at.toISOString();
    }
    this.submitting = true;
    this.cdr.markForCheck();
    this.api
      .publishVersion(this.plan.id, this.version.id, effective, this.reason.trim() || null)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (version) => {
          this.submitting = false;
          this.toast.success(
            version.status === 'SCHEDULED'
              ? `Version ${version.version_number} is scheduled.`
              : `Version ${version.version_number} is now live for new assignments.`,
            version.status === 'SCHEDULED' ? 'Scheduled' : 'Published',
          );
          this.published.emit(version);
        },
        error: (err) => {
          this.submitting = false;
          this.toast.error(subscriptionErrorMessage(err, 'Unable to publish this version.'), 'Not published');
          this.cdr.markForCheck();
        },
      });
  }
}
