import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { FormFieldComponent } from '@shared/components/form-field/form-field.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import {
  ConfirmationModalComponent,
  ConfirmationResult,
} from '@shared/components/confirmation-modal/confirmation-modal.component';
import { StatusBadgeComponent } from '@shared/components/status-badge/status-badge.component';
import { CfDateTimeFieldComponent } from '@shared/components/cf-datetime-field/cf-datetime-field.component';
import { AuthService } from '@core/services/auth.service';
import {
  dateWindowValidator,
  fieldErrorText,
  markFormGroupTouched,
} from '@core/validators/form-validation.helper';
import { SupportAccessGrant, SupportGrantMode } from '../../support-center/models/support-access.model';
import { ParishSupportGrantService } from './parish-support-grant.service';

@Component({
  selector: 'app-support-access-windows-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    PageHeaderComponent,
    FormFieldComponent,
    DataTableComponent,
    CfEmptyStateComponent,
    LoadingSkeletonComponent,
    ConfirmationModalComponent,
    StatusBadgeComponent,
    CfDateTimeFieldComponent,
  ],
  templateUrl: './support-access-windows.page.html',
  styleUrl: './support-access-windows.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportAccessWindowsPage implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly grantsApi = inject(ParishSupportGrantService);
  private readonly auth = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  readonly canView =
    this.auth.hasPermission('support.grants.parish.view') ||
    this.auth.hasPermission('support.grants.parish.manage');
  readonly canManage = this.auth.hasPermission('support.grants.parish.manage');

  rows: SupportAccessGrant[] = [];
  loading = false;
  loaded = false;
  saving = false;
  submitted = false;
  error: string | null = null;
  success: string | null = null;
  confirmOpen = false;
  pendingRevoke: SupportAccessGrant | null = null;

  get revokeConfirmMessage(): string {
    const raw = this.pendingRevoke?.ends_at;
    const ending = raw ? ` ending ${new Date(raw).toLocaleString()}` : '';
    return (
      `Revoke the support access window${ending}? ` +
      'Support will not be able to open new sessions in this window.'
    );
  }

  readonly form = this.fb.nonNullable.group(
    {
      allowed_mode: ['readonly' as SupportGrantMode, Validators.required],
      starts_at: ['', Validators.required],
      ends_at: ['', Validators.required],
      note: ['', Validators.maxLength(2000)],
      max_sessions: [null as number | null, [Validators.min(1), Validators.max(1000)]],
    },
    { validators: [dateWindowValidator('starts_at', 'ends_at')] }
  );

  ngOnInit(): void {
    this.form.controls.starts_at.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.form.controls.ends_at.updateValueAndValidity({ onlySelf: true });
        this.form.updateValueAndValidity({ onlySelf: false, emitEvent: false });
        this.cdr.markForCheck();
      });

    if (this.canView) {
      this.reload();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  reload(): void {
    this.loading = true;
    this.error = null;
    this.grantsApi
      .list()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (rows) => {
          this.rows = rows;
          this.loading = false;
          this.loaded = true;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.loading = false;
          this.loaded = true;
          this.error = err?.error?.message || 'Could not load support access windows.';
          this.cdr.markForCheck();
        },
      });
  }

  create(): void {
    if (!this.canManage || this.saving) {
      return;
    }

    this.submitted = true;
    this.error = null;
    this.success = null;
    markFormGroupTouched(this.form, '#parish-grant-form ');
    this.cdr.markForCheck();

    if (this.form.invalid) {
      return;
    }

    this.saving = true;
    const value = this.form.getRawValue();
    this.grantsApi
      .create({
        allowed_mode: value.allowed_mode,
        starts_at: value.starts_at,
        ends_at: value.ends_at,
        note: value.note || undefined,
        max_sessions: value.max_sessions || undefined,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.saving = false;
          this.submitted = false;
          this.success = 'Support access window opened.';
          this.form.reset({
            allowed_mode: 'readonly',
            starts_at: '',
            ends_at: '',
            note: '',
            max_sessions: null,
          });
          this.form.markAsPristine();
          this.form.markAsUntouched();
          this.reload();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.saving = false;
          this.error = err?.error?.message || 'Could not create access window.';
          this.cdr.markForCheck();
        },
      });
  }

  fieldError(controlName: string): string | null {
    return fieldErrorText(controlName, this.form, this.submitted);
  }

  endsError(): string | null {
    const ends = this.form.controls.ends_at;
    const starts = this.form.controls.starts_at;
    const showErrors =
      this.submitted || ends.touched || (starts.touched && !!ends.value);
    if (!showErrors) {
      return null;
    }
    if (this.form.hasError('startsAfterEnds')) {
      return 'End date and time must be after the start date and time.';
    }
    return this.fieldError('ends_at');
  }

  requestRevoke(row: SupportAccessGrant): void {
    if (!this.canManage || row.status !== 'active') {
      return;
    }
    this.pendingRevoke = row;
    this.confirmOpen = true;
    this.cdr.markForCheck();
  }

  onRevokeConfirmed(result: ConfirmationResult): void {
    this.confirmOpen = false;
    const row = this.pendingRevoke;
    this.pendingRevoke = null;
    if (!result.confirmed || !row) {
      this.cdr.markForCheck();
      return;
    }
    this.grantsApi
      .revoke(row.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.success = 'Access window revoked.';
          this.reload();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error = err?.error?.message || 'Could not revoke access window.';
          this.cdr.markForCheck();
        },
      });
  }

  statusTone(status: string): 'success' | 'neutral' | 'warning' | 'critical' | 'info' {
    if (status === 'active') {
      return 'success';
    }
    if (status === 'revoked' || status === 'expired') {
      return 'critical';
    }
    return 'neutral';
  }

  modeTone(mode: string): 'success' | 'neutral' | 'warning' | 'critical' | 'info' {
    if (mode === 'emergency') {
      return 'critical';
    }
    if (mode === 'standard') {
      return 'warning';
    }
    return 'info';
  }
}
