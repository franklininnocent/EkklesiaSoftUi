import { Component, Input, Output, EventEmitter, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { BCCService } from '../../../../core/services/bcc.service';
import { BCC } from '../../../../core/models/family.model';

@Component({
  selector: 'app-bcc-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './bcc-form.html',
  styleUrls: ['./bcc-form.scss']
})
export class BCCFormComponent implements OnInit, AfterViewInit {
  @Input() bcc: BCC | null = null;
  @Output() save = new EventEmitter<any>();
  @Output() cancel = new EventEmitter<void>();
  @ViewChild('formContent', { static: false }) formContentRef!: ElementRef<HTMLDivElement>;

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
    if (this.bccForm.valid) {
      this.loading = true;
      this.error = null;
      const formData = this.bccForm.value;

      const apiCall = this.bcc
        ? this.bccService.updateBCC(this.bcc.id, formData)
        : this.bccService.createBCC(formData);

      apiCall.subscribe({
        next: (response) => {
          this.loading = false;
          if (response.success) {
            this.save.emit(response.data);
          } else {
            this.error = response.message || 'Failed to save BCC';
          }
        },
        error: (error) => {
          this.loading = false;
          this.error = error?.error?.message || 'Failed to save BCC. Please try again.';
          console.error('Error saving BCC:', error);
        }
      });
    } else {
      this.markFormGroupTouched(this.bccForm);
      this.error = 'Please fill in all required fields correctly.';
    }
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
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
    const control = this.bccForm.get(controlName);
    return !!(control && control.invalid && control.touched);
  }

  getFieldError(controlName: string): string {
    const control = this.bccForm.get(controlName);
    if (!control || !control.errors || !control.touched) {
      return '';
    }

    if (control.errors['required']) {
      return `${controlName.replace('_', ' ')} is required`;
    }
    if (control.errors['email']) {
      return 'Please enter a valid email address';
    }

    return 'Invalid value';
  }
}
