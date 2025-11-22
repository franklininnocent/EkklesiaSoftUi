import { Component, EventEmitter, Input, OnInit, OnChanges, SimpleChanges, Output, ViewChild, ElementRef, AfterViewChecked, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Role, RoleCreateRequest, RoleUpdateRequest, Permission } from '@core/models';
import { RolesService } from '@core/services/roles.service';
import { PermissionsService } from '@core/services/permissions.service';
import { forkJoin, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { getErrorMessage, isFieldInvalid, markFormGroupTouched } from '@core/validators/form-validation.helper';
import { trapFocus, saveActiveElement, restoreActiveElement } from '@shared/utils/focus-trap.util';

@Component({
  selector: 'app-role-form-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './role-form-modal.component.html',
  styleUrl: './role-form-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RoleFormModalComponent implements OnInit, OnChanges, AfterViewChecked, OnDestroy {
  @Input() show = false;
  @Input() role: Role | null = null; // For edit mode
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<Role>();

  @ViewChild('modalContainer', { static: false }) modalContainerRef?: ElementRef<HTMLElement>;

  roleForm!: FormGroup;
  isSubmitting = false;
  errorMessage: string | null = null;
  isEditMode = false;
  
  // Focus management
  private previousActiveElement: HTMLElement | null = null;
  private focusTrapCleanup: (() => void) | null = null;
  private modalWasOpen = false;
  
  // Subscription management
  private destroy$ = new Subject<void>();
  
  constructor(
    private fb: FormBuilder,
    private rolesService: RolesService,
    private permissionsService: PermissionsService,
    private cdr: ChangeDetectorRef
  ) {}

  // Configuration
  minLevel = 5;
  maxLevel = 10;
  maxNameLength = 255;
  maxDescriptionLength = 500;

  // Permissions
  permissions: Permission[] = [];
  selectedPermissionIds: Set<number> = new Set();
  loadingPermissions = false;
  permissionsError: string | null = null;
  showPermissions = false; // Toggle for permissions section


  ngOnInit(): void {
    this.loadPermissions();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // When the modal is shown or role changes, reinitialize
    if (changes['show'] && this.show) {
      // Save current focus
      this.previousActiveElement = saveActiveElement();
      
      // Set edit mode based on whether role is provided
      this.isEditMode = !!this.role;
      
      // Initialize or reinitialize the form
      this.initializeForm();
      
      // Load permissions if not already loaded
      if (this.permissions.length === 0) {
        this.loadPermissions();
      }
      
      // If editing, load assigned permissions
      if (this.isEditMode && this.role) {
        this.loadRolePermissions();
      } else {
        // If creating new role, clear selected permissions
        this.selectedPermissionIds.clear();
      }
      
      // Clear any previous errors
      this.errorMessage = null;
    }
    
    // Handle role changes (when switching between edit modals)
    if (changes['role'] && this.role) {
      this.isEditMode = true;
      this.initializeForm();
      if (this.show) {
        this.loadRolePermissions();
      }
    }
  }

  private initializeForm(): void {
    this.roleForm = this.fb.group({
      name: [
        this.role?.name || '',
        [
          Validators.required,
          Validators.minLength(3),
          Validators.maxLength(this.maxNameLength),
          Validators.pattern(/^[a-zA-Z0-9\s\-_]+$/) // Alphanumeric, spaces, hyphens, underscores
        ]
      ],
      description: [
        this.role?.description || '',
        [
          Validators.maxLength(this.maxDescriptionLength)
        ]
      ],
      level: [
        this.role?.level || this.minLevel,
        [
          Validators.required,
          Validators.min(this.minLevel),
          Validators.max(this.maxLevel)
        ]
      ]
    });
  }

  // Getter methods for form controls
  get name() {
    return this.roleForm.get('name');
  }

  get description() {
    return this.roleForm.get('description');
  }

  get level() {
    return this.roleForm.get('level');
  }

  // Character count for description
  get descriptionCharCount(): number {
    return this.description?.value?.length || 0;
  }

  get descriptionRemainingChars(): number {
    return this.maxDescriptionLength - this.descriptionCharCount;
  }

  // Validation error messages
  getNameError(): string | null {
    if (this.name?.hasError('required')) {
      return 'Role name is required';
    }
    if (this.name?.hasError('minlength')) {
      return 'Role name must be at least 3 characters';
    }
    if (this.name?.hasError('maxlength')) {
      return `Role name cannot exceed ${this.maxNameLength} characters`;
    }
    if (this.name?.hasError('pattern')) {
      return 'Role name can only contain letters, numbers, spaces, hyphens, and underscores';
    }
    return null;
  }

  getDescriptionError(): string | null {
    if (this.description?.hasError('maxlength')) {
      return `Description cannot exceed ${this.maxDescriptionLength} characters`;
    }
    return null;
  }

  getLevelError(): string | null {
    if (this.level?.hasError('required')) {
      return 'Role level is required';
    }
    if (this.level?.hasError('min')) {
      return `Level must be at least ${this.minLevel}`;
    }
    if (this.level?.hasError('max')) {
      return `Level cannot exceed ${this.maxLevel}`;
    }
    return null;
  }

  // Helper methods using validation helper
  hasError(controlName: string): boolean {
    return isFieldInvalid(controlName, this.roleForm);
  }

  getErrorMessage(controlName: string): string {
    return getErrorMessage(controlName, this.roleForm);
  }

  // Form submission
  onSubmit(): void {
    if (!this.roleForm.valid) {
      markFormGroupTouched(this.roleForm);
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = null;

    if (this.isEditMode && this.role) {
      this.updateRole();
    } else {
      this.createRole();
    }
  }

  private createRole(): void {
    const formValue = this.roleForm.value;
    const request: RoleCreateRequest = {
      name: formValue.name.trim(),
      description: formValue.description?.trim() || undefined,
      level: formValue.level,
      // tenant_id will be auto-set by backend for non-SuperAdmins
      is_custom: true
    };

    this.rolesService.createRole(request).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        if (response.data && response.data.role) {
          const createdRole = response.data.role;
          
          // Assign permissions if any are selected
          if (this.selectedPermissionIds.size > 0) {
            this.assignPermissionsToRole(createdRole);
          } else {
            this.isSubmitting = false;
            this.saved.emit(createdRole);
            this.cdr.markForCheck();
            this.close();
          }
        }
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage = this.extractErrorMessage(err);
        this.cdr.markForCheck();
      }
    });
  }

  private updateRole(): void {
    if (!this.role) return;

    const formValue = this.roleForm.value;
    const request: RoleUpdateRequest = {
      name: formValue.name.trim(),
      description: formValue.description?.trim() || undefined,
      level: formValue.level
    };

    this.rolesService.updateRole(this.role.id, request).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        if (response.data && response.data.role) {
          const updatedRole = response.data.role;
          
          // Always update permissions for existing role
          this.assignPermissionsToRole(updatedRole);
        }
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage = this.extractErrorMessage(err);
        this.cdr.markForCheck();
      }
    });
  }

  // Assign permissions to a role
  private assignPermissionsToRole(role: Role): void {
    const permissionIds = Array.from(this.selectedPermissionIds);
    
    this.permissionsService.bulkAssignToRole({ 
      role_id: role.id, 
      permission_ids: permissionIds 
    }).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.saved.emit(role);
        this.cdr.markForCheck();
        this.close();
      },
      error: (err: any) => {
        this.isSubmitting = false;
        console.error('Error assigning permissions:', err);
        // Show partial success message - role was created/updated but permissions failed
        this.errorMessage = `Role ${this.isEditMode ? 'updated' : 'created'} successfully, but there was an error assigning permissions: ${this.extractErrorMessage(err)}`;
        // Still emit the saved role even if permissions failed
        this.saved.emit(role);
        this.cdr.markForCheck();
      }
    });
  }

  private extractErrorMessage(err: any): string {
    if (err.error?.message) {
      return err.error.message;
    }
    if (err.error?.errors) {
      // Laravel validation errors
      const errors = Object.values(err.error.errors).flat();
      return errors.join(', ');
    }
    return 'An unexpected error occurred. Please try again.';
  }

  // Modal actions
  close(): void {
    if (!this.isSubmitting) {
      // Clean up focus trap
      if (this.focusTrapCleanup) {
        this.focusTrapCleanup();
        this.focusTrapCleanup = null;
      }
      
      this.closed.emit();
      this.resetForm();
      
      // Restore previous focus
      if (this.previousActiveElement) {
        setTimeout(() => {
          restoreActiveElement(this.previousActiveElement);
          this.previousActiveElement = null;
        }, 100);
      }
    }
  }

  private resetForm(): void {
    this.roleForm.reset({
      name: '',
      description: '',
      level: this.minLevel
    });
    this.errorMessage = null;
  }

  // Prevent modal close when clicking inside
  onModalClick(event: MouseEvent): void {
    event.stopPropagation();
  }

  // Level helper text
  getLevelDescription(level: number): string {
    if (level >= 5 && level <= 6) {
      return 'Basic custom role - Limited administrative access';
    } else if (level >= 7 && level <= 8) {
      return 'Intermediate role - Moderate administrative access';
    } else if (level >= 9 && level <= 10) {
      return 'Advanced role - Extended administrative access';
    }
    return 'Custom role level';
  }

  // ============ PERMISSIONS METHODS ============

  loadPermissions(): void {
    this.loadingPermissions = true;
    this.permissionsError = null;

    this.permissionsService.getPermissions({ per_page: 'all', active: 1 }).subscribe({
      next: (response: any) => {
        // Handle both paginated and non-paginated responses
        if (response.success !== undefined) {
          // Non-paginated response with success field
          if (response.success) {
            this.permissions = response.data;
          } else {
            this.permissionsError = response.message || 'Failed to load permissions';
          }
        } else if (response.data && Array.isArray(response.data)) {
          // Paginated response
          this.permissions = response.data;
        } else {
          this.permissionsError = 'Invalid response format';
        }
        this.loadingPermissions = false;
      },
      error: (err: any) => {
        console.error('Error loading permissions:', err);
        this.permissionsError = err.error?.message || 'Failed to load permissions';
        this.loadingPermissions = false;
      }
    });
  }

  loadRolePermissions(): void {
    if (!this.role) return;

    this.permissionsService.getPermissionsForRole(this.role.id).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.selectedPermissionIds = new Set(response.data.map(p => p.id));
          this.cdr.markForCheck();
        }
      },
      error: (err) => {
        console.error('Error loading role permissions:', err);
        this.cdr.markForCheck();
      }
    });
  }

  // Group permissions by module
  get permissionsByModule(): Map<string, Permission[]> {
    const grouped = new Map<string, Permission[]>();
    
    this.permissions.forEach(permission => {
      const module = permission.module || 'Other';
      if (!grouped.has(module)) {
        grouped.set(module, []);
      }
      grouped.get(module)!.push(permission);
    });

    return grouped;
  }

  // Get unique modules sorted
  get modules(): string[] {
    return Array.from(this.permissionsByModule.keys()).sort();
  }

  // Toggle permission selection
  togglePermission(permissionId: number): void {
    if (this.selectedPermissionIds.has(permissionId)) {
      this.selectedPermissionIds.delete(permissionId);
    } else {
      this.selectedPermissionIds.add(permissionId);
    }
  }

  // Check if permission is selected
  isPermissionSelected(permissionId: number): boolean {
    return this.selectedPermissionIds.has(permissionId);
  }

  // Select all permissions in a module
  toggleModulePermissions(module: string): void {
    const modulePermissions = this.permissionsByModule.get(module) || [];
    const allSelected = modulePermissions.every(p => this.selectedPermissionIds.has(p.id));

    if (allSelected) {
      // Deselect all
      modulePermissions.forEach(p => this.selectedPermissionIds.delete(p.id));
    } else {
      // Select all
      modulePermissions.forEach(p => this.selectedPermissionIds.add(p.id));
    }
  }

  // Check if all permissions in a module are selected
  isModuleFullySelected(module: string): boolean {
    const modulePermissions = this.permissionsByModule.get(module) || [];
    return modulePermissions.length > 0 && modulePermissions.every(p => this.selectedPermissionIds.has(p.id));
  }

  // Check if some (but not all) permissions in a module are selected
  isModulePartiallySelected(module: string): boolean {
    const modulePermissions = this.permissionsByModule.get(module) || [];
    const selectedCount = modulePermissions.filter(p => this.selectedPermissionIds.has(p.id)).length;
    return selectedCount > 0 && selectedCount < modulePermissions.length;
  }

  // Get count of selected permissions
  get selectedPermissionsCount(): number {
    return this.selectedPermissionIds.size;
  }

  // Toggle permissions panel
  togglePermissionsPanel(): void {
    this.showPermissions = !this.showPermissions;
  }

  ngAfterViewChecked(): void {
    // Focus management: Trap focus when modal opens
    if (this.show && !this.modalWasOpen && this.modalContainerRef) {
      this.modalWasOpen = true;
      this.previousActiveElement = saveActiveElement();
      this.focusTrapCleanup = trapFocus(this.modalContainerRef.nativeElement);
    } else if (!this.show && this.modalWasOpen) {
      this.modalWasOpen = false;
      if (this.focusTrapCleanup) {
        this.focusTrapCleanup();
        this.focusTrapCleanup = null;
      }
      restoreActiveElement(this.previousActiveElement);
      this.previousActiveElement = null;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    
    // Clean up focus trap if still active
    if (this.focusTrapCleanup) {
      this.focusTrapCleanup();
    }
  }
}

