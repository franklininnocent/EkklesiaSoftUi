/**
 * Pope Details Management Component
 *
 * Manages Pope details within the Ecclesiastical Data Management interface.
 * Global Pope record — SuperAdmin only.
 */

import { Component, Input, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { PopeDetailsService } from '@core/services/church';
import { AuthService } from '@core/services';
import { ToastService } from '@core/services/toast.service';
import { PopeDetails, UpdatePopeDetailsRequest } from '@core/models/church';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';

@Component({
  selector: 'app-pope-details-management',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    PageHeaderComponent,
    LoadingSkeletonComponent,
    CfEmptyStateComponent,
  ],
  templateUrl: './pope-details-management.component.html',
  changeDetection: ChangeDetectionStrategy.Default,
  styleUrl: './pope-details-management.component.scss'
})
export class PopeDetailsManagementComponent implements OnInit {
  /** When true (e.g. Roles & Permissions tab), suppress duplicate page header. */
  @Input() embedded = false;

  private fb = inject(FormBuilder);
  private popeDetailsService = inject(PopeDetailsService);
  private authService = inject(AuthService);
  private toastService = inject(ToastService);

  loading = false;
  loaded = false;
  saving = false;
  uploading = false;
  loadError: string | null = null;
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
   * CRITICAL SECURITY: Pope Details is SuperAdmin only
   */
  private checkPermissions(): void {
    const user = this.authService.currentUserValue;

    const isSuperAdmin = this.authService.isSuperAdmin() ||
                        (user?.role_name === 'SuperAdmin') ||
                        (user?.role?.name === 'SuperAdmin') ||
                        (user?.is_super_admin === true) ||
                        (user?.is_admin === true);

    this.canManage = isSuperAdmin;

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

  private initForm(): void {
    this.popeForm = this.fb.group({
      pope_name: ['', [Validators.required, Validators.maxLength(255)]],
      pope_title: ['', [Validators.maxLength(100)]],
      pope_effective_from: ['']
    });
  }

  loadPopeDetails(): void {
    if (!this.canManage) {
      return;
    }

    this.loading = true;
    this.loadError = null;

    this.popeDetailsService.getPopeDetails().subscribe({
      next: (response) => {
        if (response.success) {
          this.popeDetails = response.data;
          this.populateForm(response.data);
        }
        this.loading = false;
        this.loaded = true;
      },
      error: (err) => {
        console.error('Failed to load pope details:', err);
        this.loadError = err?.message || 'Failed to load pope details. Please try again.';
        this.toastService.error('Failed to load pope details');
        this.loading = false;
        this.loaded = true;
      }
    });
  }

  retryLoad(): void {
    this.loaded = false;
    this.loadPopeDetails();
  }

  private populateForm(data: PopeDetails): void {
    this.popeForm.patchValue({
      pope_name: data.pope_name || '',
      pope_title: data.pope_title || '',
      pope_effective_from: data.pope_effective_from || ''
    });

    if (data.pope_image_url) {
      this.imagePreview = data.pope_image_url;
    } else {
      this.imagePreview = null;
    }
  }

  hasCurrentPope(): boolean {
    return !!(this.popeDetails?.pope_name?.trim());
  }

  imageStatusLabel(): string {
    if (this.popeDetails?.pope_image_url || this.imagePreview) {
      return 'Portrait uploaded';
    }
    return 'No portrait';
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];

      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        this.toastService.error('Invalid file type. Please upload a JPG, PNG, or WebP image.');
        input.value = '';
        return;
      }

      const maxSize = 3 * 1024 * 1024;
      if (file.size > maxSize) {
        this.toastService.error('File size exceeds 3MB limit. Please choose a smaller image.');
        input.value = '';
        return;
      }

      this.selectedFile = file;

      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        this.imagePreview = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  removeImage(): void {
    this.selectedFile = null;
    if (!this.popeDetails?.pope_image_url) {
      this.imagePreview = null;
    } else if (this.popeDetails.pope_image_url) {
      this.imagePreview = this.popeDetails.pope_image_url;
    }
  }

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
          if (response.data.pope_image_url) {
            this.imagePreview = response.data.pope_image_url;
          }
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

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

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

  hasFieldError(fieldName: string): boolean {
    const control = this.popeForm.get(fieldName);
    return !!(control?.errors && control.touched);
  }

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

  popeDisplayName(): string {
    return this.popeDetails?.pope_name?.trim() || 'Not set';
  }

  popePhotoAlt(): string {
    const name = this.popeDetails?.pope_name?.trim();
    return name ? `Portrait of ${name}` : 'Pope portrait';
  }
}
