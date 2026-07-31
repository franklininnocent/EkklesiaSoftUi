/**
 * Pope Details Management Component
 * 
 * Manages Pope details within the Ecclesiastical Data Management interface.
 * Tenant-specific: Each tenant manages their own pope details.
 * Requires Ekklesia Roles permissions.
 */

import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { PopeDetailsService } from '@core/services/church';
import { AuthService } from '@core/services';
import { ToastService } from '@core/services/toast.service';
import { PopeDetails, UpdatePopeDetailsRequest } from '@core/models/church';

@Component({
  selector: 'app-pope-details-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './pope-details-management.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './pope-details-management.component.scss'
})
export class PopeDetailsManagementComponent implements OnInit {
  private fb = inject(FormBuilder);
  private popeDetailsService = inject(PopeDetailsService);
  private authService = inject(AuthService);
  private toastService = inject(ToastService);

  loading = false;
  saving = false;
  uploading = false;
  popeForm!: FormGroup;
  popeDetails: PopeDetails | null = null;
  imagePreview: string | null = null;
  selectedFile: File | null = null;

  canManage = false;

  ngOnInit(): void {
    this.checkPermissions();
    this.initForm();
    this.loadPopeDetails();
  }

  /**
   * Check if user has permission to manage pope details
   * CRITICAL SECURITY: Pope Details is SuperAdmin only (changed from Ekklesia roles)
   */
  private checkPermissions(): void {
    const user = this.authService.currentUserValue;
    
    // CRITICAL SECURITY: Only SuperAdmin can manage Pope Details
    // Check for SuperAdmin explicitly
    const isSuperAdmin = this.authService.isSuperAdmin() ||
                        (user?.role_name === 'SuperAdmin') ||
                        (user?.role?.name === 'SuperAdmin') ||
                        (user?.is_super_admin === true) ||
                        (user?.is_admin === true);
    
    // User can manage pope details ONLY if they are SuperAdmin
    // Even if they have the permission, we enforce SuperAdmin check for security
    this.canManage = isSuperAdmin;
    
    // If user is not SuperAdmin, log a warning for audit
    if (!this.canManage && user) {
      console.warn('Non-SuperAdmin user attempted to access Pope Details (SuperAdmin only)', {
        user_id: user.id,
        user_email: user.email,
        role_name: user.role_name || user.role?.name,
      });
    }
    
    if (!this.canManage) {
      this.toastService.error('You do not have permission to manage pope details.');
    }
  }

  /**
   * Initialize form
   */
  private initForm(): void {
    this.popeForm = this.fb.group({
      pope_name: ['', [Validators.required, Validators.maxLength(255)]],
      pope_title: ['', [Validators.maxLength(100)]],
      pope_effective_from: ['']
    });
  }

  /**
   * Load current pope details (public method for refresh button)
   */
  loadPopeDetails(): void {
    if (!this.canManage) {
      return;
    }

    this.loading = true;
    this.popeDetailsService.getPopeDetails().subscribe({
      next: (response) => {
        if (response.success) {
          this.popeDetails = response.data;
          this.populateForm(response.data);
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load pope details:', err);
        this.toastService.error('Failed to load pope details');
        this.loading = false;
      }
    });
  }

  /**
   * Populate form with existing data
   */
  private populateForm(data: PopeDetails): void {
    this.popeForm.patchValue({
      pope_name: data.pope_name || '',
      pope_title: data.pope_title || '',
      pope_effective_from: data.pope_effective_from || ''
    });

    // Set image preview if available
    if (data.pope_image_url) {
      this.imagePreview = data.pope_image_url;
    }
  }

  /**
   * Handle image file selection
   */
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        this.toastService.error('Invalid file type. Please upload a JPG, PNG, or WebP image.');
        input.value = '';
        return;
      }

