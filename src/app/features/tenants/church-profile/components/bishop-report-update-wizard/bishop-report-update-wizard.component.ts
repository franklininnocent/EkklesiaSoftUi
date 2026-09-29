import { CommonModule } from '@angular/common';
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
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { switchMap } from 'rxjs/operators';
import { of } from 'rxjs';
import { ModalShellComponent } from '@shared/components';
import { BishopPhotoControlComponent, BishopPhotoControlState } from '@shared/components/bishop-photo-control/bishop-photo-control.component';
import { ChurchBishopUpdateService } from '@core/services/church';
import { ToastService } from '@core/services';
import {
  BishopUpdateRequestItem,
  BishopUpdateRequestType,
  DiocesanLeadership,
} from '@core/models/ecclesiastical';

interface RequestTypeOption {
  value: BishopUpdateRequestType;
  label: string;
  description: string;
}

@Component({
  selector: 'app-bishop-report-update-wizard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModalShellComponent, BishopPhotoControlComponent],
  templateUrl: './bishop-report-update-wizard.component.html',
  styleUrl: './bishop-report-update-wizard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BishopReportUpdateWizardComponent implements OnInit {
  private readonly api = inject(ChurchBishopUpdateService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) leadership!: DiocesanLeadership;
  @Input() editingRequest: BishopUpdateRequestItem | null = null;
  @Input() initialType: BishopUpdateRequestType | null = null;
  @Output() completed = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  step = 1;
  readonly totalSteps = 3;
  saving = false;
  showMoreDetails = false;
  formError: string | null = null;
  pendingPhoto: File | null = null;

  readonly endReasons = [
    { value: 'transfer', label: 'Transferred to another diocese' },
    { value: 'retirement', label: 'Retired' },
    { value: 'resignation', label: 'Resigned' },
    { value: 'death', label: 'Deceased' },
    { value: 'other', label: 'Other' },
  ];

  readonly requestTypes: RequestTypeOption[] = [
    {
      value: 'change_current_bishop',
      label: 'Suggest new bishop',
      description: 'The ordinary has changed or will change soon.',
    },
    {
      value: 'correct_information',
      label: 'Correct bishop details',
      description: 'Fix a name, title, or date on the current record.',
    },
    {
      value: 'update_image',
      label: 'Update bishop photo',
      description: 'Suggest a new official portrait.',
    },
    {
      value: 'add_auxiliary',
      label: 'Add auxiliary bishop',
      description: 'Report an auxiliary or coadjutor appointment.',
    },
  ];

  readonly form = this.fb.nonNullable.group({
    request_type: ['' as BishopUpdateRequestType | '', Validators.required],
    full_name: ['', Validators.required],
    given_name: [''],
    family_name: [''],
    religious_name: [''],
    date_of_birth: [''],
    ordained_priest_date: [''],
    ordained_bishop_date: [''],
    email: [''],
    phone: [''],
    education: [''],
    biography: [''],
    effective_date: [''],
    end_reason: [''],
    source_reference: [''],
    supporting_information: [''],
    submission_notes: [''],
  });

  ngOnInit(): void {
    if (this.editingRequest) {
      const bishopData = this.editingRequest.proposed_bishop_data ?? {};
      const appointmentData = this.editingRequest.proposed_appointment_data ?? {};
      this.form.patchValue({
        request_type: this.editingRequest.request_type,
        full_name: String(bishopData['full_name'] ?? ''),
        given_name: String(bishopData['given_name'] ?? ''),
        family_name: String(bishopData['family_name'] ?? ''),
        religious_name: String(bishopData['religious_name'] ?? ''),
        date_of_birth: String(bishopData['date_of_birth'] ?? ''),
        ordained_priest_date: String(bishopData['ordained_priest_date'] ?? ''),
        ordained_bishop_date: String(bishopData['ordained_bishop_date'] ?? ''),
        email: String(bishopData['email'] ?? ''),
        phone: String(bishopData['phone'] ?? ''),
        education: String(bishopData['education'] ?? ''),
        biography: String(bishopData['biography'] ?? ''),
        effective_date: String(appointmentData['effective_date'] ?? ''),
        end_reason: String(appointmentData['end_reason'] ?? ''),
        source_reference: this.editingRequest.source_reference ?? '',
        supporting_information: this.editingRequest.supporting_information ?? '',
        submission_notes: this.editingRequest.submission_notes ?? '',
      });
      this.showMoreDetails = this.hasExtraDetails();
    } else if (this.initialType) {
      this.form.controls.request_type.setValue(this.initialType);
      this.step = 2;
    } else if (this.leadership.ordinary?.bishop_name) {
      this.form.controls.full_name.setValue(this.leadership.ordinary.bishop_name);
    }
  }

  get isNewBishopFlow(): boolean {
    return this.form.controls.request_type.value === 'change_current_bishop';
  }

  get skipsTypeStep(): boolean {
    return this.initialType === 'change_current_bishop' && !this.editingRequest;
  }

  get modalTitle(): string {
    if (this.editingRequest) {
      return 'Update your submission';
    }
    return this.skipsTypeStep || this.isNewBishopFlow
      ? 'Suggest a new bishop'
      : 'Report a bishop update';
  }

  get dioceseLabel(): string {
    return this.leadership.diocese_name || 'Your diocese';
  }

  get stepTitle(): string {
    switch (this.step) {
      case 1:
        return 'What needs updating?';
      case 2:
        return this.isNewBishopFlow ? 'Who is the new bishop?' : 'Tell us what changed';
      default:
        return 'Review and send';
    }
  }

  get photoSource(): { photo_public_url?: string } | null {
    const url = this.editingRequest?.pending_photo_public_url;
    return url ? { photo_public_url: url } : null;
  }

  onPhotoStateChange(state: BishopPhotoControlState): void {
    this.pendingPhoto = state.pendingFile;
  }

  onPhotoError(message: string): void {
    this.formError = message;
    this.cdr.markForCheck();
  }

  onCancel(): void {
    if (this.saving) {
      return;
    }
    this.cancel.emit();
  }

  goBack(): void {
    if (this.saving || this.step <= 1) {
      return;
    }
    if (this.skipsTypeStep && this.step === 2) {
      return;
    }
    this.formError = null;
    this.step -= 1;
    this.cdr.markForCheck();
  }

  goNext(): void {
    this.formError = null;

    if (this.step === 1) {
      if (this.form.controls.request_type.invalid) {
        this.form.controls.request_type.markAsTouched();
        this.cdr.markForCheck();
        return;
      }
      if (this.form.controls.request_type.value === 'change_current_bishop'
        && this.form.controls.full_name.value === this.leadership.ordinary?.bishop_name) {
        this.form.controls.full_name.setValue('');
      }
      this.step = 2;
      this.cdr.markForCheck();
      return;
    }

    if (this.step === 2) {
      if (this.form.controls.full_name.invalid) {
        this.form.controls.full_name.markAsTouched();
        this.cdr.markForCheck();
        return;
      }
      if (this.requiresEffectiveDate() && !this.form.controls.effective_date.value) {
        this.form.controls.effective_date.markAsTouched();
        this.formError = 'Please include the effective date from your diocesan announcement.';
        this.cdr.markForCheck();
        return;
      }
      if (this.requiresEndReason() && !this.form.controls.end_reason.value) {
        this.form.controls.end_reason.markAsTouched();
        this.formError = 'Please tell us what happened to the previous bishop.';
        this.cdr.markForCheck();
        return;
      }
      this.step = 3;
      this.cdr.markForCheck();
      return;
    }

    this.submit();
  }

  requiresEffectiveDate(): boolean {
    const type = this.form.controls.request_type.value;
    return type === 'change_current_bishop' || type === 'add_auxiliary';
  }

  requiresEndReason(): boolean {
    return this.isNewBishopFlow && !!this.leadership.ordinary;
  }

  selectedTypeLabel(): string {
    const type = this.form.controls.request_type.value;
    return this.requestTypes.find((item) => item.value === type)?.label ?? type;
  }

  endReasonLabel(): string {
    const value = this.form.controls.end_reason.value;
    return this.endReasons.find((item) => item.value === value)?.label ?? value;
  }

  private hasExtraDetails(): boolean {
    return !!(
      this.form.controls.given_name.value
      || this.form.controls.family_name.value
      || this.form.controls.religious_name.value
      || this.form.controls.date_of_birth.value
      || this.form.controls.ordained_priest_date.value
      || this.form.controls.ordained_bishop_date.value
      || this.form.controls.email.value
      || this.form.controls.phone.value
      || this.form.controls.education.value
      || this.form.controls.biography.value
    );
  }

  private submit(): void {
    const type = this.form.controls.request_type.value;
    if (!type) {
      return;
    }

    this.saving = true;
    this.cdr.markForCheck();

    const proposedBishopData: Record<string, unknown> = {
      full_name: this.form.controls.full_name.value.trim(),
    };
    const extraFields: Array<[string, string]> = [
      ['given_name', this.form.controls.given_name.value],
      ['family_name', this.form.controls.family_name.value],
      ['religious_name', this.form.controls.religious_name.value],
      ['date_of_birth', this.form.controls.date_of_birth.value],
      ['ordained_priest_date', this.form.controls.ordained_priest_date.value],
      ['ordained_bishop_date', this.form.controls.ordained_bishop_date.value],
      ['email', this.form.controls.email.value],
      ['phone', this.form.controls.phone.value],
      ['education', this.form.controls.education.value],
      ['biography', this.form.controls.biography.value],
    ];
    extraFields.forEach(([key, value]) => {
      if (value.trim()) {
        proposedBishopData[key] = value.trim();
      }
    });

    const proposedAppointmentData: Record<string, unknown> = {};
    if (this.form.controls.effective_date.value) {
      proposedAppointmentData['effective_date'] = this.form.controls.effective_date.value;
    }
    if (this.form.controls.end_reason.value) {
      proposedAppointmentData['end_reason'] = this.form.controls.end_reason.value;
    }

    const payload = {
      request_type: type,
      target_bishop_id: this.isNewBishopFlow ? undefined : this.leadership.ordinary?.bishop_id,
      proposed_bishop_data: proposedBishopData,
      proposed_appointment_data: proposedAppointmentData,
      source_reference: this.form.controls.source_reference.value.trim() || undefined,
      supporting_information: this.form.controls.supporting_information.value.trim() || undefined,
      submission_notes: this.form.controls.submission_notes.value.trim() || undefined,
    };

    const save$ = this.editingRequest
      ? this.api.updateDraft(this.editingRequest.id, {
          ...payload,
          version: this.editingRequest.version,
        })
      : this.api.createDraft(payload);

    save$.pipe(
      switchMap((response) => {
        const saved = response.data;
        if (!saved) {
          throw new Error('Could not save your update request.');
        }
        if (!this.pendingPhoto) {
          return of(saved);
        }
        return this.api.uploadPhoto(saved.id, this.pendingPhoto).pipe(
          switchMap((photoResponse) => of(photoResponse.data ?? saved)),
        );
      }),
      switchMap((saved) => this.api.submit(saved.id, saved.version).pipe(
        switchMap(() => of(saved)),
      )),
    ).subscribe({
      next: () => {
        this.toast.success(
          this.isNewBishopFlow
            ? 'Your bishop suggestion was sent to Ekklesia for review.'
            : 'Your update was sent to Ekklesia for review.',
        );
        this.saving = false;
        this.completed.emit();
        this.cdr.markForCheck();
      },
      error: (err) => this.fail(this.readError(err, 'Could not submit your update for review.')),
    });
  }

  private fail(message: string): void {
    this.formError = message;
    this.saving = false;
    this.toast.error(message);
    this.cdr.markForCheck();
  }

  private readError(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse) {
      const apiMessage = err.error?.message;
      if (typeof apiMessage === 'string' && apiMessage.trim()) {
        return apiMessage;
      }
    }
    if (err instanceof Error && err.message) {
      return err.message;
    }
    return fallback;
  }
}
