import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
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
export class BCCFormComponent implements OnInit {
  @Input() bcc: BCC | null = null;
  @Output() save = new EventEmitter<any>();
  @Output() cancel = new EventEmitter<void>();

  bccForm: FormGroup;
  loading = false;
  error: string | null = null;

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
    this.bccForm = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      meeting_place: [''],
      meeting_day: [''],
      meeting_time: [''],
      meeting_frequency: [''],
      min_families: [10, [Validators.required, Validators.min(1)]],
      max_families: [50, [Validators.required, Validators.min(1)]],
      contact_phone: [''],
      contact_email: ['', Validators.email],
      status: ['active'],
      established_date: [''],
      notes: ['']
    });
  }

  ngOnInit(): void {
    if (this.bcc) {
      this.bccForm.patchValue(this.bcc);
    }
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
}
