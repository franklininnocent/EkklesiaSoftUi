import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { FamilyService } from '../../../../core/services/family.service';
import { Family, BCC } from '../../../../core/models/family.model';
import { FamilyMemberFormModalComponent, FamilyMemberFormValue } from '../family-member-form-modal/family-member-form-modal.component';

@Component({
  selector: 'app-family-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FamilyMemberFormModalComponent],
  templateUrl: './family-form.html',
  styleUrls: ['./family-form.scss']
})
export class FamilyFormComponent implements OnInit {
  @Input() family: Family | null = null;
  @Input() bccs: BCC[] = [];
  @Output() save = new EventEmitter<any>();
  @Output() cancel = new EventEmitter<void>();

  familyForm: FormGroup;
  activeTab = 'info'; // 'info' | 'members'
  loading = false;
  error: string | null = null;
  showMemberModal = false;
  memberToEditIndex: number | null = null;

  // For Math methods in template
  Math = Math;

  constructor(
    private fb: FormBuilder,
    private familyService: FamilyService
  ) {
    this.familyForm = this.fb.group({
      family_name: ['', Validators.required],
      address_line_1: [''],
      address_line_2: [''],
      city: [''],
      postal_code: [''],
      updated_at: [''],
      bcc_id: [''],
      primary_phone: [''],
      secondary_phone: [''],
      email: ['', Validators.email],
      status: ['active'],
      notes: [''],
      members: this.fb.array([])
    });
  }

  ngOnInit(): void {
    if (this.family) {
      this.familyForm.patchValue(this.family);
      if (this.family.updated_at) {
        this.familyForm.get('updated_at')?.setValue(this.family.updated_at);
      }
      // Load existing members
      if (this.family.members && this.family.members.length > 0) {
        this.family.members.forEach(member => this.addMember(member));
      }
    }
  }

  get members(): FormArray {
    return this.familyForm.get('members') as FormArray;
  }

  /**
   * Add a new member to the form
   */
  addMember(member?: any): void {
    const memberForm = this.fb.group({
      id: [member?.id || null],
      first_name: [member?.first_name || '', Validators.required],
      middle_name: [member?.middle_name || ''],
      last_name: [member?.last_name || '', Validators.required],
      date_of_birth: [member?.date_of_birth || ''],
      gender: [member?.gender || ''],
      relationship_to_head: [member?.relationship_to_head || 'other', Validators.required],
      marital_status: [member?.marital_status || 'single'],
      phone: [member?.phone || ''],
      email: [member?.email || '', Validators.email],
      occupation: [member?.occupation || ''],
      education: [member?.education || ''],
      baptism_date: [member?.baptism_date || ''],
      first_communion_date: [member?.first_communion_date || ''],
      confirmation_date: [member?.confirmation_date || ''],
      status: [member?.status || 'active']
    });

    this.members.push(memberForm);
  }

  openAddMemberModal(): void {
    this.memberToEditIndex = null;
    this.showMemberModal = true;
  }

  openEditMemberModal(index: number): void {
    this.memberToEditIndex = index;
    this.showMemberModal = true;
  }

  onMemberModalSave(value: FamilyMemberFormValue): void {
    if (this.memberToEditIndex === null) {
      this.addMember(value);
    } else {
      const group = this.members.at(this.memberToEditIndex) as FormGroup;
      group.patchValue(value);
    }
    this.showMemberModal = false;
    this.memberToEditIndex = null;
  }

  onMemberModalCancel(): void {
    this.showMemberModal = false;
    this.memberToEditIndex = null;
  }

  /**
   * Remove a member from the form
   */
  removeMember(index: number): void {
    if (confirm('Are you sure you want to remove this member?')) {
      this.members.removeAt(index);
    }
  }

  /**
   * Switch between tabs
   */
  switchTab(tab: string): void {
    this.activeTab = tab;
  }

  /**
   * Submit the form
   */
  onSubmit(): void {
    if (this.familyForm.valid) {
      this.loading = true;
      this.error = null;
      const formData = this.familyForm.value;

      const apiCall = this.family
        ? this.familyService.updateFamily(this.family.id, formData)
        : this.familyService.createFamily(formData);

      apiCall.subscribe({
        next: (response) => {
          this.loading = false;
          if (response.success) {
            this.save.emit(response.data);
          } else {
            this.error = response.message || 'Failed to save family';
          }
        },
        error: (error) => {
          this.loading = false;
          this.error = error?.error?.message || 'Failed to save family. Please try again.';
          console.error('Error saving family:', error);
        }
      });
    } else {
      // Mark all fields as touched to show validation errors
      this.markFormGroupTouched(this.familyForm);
      this.error = 'Please fill in all required fields correctly.';
    }
  }

  /**
   * Mark all fields as touched to trigger validation display
   */
  private markFormGroupTouched(formGroup: FormGroup | FormArray): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();

      if (control instanceof FormGroup || control instanceof FormArray) {
        this.markFormGroupTouched(control);
      }
    });
  }

  /**
   * Cancel and close the form
   */
  onCancel(): void {
    if (this.familyForm.dirty) {
      if (confirm('You have unsaved changes. Are you sure you want to cancel?')) {
        this.cancel.emit();
      }
    } else {
      this.cancel.emit();
    }
  }

  /**
   * Check if a form control has an error
   */
  hasError(controlName: string): boolean {
    const control = this.familyForm.get(controlName);
    return !!(control && control.invalid && control.touched);
  }

  /**
   * Check if a member form control has an error
   */
  hasMemberError(index: number, controlName: string): boolean {
    const control = this.members.at(index).get(controlName);
    return !!(control && control.invalid && control.touched);
  }
}
