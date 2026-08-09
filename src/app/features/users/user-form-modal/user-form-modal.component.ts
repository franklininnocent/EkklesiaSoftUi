import { Component, EventEmitter, Input, OnInit, OnChanges, SimpleChanges, Output, inject, ViewChild, ElementRef, AfterViewChecked, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { User, Role, Permission, UserRequest } from '@core/models';
import { UsersService } from '@core/services/users.service';
import { RolesService } from '@core/services/roles.service';
import { ToastService } from '@core/services/toast.service';
import { AuthService } from '@core/services/auth.service';
import { PhoneInputComponent, ButtonComponent, ModalShellComponent } from '@shared/components';
import { FormFieldComponent } from '@shared/components/form-field/form-field.component';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { trapFocus, saveActiveElement, restoreActiveElement } from '@shared/utils/focus-trap.util';

/**
 * UserFormModalComponent - Create/Edit User with Multi-Role Selection
 * 
 * This component provides a modal interface for creating and editing users
 * with support for assigning multiple roles simultaneously.
 * 
 * Features:
 * - Create and Edit modes
 * - Multi-role selection with checkboxes
 * - Form validation
 * - Password complexity requirements
 * - Responsive design
 * 
 * @author Development Team
 * @date 2025-10-25
 */
@Component({
  selector: 'app-user-form-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, PhoneInputComponent, ButtonComponent, ModalShellComponent, FormFieldComponent],
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

  private usersService = inject(UsersService);
  private rolesService = inject(RolesService);
  private toastService = inject(ToastService);
  private authService = inject(AuthService);
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
    active: 1
  };

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

  ngOnInit(): void {
    this.loadRoles();
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
        active: this.user.active
      };
      
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
      active: this.user.active
    };
    
    // Populate selected roles
    this.selectedRoleIds.clear();
    if (this.user.roles) {
      this.user.roles.forEach(role => this.selectedRoleIds.add(role.id));
    }
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

  // Role selection handlers
  toggleRole(roleId: number): void {
    if (this.selectedRoleIds.has(roleId)) {
      this.selectedRoleIds.delete(roleId);
    } else {
      this.selectedRoleIds.add(roleId);
    }
    
    this.formData.role_ids = Array.from(this.selectedRoleIds);
    this.validateField('role_ids');
  }

  isRoleSelected(roleId: number): boolean {
    return this.selectedRoleIds.has(roleId);
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

  // Form submission
  onSubmit(): void {
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
      active: this.formData.active as 0 | 1
    };
    
    // Only include password if it's provided
    if (this.formData.password && this.formData.password.trim() !== '') {
      requestData.password = this.formData.password;
      requestData.password_confirmation = this.formData.password_confirmation;
    }
    
    if (this.isEditMode && this.user) {
      // Update existing user
      this.usersService.updateUser(this.user.id, requestData).pipe(
        takeUntil(this.destroy$)
      ).subscribe({
        next: (response) => {
          if (response.success) {
            this.toastService.success('User updated successfully');
            this.saved.emit(response.data);
            this.closeModal();
          } else {
            this.errorMessage = response.message || 'Failed to update user';
            if (this.errorMessage) {
              this.toastService.error(this.errorMessage);
            }
          }
          this.isSubmitting = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error updating user:', error);
          this.errorMessage = error.error?.message || 'An error occurred while updating the user';
          if (this.errorMessage) {
            this.toastService.error(this.errorMessage);
          }
          this.isSubmitting = false;
          this.cdr.markForCheck();
        }
      });
    } else {
      // Create new user
      this.usersService.createUser(requestData as UserRequest).pipe(
        takeUntil(this.destroy$)
      ).subscribe({
        next: (response) => {
          if (response.success) {
            this.toastService.success('User created successfully');
            this.saved.emit(response.data);
            this.closeModal();
          } else {
            this.errorMessage = response.message || 'Failed to create user';
            if (this.errorMessage) {
              this.toastService.error(this.errorMessage);
            }
          }
          this.isSubmitting = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error creating user:', error);
          this.errorMessage = error.error?.message || 'An error occurred while creating the user';
          if (this.errorMessage) {
            this.toastService.error(this.errorMessage);
          }
          this.isSubmitting = false;
          this.cdr.markForCheck();
        }
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
      active: 1
    };
    this.selectedRoleIds.clear();
    this.validationErrors = {};
    this.touchedFields.clear();
    this.errorMessage = null;
  }

  // Utility methods
  getRoleCount(): number {
    return this.selectedRoleIds.size;
  }
}

