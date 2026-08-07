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
import { forkJoin } from 'rxjs';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { FormFieldComponent } from '@shared/components/form-field/form-field.component';
import {
  LeadershipExitReason,
  LeadershipHandoverPayload,
  LeadershipTerm,
  OrganizationMembership,
} from '../../models/ministries.model';
import { MinistriesApiService } from '../../services/ministries-api.service';
import { LeadershipMemberPickerComponent } from '../leadership-member-picker/leadership-member-picker.component';

type HandoverExitReason = Exclude<LeadershipExitReason, 'census_cascade'>;

@Component({
  selector: 'app-handover-leadership-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LeadershipMemberPickerComponent,
    ModalShellComponent,
    FormFieldComponent,
  ],
  templateUrl: './handover-leadership-modal.component.html',
  styleUrl: './handover-leadership-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HandoverLeadershipModalComponent implements OnInit {
  private readonly api = inject(MinistriesApiService);
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) organizationId!: string;
  @Input({ required: true }) term!: LeadershipTerm;
  @Output() handedOver = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  members: OrganizationMembership[] = [];
  guestsCanHoldOffice = false;

  loading = true;
  loadError: string | null = null;
  saving = false;
  submitted = false;
  formError: string | null = null;

  readonly exitReasons: { value: HandoverExitReason; label: string }[] = [
    { value: 'resigned', label: 'Resigned' },
    { value: 'transferred', label: 'Transferred' },
    { value: 'removed', label: 'Removed' },
    { value: 'term_completed', label: 'Term completed' },
    { value: 'deceased', label: 'Deceased' },
  ];

  readonly form = this.fb.nonNullable.group({
    outgoing_effective_to: ['', Validators.required],
    exit_reason: ['' as HandoverExitReason | '', Validators.required],
    membership_id: ['', Validators.required],
    appointment_date: ['', Validators.required],
    effective_from: ['', Validators.required],
    effective_to: [''],
    term_label: ['', Validators.maxLength(50)],
    appointment_reference: ['', Validators.maxLength(100)],
    is_interim: [false],
    remarks: [''],
  });

  ngOnInit(): void {
    const today = this.todayIsoDate();
    this.form.patchValue({
      outgoing_effective_to: today,
      appointment_date: today,
      effective_from: today,
    });
    this.form.setValidators((group) => this.crossFieldValidators(group));
    this.form.valueChanges.subscribe(() => {
      if (this.formError) {
        this.formError = null;
        this.cdr.markForCheck();
      }
    });
    this.loadOptions();
  }

  get positionName(): string {
    return this.term.position?.name?.trim() || 'Position';
  }

  get outgoingHolderName(): string {
    return this.term.holder?.display_name?.trim() || 'Current holder';
  }

  isGuestDisabled(member: OrganizationMembership): boolean {
    return member.member_source === 'guest' && !this.guestsCanHoldOffice;
  }

  onCancel(): void {
    if (this.saving) {
      return;
    }
    this.cancel.emit();
  }

  retryLoad(): void {
    this.loadOptions();
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

    const selected = this.members.find((m) => m.id === this.form.controls.membership_id.value);
    if (selected && this.isGuestDisabled(selected)) {
      this.formError = 'Guests cannot hold office in this organization.';
      this.cdr.markForCheck();
      return;
    }

    const raw = this.form.getRawValue();
    const payload: LeadershipHandoverPayload = {
      position_id: this.term.position_id,
      outgoing_term_id: this.term.id,
      outgoing: {
        effective_to: raw.outgoing_effective_to,
        exit_reason: raw.exit_reason as HandoverExitReason,
      },
      incoming: {
        membership_id: raw.membership_id,
        appointment_date: raw.appointment_date,
        effective_from: raw.effective_from,
        effective_to: raw.effective_to.trim() || null,
        term_label: raw.term_label.trim() || null,
        appointment_reference: raw.appointment_reference.trim() || null,
        is_interim: raw.is_interim,
        remarks: raw.remarks.trim() || null,
      },
    };

    this.saving = true;
    this.cdr.markForCheck();

    this.api.handoverLeadership(this.organizationId, payload).subscribe({
      next: () => {
        this.saving = false;
        this.handedOver.emit();
        this.cdr.markForCheck();
      },
      error: (error: unknown) => {
        this.saving = false;
        this.formError = this.mapHandoverError(error);
        this.cdr.markForCheck();
      },
    });
  }

  private loadOptions(): void {
    this.loading = true;
    this.loadError = null;
    this.cdr.markForCheck();

    forkJoin({
      members: this.api.listMembers(this.organizationId, {
        is_current: true,
        status: 'active',
        per_page: 100,
      }),
      organization: this.api.getOrganization(this.organizationId, 'settings'),
    }).subscribe({
      next: ({ members, organization }) => {
        this.members = members.data.filter((member) => member.id !== this.term.membership_id);
        this.guestsCanHoldOffice = organization.data.settings?.guests_can_hold_office ?? false;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.loadError = 'Could not load handover options. Please try again.';
        this.cdr.markForCheck();
      },
    });
  }

  private crossFieldValidators(group: AbstractControl): ValidationErrors | null {
    const errors: ValidationErrors = {};
    const outgoingTo = String(group.get('outgoing_effective_to')?.value ?? '').trim();
    const appointment = String(group.get('appointment_date')?.value ?? '').trim();
    const effectiveFrom = String(group.get('effective_from')?.value ?? '').trim();
    const effectiveTo = String(group.get('effective_to')?.value ?? '').trim();
    const termStart = this.term.effective_from;

    if (outgoingTo && termStart && outgoingTo < termStart) {
      errors['outgoingBeforeTermStart'] = true;
    }
    if (appointment && effectiveFrom && appointment > effectiveFrom) {
      errors['appointmentAfterEffective'] = true;
    }
    if (effectiveTo && effectiveFrom && effectiveTo < effectiveFrom) {
      errors['effectiveToBeforeFrom'] = true;
    }

    return Object.keys(errors).length ? errors : null;
  }

  private mapHandoverError(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'Could not complete handover. Please try again.';
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
      return 'Organization must be active to hand over leadership.';
    }
    if (combined.includes('guest') && combined.includes('office')) {
      return 'Guests cannot hold office in this organization.';
    }
    if (combined.includes('multi') || combined.includes('already holds')) {
      return 'This member already holds another leadership role.';
    }
    if (combined.includes('outgoing') && combined.includes('active')) {
      return 'Outgoing term must still be active.';
    }
    if (
      combined.includes('effective to') ||
      combined.includes('after or equal') ||
      (combined.includes('effective_to') && combined.includes('effective_from'))
    ) {
      return 'Incoming effective to must be on or after the effective from date.';
    }
    if (combined.includes('membership') || combined.includes('active member')) {
      return 'Select a current active member of this organization.';
    }
    if (combined.includes('term start') || combined.includes('before the term')) {
      return 'Outgoing end date must be on or after the term start date.';
    }

    return payload?.message || fieldMessages || 'Could not complete handover. Please try again.';
  }

  private todayIsoDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
