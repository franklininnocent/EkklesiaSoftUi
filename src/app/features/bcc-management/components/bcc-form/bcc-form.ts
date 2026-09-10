import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { BCCService } from '../../../../core/services/bcc.service';
import { BCC } from '../../../../core/models/family.model';
import { getErrorMessage, isFieldInvalid, markFormGroupTouched } from '../../../../core/validators/form-validation.helper';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { SubscriptionAccessService } from '@core/services/subscription-access.service';
import { ToastService } from '@core/services/toast.service';

@Component({
  selector: 'app-bcc-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModalShellComponent],
  templateUrl: './bcc-form.html',
  styleUrls: ['./bcc-form.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BCCFormComponent implements OnInit, OnDestroy, AfterViewInit {
  @Input() bcc: BCC | null = null;
  @Output() save = new EventEmitter<any>();
  @Output() cancel = new EventEmitter<void>();
  @ViewChild('formContent', { static: false }) formContentRef!: ElementRef<HTMLFormElement>;

  private destroy$ = new Subject<void>();
  private cdr = inject(ChangeDetectorRef);
  private readonly subscriptionAccess = inject(SubscriptionAccessService);
  private readonly toast = inject(ToastService);
  bccForm: FormGroup;
  loading = false;
  error: string | null = null;
  today: string;

  weekDays = [
    { value: 'monday', label: 'Monday' },
    { value: 'tuesday', label: 'Tuesday' },
    { value: 'wednesday', label: 'Wednesday' },
    { value: 'thursday', label: 'Thursday' },
    { value: 'friday', label: 'Friday' },
    { value: 'saturday', label: 'Saturday' },
    { value: 'sunday', label: 'Sunday' }
  ];

  frequencies = [
    'Weekly',
    'Bi-weekly',
    'Monthly',
    'Quarterly'
  ];

  constructor(
    private fb: FormBuilder,
    private bccService: BCCService
  ) {
    // Set today's date for max date validation
    const today = new Date();
    this.today = today.toISOString().split('T')[0];
    this.bccForm = this.fb.group({
      bcc_code: [''], // Auto-generated, read-only in edit mode
      name: ['', Validators.required],
      description: [''],
      location: [''], // Location/Street address
      meeting_place: [''],
      meeting_day: [''],
      meeting_time: [''],
      meeting_frequency: [''],
      status: ['active', Validators.required],
      established_date: [''],
      notes: ['']
    });
  }

  ngOnInit(): void {
    if (this.bcc) {
      this.bccForm.patchValue(this.bcc);
    }

    // Watch for status changes to validate against active families
    this.bccForm.get('status')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((status) => {
        this.validateStatusChange(status);
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Validate status change - prevent inactive if there are active families
   */
  private validateStatusChange(status: string): void {
    const statusControl = this.bccForm.get('status');
    
    if (!statusControl || !this.bcc) {
      return;
    }

    // Only validate when trying to set to inactive
    if (status === 'inactive') {
      const activeFamilyCount = this.getActiveFamilyCountInternal();
      
      if (activeFamilyCount > 0) {
        statusControl.setErrors({
          hasActiveFamilies: true
        });
        this.error = `Cannot set BCC to inactive. There ${activeFamilyCount === 1 ? 'is' : 'are'} ${activeFamilyCount} active ${activeFamilyCount === 1 ? 'family' : 'families'} assigned to this BCC. Please reassign or deactivate the families first.`;
      } else {
        statusControl.setErrors(null);
        this.error = null;
      }
    } else {
      // Clear error when status is not inactive
      statusControl.setErrors(null);
      this.error = null;
    }
  }

  /**
   * Get count of active families in this BCC (private method)
   */
  private getActiveFamilyCountInternal(): number {
    if (!this.bcc) {
      return 0;
    }

    // If families array is available, count active families
    if (this.bcc.families && Array.isArray(this.bcc.families)) {
      return this.bcc.families.filter(family => family.status === 'active').length;
    }

    // Fallback: use current_family_count if families array is not loaded
    // Note: This assumes all families in current_family_count are active
    // If this is not accurate, the backend should include families array
    if (this.bcc.current_family_count !== undefined && this.bcc.current_family_count > 0) {
      return this.bcc.current_family_count;
    }

    return 0;
  }

  /**
   * Get active family count (for template)
   */
  getActiveFamilyCount(): number {
    return this.getActiveFamilyCountInternal();
  }

  ngAfterViewInit(): void {
    // Ensure form content scrolls to top when modal opens
    this.scrollToTop();
  }

  private scrollToTop(): void {
    setTimeout(() => {
      if (this.formContentRef?.nativeElement) {
        this.formContentRef.nativeElement.scrollTop = 0;
      }
    }, 150);
  }

  onSubmit(): void {
    if (this.subscriptionAccess.isReadOnly()) {
      this.toast.warning('Read-only mode: renew subscription to save BCCs.', 'Read-only');
      return;
    }
    // Re-validate status before submission
    const status = this.bccForm.get('status')?.value;
    if (status === 'inactive' && this.bcc) {
      this.validateStatusChange(status);
    }

    if (!this.bccForm.valid) {
      markFormGroupTouched(this.bccForm);
      if (!this.error) {
        this.error = null; // Individual field errors will show
      }
      return;
    }
    
    if (this.bccForm.valid) {
      this.loading = true;
      const formData = this.bccForm.value;

      const apiCall = this.bcc
        ? this.bccService.updateBCC(this.bcc.id, formData)
        : this.bccService.createBCC(formData);

      apiCall
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            this.loading = false;
            if (response.success) {
              this.save.emit(response.data);
            } else {
              this.error = response.message || 'Failed to save BCC';
            }
            this.cdr.markForCheck();
          },
          error: (error) => {
            this.loading = false;
            this.error = error?.error?.message || 'Failed to save BCC. Please try again.';
            console.error('Error saving BCC:', error);
            this.cdr.markForCheck();
          }
        });
    }
  }

  onCancel(): void {
    if (this.bccForm.dirty) {
      if (confirm('You have unsaved changes. Are you sure you want to cancel?')) {
        this.cancel.emit();
      }
    } else {
      this.cancel.emit();
    }
  }

  hasError(controlName: string): boolean {
    return isFieldInvalid(controlName, this.bccForm);
  }

  getErrorMessage(controlName: string): string {
    const error = getErrorMessage(controlName, this.bccForm);
    if (!error && controlName === 'status' && this.bccForm.get('status')?.errors?.['hasActiveFamilies']) {
      return 'Cannot set BCC to inactive with active families';
    }
    return error;
  }
}
