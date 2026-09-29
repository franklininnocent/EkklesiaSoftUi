import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
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
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { FormFieldComponent } from '@shared/components/form-field/form-field.component';
import {
  LeadershipExitReason,
  LeadershipTerm,
  TerminateLeadershipPayload,
} from '../../models/ministries.model';
import { MinistriesApiService } from '../../services/ministries-api.service';

type TerminateExitReason = Exclude<LeadershipExitReason, 'census_cascade'>;

@Component({
  selector: 'app-terminate-leadership-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModalShellComponent, FormFieldComponent],
  templateUrl: './terminate-leadership-modal.component.html',
  styleUrl: './terminate-leadership-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TerminateLeadershipModalComponent implements OnInit {
  private readonly api = inject(MinistriesApiService);
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) organizationId!: string;
  @Input({ required: true }) term!: LeadershipTerm;
  @Output() terminated = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  saving = false;
  submitted = false;
  formError: string | null = null;

  readonly exitReasons: { value: TerminateExitReason; label: string }[] = [
    { value: 'resigned', label: 'Resigned' },
    { value: 'transferred', label: 'Transferred' },
    { value: 'removed', label: 'Removed' },
    { value: 'term_completed', label: 'Term completed' },
    { value: 'deceased', label: 'Deceased' },
  ];

  readonly form = this.fb.nonNullable.group({
    effective_to: ['', Validators.required],
    exit_reason: ['' as TerminateExitReason | '', Validators.required],
    remarks: [''],
  });

  ngOnInit(): void {
    this.form.patchValue({
      effective_to: this.todayIsoDate(),
    });
    this.form.setValidators((group) => this.effectiveToOnOrAfterTermStart(group));
    this.form.valueChanges.subscribe(() => {
      if (this.formError) {
        this.formError = null;
        this.cdr.markForCheck();
      }
    });
  }

  get positionName(): string {
    return this.term.position?.name?.trim() || 'Position';
  }

  get holderName(): string {
    return this.term.holder?.display_name?.trim() || 'Current holder';
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
    this.form.updateValueAndValidity();

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.cdr.markForCheck();
      return;
    }

    const raw = this.form.getRawValue();
    const payload: TerminateLeadershipPayload = {
      effective_to: raw.effective_to,
      exit_reason: raw.exit_reason as TerminateExitReason,
      remarks: raw.remarks.trim() || null,
    };

    this.saving = true;
    this.cdr.markForCheck();

    this.api.terminateLeadership(this.organizationId, this.term.id, payload).subscribe({
      next: () => {
        this.saving = false;
        this.terminated.emit();
        this.cdr.markForCheck();
      },
      error: (error: unknown) => {
        this.saving = false;
        this.formError = this.mapTerminateError(error);
        this.cdr.markForCheck();
      },
    });
  }

  private effectiveToOnOrAfterTermStart(group: AbstractControl): ValidationErrors | null {
    const effectiveTo = String(group.get('effective_to')?.value ?? '').trim();
    const termStart = this.term.effective_from;
    if (!effectiveTo || !termStart) {
      return null;
    }
    if (effectiveTo < termStart) {
      return { effectiveBeforeTermStart: true };
    }
    return null;
  }

  private mapTerminateError(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'Could not terminate leadership. Please try again.';
    }

    const payload = error.error as {
      message?: string;
      errors?: Record<string, string[]>;
    } | null;

    const fieldMessages = payload?.errors
      ? Object.values(payload.errors)
          .flatMap((value) => (Array.isArray(value) ? value : []))
          .join(' ')
      : '';
    const combined = `${payload?.message ?? ''} ${fieldMessages}`.toLowerCase();

    if (combined.includes('inactive') || combined.includes('must be active')) {
      return 'Organization must be active to terminate leadership.';
    }
    if (combined.includes('only active') || combined.includes('not active')) {
      return 'Only active leadership terms can be terminated.';
    }
    if (combined.includes('term start') || combined.includes('before the term')) {
      return 'End date must be on or after the term start date.';
    }

    return payload?.message || fieldMessages || 'Could not terminate leadership. Please try again.';
  }

  private todayIsoDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
