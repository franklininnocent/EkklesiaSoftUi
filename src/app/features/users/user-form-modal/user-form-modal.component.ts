import { Component, EventEmitter, Input, OnInit, OnChanges, SimpleChanges, Output, inject, ViewChild, ElementRef, AfterViewChecked, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { User, Role, UserRequest, LinkableClergy } from '@core/models';
import { UsersService } from '@core/services/users.service';
import { RolesService } from '@core/services/roles.service';
import { ToastService } from '@core/services/toast.service';
import { AuthService } from '@core/services/auth.service';
import { PhoneInputComponent, ModalShellComponent, ImageViewerComponent, CfMediaUploadComponent } from '@shared/components';
import { Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, takeUntil, tap, catchError, finalize } from 'rxjs/operators';
import { trapFocus, restoreActiveElement } from '@shared/utils/focus-trap.util';
import { SubscriptionAccessService } from '@core/services/subscription-access.service';
import {
  USER_PROFILE_IMAGE_ACCEPT,
  resolveUserProfileImageUrl,
  validateUserProfileImageFileAsync,
} from '@core/utils/user-profile-image.util';

/**
 * UserFormModalComponent - Create/Edit User with Multi-Role Selection
 *
 * Category-style large sectioned modal (enterprise-modal-style-guide.md §14).
 * Role assignment remains multi-select checkboxes; presentation only.
 */
@Component({
  selector: 'app-user-form-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, PhoneInputComponent, ModalShellComponent, ImageViewerComponent, CfMediaUploadComponent],
  templateUrl: './user-form-modal.component.html',
  styleUrl: './user-form-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserFormModalComponent implements OnInit, OnChanges, AfterViewChecked, OnDestroy {
  @Input() show = false;
  @Input() user: User | null = null; // For edit mode
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<User>();

  @ViewChild('modalContainer', { static: false }) modalContainerRef?: ElementRef<HTMLElement>;
  @ViewChild('profileMediaUpload') profileMediaUpload?: CfMediaUploadComponent;

  private usersService = inject(UsersService);
  private rolesService = inject(RolesService);
  private toastService = inject(ToastService);
  private authService = inject(AuthService);
  private subscriptionAccess = inject(SubscriptionAccessService);
  private cdr = inject(ChangeDetectorRef);

  // Form state
  isSubmitting = false;
  errorMessage: string | null = null;
  isEditMode = false;
  isEditingSelf = false;  // True when editing own account
  editRestrictionReason: string | null = null;  // Reason why editing is restricted
  
  // Focus management
  private previousActiveElement: HTMLElement | null = null;
  private focusTrapCleanup: (() => void) | null = null;
  private modalWasOpen = false;
  
  // Subscription management
  private destroy$ = new Subject<void>();

  // Form data
  formData = {
    name: '',
    email: '',
    password: '',
    password_confirmation: '',
    contact_number: '',
    user_type: 1,
    role_ids: [] as number[],
    active: 1,
    person_id: null as string | null
  };

  // Parish leader linking (optional)
  clergyQuery = '';
  clergyResults: LinkableClergy[] = [];
  clergySearching = false;
  showClergyResults = false;
  selectedClergy: LinkableClergy | null = null;
  private clergySearch$ = new Subject<string>();

  // Validation state
  validationErrors: { [key: string]: string } = {};
  touchedFields: Set<string> = new Set();

  // Roles
  availableRoles: Role[] = [];
  loadingRoles = false;
  rolesError: string | null = null;
  selectedRoleIds: Set<number> = new Set();

  // Configuration
  passwordMinLength = 8;
  passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
  readonly profileImageAccept = USER_PROFILE_IMAGE_ACCEPT;

  // Profile image state
  selectedProfileImage: File | null = null;
  profileImagePreviewUrl: string | null = null;
  existingProfileImageUrl: string | null = null;
  removeProfileImage = false;
  profileImageError: string | null = null;
  photoViewer: { src: string; alt: string; title: string; subtitle: string } | null = null;
  private profileImageObjectUrl: string | null = null;

  ngOnInit(): void {
    this.loadRoles();
    this.setupClergySearch();
  }

  private setupClergySearch(): void {
    this.clergySearch$.pipe(
      debounceTime(250),
      distinctUntilChanged(),
      tap(() => {
        this.clergySearching = true;
        this.cdr.markForCheck();
      }),
      switchMap((query) => {
        const trimmed = query.trim();
        if (trimmed.length < 2) {
          this.clergyResults = [];
          this.clergySearching = false;
          this.showClergyResults = false;
          this.cdr.markForCheck();
          return of({ success: true, data: [] as LinkableClergy[] });
        }

        return this.usersService.getLinkableClergy(trimmed).pipe(
          catchError(() => of({ success: false, data: [] as LinkableClergy[] }))
        );
      }),
      takeUntil(this.destroy$)
    ).subscribe((response) => {
      this.clergyResults = Array.isArray(response.data) ? response.data : [];
      this.clergySearching = false;
      this.showClergyResults = this.clergyQuery.trim().length >= 2;
      this.cdr.markForCheck();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    // When the modal is shown or user changes, reinitialize
    if (changes['show'] && this.show) {
      this.isEditMode = !!this.user;
      
      // Check if editing own account
      if (this.isEditMode && this.user) {
        this.isEditingSelf = this.user.is_self === true;
        this.editRestrictionReason = this.user.edit_restriction_reason || null;
      } else {
        this.isEditingSelf = false;
        this.editRestrictionReason = null;
      }
      
      this.initializeForm();
      
      if (this.availableRoles.length === 0) {
        this.loadRoles();
      }
      
      if (this.isEditMode && this.user) {
        this.loadUserData();
      } else {
        this.resetForm();
      }
      
      this.errorMessage = null;
      this.validationErrors = {};
      this.touchedFields.clear();
      this.resetProfileImageState();
    }
    
    if (changes['user'] && this.user) {
      this.isEditMode = true;
      this.isEditingSelf = this.user.is_self === true;
      this.editRestrictionReason = this.user.edit_restriction_reason || null;
      this.initializeForm();
      if (this.show) {
        this.loadUserData();
      }
    }
  }

  private initializeForm(): void {
    if (this.isEditMode && this.user) {
      this.formData = {
        name: this.user.name || '',
        email: this.user.email || '',
        password: '',
        password_confirmation: '',
        contact_number: this.user.contact_number || '',
        user_type: this.user.user_type || 1,
        role_ids: this.user.roles?.map(r => r.id) || [],
        active: this.user.active,
        person_id: this.user.person_id ?? null
      };

      this.setSelectedClergyFromUser();
      
      // Initialize selected roles
      this.selectedRoleIds.clear();
      if (this.user.roles) {
        this.user.roles.forEach(role => this.selectedRoleIds.add(role.id));
      }
    } else {
      this.resetForm();
    }
  }

  private loadUserData(): void {
    if (!this.user) return;
    
    this.formData = {
      name: this.user.name,
      email: this.user.email,
      password: '',
      password_confirmation: '',
      contact_number: this.user.contact_number || '',
      user_type: this.user.user_type || 1,
      role_ids: this.user.roles?.map(r => r.id) || [],
      active: this.user.active,
      person_id: this.user.person_id ?? null
    };

    this.setSelectedClergyFromUser();
    
    // Populate selected roles
    this.selectedRoleIds.clear();
    if (this.user.roles) {
      this.user.roles.forEach(role => this.selectedRoleIds.add(role.id));
    }

    this.existingProfileImageUrl = resolveUserProfileImageUrl(this.user);
    this.resetProfileImageSelection();
  }

  private loadRoles(): void {
    this.loadingRoles = true;
    this.rolesError = null;
    const currentUser = this.authService.currentUserValue;
    const tenantMode = !!currentUser?.tenant_id && !this.authService.isSuperAdmin() && !this.authService.isEkklesiaAdmin();
    
    this.rolesService.getRoles({ per_page: 'all' }, { tenantMode }).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        const roles = Array.isArray(response) ? response : (response.data || []);
        // Show active roles only; include system roles like Administrator where needed.
        this.availableRoles = roles.filter(role => role.active === 1);
        this.loadingRoles = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error loading roles:', error);
        this.rolesError = 'Failed to load roles. Please try again.';
        this.loadingRoles = false;
        this.cdr.markForCheck();
      }
    });
  }

  onClergyQueryInput(): void {
    if (this.isEditingSelf) {
      return;
    }
    this.clergySearch$.next(this.clergyQuery);
  }

  onClergySearchEnter(event: Event): void {
    event.preventDefault();
    this.onClergyQueryInput();
  }

  selectClergy(clergy: LinkableClergy, event?: Event): void {
    event?.preventDefault();
    this.selectedClergy = clergy;
    this.formData.person_id = clergy.person_id;
    this.clergyQuery = clergy.person_name;
    this.showClergyResults = false;
    this.clergyResults = [];

    if (clergy.person_name) {
      this.formData.name = clergy.person_name;
    }
    if (clergy.email) {
      this.formData.email = clergy.email;
    }
    if (clergy.phone) {
      this.formData.contact_number = clergy.phone;
    }

    this.suggestParishPriestRole();
    this.validateField('name');
    this.validateField('email');
    this.cdr.markForCheck();
  }

  clearSelectedClergy(): void {
    this.selectedClergy = null;
    this.formData.person_id = null;
    this.clergyQuery = '';
    this.clergyResults = [];
    this.showClergyResults = false;
    this.cdr.markForCheck();
  }

  private setSelectedClergyFromUser(): void {
    if (!this.user?.person_id) {
      this.selectedClergy = null;
      this.clergyQuery = '';
      return;
    }

    const person = this.user.person;
    this.selectedClergy = {
      assignment_id: '',
      person_id: this.user.person_id,
      person_name: person?.full_name_display
        || [person?.first_name, person?.last_name].filter(Boolean).join(' ')
        || this.user.name,
      first_name: person?.first_name,
      last_name: person?.last_name,
      email: person?.email ?? this.user.email,
      phone: person?.phone ?? this.user.contact_number ?? null,
      role_id: '',
      role_title: undefined
    };
    this.clergyQuery = this.selectedClergy.person_name;
  }

  private suggestParishPriestRole(): void {
    const parishPriest = this.availableRoles.find((role) => role.name === 'Parish Priest');
    if (parishPriest && !this.selectedRoleIds.has(parishPriest.id)) {
      this.selectedRoleIds.add(parishPriest.id);
      this.formData.role_ids = Array.from(this.selectedRoleIds);
      this.validateField('role_ids');
    }
  }

  // Role selection handlers
  toggleRole(roleId: number): void {
    if (this.isEditingSelf) {
      return;
    }

    if (this.selectedRoleIds.has(roleId)) {
      this.selectedRoleIds.delete(roleId);
    } else {
      this.selectedRoleIds.add(roleId);
    }
    
    this.formData.role_ids = Array.from(this.selectedRoleIds);
    this.validateField('role_ids');
    this.cdr.markForCheck();
  }

  isRoleSelected(roleId: number): boolean {
    return this.selectedRoleIds.has(roleId);
  }

  onActiveToggle(): void {
    if (this.isEditingSelf) {
      return;
    }
    this.formData.active = this.formData.active === 1 ? 0 : 1;
    this.cdr.markForCheck();
  }


  // Form validation
  markFieldAsTouched(fieldName: string): void {
    this.touchedFields.add(fieldName);
    this.validateField(fieldName);
  }

  validateField(fieldName: string): void {
    const value = this.formData[fieldName as keyof typeof this.formData];
    
    switch (fieldName) {
      case 'name':
        if (!value || (typeof value === 'string' && value.trim() === '')) {
          this.validationErrors['name'] = 'Name is required';
        } else if (typeof value === 'string' && value.length < 2) {
          this.validationErrors['name'] = 'Name must be at least 2 characters';
        } else {
          delete this.validationErrors['name'];
        }
        break;
        
      case 'email':
        if (!value || (typeof value === 'string' && value.trim() === '')) {
          this.validationErrors['email'] = 'Email is required';
        } else if (typeof value === 'string' && !this.isValidEmail(value)) {
          this.validationErrors['email'] = 'Invalid email format';
        } else {
          delete this.validationErrors['email'];
        }
        break;
        
      case 'password':
        if (!this.isEditMode) {
          if (!value || (typeof value === 'string' && value.trim() === '')) {
            this.validationErrors['password'] = 'Password is required';
          } else if (typeof value === 'string' && value.length < this.passwordMinLength) {
            this.validationErrors['password'] = `Password must be at least ${this.passwordMinLength} characters`;
          } else if (typeof value === 'string' && !this.passwordPattern.test(value)) {
            this.validationErrors['password'] = 'Password must contain uppercase, lowercase, number, and special character';
          } else {
            delete this.validationErrors['password'];
          }
        } else {
          // In edit mode, password is optional
          if (value && typeof value === 'string' && value.trim() !== '') {
            if (value.length < this.passwordMinLength) {
              this.validationErrors['password'] = `Password must be at least ${this.passwordMinLength} characters`;
            } else if (!this.passwordPattern.test(value)) {
              this.validationErrors['password'] = 'Password must contain uppercase, lowercase, number, and special character';
            } else {
              delete this.validationErrors['password'];
            }
          } else {
            delete this.validationErrors['password'];
          }
        }
        break;
        
      case 'password_confirmation':
        const password = this.formData.password;
        if (password && password.trim() !== '') {
          if (!value || value !== password) {
            this.validationErrors['password_confirmation'] = 'Passwords do not match';
          } else {
            delete this.validationErrors['password_confirmation'];
          }
        } else {
          delete this.validationErrors['password_confirmation'];
        }
        break;
        
      case 'role_ids':
        if (this.selectedRoleIds.size === 0) {
          this.validationErrors['role_ids'] = 'At least one role must be selected';
        } else {
          delete this.validationErrors['role_ids'];
        }
        break;
    }
  }

  private isValidEmail(email: string): boolean {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(email);
  }

  isFormValid(): boolean {
    // Validate all fields
    this.validateField('name');
    this.validateField('email');
    this.validateField('password');
    this.validateField('password_confirmation');
    this.validateField('role_ids');
    
    return Object.keys(this.validationErrors).length === 0;
  }

  hasError(fieldName: string): boolean {
    return this.touchedFields.has(fieldName) && !!this.validationErrors[fieldName];
  }

  getError(fieldName: string): string {
    return this.validationErrors[fieldName] || '';
  }

  get displayProfileImageUrl(): string | null {
    if (this.profileImagePreviewUrl) {
      return this.profileImagePreviewUrl;
    }

    if (this.removeProfileImage) {
      return null;
    }

    return this.existingProfileImageUrl;
  }

  get canEditProfileImage(): boolean {
    return !this.isEditingSelf;
  }

  get isTenantAdminSelf(): boolean {
    return this.isEditingSelf && this.authService.isTenantAdmin();
  }

  get existingProfileImagePreviewUrl(): string | null {
    return this.removeProfileImage ? null : this.existingProfileImageUrl;
  }

  get hasProfileImageChange(): boolean {
    return !!this.selectedProfileImage || this.removeProfileImage;
  }

  onProfileImageValidationError(message: string): void {
    this.profileImageError = message;
    this.cdr.markForCheck();
  }

  onCfProfileImageSelected(file: File): void {
    void this.applyProfileImageFile(file);
  }

  private async applyProfileImageFile(file: File): Promise<void> {
    const error = await validateUserProfileImageFileAsync(file);
    if (error) {
      this.profileImageError = error;
      this.profileMediaUpload?.clearLocalPreview();
      this.cdr.markForCheck();
      return;
    }

    this.revokeProfileImageObjectUrl();
    this.selectedProfileImage = file;
    this.removeProfileImage = false;
    this.profileImageError = null;
    this.profileImageObjectUrl = URL.createObjectURL(file);
    this.profileImagePreviewUrl = this.profileImageObjectUrl;
    this.cdr.markForCheck();
  }

  removeSelectedProfileImage(): void {
    this.profileMediaUpload?.clearLocalPreview();
    this.revokeProfileImageObjectUrl();
    this.selectedProfileImage = null;
    this.profileImagePreviewUrl = null;
    this.removeProfileImage = !!this.existingProfileImageUrl;
    this.profileImageError = null;
    this.cdr.markForCheck();
  }

  openSavedProfilePhotoViewer(): void {
    const url = this.displayProfileImageUrl;
    if (!url || this.selectedProfileImage) {
      return;
    }

    this.photoViewer = {
      src: url,
      alt: this.formData.name || this.user?.name || 'User',
      title: this.formData.name || this.user?.name || 'User',
      subtitle: this.user?.email || this.formData.email || '',
    };
    this.cdr.markForCheck();
  }

  closePhotoViewer(): void {
    this.photoViewer = null;
    this.cdr.markForCheck();
  }

  private resetProfileImageSelection(): void {
    this.profileMediaUpload?.clearLocalPreview();
    this.revokeProfileImageObjectUrl();
    this.selectedProfileImage = null;
    this.profileImagePreviewUrl = null;
    this.removeProfileImage = false;
    this.profileImageError = null;
  }

  private resetProfileImageState(): void {
    this.existingProfileImageUrl = this.user ? resolveUserProfileImageUrl(this.user) : null;
    this.resetProfileImageSelection();
    this.photoViewer = null;
  }

  private revokeProfileImageObjectUrl(): void {
    if (this.profileImageObjectUrl) {
      URL.revokeObjectURL(this.profileImageObjectUrl);
      this.profileImageObjectUrl = null;
    }
  }

  private syncProfileImage(userId: number) {
    if (this.isEditingSelf || !this.hasProfileImageChange) {
      return of(null);
    }

    if (this.removeProfileImage && !this.selectedProfileImage) {
      return this.usersService.deleteProfileImage(userId).pipe(
        catchError((error) => {
          this.toastService.warning(
            error.error?.message || 'User saved, but removing the profile image failed.',
            'Profile image'
          );
          return of(null);
        })
      );
    }

    if (this.selectedProfileImage) {
      return this.usersService.uploadProfileImage(userId, this.selectedProfileImage).pipe(
        catchError((error) => {
          this.toastService.warning(
            error.error?.message || 'User saved, but uploading the profile image failed.',
            'Profile image'
          );
          return of(null);
        })
      );
    }

    return of(null);
  }

  private handleSaveSuccess(savedUser: User, successMessage: string): void {
    this.syncProfileImage(savedUser.id).pipe(
      finalize(() => {
        this.isSubmitting = false;
        this.cdr.markForCheck();
      }),
      takeUntil(this.destroy$)
    ).subscribe((photoResponse) => {
      const user = photoResponse?.data ?? savedUser;
      this.toastService.success(successMessage);
      this.saved.emit(user);
      this.closeModal();
    });
  }

  private handleSaveError(error: unknown, fallbackMessage: string): void {
    console.error(fallbackMessage, error);
    const err = error as { error?: { message?: string } };
    this.errorMessage = err.error?.message || fallbackMessage;
    if (this.errorMessage) {
      this.toastService.error(this.errorMessage);
    }
    this.isSubmitting = false;
    this.cdr.markForCheck();
  }

  // Form submission
  onSubmit(): void {
    if (this.subscriptionAccess.isReadOnly()) {
      this.toastService.warning('Read-only mode: renew subscription to save users.', 'Read-only');
      return;
    }
    // Mark all fields as touched
    Object.keys(this.formData).forEach(key => this.markFieldAsTouched(key));
    
    if (!this.isFormValid()) {
      this.errorMessage = 'Please fix the validation errors before submitting.';
      return;
    }
    
    this.isSubmitting = true;
    this.errorMessage = null;
    
    // Prepare request data
    const requestData: Partial<UserRequest> = {
      name: this.formData.name,
      email: this.formData.email,
      contact_number: this.formData.contact_number || undefined,
      user_type: this.formData.user_type as 1 | 2,
      role_ids: Array.from(this.selectedRoleIds),
      active: this.formData.active as 0 | 1,
      person_id: this.formData.person_id
    };
    
    // Only include password if it's provided
    if (this.formData.password && this.formData.password.trim() !== '') {
      requestData.password = this.formData.password;
      requestData.password_confirmation = this.formData.password_confirmation;
    }
    
    if (this.isEditMode && this.user) {
      this.usersService.updateUser(this.user.id, requestData).pipe(
        takeUntil(this.destroy$)
      ).subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.handleSaveSuccess(response.data, 'User updated successfully');
          } else {
            this.errorMessage = response.message || 'Failed to update user';
            if (this.errorMessage) {
              this.toastService.error(this.errorMessage);
            }
            this.isSubmitting = false;
            this.cdr.markForCheck();
          }
        },
        error: (error) => this.handleSaveError(error, 'An error occurred while updating the user'),
      });
    } else {
      this.usersService.createUser(requestData as UserRequest).pipe(
        takeUntil(this.destroy$)
      ).subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.handleSaveSuccess(response.data, 'User created successfully');
          } else {
            this.errorMessage = response.message || 'Failed to create user';
            if (this.errorMessage) {
              this.toastService.error(this.errorMessage);
            }
            this.isSubmitting = false;
            this.cdr.markForCheck();
          }
        },
        error: (error) => this.handleSaveError(error, 'An error occurred while creating the user'),
      });
    }
  }

  closeModal(): void {
    // Clean up focus trap
    if (this.focusTrapCleanup) {
      this.focusTrapCleanup();
      this.focusTrapCleanup = null;
    }
    
    this.closed.emit();
    
    // Restore previous focus
    if (this.previousActiveElement) {
      setTimeout(() => {
        restoreActiveElement(this.previousActiveElement);
        this.previousActiveElement = null;
      }, 100);
    }
  }
  
  ngAfterViewChecked(): void {
    // Set up focus trap when modal opens
    if (this.show && !this.modalWasOpen && this.modalContainerRef?.nativeElement) {
      this.focusTrapCleanup = trapFocus(this.modalContainerRef.nativeElement);
      this.modalWasOpen = true;
    } else if (!this.show && this.modalWasOpen) {
      if (this.focusTrapCleanup) {
        this.focusTrapCleanup();
        this.focusTrapCleanup = null;
      }
      this.modalWasOpen = false;
    }
  }
  
  ngOnDestroy(): void {
    this.revokeProfileImageObjectUrl();
    // Clean up subscriptions
    this.destroy$.next();
    this.destroy$.complete();
    
    // Clean up focus trap
    if (this.focusTrapCleanup) {
      this.focusTrapCleanup();
    }
    
    // Restore previous focus
    if (this.previousActiveElement) {
      restoreActiveElement(this.previousActiveElement);
    }
  }

  private resetForm(): void {
    this.formData = {
      name: '',
      email: '',
      password: '',
      password_confirmation: '',
      contact_number: '',
      user_type: 1,
      role_ids: [],
      active: 1,
      person_id: null
    };
    this.selectedClergy = null;
    this.clergyQuery = '';
    this.clergyResults = [];
    this.showClergyResults = false;
    this.selectedRoleIds.clear();
    this.validationErrors = {};
    this.touchedFields.clear();
    this.errorMessage = null;
    this.resetProfileImageState();
  }

  // Utility methods
  getRoleCount(): number {
    return this.selectedRoleIds.size;
  }
}

