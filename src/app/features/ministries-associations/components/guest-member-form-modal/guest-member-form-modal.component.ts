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
  CreateGuestMemberPayload,
  GuestMember,
  GuestSupportType,
  GuestType,
} from '../../models/ministries.model';
import { MinistriesApiService } from '../../services/ministries-api.service';

type GenderOption = 'male' | 'female' | 'other';

function phoneOrEmailRequired(group: AbstractControl): ValidationErrors | null {
  const phone = String(group.get('phone')?.value ?? '').trim();
  const email = String(group.get('email')?.value ?? '').trim();
  if (!phone && !email) {
    return { phoneOrEmail: true };
  }
  return null;
}

@Component({
  selector: 'app-guest-member-form-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModalShellComponent, FormFieldComponent],
  templateUrl: './guest-member-form-modal.component.html',
  styleUrl: './guest-member-form-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuestMemberFormModalComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly api = inject(MinistriesApiService);
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);

  /** When set, modal edits that guest (loaded via GET). */
  @Input() guestId: string | null = null;
  @Output() saved = new EventEmitter<GuestMember>();
  @Output() cancel = new EventEmitter<void>();

  loading = false;
  loadError: string | null = null;
  saving = false;
  submitted = false;
  formError: string | null = null;
  phoneError: string | null = null;
  emailError: string | null = null;

  readonly genderOptions: Array<{ value: GenderOption; label: string }> = [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'other', label: 'Other' },
  ];

  readonly guestTypeOptions: Array<{ value: GuestType; label: string }> = [
    { value: 'supporter', label: 'Supporter' },
    { value: 'volunteer', label: 'Volunteer' },
    { value: 'benefactor', label: 'Benefactor' },
    { value: 'advisor', label: 'Advisor' },
    { value: 'resource_person', label: 'Resource person' },
  ];

  readonly supportTypeOptions: Array<{ value: GuestSupportType; label: string }> = [
    { value: 'financial', label: 'Financial' },
    { value: 'labor', label: 'Labor' },
    { value: 'advisory', label: 'Advisory' },
  ];

  readonly form = this.fb.nonNullable.group(
    {
      first_name: ['', [Validators.required, Validators.maxLength(100)]],
      last_name: ['', [Validators.required, Validators.maxLength(100)]],
      phone: ['', Validators.maxLength(20)],
      email: ['', [Validators.email, Validators.maxLength(255)]],
      gender: ['' as '' | GenderOption],
      address: [''],
      guest_type: ['supporter' as GuestType, Validators.required],
      external_organization: ['', Validators.maxLength(255)],
      support_type: ['' as '' | GuestSupportType],
      remarks: [''],
    },
    { validators: [phoneOrEmailRequired] },
  );

  get isEdit(): boolean {
    return !!this.guestId;
  }

  get title(): string {
    return this.isEdit ? 'Edit guest' : 'Add guest';
  }

  get submitLabel(): string {
    if (this.saving) {
      return 'Saving…';
    }
    return this.isEdit ? 'Save changes' : 'Add guest';
  }

  ngOnInit(): void {
    if (this.guestId) {
      this.loadGuest(this.guestId);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onCancel(): void {
    if (this.saving || this.loading) {
      return;
    }
    this.cancel.emit();
  }

  onSubmit(): void {
    this.submitted = true;
    this.formError = null;
    this.phoneError = null;
    this.emailError = null;
    this.form.updateValueAndValidity();

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.cdr.markForCheck();
      return;
    }

    const payload = this.toPayload();
    this.saving = true;
    this.cdr.markForCheck();

    const request$ = this.guestId
      ? this.api.updateGuestMember(this.guestId, payload)
      : this.api.createGuestMember(payload);

    request$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        this.saving = false;
        this.saved.emit(response.data);
        this.cdr.markForCheck();
      },
      error: (error: unknown) => {
        this.saving = false;
        this.applySubmitError(error);
        this.cdr.markForCheck();
      },
    });
  }

  private loadGuest(id: string): void {
    this.loading = true;
    this.loadError = null;
    this.form.disable({ emitEvent: false });
    this.cdr.markForCheck();

    this.api
      .getGuestMember(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.patchFromGuest(response.data);
          this.form.enable({ emitEvent: false });
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this.loadError = 'Could not load this guest. Please try again.';
          this.cdr.markForCheck();
        },
      });
  }

  private patchFromGuest(guest: GuestMember): void {
    this.form.patchValue({
      first_name: guest.first_name ?? '',
      last_name: guest.last_name ?? '',
      phone: guest.phone ?? '',
      email: guest.email ?? '',
      gender: guest.gender ?? '',
      address: guest.address ?? '',
      guest_type: guest.guest_type ?? 'supporter',
      external_organization: guest.external_organization ?? '',
      support_type: guest.support_type ?? '',
      remarks: guest.remarks ?? '',
    });
  }

  private toPayload(): CreateGuestMemberPayload {
    const raw = this.form.getRawValue();
    return {
      first_name: raw.first_name.trim(),
      last_name: raw.last_name.trim(),
      phone: raw.phone.trim() || null,
      email: raw.email.trim() || null,
      gender: raw.gender || null,
      address: raw.address.trim() || null,
      guest_type: raw.guest_type,
      external_organization: raw.external_organization.trim() || null,
      support_type: raw.support_type || null,
      remarks: raw.remarks.trim() || null,
    };
  }

  private applySubmitError(error: unknown): void {
    if (!(error instanceof HttpErrorResponse)) {
      this.formError = 'Could not save guest. Please try again.';
      return;
    }

    const payload = error.error as {
      message?: string;
      errors?: Record<string, string[]>;
    } | null;

    if (error.status === 422 && payload?.errors) {
      this.phoneError = payload.errors['phone']?.[0] ?? null;
      this.emailError = payload.errors['email']?.[0] ?? null;
      const remaining = Object.entries(payload.errors)
        .filter(([key]) => key !== 'phone' && key !== 'email')
        .flatMap(([, messages]) => messages);
      this.formError = remaining[0] || payload.message || 'Could not save guest. Please check the form.';
      return;
    }

    this.formError = payload?.message || 'Could not save guest. Please try again.';
  }
}
