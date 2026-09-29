import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import {
  AppointmentEndReason,
  DiocesanAppointmentSummary,
  ReplaceOrdinaryRequest,
} from '@core/models/ecclesiastical';
import { BishopService, DioceseService, extractBishopList } from '@core/services/ecclesiastical';
import { ToastService } from '@core/services';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { markFormGroupTouched } from '@core/validators/form-validation.helper';

type SuccessorMode = 'new' | 'existing';

@Component({
  selector: 'app-appoint-successor-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgSelectModule, ModalShellComponent],
  templateUrl: './appoint-successor-modal.component.html',
  styleUrl: './appoint-successor-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppointSuccessorModalComponent implements OnChanges {
  @Input() show = false;
  @Input() dioceseId!: number;
  @Input() dioceseName = '';
  @Input() currentOrdinary: DiocesanAppointmentSummary | null = null;
  @Output() succeeded = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  form!: FormGroup;
  isSubmitting = false;
  bishopOptions: Array<{ id: number; full_name: string }> = [];
  loadingBishops = false;

  readonly endReasonOptions: Array<{ value: AppointmentEndReason; label: string }> = [
    { value: 'retirement', label: 'Retirement' },
    { value: 'transfer', label: 'Transfer' },
    { value: 'death', label: 'Death' },
    { value: 'resignation', label: 'Resignation' },
    { value: 'appointment_ended', label: 'Appointment ended' },
    { value: 'other', label: 'Other' },
  ];

  constructor(
    private fb: FormBuilder,
    private dioceseService: DioceseService,
    private bishopService: BishopService,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef,
  ) {
    this.form = this.fb.group({
      successor_mode: ['new', Validators.required],
      bishop_id: [null],
      full_name: ['', [Validators.maxLength(255)]],
      effective_date: ['', Validators.required],
      end_reason: ['retirement', Validators.required],
    });

    this.form.get('successor_mode')?.valueChanges.subscribe((mode: SuccessorMode) => {
      this.applySuccessorModeValidators(mode);
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['show']?.currentValue) {
      this.resetForm();
      this.loadBishopOptions();
    }
  }

  get successorMode(): SuccessorMode {
    return this.form.get('successor_mode')?.value ?? 'new';
  }

  private resetForm(): void {
    this.form.reset({
      successor_mode: 'new',
      bishop_id: null,
      full_name: '',
      effective_date: new Date().toISOString().slice(0, 10),
      end_reason: 'retirement',
    });
    this.applySuccessorModeValidators('new');
    this.isSubmitting = false;
  }

  private applySuccessorModeValidators(mode: SuccessorMode): void {
    const bishopId = this.form.get('bishop_id');
    const fullName = this.form.get('full_name');

    if (mode === 'existing') {
      bishopId?.setValidators([Validators.required]);
      fullName?.clearValidators();
      fullName?.setValue('');
    } else {
      bishopId?.clearValidators();
      bishopId?.setValue(null);
      fullName?.setValidators([Validators.required, Validators.maxLength(255)]);
    }

    bishopId?.updateValueAndValidity({ emitEvent: false });
    fullName?.updateValueAndValidity({ emitEvent: false });
  }

  private loadBishopOptions(): void {
    this.loadingBishops = true;
    this.bishopService.getBishops({ per_page: 100, sort_by: 'full_name', sort_dir: 'asc' }).subscribe({
      next: (response) => {
        const bishops = extractBishopList(response);
        const currentId = this.currentOrdinary?.bishop_id;
        this.bishopOptions = bishops
          .filter((bishop) => bishop.id !== currentId)
          .map((bishop) => ({ id: bishop.id, full_name: bishop.full_name }));
        this.loadingBishops = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.bishopOptions = [];
        this.loadingBishops = false;
        this.cdr.markForCheck();
      },
    });
  }

  onSubmit(): void {
    if (!this.form.valid || this.isSubmitting) {
      markFormGroupTouched(this.form);
      return;
    }

    const value = this.form.getRawValue();
    const payload: ReplaceOrdinaryRequest = {
      appointment: {
        effective_date: value.effective_date,
        canonical_role: 'diocesan_bishop',
      },
      end_reason: value.end_reason,
    };

    if (this.successorMode === 'existing') {
      payload.bishop_id = value.bishop_id;
    } else {
      payload.person = { full_name: value.full_name.trim() };
    }

    this.isSubmitting = true;
    this.dioceseService.replaceOrdinary(this.dioceseId, payload).subscribe({
      next: () => {
        this.toastService.success('Successor appointed successfully');
        this.isSubmitting = false;
        this.succeeded.emit();
        this.onCancel();
      },
      error: (error) => {
        console.error('Succession failed:', error);
        this.toastService.error(error?.error?.message || 'Failed to appoint successor');
        this.isSubmitting = false;
        this.cdr.markForCheck();
      },
    });
  }

  onCancel(): void {
    if (this.isSubmitting) {
      return;
    }
    this.cancelled.emit();
  }
}
