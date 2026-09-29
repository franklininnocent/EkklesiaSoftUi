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
  MemberType,
  OrganizationMembership,
  ReEnrollMemberPayload,
} from '../../models/ministries.model';
import { MinistriesApiService } from '../../services/ministries-api.service';

@Component({
  selector: 'app-re-enroll-member-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModalShellComponent, FormFieldComponent],
  templateUrl: './re-enroll-member-modal.component.html',
  styleUrl: './re-enroll-member-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReEnrollMemberModalComponent implements OnInit {
  private readonly api = inject(MinistriesApiService);
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) organizationId!: string;
  @Input({ required: true }) membership!: OrganizationMembership;
  @Output() reenrolled = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  saving = false;
  submitted = false;
  formError: string | null = null;

  readonly form = this.fb.nonNullable.group({
    joined_date: ['', [Validators.required, (c: AbstractControl) => this.afterPriorExit(c)]],
    member_type: ['' as MemberType | ''],
    remarks: [''],
  });

  ngOnInit(): void {
    this.form.patchValue({
      joined_date: this.defaultJoinedDate(),
      member_type: this.membership.member_type,
      remarks: '',
    });
  }

  get minJoinedDate(): string | null {
    if (!this.membership.exit_date) {
      return null;
    }
    return this.addDays(this.membership.exit_date, 1);
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
    this.form.controls.joined_date.updateValueAndValidity();

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.cdr.markForCheck();
      return;
    }

    const raw = this.form.getRawValue();
    const payload: ReEnrollMemberPayload = {
      joined_date: raw.joined_date,
      remarks: raw.remarks.trim() || null,
    };

    if (raw.member_type) {
      payload.member_type = raw.member_type;
    }

    this.saving = true;
    this.cdr.markForCheck();

    this.api
      .reEnrollMember(this.organizationId, this.membership.id, payload)
      .subscribe({
        next: () => {
          this.saving = false;
          this.reenrolled.emit();
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          this.saving = false;
          this.formError = this.mapError(error);
          this.cdr.markForCheck();
        },
      });
  }

  formatDate(value: string | null): string {
    if (!value) {
      return '—';
    }
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

  private defaultJoinedDate(): string {
    const today = this.todayIsoDate();
    const min = this.minJoinedDate;
    if (min && today <= this.membership.exit_date!) {
      return min;
    }
    if (min && today < min) {
      return min;
    }
    return today;
  }

  private afterPriorExit(control: AbstractControl): ValidationErrors | null {
    const value = String(control.value ?? '').trim();
    if (!value || !this.membership?.exit_date) {
      return null;
    }
    if (value <= this.membership.exit_date) {
      return { afterExit: true };
    }
    return null;
  }

  private addDays(isoDate: string, days: number): string {
    const date = new Date(`${isoDate}T00:00:00`);
    date.setDate(date.getDate() + days);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
      return 'Could not re-enroll member. Please try again.';
    }

    const payload = error.error as {
      message?: string;
      errors?: Record<string, string[]>;
    } | null;

    const fieldMessages = payload?.errors
      ? Object.values(payload.errors).flat().join(' ')
      : '';
    const combined = `${payload?.message ?? ''} ${fieldMessages}`.toLowerCase();

    if (combined.includes('closed') || combined.includes('before re-enrolling')) {
      return 'Only closed enrollments can be re-enrolled.';
    }
    if (combined.includes('after the prior exit') || combined.includes('joined date must be after')) {
      return 'Joined date must be after the prior exit date.';
    }
    if (combined.includes('already')) {
      return 'Already enrolled in this organization';
    }
    if (combined.includes('deceased') || combined.includes('transferred') || combined.includes('not eligible')) {
      return 'Member is deceased or transferred in parish records';
    }
    if (combined.includes('inactive') || combined.includes('must be active')) {
      return 'Organization must be active to enroll members';
    }

    return payload?.message || 'Could not re-enroll member. Please try again.';
  }
}
