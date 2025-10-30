import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

export interface FamilyMemberFormValue {
  id?: number | null;
  first_name: string;
  middle_name?: string;
  last_name: string;
  date_of_birth?: string;
  gender?: string;
  relationship_to_head: string;
  marital_status?: string;
  phone?: string;
  email?: string;
  occupation?: string;
  education?: string;
  baptism_date?: string;
  first_communion_date?: string;
  confirmation_date?: string;
  status?: string;
}

@Component({
  selector: 'app-family-member-form-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './family-member-form-modal.component.html',
  styleUrls: ['./family-member-form-modal.component.scss']
})
export class FamilyMemberFormModalComponent {
  @Input() member: FamilyMemberFormValue | null = null;
  @Output() save = new EventEmitter<FamilyMemberFormValue>();
  @Output() cancel = new EventEmitter<void>();

  form: FormGroup;
  saving = false;
  isEditMode = false;

  constructor(private fb: FormBuilder) {
    this.form = this.fb.group({
      id: [null],
      first_name: ['', Validators.required],
      middle_name: [''],
      last_name: ['', Validators.required],
      date_of_birth: [''],
      gender: [''],
      relationship_to_head: ['other', Validators.required],
      marital_status: ['single'],
      phone: [''],
      email: ['', Validators.email],
      occupation: [''],
      education: [''],
      baptism_date: [''],
      first_communion_date: [''],
      confirmation_date: [''],
      status: ['active']
    });
  }

  ngOnChanges(): void {
    if (this.member) {
      this.isEditMode = true;
      this.form.patchValue(this.member);
    } else {
      this.isEditMode = false;
      this.form.reset({ relationship_to_head: 'other', marital_status: 'single', status: 'active' });
    }
  }

  onSave(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving = true;
    const value = this.form.value as FamilyMemberFormValue;
    this.save.emit(value);
    this.saving = false;
  }

  onCancel(): void {
    this.cancel.emit();
  }
}


