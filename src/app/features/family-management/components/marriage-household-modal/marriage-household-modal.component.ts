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
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BCCService } from '@core/services/bcc.service';
import { FamilyService } from '@core/services/family.service';
import { BCC, Family, FamilyMember } from '@core/models/family.model';
import { ModalShellComponent } from '@shared/components';

function createTransitionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

type MarriageOutcome = 'new_household' | 'join_existing';

@Component({
  selector: 'app-marriage-household-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModalShellComponent],
  templateUrl: './marriage-household-modal.component.html',
  styleUrl: './marriage-household-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarriageHouseholdModalComponent implements OnInit {
  private readonly familyService = inject(FamilyService);
  private readonly bccService = inject(BCCService);
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) sourceFamily!: Family;
  @Output() completed = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  step = 1;
  readonly totalSteps = 4;
  bccs: BCC[] = [];
  families: Family[] = [];
  familiesLoading = false;
  saving = false;
  formError: string | null = null;

  readonly form = this.fb.nonNullable.group({
    outcome: ['new_household' as MarriageOutcome, Validators.required],
    bride_member_id: ['', Validators.required],
    groom_member_id: ['', Validators.required],
    new_family_name: [''],
    new_bcc_id: [''],
    new_head_member_id: [''],
    target_family_id: [''],
    joining_member_id: [''],
    partner_member_id: [''],
    replacement_head_member_id: [''],
    effective_date: ['', Validators.required],
  });

  ngOnInit(): void {
    this.form.controls.effective_date.setValue(this.todayIsoDate());
    this.loadBccs();
    this.loadFamilies();
    this.applyOutcomeValidators();
  }

  get members(): FamilyMember[] {
    return this.sourceFamily.members ?? [];
  }

  get otherFamilies(): Family[] {
    return this.families.filter((family) => family.id !== this.sourceFamily.id);
  }

  get stepTitle(): string {
    switch (this.step) {
      case 1:
        return 'What happens after the wedding?';
      case 2:
        return 'Who is getting married?';
      case 3:
        return this.form.controls.outcome.value === 'new_household'
          ? 'New household details'
          : 'Join an existing household';
      default:
        return 'Review and confirm';
    }
  }

  memberLabel(member: FamilyMember): string {
    const name = [member.first_name, member.last_name].filter(Boolean).join(' ').trim();
    const relationship = member.relationship_to_head
      ? member.relationship_to_head.replace(/_/g, ' ')
      : '';
    return relationship ? `${name} (${relationship})` : name;
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
    this.formError = null;
    this.step -= 1;
    this.cdr.markForCheck();
  }

  goNext(): void {
    this.formError = null;

    if (this.step === 1) {
      this.applyOutcomeValidators();
      this.step = 2;
      this.cdr.markForCheck();
      return;
    }

    if (this.step === 2) {
      if (this.form.controls.bride_member_id.invalid || this.form.controls.groom_member_id.invalid) {
        this.form.markAllAsTouched();
        this.cdr.markForCheck();
        return;
      }
      if (this.form.controls.bride_member_id.value === this.form.controls.groom_member_id.value) {
        this.formError = 'Bride and groom must be different people.';
        this.cdr.markForCheck();
        return;
      }
      this.prefillJoinFields();
      this.step = 3;
      this.cdr.markForCheck();
      return;
    }

    if (this.step === 3) {
      if (!this.validateDetailsStep()) {
        this.cdr.markForCheck();
        return;
      }
      this.step = 4;
      this.cdr.markForCheck();
      return;
    }

    this.submit();
  }

  onOutcomeChange(): void {
    this.applyOutcomeValidators();
    this.cdr.markForCheck();
  }

  private prefillJoinFields(): void {
    const brideId = this.form.controls.bride_member_id.value;
    const groomId = this.form.controls.groom_member_id.value;
 const brideInSource = this.members.some((member) => member.id === brideId);
    const groomInSource = this.members.some((member) => member.id === groomId);

    if (this.form.controls.outcome.value === 'join_existing') {
      if (brideInSource && !groomInSource) {
        this.form.patchValue({
          joining_member_id: brideId,
          partner_member_id: groomId,
        });
      } else if (groomInSource && !brideInSource) {
        this.form.patchValue({
          joining_member_id: groomId,
          partner_member_id: brideId,
        });
      } else if (brideInSource) {
        this.form.patchValue({ joining_member_id: brideId });
      }
    } else {
      this.form.patchValue({
        new_head_member_id: brideId,
        new_family_name: `${this.sourceFamily.family_name} Household`,
      });
    }
  }

  private validateDetailsStep(): boolean {
    const outcome = this.form.controls.outcome.value;

    if (outcome === 'new_household') {
      const controls = ['new_family_name', 'new_bcc_id', 'new_head_member_id'] as const;
      let valid = true;
      controls.forEach((name) => {
        const control = this.form.controls[name];
        if (control.invalid) {
          control.markAsTouched();
          valid = false;
        }
      });
      return valid;
    }

    const controls = ['target_family_id', 'joining_member_id'] as const;
    let valid = true;
    controls.forEach((name) => {
      const control = this.form.controls[name];
      if (control.invalid) {
        control.markAsTouched();
        valid = false;
      }
    });
    return valid;
  }

  private submit(): void {
    if (this.form.controls.effective_date.invalid) {
      this.form.controls.effective_date.markAsTouched();
      this.cdr.markForCheck();
      return;
    }

    const raw = this.form.getRawValue();
    const originSuccessions = raw.replacement_head_member_id
      ? [{
          origin_family_id: this.sourceFamily.id,
          replacement_head_member_id: raw.replacement_head_member_id,
        }]
      : undefined;

    const payload = raw.outcome === 'new_household'
      ? {
          transition_id: createTransitionId(),
          outcome: raw.outcome,
          effective_date: raw.effective_date,
          bride_member_id: raw.bride_member_id,
          groom_member_id: raw.groom_member_id,
          new_household: {
            family_name: raw.new_family_name,
            bcc_id: raw.new_bcc_id,
          },
          new_household_head_member_id: raw.new_head_member_id,
          origin_successions: originSuccessions,
        }
      : {
          transition_id: createTransitionId(),
          outcome: raw.outcome,
          effective_date: raw.effective_date,
          bride_member_id: raw.bride_member_id,
          groom_member_id: raw.groom_member_id,
          target_family_id: raw.target_family_id,
          joining_member_id: raw.joining_member_id,
          partner_member_id: raw.partner_member_id || undefined,
          origin_successions: originSuccessions,
        };

    this.saving = true;
    this.formError = null;
    this.cdr.markForCheck();

    this.familyService.marriageTransition(payload).subscribe({
      next: (response) => {
        this.saving = false;
        if (response.success) {
          this.completed.emit();
        } else {
          this.formError = response.message || 'Could not record this marriage transition.';
        }
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.saving = false;
        this.formError = this.mapTransitionError(error);
        this.cdr.markForCheck();
      },
    });
  }

  private loadBccs(): void {
    this.bccService.getBCCs({ status: 'active', per_page: 100 }).subscribe({
      next: (response) => {
        this.bccs = response.data ?? [];
        this.cdr.markForCheck();
      },
      error: () => {
        this.bccs = [];
        this.cdr.markForCheck();
      },
    });
  }

  private loadFamilies(): void {
    this.familiesLoading = true;
    this.cdr.markForCheck();

    this.familyService.getFamilies({ status: 'active', per_page: 100 }).subscribe({
      next: (response) => {
        this.families = response.data ?? [];
        this.familiesLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.families = [];
        this.familiesLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  private applyOutcomeValidators(): void {
    const outcome = this.form.controls.outcome.value;
    const newFields = ['new_family_name', 'new_bcc_id', 'new_head_member_id'] as const;
    const joinFields = ['target_family_id', 'joining_member_id'] as const;

    newFields.forEach((name) => {
      const control = this.form.controls[name];
      if (outcome === 'new_household') {
        control.setValidators(Validators.required);
      } else {
        control.clearValidators();
        control.setValue('');
      }
      control.updateValueAndValidity();
    });

    joinFields.forEach((name) => {
      const control = this.form.controls[name];
      if (outcome === 'join_existing') {
        control.setValidators(Validators.required);
      } else {
        control.clearValidators();
        control.setValue('');
      }
      control.updateValueAndValidity();
    });
  }

  private todayIsoDate(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  private mapTransitionError(error: unknown): string {
    const { code, message } = this.normalizeError(error);

    switch (code) {
      case 'SAME_FAMILY_MARRIAGE_NOT_ALLOWED':
        return 'Both people already belong to the same family.';
      case 'HEAD_SUCCESSION_REQUIRED':
        return 'Choose who will be the new head in the family someone is leaving.';
      case 'INVALID_SUCCESSION_MEMBER':
        return 'The chosen replacement head is not valid for that family.';
      case 'TARGET_FAMILY_NOT_FOUND':
        return 'The destination family was not found.';
      case 'MEMBER_ALREADY_IN_TARGET_FAMILY':
        return 'That person is already in the destination family.';
      case 'INVALID_EFFECTIVE_DATE':
        return 'Effective date cannot be in the future.';
      case 'TRANSITION_ALREADY_COMPLETED':
        return 'This marriage transition was already recorded.';
      default:
        return message || 'Could not record this marriage transition. Please try again.';
    }
  }

  private normalizeError(error: unknown): { code?: string; message?: string } {
    const payload = error instanceof HttpErrorResponse
      ? error.error
      : error && typeof error === 'object'
        ? error
        : null;

    if (payload && typeof payload === 'object') {
      const body = payload as { code?: string; message?: string };
      return { code: body.code, message: body.message };
    }

    return {};
  }
}
