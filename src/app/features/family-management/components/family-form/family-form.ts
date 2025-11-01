import { Component, Input, Output, EventEmitter, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { FamilyService } from '../../../../core/services/family.service';
import { Family, BCC } from '../../../../core/models/family.model';
import { FamilyMemberFormModalComponent, FamilyMemberFormValue } from '../family-member-form-modal/family-member-form-modal.component';
import { tenantPhoneValidator, getTenantCallingCode } from '../../../../core/validators/phone.validators';
import { getErrorMessage, isFieldInvalid, markFormGroupTouched } from '../../../../core/validators/form-validation.helper';

@Component({
  selector: 'app-family-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FamilyMemberFormModalComponent],
  templateUrl: './family-form.html',
  styleUrls: ['./family-form.scss']
})
export class FamilyFormComponent implements OnInit, AfterViewInit {
  @Input() family: Family | null = null;
  @Input() bccs: BCC[] = [];
  @Output() save = new EventEmitter<any>();
  @Output() cancel = new EventEmitter<void>();

  familyForm: FormGroup;
  activeTab = 'info'; // 'info' | 'head' | 'members'
  loading = false;
  error: string | null = null;
  showMemberModal = false;
  memberToEditIndex: number | null = null;
  callingCode: string = getTenantCallingCode();
  expandedMemberIndexes: Set<number> = new Set();

  @ViewChild('infoTabContent', { static: false }) infoTabContentRef!: ElementRef<HTMLDivElement>;
  @ViewChild('headTabContent', { static: false }) headTabContentRef!: ElementRef<HTMLDivElement>;
  @ViewChild('membersTabContent', { static: false }) membersTabContentRef!: ElementRef<HTMLDivElement>;

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
      primary_phone: ['', tenantPhoneValidator()],
      secondary_phone: ['', tenantPhoneValidator()],
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

  ngAfterViewInit(): void {
    this.scrollActiveTabToTop();
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
      full_name: [member?.full_name || ''],
      full_name_display: [member?.full_name_display || ''],
      date_of_birth: [member?.date_of_birth || ''],
      gender: [member?.gender || ''],
      relationship_to_head: [member?.relationship_to_head || 'other', Validators.required],
      marital_status: [member?.marital_status || 'single'],
      phone: [member?.phone || '', tenantPhoneValidator()],
      email: [member?.email || '', Validators.email],
      occupation: [member?.occupation || ''],
      education: [member?.education || ''],
      baptism_date: [member?.baptism_date || ''],
      first_communion_date: [member?.first_communion_date || ''],
      confirmation_date: [member?.confirmation_date || ''],
      status: [member?.status || 'active'],
      is_primary_contact: [member?.is_primary_contact || false]
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

  toggleMember(index: number): void {
    if (this.expandedMemberIndexes.has(index)) {
      this.expandedMemberIndexes.delete(index);
    } else {
      this.expandedMemberIndexes.add(index);
    }
  }

  isMemberExpanded(index: number): boolean {
    return this.expandedMemberIndexes.has(index);
  }

  /**
   * Get display name from a member
   */
  getDisplayName(member: any | null | undefined): string {
    if (!member) {
      return '—';
    }
    // Check API-returned fields in priority order
    const fullNameFields = [
      member.full_name_display,
      member.full_name,
      member.fullName
    ];
    
    for (const full of fullNameFields) {
      if (typeof full === 'string' && full.trim().length > 0) {
        return full.trim();
      }
    }
    
    // Build from parts
    const parts = [member.first_name, member.middle_name, member.last_name]
      .filter((p: string | undefined) => !!p && String(p).trim().length > 0)
      .map((p: string) => p.trim());
    const name = parts.join(' ').replace(/\s+/g, ' ').trim();
    return name || '—';
  }

  /**
   * Normalize name for comparison (remove extra spaces, lowercase)
   */
  private normalizeName(name: string): string {
    return (name || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  /**
   * Get all possible name variations from a member
   */
  private getMemberNameVariations(member: any): string[] {
    const variations: string[] = [];
    
    // Check all possible full name fields from API
    const fullNameFields = [
      member.full_name,
      member.full_name_display,
      this.getDisplayName(member)
    ];
    
    fullNameFields.forEach(name => {
      if (name && typeof name === 'string' && name.trim()) {
        variations.push(this.normalizeName(name));
      }
    });
    
    return [...new Set(variations)]; // Remove duplicates
  }

  /**
   * Check if a member's name matches the target name
   */
  private nameMatches(member: any, targetName: string): boolean {
    const normalizedTarget = this.normalizeName(targetName);
    if (!normalizedTarget) return false;
    
    const memberVariations = this.getMemberNameVariations(member);
    
    // Exact match
    if (memberVariations.includes(normalizedTarget)) {
      return true;
    }
    
    // Split target and member names into parts for better matching
    const targetParts = normalizedTarget.split(/\s+/).filter(p => p.length > 0);
    
    for (const variation of memberVariations) {
      const variationParts = variation.split(/\s+/).filter(p => p.length > 0);
      
      // If both have at least 2 parts, check last name match first (most reliable)
      if (targetParts.length >= 2 && variationParts.length >= 2) {
        const targetLastName = targetParts[targetParts.length - 1];
        const variationLastName = variationParts[variationParts.length - 1];
        
        // Last names must match
        if (targetLastName === variationLastName) {
          // Check if first name matches (allows for middle names)
          const targetFirstName = targetParts[0];
          const variationFirstName = variationParts[0];
          
          if (targetFirstName === variationFirstName) {
            return true;
          }
          
          // Allow partial first name match (e.g., "Ann" matches "Annamae")
          if (targetFirstName.length >= 3 && variationFirstName.startsWith(targetFirstName)) {
            return true;
          }
          if (variationFirstName.length >= 3 && targetFirstName.startsWith(variationFirstName)) {
            return true;
          }
        }
      }
      
      // Check if target name is fully contained in variation or vice versa
      if (variation.includes(normalizedTarget) || normalizedTarget.includes(variation)) {
        // Additional check: ensure at least one meaningful word matches
        const commonWords = targetParts.filter(word => 
          word.length >= 2 && variationParts.includes(word)
        );
        if (commonWords.length >= 2 || (commonWords.length === 1 && targetParts.length === 1)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Get the family head member from the form array
   */
  getFamilyHead(): any | null {
    const membersArray = this.members.controls;
    if (!membersArray || membersArray.length === 0) {
      // No members in form, check if we have head_of_family from the original family
      if (this.family?.head_of_family) {
        return {
          first_name: this.family.head_of_family,
          last_name: '',
          full_name: this.family.head_of_family,
          relationship_to_head: 'self',
          phone: this.family.primary_phone || '',
          email: this.family.email || '',
          date_of_birth: '',
          gender: '',
          marital_status: '',
          occupation: '',
          is_from_db_name: true,
          head_profile_image_full_url: this.family.head_profile_image_full_url || null
        };
      }
      return null;
    }

    const candidates = membersArray.map(m => m.value);

    // 1) PRIORITY: If database specifies head_of_family on the family record, match it exactly
    const headName = (this.family?.head_of_family || '').trim();
    if (headName) {
      // Try exact match first
      let byName = candidates.find(m => this.nameMatches(m, headName));
      
      if (byName) {
        return byName;
      }
      
      // If no exact match, try fuzzy matching (last name priority)
      const headParts = this.normalizeName(headName).split(/\s+/);
      if (headParts.length >= 2) {
        const headLastName = headParts[headParts.length - 1];
        byName = candidates.find(m => {
          const memberVariations = this.getMemberNameVariations(m);
          const found = memberVariations.some(v => {
            const parts = v.split(/\s+/);
            const lastMatch = parts.length >= 2 && parts[parts.length - 1] === headLastName;
            const firstMatch = parts.length >= 1 && parts[0] === headParts[0];
            return lastMatch && (firstMatch || headParts.length === 1);
          });
          return found;
        });
        if (byName) {
          return byName;
        }
      }
      
      // If head_of_family is specified but we can't match any member, return a mock object
      return {
        first_name: this.family.head_of_family,
        last_name: '',
        full_name: this.family.head_of_family,
        relationship_to_head: 'self',
        phone: this.family.primary_phone || '',
        email: this.family.email || '',
        date_of_birth: '',
        gender: '',
        marital_status: '',
        occupation: '',
        is_from_db_name: true,
        head_profile_image_full_url: this.family.head_profile_image_full_url || null
      };
    }

    // 2) Prefer explicit self/head relationships (prioritize active members)
    const relPriority = ['self', 'head', 'head of family'];
    const byRelationship = candidates.find(m => {
      const rel = String(m.relationship_to_head || '').toLowerCase();
      return relPriority.includes(rel) && m.status === 'active';
    }) || candidates.find(m => {
      const rel = String(m.relationship_to_head || '').toLowerCase();
      return relPriority.includes(rel);
    }) || candidates.find(m => {
      const isPrimary = (m as any).is_primary_contact === true && m.status === 'active';
      return isPrimary;
    }) || candidates.find(m => {
      const isPrimary = (m as any).is_primary_contact === true;
      return isPrimary;
    });
    if (byRelationship) {
      return byRelationship;
    }

    // 3) Fallback: first active member, else first member
    return candidates.find(m => m.status === 'active') || candidates[0] || null;
  }

  /**
   * Get the index of the family head in the members array
   */
  getFamilyHeadIndex(): number | null {
    const members = this.members.controls;
    for (let i = 0; i < members.length; i++) {
      const rel = String(members[i].get('relationship_to_head')?.value || '').toLowerCase();
      if (rel === 'self' || rel === 'head' || rel === 'head of family') {
        return i;
      }
    }
    return null;
  }

  /**
   * Check if a member at index is the family head
   */
  isHeadMember(index: number): boolean {
    const member = this.members.at(index);
    const rel = String(member.get('relationship_to_head')?.value || '').toLowerCase();
    return rel === 'self' || rel === 'head' || rel === 'head of family';
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
    // Ensure new tab content starts at the top
    setTimeout(() => this.scrollActiveTabToTop(), 50);
  }

  private scrollActiveTabToTop(): void {
    let ref;
    if (this.activeTab === 'info') {
      ref = this.infoTabContentRef;
    } else if (this.activeTab === 'head') {
      ref = this.headTabContentRef;
    } else {
      ref = this.membersTabContentRef;
    }
    if (ref?.nativeElement) {
      ref.nativeElement.scrollTop = 0;
    }
  }

  /**
   * Submit the form
   */
  onSubmit(): void {
    if (!this.familyForm.valid) {
      markFormGroupTouched(this.familyForm);
      // Switch to info tab if validation fails and we're on members tab
      if (this.activeTab === 'members') {
        this.switchTab('info');
      }
      return;
    }
    
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
    return isFieldInvalid(controlName, this.familyForm);
  }

  /**
   * Get user-friendly error message for a form control
   */
  getErrorMessage(controlName: string): string {
    return getErrorMessage(controlName, this.familyForm);
  }

  /**
   * Check if a member form control has an error
   */
  hasMemberError(index: number, controlName: string): boolean {
    const control = this.members.at(index).get(controlName);
    return !!(control && control.invalid && control.touched);
  }
}