      // Validate file size (3MB max)
      const maxSize = 3 * 1024 * 1024; // 3MB in bytes
      if (file.size > maxSize) {
        this.toastService.error('File size exceeds 3MB limit. Please choose a smaller image.');
        input.value = '';
        return;
      }

      this.selectedFile = file;

      // Create preview
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.imagePreview = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  /**
   * Remove selected image
   */
  removeImage(): void {
    this.selectedFile = null;
    // If there's an existing image, keep the preview
    // Otherwise, clear it
    if (!this.popeDetails?.pope_image_url) {
      this.imagePreview = null;
    }
  }

  /**
   * Upload pope image
   */
  uploadImage(): void {
    if (!this.selectedFile || !this.canManage) {
      return;
    }

    this.uploading = true;
    this.popeDetailsService.uploadPopeImage(this.selectedFile).subscribe({
      next: (response) => {
        if (response.success) {
          this.toastService.success('Pope image uploaded successfully');
          this.selectedFile = null;
          // Update image preview with new URL
          if (response.data.pope_image_url) {
            this.imagePreview = response.data.pope_image_url;
          }
          // Reload pope details to get updated data
          this.loadPopeDetails();
        }
        this.uploading = false;
      },
      error: (err) => {
        console.error('Failed to upload pope image:', err);
        const errorMessage = err.error?.message || 'Failed to upload pope image';
        this.toastService.error(errorMessage);
        this.uploading = false;
      }
    });
  }

  /**
   * Delete pope image
   */
  deleteImage(): void {
    if (!this.canManage || !confirm('Are you sure you want to delete the pope image?')) {
      return;
    }

    this.uploading = true;
    this.popeDetailsService.deletePopeImage().subscribe({
      next: (response) => {
        if (response.success) {
          this.toastService.success('Pope image deleted successfully');
          this.imagePreview = null;
          this.selectedFile = null;
          // Reload pope details
          this.loadPopeDetails();
        }
        this.uploading = false;
      },
      error: (err) => {
        console.error('Failed to delete pope image:', err);
        const errorMessage = err.error?.message || 'Failed to delete pope image';
        this.toastService.error(errorMessage);
        this.uploading = false;
      }
    });
  }

  /**
   * Save pope details
   */
  savePopeDetails(): void {
    if (!this.canManage || this.popeForm.invalid) {
      this.markFormGroupTouched(this.popeForm);
      return;
    }

    this.saving = true;
    const formValue = this.popeForm.value;
    
    const updateData: UpdatePopeDetailsRequest = {
      pope_name: formValue.pope_name,
      pope_title: formValue.pope_title || undefined,
      pope_effective_from: formValue.pope_effective_from || undefined
    };

    this.popeDetailsService.updatePopeDetails(updateData).subscribe({
      next: (response) => {
        if (response.success) {
          this.toastService.success('Pope details saved successfully');
          this.popeDetails = response.data;
        }
        this.saving = false;
      },
      error: (err) => {
        console.error('Failed to save pope details:', err);
        const errorMessage = err.error?.message || 'Failed to save pope details';
        this.toastService.error(errorMessage);
        this.saving = false;
      }
    });
  }

  /**
   * Mark all form controls as touched
   */
  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  /**
   * Get form control error message
   */
  getFieldError(fieldName: string): string {
    const control = this.popeForm.get(fieldName);
    if (control?.errors && control.touched) {
      if (control.errors['required']) {
        return `${fieldName.replace('_', ' ')} is required`;
      }
      if (control.errors['maxlength']) {
        return `${fieldName.replace('_', ' ')} must not exceed ${control.errors['maxlength'].requiredLength} characters`;
      }
    }
    return '';
  }

  /**
   * Check if field has error
   */
  hasFieldError(fieldName: string): boolean {
    const control = this.popeForm.get(fieldName);
    return !!(control?.errors && control.touched);
  }

  /**
   * Format date for display
   */
  formatDate(dateString: string | null | undefined): string {
    if (!dateString) {
      return '';
    }
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return dateString;
    }
  }
}

