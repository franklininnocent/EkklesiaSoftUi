import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Family, FamilyMember } from '@core/models/family.model';
import { ModalShellComponent } from '@shared/components';
import { PastoralCareService } from '../../services/pastoral-care.service';
import { PastoralCareType } from '../../models/pastoral-care.model';

@Component({
  selector: 'app-request-visit-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModalShellComponent],
  templateUrl: './request-visit-modal.component.html',
  styleUrl: './request-visit-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestVisitModalComponent {
  private readonly pastoralCare = inject(PastoralCareService);
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) family!: Family;
  @Output() completed = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  saving = false;
  formError: string | null = null;

  readonly visitTypes: Array<{ value: PastoralCareType; label: string }> = [
    { value: 'hospital_visit', label: 'Hospital visit' },
    { value: 'home_visit', label: 'Home visit' },
    { value: 'bereavement', label: 'Bereavement' },
    { value: 'other', label: 'Other' },
  ];

  readonly form = this.fb.nonNullable.group({
    person_id: [''],
    type: ['home_visit' as PastoralCareType, Validators.required],
    priority: ['routine' as 'urgent' | 'routine'],
    summary: ['', [Validators.required, Validators.maxLength(255)]],
    notes: [''],
    due_on: [''],
  });

  get members(): FamilyMember[] {
    return (this.family?.members ?? []).filter((member) => member.status !== 'inactive');
  }

  memberLabel(member: FamilyMember): string {
    return [member.first_name, member.last_name].filter(Boolean).join(' ').trim() || 'Family member';
  }

  submit(): void {
    if (this.form.invalid || this.saving) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.saving = true;
    this.formError = null;
    this.pastoralCare
      .create({
        family_id: this.family.id,
        person_id: value.person_id || null,
        type: value.type,
        priority: value.priority,
        summary: value.summary.trim(),
        notes: value.notes.trim() || null,
        due_on: value.due_on || null,
      })
      .subscribe({
        next: () => {
          this.saving = false;
          this.completed.emit();
        },
        error: (error: HttpErrorResponse) => {
          this.saving = false;
          this.formError = error.error?.message || 'Could not save this visit request.';
          this.cdr.markForCheck();
        },
      });
  }

  onCancel(): void {
    if (!this.saving) {
      this.cancel.emit();
    }
  }
}
