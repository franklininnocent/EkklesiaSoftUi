import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FamilyService } from '../../../../core/services/family.service';
import { Family, FamilyMember } from '../../../../core/models/family.model';
import { FamilyFormComponent } from '../family-form/family-form';
import { FamilyMemberFormModalComponent, FamilyMemberFormValue } from '../family-member-form-modal/family-member-form-modal.component';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'app-family-detail',
  standalone: true,
  imports: [CommonModule, FamilyFormComponent, FamilyMemberFormModalComponent],
  templateUrl: './family-detail.html',
  styleUrls: ['./family-detail.scss'],
})
export class FamilyDetail implements OnInit {
  family: Family | null = null;
  loading = true;
  error: string | null = null;
  showEdit = false;
  expandedMemberIndexes: Set<number> = new Set();
  showMemberModal = false;
  memberToEditIndex: number | null = null;
  memberToEdit: FamilyMemberFormValue | null = null;
  editingHeadImage = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private familyService: FamilyService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') as string;
    if (!id) {
      this.error = 'Family not found';
      this.loading = false;
      return;
    }
    this.loadFamily(id);
  }

  loadFamily(id: string): void {
    this.loading = true;
    this.familyService.getFamily(id).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.family = res.data;
          this.loading = false;
        } else {
          this.error = res.message || 'Failed to load family';
          this.loading = false;
        }
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to load family';
        this.loading = false;
      }
    });
  }

  openEdit(): void {
    this.showEdit = true;
  }

  onEditSave(updated: Family): void {
    this.showEdit = false;
    this.family = updated;
  }

  onEditCancel(): void {
    this.showEdit = false;
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
   * Normalize name for comparison (remove extra spaces, lowercase)
   */
  private normalizeName(name: string): string {
    return (name || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  /**
   * Get all possible name variations from a member
   */
  private getMemberNameVariations(member: FamilyMember): string[] {
    const variations: string[] = [];
    
    // Check all possible full name fields from API
    const fullNameFields = [
      (member as any).full_name,
      (member as any).full_name_display,
      this.getDisplayName(member)
    ];
    
    fullNameFields.forEach(name => {
      if (name && typeof name === 'string' && name.trim()) {
        variations.push(this.normalizeName(name));
      }
    });
    
    // Also try first + last name combination
    if (member.first_name && member.last_name) {
      const combined = `${member.first_name} ${member.last_name}`.trim();
      if (combined) {
        variations.push(this.normalizeName(combined));
      }
    }
    
    return [...new Set(variations)]; // Remove duplicates
  }

  /**
   * Check if a member's name matches the target name
   */
  private nameMatches(member: FamilyMember, targetName: string): boolean {
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

  getFamilyHead(): FamilyMember | null {
    if (!this.family || !this.family.members || this.family.members.length === 0) {
      return null;
    }
    const candidates = this.family.members;

    // 1) PRIORITY: If database specifies head_of_family on the family record, match it exactly
    const headName = (this.family.head_of_family || '').trim();
    if (headName) {
      // Try exact match first
      let byName = candidates.find(m => {
        const matches = this.nameMatches(m, headName);
        return matches;
      });
      
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
            // Also check first name matches
            const firstMatch = parts.length >= 1 && parts[0] === headParts[0];
            return lastMatch && (firstMatch || headParts.length === 1);
          });
          return found;
        });
        if (byName) {
          return byName;
        }
      }
      
      // If head_of_family is specified but we can't match any member, return null
      // The template will use the fallback to show the head_of_family string
      return null;
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

  getDisplayName(member: FamilyMember | null | undefined): string {
    if (!member) {
      return '—';
    }
    // Check API-returned fields in priority order
    const fullNameFields = [
      (member as any).full_name_display,
      (member as any).full_name,
      (member as any).fullName
    ];
    
    for (const full of fullNameFields) {
      if (typeof full === 'string' && full.trim().length > 0) {
        return full.trim();
      }
    }
    
    // Build from parts
    const parts = [member.first_name, (member as any).middle_name, member.last_name]
      .filter((p: string | undefined) => !!p && String(p).trim().length > 0)
      .map((p: string) => p.trim());
    const name = parts.join(' ').replace(/\s+/g, ' ').trim();
    return name || '—';
  }

  /**
   * Get the index of the family head member in the members array
   */
  getFamilyHeadIndex(): number | null {
    if (!this.family || !this.family.members || this.family.members.length === 0) {
      return null;
    }
    
    const head = this.getFamilyHead();
    if (!head || !head.id) {
      return null;
    }
    
    // Find the index of the head member by matching ID
    const index = this.family.members.findIndex(m => m.id === head.id);
    return index >= 0 ? index : null;
  }

  /**
   * Check if a member at the given index is the family head
   */
  isHeadMember(index: number): boolean {
    const headIndex = this.getFamilyHeadIndex();
    return headIndex !== null && headIndex === index;
  }

  /**
   * Open edit modal for the family head member
   */
  openEditHeadMember(): void {
    const headIndex = this.getFamilyHeadIndex();
    if (headIndex !== null) {
      this.openEditMember(headIndex);
    } else {
      // If head is not found in members, show error
      this.toastService.error('Family head member not found in members list. Please add the head as a member first.', 'Error', 5000);
    }
  }

  openEditMember(index: number): void {
    this.memberToEditIndex = index;
    // Store the member data once when opening the modal to prevent re-patching the form
    // This ensures the form only gets the initial data and user changes are preserved
    this.memberToEdit = this.getMemberFormValue(index);
    this.showMemberModal = true;
  }

  getMemberFormValue(index: number): FamilyMemberFormValue | null {
    if (!this.family || !this.family.members || !this.family.members[index]) {
      return null;
    }
    const m = this.family.members[index];
    return {
      id: m.id ? Number(m.id) : null,
      first_name: m.first_name,
      middle_name: m.middle_name,
      last_name: m.last_name,
      date_of_birth: m.date_of_birth,
      gender: m.gender,
      relationship_to_head: m.relationship_to_head,
      marital_status: m.marital_status,
      phone: m.phone,
      email: m.email,
      occupation: m.occupation,
      education: m.education,
      baptism_date: m.baptism_date,
      first_communion_date: m.first_communion_date,
      confirmation_date: m.confirmation_date,
      status: m.status
    };
  }

  onMemberModalSave(value: FamilyMemberFormValue): void {
    if (!this.family || !this.family.members || this.memberToEditIndex === null) {
      this.toastService.error('Family not loaded. Please refresh and try again.', 'Error', 5000);
      return;
    }
    
    const member = this.family.members[this.memberToEditIndex];
    if (!member || !member.id) {
      this.toastService.error('Member ID not found. Please refresh and try again.', 'Error', 5000);
      return;
    }
    
    // Prepare payload - remove id field (handled by URL parameter)
    const payload: any = { ...value };
    delete payload.id;
    
    // Ensure family_id and member_id are properly converted to strings and trimmed
    // Remove any whitespace or extra characters that might have been added
    const familyId = String(this.family.id || '').trim().split('\n')[0].split('\r')[0];
    const memberId = String(member.id || '').trim().split('\n')[0].split('\r')[0];
    
    // Validate that IDs are not empty after trimming
    if (!familyId || !memberId) {
      this.toastService.error('Invalid family or member ID. Please refresh and try again.', 'Error', 5000);
      return;
    }
    
    this.familyService.updateFamilyMember(familyId, memberId, payload).subscribe({
      next: (res) => {
        if (res.success) {
          this.toastService.success('Member updated successfully', 'Success', 4000);
          this.showMemberModal = false;
          this.memberToEditIndex = null;
          this.memberToEdit = null;
          // Reload family to get updated data from server
          if (this.family?.id) {
            this.loadFamily(String(this.family.id));
          }
        } else {
          this.toastService.error(res.message || 'Failed to update member', 'Error', 5000);
        }
      },
      error: (err) => {
        console.error('Error updating family member:', err);
        let errorMessage = 'Failed to update member';
        
        if (err?.error) {
          if (err.error.errors) {
            // Validation errors
            const validationErrors = Object.values(err.error.errors).flat();
            errorMessage = validationErrors.join(', ') || errorMessage;
          } else if (err.error.message) {
            errorMessage = err.error.message;
          }
        }
        
        this.toastService.error(errorMessage, 'Error', 6000);
      }
    });
  }

  onMemberModalCancel(): void {
    this.showMemberModal = false;
    this.memberToEditIndex = null;
    this.memberToEdit = null;
  }

  // ==================== FAMILY PROFILE IMAGE OPERATIONS ====================

  /**
   * Handle profile image file selection
   */
  onProfileImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0 && this.family?.id) {
      const file = input.files[0];
      
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        this.toastService.error('Please select a valid image file (JPEG, PNG, GIF, or WebP)', 'Error', 5000);
        input.value = '';
        return;
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        this.toastService.error('File size must be less than 5MB', 'Error', 5000);
        input.value = '';
        return;
      }

      // Upload the file
      this.uploadProfileImage(file);
      input.value = ''; // Reset input
    }
  }

  /**
   * Upload family profile image
   */
  uploadProfileImage(file: File): void {
    if (!this.family?.id) {
      this.toastService.error('Family not loaded. Please refresh and try again.', 'Error', 5000);
      return;
    }

    this.familyService.uploadProfileImage(this.family.id, file).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.family = res.data;
          this.toastService.success('Profile image uploaded successfully', 'Success', 4000);
        } else {
          this.toastService.error(res.message || 'Failed to upload image', 'Error', 5000);
        }
      },
      error: (err) => {
        console.error('Error uploading profile image:', err);
        let errorMessage = 'Failed to upload image';
        
        if (err?.error) {
          if (err.error.errors) {
            const validationErrors = Object.values(err.error.errors).flat();
            errorMessage = validationErrors.join(', ') || errorMessage;
          } else if (err.error.message) {
            errorMessage = err.error.message;
          }
        }
        
        this.toastService.error(errorMessage, 'Error', 6000);
      }
    });
  }

  /**
   * Delete family profile image
   */
  deleteProfileImage(): void {
    if (!this.family?.id) {
      this.toastService.error('Family not loaded. Please refresh and try again.', 'Error', 5000);
      return;
    }

    if (!confirm('Are you sure you want to delete the family profile image?')) {
      return;
    }

    this.familyService.deleteProfileImage(this.family.id).subscribe({
      next: (res) => {
        if (res.success) {
          // Update family to remove profile image URL
          if (this.family) {
            this.family.profile_image_url = undefined;
            this.family.profile_image_full_url = undefined;
          }
          this.toastService.success('Profile image deleted successfully', 'Success', 4000);
        } else {
          this.toastService.error(res.message || 'Failed to delete image', 'Error', 5000);
        }
      },
      error: (err) => {
        console.error('Error deleting profile image:', err);
        this.toastService.error('Failed to delete image', 'Error', 6000);
      }
    });
  }

  /**
   * Trigger file input click
   */
  triggerProfileImageInput(): void {
    const input = document.getElementById('profileImageInput') as HTMLInputElement;
    if (input) {
      input.click();
    }
  }

  // ==================== FAMILY HEAD PROFILE IMAGE OPERATIONS ====================

  /**
   * Handle head profile image file selection
   */
  onHeadProfileImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0 && this.family?.id) {
      const file = input.files[0];
      
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        this.toastService.error('Please select a valid image file (JPEG, PNG, GIF, or WebP)', 'Error', 5000);
        input.value = '';
        return;
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        this.toastService.error('File size must be less than 5MB', 'Error', 5000);
        input.value = '';
        return;
      }

      // Upload the file
      this.uploadHeadProfileImage(file);
      input.value = ''; // Reset input
    }
  }

  /**
   * Upload family head profile image
   */
  uploadHeadProfileImage(file: File): void {
    if (!this.family?.id) {
      this.toastService.error('Family not loaded. Please refresh and try again.', 'Error', 5000);
      return;
    }

    this.familyService.uploadHeadProfileImage(this.family.id, file).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.family = res.data;
          this.editingHeadImage = false; // Close editing mode
          this.toastService.success('Head profile image uploaded successfully', 'Success', 4000);
        } else {
          this.toastService.error(res.message || 'Failed to upload image', 'Error', 5000);
        }
      },
      error: (err) => {
        console.error('Error uploading head profile image:', err);
        let errorMessage = 'Failed to upload image';
        
        if (err?.error) {
          if (err.error.errors) {
            const validationErrors = Object.values(err.error.errors).flat();
            errorMessage = validationErrors.join(', ') || errorMessage;
          } else if (err.error.message) {
            errorMessage = err.error.message;
          }
        }
        
        this.toastService.error(errorMessage, 'Error', 6000);
      }
    });
  }

  /**
   * Delete family head profile image
   */
  deleteHeadProfileImage(): void {
    if (!this.family?.id) {
      this.toastService.error('Family not loaded. Please refresh and try again.', 'Error', 5000);
      return;
    }

    if (!confirm('Are you sure you want to delete the family head profile image?')) {
      return;
    }

    this.familyService.deleteHeadProfileImage(this.family.id).subscribe({
      next: (res) => {
        if (res.success) {
          // Update family to remove profile image URL
          if (this.family) {
            this.family.head_profile_image_url = undefined;
            this.family.head_profile_image_full_url = undefined;
          }
          this.editingHeadImage = false; // Close editing mode
          this.toastService.success('Head profile image deleted successfully', 'Success', 4000);
        } else {
          this.toastService.error(res.message || 'Failed to delete image', 'Error', 5000);
        }
      },
      error: (err) => {
        console.error('Error deleting head profile image:', err);
        this.toastService.error('Failed to delete image', 'Error', 6000);
      }
    });
  }

  /**
   * Trigger head profile image input click
   */
  triggerHeadProfileImageInput(): void {
    console.log('triggerHeadProfileImageInput called');
    const input = document.getElementById('headProfileImageInput') as HTMLInputElement;
    if (input) {
      console.log('Found headProfileImageInput, clicking...');
      input.click();
    } else {
      console.log('headProfileImageInput not found, trying derived...');
      const derivedInput = document.getElementById('headProfileImageInputDerived') as HTMLInputElement;
      if (derivedInput) {
        console.log('Found headProfileImageInputDerived, clicking...');
        derivedInput.click();
      } else {
        console.error('Neither head profile image input found!');
      }
    }
  }
}
