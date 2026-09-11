import { Component, EventEmitter, Input, OnInit, OnChanges, SimpleChanges, Output, ViewChild, ElementRef, AfterViewChecked, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Role, RoleCreateRequest, RoleUpdateRequest, Permission } from '@core/models';
import { RolesService } from '@core/services/roles.service';
import { PermissionsService } from '@core/services/permissions.service';
import { AuthService } from '@core/services/auth.service';
import { forkJoin, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { getErrorMessage, isFieldInvalid, markFormGroupTouched } from '@core/validators/form-validation.helper';
import { trapFocus, saveActiveElement, restoreActiveElement } from '@shared/utils/focus-trap.util';
import { isHighRiskPermissionName } from '@shared/utils/rbac-permission.util';
import { isProtectedRoleDefinition } from '@shared/utils/rbac-role.util';
import { RolePermissionWorkspaceComponent } from '../role-permission-workspace/role-permission-workspace.component';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';

@Component({
  selector: 'app-role-form-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RolePermissionWorkspaceComponent, ModalShellComponent],
  templateUrl: './role-form-modal.component.html',
  styleUrl: './role-form-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RoleFormModalComponent implements OnInit, OnChanges, AfterViewChecked, OnDestroy {
  @Input() show = false;
  @Input() role: Role | null = null; // For edit mode
  @Input() tenantMode = false;
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
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  // Configuration
  minLevel = 5;
  effectiveMinLevel = 5;
  maxLevel = 10;
  maxNameLength = 255;
  maxDescriptionLength = 500;

  // Permissions
  permissions: Permission[] = [];
  selectedPermissionIds: Set<number> = new Set();
  groupedPermissionsByModule = new Map<string, Permission[]>();
  moduleNames: string[] = [];
  loadingPermissions = false;
  permissionsError: string | null = null;
  permissionCatalogAccessDenied = false;
  showPermissions = true;


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
      
      // Clear any previous errors and keep permissions visible in edit/create.
      this.errorMessage = null;
      this.permissionCatalogAccessDenied = false;
      this.showPermissions = true;
    }
    
    // Handle role changes (when switching between edit modals)
    if (changes['role'] && this.role) {
      this.isEditMode = true;
      this.initializeForm();
      if (this.show) {
        this.loadRolePermissions();
      }
    }

    if (changes['tenantMode'] && this.roleForm) {
      this.applyProtectedRoleLocks();
    }
  }

  private initializeForm(): void {
    // Edit mode must accept historical default role levels (e.g., 2-4).
    this.effectiveMinLevel = this.resolveEffectiveMinLevel();

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
        this.role?.level || this.effectiveMinLevel,
        [
          Validators.required,
          Validators.min(this.effectiveMinLevel),
          Validators.max(this.maxLevel)
        ]
      ]
    });

    this.applyProtectedRoleLocks();
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
      return `Level must be at least ${this.effectiveMinLevel}`;
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
    if (this.isRoleIdentityLocked() && this.role) {
      // Keep identity fields immutable for protected tenant roles.
      this.roleForm.patchValue({
        name: this.role.name,
        level: this.role.level
      }, { emitEvent: false });
    }

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
    const formValue = this.roleForm.getRawValue();
    const request: RoleCreateRequest = {
      name: formValue.name.trim(),
      description: formValue.description?.trim() || undefined,
      level: formValue.level,
      // tenant_id will be auto-set by backend for non-SuperAdmins
      is_custom: true
    };

    this.rolesService.createRole(request, { tenantMode: this.tenantMode }).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        if (response.data && response.data.role) {
          const createdRole = response.data.role;
          
          // Assign permissions only when current user is authorized for permission sync.
          if (this.selectedPermissionIds.size > 0 && this.canAssignRolePermissions()) {
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
        this.errorMessage = this.getFriendlyErrorMessage(err, 'Failed to create role');
        this.cdr.markForCheck();
      }
    });
  }

  private updateRole(): void {
    if (!this.role) return;

    const formValue = this.roleForm.getRawValue();
    const request: RoleUpdateRequest = {
      name: formValue.name.trim(),
      description: formValue.description?.trim() || undefined,
      level: formValue.level
    };

    this.rolesService.updateRole(this.role.id, request, { tenantMode: this.tenantMode }).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        if (response.data && response.data.role) {
          const updatedRole = response.data.role;

          if (this.permissionCatalogAccessDenied) {
            this.isSubmitting = false;
            this.saved.emit(updatedRole);
            this.cdr.markForCheck();
            this.close();
            return;
          }

          // Update permissions only when catalog access and permission-sync authorization are available.
          if (this.canAssignRolePermissions()) {
            this.assignPermissionsToRole(updatedRole);
            return;
          }

          this.isSubmitting = false;
          this.saved.emit(updatedRole);
          this.cdr.markForCheck();
          this.close();
        }
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage = this.getFriendlyErrorMessage(err, 'Failed to update role');
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
    }, { tenantMode: this.tenantMode }).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.saved.emit(role);
        this.cdr.markForCheck();
        this.close();
      },
      error: (err: any) => {
        if (err?.status === 403) {
          // Role creation/update succeeded; current user is not allowed to sync permissions.
          // Treat this as non-blocking to avoid false failure UX.
          this.isSubmitting = false;
          this.saved.emit(role);
          this.cdr.markForCheck();
          this.close();
          return;
        }

        this.isSubmitting = false;
        console.error('Error assigning permissions:', err);
        // Show partial success message - role was created/updated but permissions failed
        this.errorMessage = `Role ${this.isEditMode ? 'updated' : 'created'} successfully, but permission sync failed: ${this.getFriendlyErrorMessage(err, 'Failed to assign permissions')}`;
        // Still emit the saved role even if permissions failed
        this.saved.emit(role);
        this.cdr.markForCheck();
      }
    });
  }

  private getFriendlyErrorMessage(err: any, fallback: string): string {
    const status = err?.status;
    const apiMessage = err?.error?.message;

    if (status === 0) {
      return 'Network connection failed. Please check your internet and try again.';
    }

    if (status === 403) {
      return apiMessage || 'You do not have permission to perform this action.';
    }

    if (status === 422) {
      const validationErrors = err?.error?.errors;
      if (validationErrors) {
        const firstKey = Object.keys(validationErrors)[0];
        const firstMessage = firstKey ? validationErrors[firstKey]?.[0] : null;
        if (firstMessage) {
          return firstMessage;
        }
      }
      return apiMessage || 'Validation failed. Please review your input and try again.';
    }

    if (status >= 500) {
      return 'Server error occurred. Please try again in a moment.';
    }

    return apiMessage || fallback;
  }

  private canAssignRolePermissions(): boolean {
    if (this.tenantMode) {
      return this.authService.canManageRbac();
    }

    return this.authService.hasPermission('permissions.assign')
      || this.authService.isSuperAdmin()
      || this.authService.isEkklesiaAdmin();
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
      level: this.effectiveMinLevel
    });
    this.errorMessage = null;
  }

  get levelMarkers(): number[] {
    const markers = [this.effectiveMinLevel];
    for (let i = 6; i <= 9; i += 1) {
      if (i > this.effectiveMinLevel && i < this.maxLevel) {
        markers.push(i);
      }
    }
    if (!markers.includes(this.maxLevel)) {
      markers.push(this.maxLevel);
    }
    return markers;
  }

  private resolveEffectiveMinLevel(): number {
    if (this.isEditMode && this.role?.level) {
      return Math.min(this.minLevel, this.role.level);
    }
    return this.minLevel;
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

    this.permissionsService.getPermissions({ per_page: 'all', active: 1 }, { tenantMode: this.tenantMode }).subscribe({
      next: (response: any) => {
        const normalizedPermissions = this.extractPermissionsFromResponse(response);
        if (normalizedPermissions) {
          this.permissions = normalizedPermissions;
          this.rebuildPermissionsIndex();
        } else if (response?.success === false) {
          this.permissionsError = response?.message || 'Failed to load permissions';
        } else {
          this.permissionsError = 'Invalid response format';
        }
        this.loadingPermissions = false;
      },
      error: (err: any) => {
        console.error('Error loading permissions:', err);
        if (err?.status === 403) {
          // Allow role create/update flow even when permission catalog cannot be viewed.
          this.permissionCatalogAccessDenied = true;
          this.permissionsError = null;
          this.permissions = [];
          this.groupedPermissionsByModule = new Map<string, Permission[]>();
          this.moduleNames = [];
        } else {
          this.permissionsError = this.getFriendlyErrorMessage(err, 'Failed to load permissions');
        }
        this.loadingPermissions = false;
      }
    });
  }

  loadRolePermissions(): void {
    if (!this.role) return;

    this.permissionsService.getPermissionsForRole(this.role.id, { tenantMode: this.tenantMode }).pipe(
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
        if (err?.status === 403) {
          this.permissionCatalogAccessDenied = true;
          this.permissionsError = null;
        } else {
          this.permissionsError = this.getFriendlyErrorMessage(err, 'Failed to load role permissions');
        }
        this.cdr.markForCheck();
      }
    });
  }

  // Group permissions by module
  get permissionsByModule(): Map<string, Permission[]> {
    return this.groupedPermissionsByModule;
  }

  // Get unique modules sorted
  get modules(): string[] {
    return this.moduleNames;
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

  isAllPermissionsSelected(): boolean {
    return this.permissions.length > 0 && this.permissions.every((permission) => this.selectedPermissionIds.has(permission.id));
  }

  isSomePermissionsSelected(): boolean {
    const selectedCount = this.selectedPermissionIds.size;
    return selectedCount > 0 && selectedCount < this.permissions.length;
  }

  toggleAllPermissions(): void {
    if (this.isAllPermissionsSelected()) {
      this.selectedPermissionIds.clear();
      return;
    }

    this.permissions.forEach((permission) => this.selectedPermissionIds.add(permission.id));
  }

  // Get count of selected permissions
  get selectedPermissionsCount(): number {
    return this.selectedPermissionIds.size;
  }

  get selectedModulesCount(): number {
    return this.moduleNames.filter((module) => {
      const permissions = this.groupedPermissionsByModule.get(module) || [];
      return permissions.some((permission) => this.selectedPermissionIds.has(permission.id));
    }).length;
  }

  get highRiskSelectedCount(): number {
    return this.permissions.filter((permission) => this.selectedPermissionIds.has(permission.id) && this.isHighRiskPermission(permission)).length;
  }

  // Toggle permissions panel
  togglePermissionsPanel(): void {
    this.showPermissions = !this.showPermissions;
  }

  onWorkspaceSelectionChange(next: Set<number>): void {
    this.selectedPermissionIds = next;
    this.cdr.markForCheck();
  }

  trackByModuleName(_index: number, module: string): string {
    return module;
  }

  trackByPermissionId(_index: number, permission: Permission): number {
    return permission.id;
  }

  getPermissionLabel(permission: Permission): string {
    const description = permission.description?.trim();
    if (description) {
      return description;
    }

    const displayName = permission.display_name?.trim();
    if (displayName) {
      return displayName;
    }

    return permission.name;
  }

  getModuleCheckboxId(module: string): string {
    return `role-form-module-${this.toDomId(module)}`;
  }

  getPermissionCheckboxId(module: string, permissionId: number): string {
    return `role-form-permission-${this.toDomId(module)}-${permissionId}`;
  }

  private rebuildPermissionsIndex(): void {
    const grouped = new Map<string, Permission[]>();

    this.permissions.forEach((permission) => {
      const module = this.resolvePermissionModule(permission);
      if (!grouped.has(module)) {
        grouped.set(module, []);
      }
      grouped.get(module)!.push(permission);
    });

    this.groupedPermissionsByModule = grouped;
    this.moduleNames = Array.from(grouped.keys()).sort();
  }

  private extractPermissionsFromResponse(response: any): Permission[] | null {
    if (!response) {
      return null;
    }

    // Flat array payload.
    if (Array.isArray(response)) {
      return response;
    }

    // Common envelope shapes: { data: Permission[] } or { data: { data: Permission[] } }.
    const directData = Array.isArray(response.data) ? response.data : null;
    const nestedData = Array.isArray(response?.data?.data) ? response.data.data : null;
    const candidate = directData ?? nestedData;

    if (!candidate) {
      return null;
    }

    const isGrouped = candidate.every((item: any) => item && Array.isArray(item.permissions));
    if (!isGrouped) {
      return candidate;
    }

    // Grouped payload: [{ module: 'Users', permissions: Permission[] }].
    return candidate.flatMap((group: any) => {
      const moduleName = group?.module ?? 'Other';
      return (group.permissions || []).map((permission: Permission) => ({
        ...permission,
        module: permission.module ?? moduleName
      }));
    });
  }

  private toDomId(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'uncategorized';
  }

  private resolvePermissionModule(permission: Permission): string {
    const permissionName = (permission.name || '').toLowerCase();
    const prefix = permissionName.includes('.') ? permissionName.split('.')[0] : '';
    const prefixModuleMap: Record<string, string> = {
      users: 'Users',
      members: 'Members',
      families: 'Families',
      events: 'Events',
      attendance: 'Attendance',
      donations: 'Finance',
      reports: 'Reports',
      roles: 'Roles',
      permissions: 'Permissions',
      settings: 'Settings',
      church: 'Settings'
    };

    if (prefix && prefixModuleMap[prefix]) {
      return prefixModuleMap[prefix];
    }

    const explicitModule = (permission.module || '').trim();
    if (!explicitModule) {
      return 'Other';
    }

    // Legacy/system module labels.
    if (explicitModule === 'Authentication') {
      return 'Users';
    }
    if (explicitModule === 'RolesAndPermissions') {
      return 'Roles & Permissions';
    }

    return explicitModule;
  }

  private isHighRiskPermission(permission: Permission): boolean {
    return isHighRiskPermissionName(permission.name);
  }

  isProtectedTenantRole(): boolean {
    return this.tenantMode && isProtectedRoleDefinition(this.role);
  }

  isRoleIdentityLocked(): boolean {
    return this.isEditMode && this.isProtectedTenantRole();
  }

  private applyProtectedRoleLocks(): void {
    if (!this.roleForm) {
      return;
    }

    if (this.isRoleIdentityLocked()) {
      this.roleForm.get('name')?.disable({ emitEvent: false });
      this.roleForm.get('level')?.disable({ emitEvent: false });
      return;
    }

    this.roleForm.get('name')?.enable({ emitEvent: false });
    this.roleForm.get('level')?.enable({ emitEvent: false });
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

