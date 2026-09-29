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
import { BCC, BccRelocationPreview, Family } from '@core/models/family.model';
import { ModalShellComponent } from '@shared/components';

function createTransitionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

@Component({
  selector: 'app-bcc-transfer-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModalShellComponent],
  templateUrl: './bcc-transfer-modal.component.html',
  styleUrl: './bcc-transfer-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BccTransferModalComponent implements OnInit {
  private readonly familyService = inject(FamilyService);
  private readonly bccService = inject(BCCService);
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) family!: Family;
  @Output() completed = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  step = 1;
  readonly totalSteps = 3;
  bccs: BCC[] = [];
  bccsLoading = false;
  preview: BccRelocationPreview | null = null;
  previewLoading = false;
  saving = false;
  formError: string | null = null;
  readonly todayIsoDate = this.buildTodayIsoDate();

  readonly form = this.fb.nonNullable.group({
    target_bcc_id: ['', Validators.required],
    effective_date: ['', Validators.required],
    historical_note: [''],
  });

  ngOnInit(): void {
    this.form.controls.effective_date.setValue(this.todayIsoDate);
    this.loadBccs();
  }

  get stepTitle(): string {
    switch (this.step) {
      case 1:
        return 'Choose destination BCC';
      case 2:
        return 'Review impact';
      default:
        return 'Confirm move';
    }
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
      if (this.form.controls.target_bcc_id.invalid) {
        this.form.controls.target_bcc_id.markAsTouched();
        this.cdr.markForCheck();
        return;
      }
      this.loadPreview();
      return;
    }

    if (this.step === 2) {
      this.step = 3;
      this.cdr.markForCheck();
      return;
    }

    this.submit();
  }

  private loadBccs(): void {
    this.bccsLoading = true;
    this.cdr.markForCheck();

    this.bccService.getBCCs({ status: 'active', per_page: 100 }).subscribe({
      next: (response) => {
        this.bccs = (response.data ?? []).filter((bcc) => bcc.id !== this.family.bcc_id);
        this.bccsLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.bccs = [];
        this.bccsLoading = false;
        this.formError = 'Could not load BCC list. Please try again.';
        this.cdr.markForCheck();
      },
    });
  }

  private loadPreview(): void {
    const targetBccId = this.form.controls.target_bcc_id.value;
    this.previewLoading = true;
    this.cdr.markForCheck();

    this.familyService.previewBccRelocation(this.family.id, targetBccId).subscribe({
      next: (response) => {
        this.previewLoading = false;
        if (response.success && response.data) {
          this.preview = response.data;
          this.step = 2;
          this.formError = null;
        } else {
          this.formError = response.message || 'Could not preview this move.';
        }
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.previewLoading = false;
        this.formError = this.mapTransitionError(error);
        this.cdr.markForCheck();
      },
    });
  }

  private submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.cdr.markForCheck();
      return;
    }

    const raw = this.form.getRawValue();
    this.saving = true;
    this.formError = null;
    this.cdr.markForCheck();

    this.familyService.relocateBcc(this.family.id, {
      target_bcc_id: raw.target_bcc_id,
      effective_date: raw.effective_date,
      transition_id: createTransitionId(),
      historical_note: raw.historical_note.trim() || null,
    }).subscribe({
      next: (response) => {
        this.saving = false;
        if (response.success) {
          this.completed.emit();
        } else {
          this.formError = response.message || 'Could not move this family.';
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

  private buildTodayIsoDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private mapTransitionError(error: unknown): string {
    const { code, message } = this.normalizeError(error);

    switch (code) {
      case 'TARGET_BCC_ALREADY_ASSIGNED':
        return 'This family is already in that BCC.';
      case 'TARGET_BCC_NOT_FOUND':
        return 'That BCC was not found in your parish.';
      case 'FAMILY_ALREADY_MIGRATED':
        return 'Migrated families cannot be moved to another BCC.';
      case 'INVALID_EFFECTIVE_DATE':
        return 'Effective date cannot be in the future.';
      case 'CROSS_TENANT_RESOURCE':
        return 'That BCC belongs to another parish.';
      case 'TRANSITION_ALREADY_COMPLETED':
        return 'This move was already recorded.';
      default:
        return message || 'Could not complete the BCC move. Please try again.';
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
