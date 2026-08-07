import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
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
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { FormFieldComponent } from '@shared/components/form-field/form-field.component';
import {
  MembershipStatus,
  OrganizationMembership,
  UpdateMembershipStatusPayload,
} from '../../models/ministries.model';
import { MinistriesApiService } from '../../services/ministries-api.service';

const EXIT_STATUSES: MembershipStatus[] = [
  'exited',
  'resigned',
  'inactive',
  'deceased',
];

@Component({
  selector: 'app-membership-status-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModalShellComponent, FormFieldComponent],
  templateUrl: './membership-status-modal.component.html',
  styleUrl: './membership-status-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MembershipStatusModalComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly api = inject(MinistriesApiService);
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) organizationId!: string;
  @Input({ required: true }) membership!: OrganizationMembership;
  @Output() updated = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  saving = false;
  submitted = false;
  confirmed = false;
  formError: string | null = null;

  readonly statusOptions: Array<{ value: MembershipStatus; label: string }> = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'suspended', label: 'Suspended' },
    { value: 'resigned', label: 'Resigned' },
    { value: 'exited', label: 'Exited' },
    { value: 'deceased', label: 'Deceased' },
  ];

  readonly form = this.fb.nonNullable.group({
    status: ['exited' as MembershipStatus, Validators.required],
    exit_date: [''],
    exit_reason: ['', Validators.maxLength(500)],
  });

  ngOnInit(): void {
    const defaultStatus =
      this.membership.status === 'active' ? 'exited' : this.membership.status;
    this.form.patchValue({
      status: defaultStatus,
      exit_date: this.todayIsoDate(),
      exit_reason: '',
    });
    this.applyExitDateValidators();
    this.form.controls.status.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.confirmed = false;
        this.formError = null;
        this.applyExitDateValidators();
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get closesInterval(): boolean {
    return EXIT_STATUSES.includes(this.form.controls.status.value);
  }

  get submitLabel(): string {
    if (this.saving) {
      return 'Saving…';
    }
    return this.closesInterval ? 'Confirm status change' : 'Save status';
  }

  currentStatusLabel(): string {
    return (
      this.statusOptions.find((option) => option.value === this.membership.status)?.label ??
      this.membership.status
    );
  }

  onConfirmToggle(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.confirmed = input.checked;
    this.formError = null;
    this.cdr.markForCheck();
  }

  onCancel(): void {
    if (this.saving) {
      return;
    }
    this.cancel.emit();
  }

  onSubmit(): void {
    this.submitted = true;
    this.formError = null;
    this.applyExitDateValidators();
    this.form.updateValueAndValidity();

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.cdr.markForCheck();
      return;
    }

    if (this.closesInterval && !this.confirmed) {
      this.formError = 'Confirm that this enrollment should be closed.';
      this.cdr.markForCheck();
      return;
    }

    const raw = this.form.getRawValue();
    const payload: UpdateMembershipStatusPayload = {
      status: raw.status,
      exit_reason: raw.exit_reason.trim() || null,
    };

    if (this.closesInterval) {
      payload.exit_date = raw.exit_date;
    }

    this.saving = true;
    this.cdr.markForCheck();

    this.api
      .updateMemberStatus(this.organizationId, this.membership.id, payload)
      .subscribe({
        next: () => {
          this.saving = false;
          this.updated.emit();
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          this.saving = false;
          this.formError = this.mapError(error);
          this.cdr.markForCheck();
        },
      });
  }

  formatDate(value: string): string {
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  private applyExitDateValidators(): void {
    const control = this.form.controls.exit_date;
    if (this.closesInterval) {
      control.setValidators([
        Validators.required,
        (c: AbstractControl) => this.exitDateOnOrAfterJoined(c),
      ]);
    } else {
      control.clearValidators();
      control.setErrors(null);
    }
    control.updateValueAndValidity({ emitEvent: false });
  }

  private exitDateOnOrAfterJoined(control: AbstractControl): ValidationErrors | null {
    const value = String(control.value ?? '').trim();
    if (!value) {
      return null;
    }
    if (value < this.membership.joined_date) {
      return { beforeJoined: true };
    }
    return null;
  }

  private todayIsoDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private mapError(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'Could not update status. Please try again.';
    }

    const payload = error.error as {
      message?: string;
      errors?: Record<string, string[]>;
    } | null;

    const fieldMessages = payload?.errors
      ? Object.values(payload.errors).flat().join(' ')
      : '';
    const combined = `${payload?.message ?? ''} ${fieldMessages}`.toLowerCase();

    if (combined.includes('closed') || combined.includes('cannot be modified')) {
      return 'This enrollment interval is closed and cannot be changed.';
    }
    if (combined.includes('joined date') || combined.includes('on or after')) {
      return 'Exit date must be on or after the joined date.';
    }

    return payload?.message || 'Could not update status. Please try again.';
  }
}
