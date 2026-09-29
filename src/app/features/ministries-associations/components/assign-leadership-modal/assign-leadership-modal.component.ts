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
  AssignLeadershipPayload,
  LeadershipConflict,
  OrganizationMembership,
  Position,
} from '../../models/ministries.model';
import { MinistriesApiService } from '../../services/ministries-api.service';
import { LeadershipMemberPickerComponent } from '../leadership-member-picker/leadership-member-picker.component';

@Component({
  selector: 'app-assign-leadership-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LeadershipMemberPickerComponent,
    ModalShellComponent,
    FormFieldComponent,
  ],
  templateUrl: './assign-leadership-modal.component.html',
  styleUrl: './assign-leadership-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssignLeadershipModalComponent implements OnInit {
  private readonly api = inject(MinistriesApiService);
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) organizationId!: string;
  @Input() positionId: string | null = null;
  @Output() assigned = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  positions: Position[] = [];
  members: OrganizationMembership[] = [];
  guestsCanHoldOffice = false;

  loading = true;
  loadError: string | null = null;
  saving = false;
  submitted = false;
  formError: string | null = null;
  conflictError: string | null = null;

  readonly form = this.fb.nonNullable.group({
    position_id: ['', Validators.required],
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
      position_id: this.positionId ?? '',
      appointment_date: today,
      effective_from: today,
    });
    this.form.setValidators((group) => this.appointmentOnOrBeforeEffective(group));
    this.form.valueChanges.subscribe(() => {
      if (this.conflictError || this.formError) {
        this.conflictError = null;
        this.formError = null;
        this.cdr.markForCheck();
      }
    });
    this.loadOptions();
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
    this.conflictError = null;
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
    const payload: AssignLeadershipPayload = {
      position_id: raw.position_id,
      membership_id: raw.membership_id,
      appointment_date: raw.appointment_date,
      effective_from: raw.effective_from,
      effective_to: raw.effective_to.trim() || null,
      term_label: raw.term_label.trim() || null,
      appointment_reference: raw.appointment_reference.trim() || null,
      is_interim: raw.is_interim,
      remarks: raw.remarks.trim() || null,
    };

    this.saving = true;
    this.cdr.markForCheck();

    this.api.assignLeadership(this.organizationId, payload).subscribe({
      next: () => {
        this.saving = false;
        this.assigned.emit();
        this.cdr.markForCheck();
      },
      error: (error: unknown) => {
        this.saving = false;
        this.applyAssignError(error);
        this.cdr.markForCheck();
      },
    });
  }

  private loadOptions(): void {
    this.loading = true;
    this.loadError = null;
    this.cdr.markForCheck();

    forkJoin({
      positions: this.api.listPositions({ is_active: true, per_page: 100 }),
      members: this.api.listMembers(this.organizationId, {
        is_current: true,
        status: 'active',
        per_page: 100,
      }),
      organization: this.api.getOrganization(this.organizationId, 'settings'),
    }).subscribe({
      next: ({ positions, members, organization }) => {
        this.positions = positions.data;
        this.members = members.data;
        this.guestsCanHoldOffice = organization.data.settings?.guests_can_hold_office ?? false;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.loadError = 'Could not load assignment options. Please try again.';
        this.cdr.markForCheck();
      },
    });
  }

  private appointmentOnOrBeforeEffective(group: AbstractControl): ValidationErrors | null {
    const errors: ValidationErrors = {};
    const appointment = String(group.get('appointment_date')?.value ?? '').trim();
    const effectiveFrom = String(group.get('effective_from')?.value ?? '').trim();
    const effectiveTo = String(group.get('effective_to')?.value ?? '').trim();

    if (appointment && effectiveFrom && appointment > effectiveFrom) {
      errors['appointmentAfterEffective'] = true;
    }
    if (effectiveTo && effectiveFrom && effectiveTo < effectiveFrom) {
      errors['effectiveToBeforeFrom'] = true;
    }

    return Object.keys(errors).length ? errors : null;
  }

  private applyAssignError(error: unknown): void {
    if (!(error instanceof HttpErrorResponse)) {
      this.formError = 'Could not assign leadership. Please try again.';
      return;
    }

    if (error.status === 409) {
      this.conflictError = this.mapConflictMessage(error);
      return;
    }

    this.formError = this.mapAssignError(error);
  }

  private mapConflictMessage(error: HttpErrorResponse): string {
    const payload = error.error as {
      errors?: {
        conflict?: LeadershipConflict;
      };
    } | null;

    const conflict = payload?.errors?.conflict;
    const positionName =
      this.positions.find((p) => p.id === this.form.controls.position_id.value)?.name?.trim() ||
      'this position';
    const holderName = conflict?.existing_holder?.display_name?.trim() || 'another member';

    return `Cannot assign ${positionName} while ${holderName} holds this role. Terminate or hand over first.`;
  }

  private mapAssignError(error: HttpErrorResponse): string {
    const payload = error.error as {
      message?: string;
      errors?: Record<string, string[] | LeadershipConflict>;
    } | null;

    const fieldMessages = payload?.errors
      ? Object.values(payload.errors)
          .flatMap((value) => (Array.isArray(value) ? value : []))
          .join(' ')
      : '';
    const combined = `${payload?.message ?? ''} ${fieldMessages}`.toLowerCase();

    if (combined.includes('inactive') || combined.includes('must be active')) {
      return 'Organization must be active to assign leadership.';
    }
    if (combined.includes('guest') && combined.includes('office')) {
      return 'Guests cannot hold office in this organization.';
    }
    if (combined.includes('multi') || combined.includes('already holds')) {
      return 'This member already holds another leadership role.';
    }
    if (
      combined.includes('effective to') ||
      combined.includes('after or equal') ||
      (combined.includes('effective_to') && combined.includes('effective_from'))
    ) {
      return 'Effective to must be on or after the effective from date.';
    }
    if (combined.includes('membership') || combined.includes('active member')) {
      return 'Select a current active member of this organization.';
    }

    return payload?.message || fieldMessages || 'Could not assign leadership. Please try again.';
  }

  private todayIsoDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
