import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Role, Permission } from '@core/models';
import { RolesService } from '@core/services/roles.service';
import { PermissionsService } from '@core/services/permissions.service';
import { UsersService } from '@core/services/users.service';
import { ToastService } from '@core/services/toast.service';
import { AuthService } from '@core/services/auth.service';
import { User } from '@core/models/user.model';
import { CardComponent, PaginationComponent } from '@shared/components';
import { SortableDirective, SortEvent } from '@shared/directives/sortable.directive';
import { isProtectedRoleDefinition } from '@shared/utils/rbac-role.util';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { RoleFormModalComponent } from './role-form-modal/role-form-modal.component';
import { AssignPermissionsModalComponent } from './assign-permissions-modal/assign-permissions-modal.component';
import { ConfirmationModalComponent } from '@shared/components/confirmation-modal/confirmation-modal.component';
import { PopeDetailsManagementComponent } from '../ecclesiastical/pope-details/pope-details-management.component';
import { ListToolbarComponent } from '@shared/components/list-toolbar/list-toolbar.component';
import { AdvancedSearchPanelComponent, SearchField, ActiveFilter } from '@shared/components/advanced-search-panel/advanced-search-panel.component';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { UserAvatarComponent, ImageViewerComponent } from '@shared/components';
import { resolveUserProfileImageUrl } from '@core/utils/user-profile-image.util';
import { take, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';

interface AssignRoleTenantGroup {
  tenantKey: string;
  tenantLabel: string;
  roles: Role[];
}

@Component({
  selector: 'app-roles-permissions',
  standalone: true,
  imports: [CommonModule, FormsModule, CardComponent, PaginationComponent, SortableDirective, RoleFormModalComponent, AssignPermissionsModalComponent, PopeDetailsManagementComponent, PageHeaderComponent, ConfirmationModalComponent, ListToolbarComponent, AdvancedSearchPanelComponent, CfEmptyStateComponent, UserAvatarComponent, ImageViewerComponent],
  templateUrl: './roles-permissions.component.html',
  styleUrl: './roles-permissions.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RolesPermissionsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  activeTab: 'roles' | 'permissions' | 'assign' | 'users' | 'pope' = 'roles';
  hasEkklesiaRole = false; // For backward compatibility
  hasSuperAdminAccess = false; // For Pope tab - SuperAdmin only
  isTenantMode = false;
  
  // Roles filter state
  rolesSearchTerm = '';
  rolesStatusFilter: 'all' | 'active' | 'inactive' = 'all';
  rolesTypeFilter: 'all' | 'system' | 'custom' | 'protected' | 'default' = 'all';
  showRolesAdvancedSearch = false;
  rolesSearchFields: SearchField[] = [
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      group: 'Role filters',
      options: [
        { value: '', label: 'All Statuses' },
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' }
      ]
    },
    {
      key: 'type',
      label: 'Type',
      type: 'select',
      group: 'Role filters',
      options: [
        { value: '', label: 'All Types' },
        { value: 'system', label: 'System' },
        { value: 'custom', label: 'Custom' },
        { value: 'protected', label: 'Protected' },
        { value: 'default', label: 'Default' }
      ]
    }
  ];

  // Permissions filter state
  permissionsSearchTerm = '';
  permissionsStatusFilter: 'all' | 'active' | 'inactive' = 'all';
  permissionsTypeFilter: 'all' | 'system' | 'custom' = 'all';
  permissionsModuleFilter = '';
  showPermissionsAdvancedSearch = false;
  permissionsSearchFields: SearchField[] = [
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      group: 'Permission filters',
      options: [
        { value: '', label: 'All Statuses' },
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' }
      ]
    },
    {
      key: 'type',
      label: 'Type',
      type: 'select',
      group: 'Permission filters',
      options: [
        { value: '', label: 'All Types' },
        { value: 'system', label: 'System' },
        { value: 'custom', label: 'Custom' }
      ]
    },
    {
      key: 'module',
      label: 'Module',
      type: 'select',
      group: 'Permission filters',
      options: [{ value: '', label: 'All Modules' }]
    }
  ];

  // Roles data
  roles: Role[] = [];
  allRoles: Role[] = []; // Store all roles for client-side pagination
  loadingRoles = false;
  rolesError: string | null = null;
  totalRoles = 0;
  
  // Permissions data
  permissions: Permission[] = [];
  allPermissions: Permission[] = []; // Store all permissions for client-side pagination
  loadingPermissions = false;
  permissionsError: string | null = null;
  totalPermissions = 0;
  
  // Grouped permissions by module
  groupedPermissions: { [module: string]: Permission[] } = {};
  moduleCollapsedState: { [module: string]: boolean } = {};
  
  // Pagination state
  rolesPage = 1;
  rolesPageSize = 20;
  rolesPageSizeOptions = [10, 20, 50, 100];
  
  permissionsPage = 1;
  permissionsPageSize = 20;
  permissionsPageSizeOptions = [10, 20, 50, 100];
  
  // Sorting state
  rolesSortColumn = '';
  rolesSortDirection: 'asc' | 'desc' | null = null;
  
  permissionsSortColumn = '';
  permissionsSortDirection: 'asc' | 'desc' | null = null;
  
  // Modals
  showCreateRoleModal = false;
  showEditRoleModal = false;
  showCreatePermissionModal = false;
  showEditPermissionModal = false;
  showAssignPermissionsModal = false;
  showRoleDeleteConfirmModal = false;
  showRoleStatusConfirmModal = false;
  
  selectedRole: Role | null = null;
  selectedPermission: Permission | null = null;
  selectedRoleForAssignment: Role | null = null; // For Assign Permissions tab
  assignRoleSearchTerm = '';
  assignRoleStatusFilter: 'all' | 'active' | 'inactive' = 'all';
  assignRoleTypeFilter: 'all' | 'system' | 'custom' | 'protected' | 'default' = 'all';
  showAssignRoleAdvancedSearch = false;
  assignRoleSearchFields: SearchField[] = [
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      group: 'Role filters',
      options: [
        { value: '', label: 'All Statuses' },
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' }
      ]
    },
    {
      key: 'type',
      label: 'Type',
      type: 'select',
      group: 'Role filters',
      options: [
        { value: '', label: 'All Types' },
        { value: 'system', label: 'System' },
        { value: 'custom', label: 'Custom' },
        { value: 'protected', label: 'Protected' },
        { value: 'default', label: 'Default' }
      ]
    }
  ];
  pendingRoleAction: Role | null = null;
  pendingRoleStatusTarget: 0 | 1 | null = null;

  // User role assignments
  tenantUsers: User[] = [];
  loadingTenantUsers = false;
  tenantUsersError: string | null = null;
  selectedUserForRoles: User | null = null;
  selectedRoleIdsForUser: number[] = [];
  savingUserRoles = false;

  constructor(
    private rolesService: RolesService,
    private permissionsService: PermissionsService,
    private usersService: UsersService,
    private toastService: ToastService,
    public authService: AuthService,  // Made public for template access
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.checkEkklesiaRole();
    this.loadRoles();
    this.loadPermissions();
    this.loadTenantUsers();
  }

  /**
   * Check if user has Ekklesia role to show Pope tab
   * CRITICAL SECURITY: Pope tab is now SuperAdmin only (changed from Ekklesia roles)
   */
  private checkEkklesiaRole(): void {
    // Check immediately first
    this.updateEkklesiaRole(this.authService.currentUserValue);
    this.updateSuperAdminAccess(this.authService.currentUserValue);
    this.updateTenantMode(this.authService.currentUserValue);
    
    // Also subscribe to user changes
    this.authService.currentUser$.pipe(take(1), takeUntil(this.destroy$)).subscribe(user => {
      this.updateEkklesiaRole(user);
      this.updateSuperAdminAccess(user);
      this.updateTenantMode(user);
      this.loadTenantUsers();
      this.cdr.detectChanges();
    });
  }

  private updateEkklesiaRole(user: any): void {
    if (!user) {
      this.hasEkklesiaRole = false;
      return;
    }

    // Check if user has Ekklesia role flag (primary check)
    if (user.has_ekklesia_role === true) {
      this.hasEkklesiaRole = true;
      return;
    }

    // Fallback: Check for Ekklesia roles by name
    const ekklesiaRoles = ['SuperAdmin', 'EkklesiaAdmin', 'EkklesiaManager', 'EkklesiaUser'];
    this.hasEkklesiaRole = 
      ekklesiaRoles.includes(user.role_name || '') ||
      ekklesiaRoles.includes(user.role?.name || '') ||
      this.authService.isEkklesiaAdmin() ||
      this.authService.isSuperAdmin();
  }

  /**
   * Check if user has SuperAdmin access for Pope tab
   * CRITICAL SECURITY: Pope section is SuperAdmin only
   */
  private updateSuperAdminAccess(user: any): void {
    if (!user) {
      this.hasSuperAdminAccess = false;
      return;
    }

    // Only SuperAdmin can access Pope section
    this.hasSuperAdminAccess = this.authService.isSuperAdmin();
  }

  private updateTenantMode(user: any): void {
    if (!user) {
      this.isTenantMode = false;
      this.selectedUserForRoles = null;
      this.tenantUsers = [];
      return;
    }

    this.isTenantMode = !!user.tenant_id && !this.authService.isSuperAdmin() && !this.authService.isEkklesiaAdmin();
    if (!this.isTenantMode) {
      this.selectedUserForRoles = null;
      this.tenantUsers = [];
    }
  }

  // Tab Management
  selectTab(tab: 'roles' | 'permissions' | 'assign' | 'users' | 'pope'): void {
    this.activeTab = tab;
  }

  isActiveTab(tab: 'roles' | 'permissions' | 'assign' | 'users' | 'pope'): boolean {
    return this.activeTab === tab;
  }

  // Roles Management
  loadRoles(): void {
    this.loadingRoles = true;
    this.rolesError = null;

    const params: any = { per_page: 'all' };

    this.rolesService.getRoles(params, { tenantMode: this.isTenantMode })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
      next: (response) => {
        this.allRoles = Array.isArray(response) ? response : response.data;
        this.applyFiltersAndPagination('roles');
        this.syncSelectedRoleForAssignment();
        this.loadingRoles = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error loading roles:', err);
        this.rolesError = this.getFriendlyErrorMessage(err, 'Failed to load roles');
        this.loadingRoles = false;
        this.cdr.markForCheck();
      }
    });
  }

  // Roles Pagination
  onRolesPageChange(page: number): void {
    this.rolesPage = page;
    this.applyFiltersAndPagination('roles');
  }

  onRolesPageSizeChange(pageSize: number): void {
    this.rolesPageSize = pageSize;
    this.rolesPage = 1; // Reset to first page
    this.applyFiltersAndPagination('roles');
  }

  // Roles Sorting
  onRolesSort(event: SortEvent): void {
    this.rolesSortColumn = event.column;
    this.rolesSortDirection = event.direction;
    this.applyFiltersAndPagination('roles');
  }

  openCreateRoleModal(): void {
    this.selectedRole = null;
    this.showCreateRoleModal = true;
    this.cdr.detectChanges();
  }

  closeCreateRoleModal(): void {
    this.showCreateRoleModal = false;
    this.selectedRole = null;
  }

  onRoleSaved(role: Role): void {
    if (this.showCreateRoleModal) {
      console.log(`✅ Role "${role.name}" created successfully!`);
      this.toastService.success(`Role "${role.name}" created successfully!`, 'Success');
    } else if (this.showEditRoleModal) {
      console.log(`✅ Role "${role.name}" updated successfully!`);
      this.toastService.success(`Role "${role.name}" updated successfully!`, 'Success');
    }
    this.loadRoles();
  }

  openEditRoleModal(role: Role): void {
    this.selectedRole = role;
    this.showEditRoleModal = true;
  }

  closeEditRoleModal(): void {
    this.showEditRoleModal = false;
    this.selectedRole = null;
  }

  deleteRole(role: Role): void {
    this.pendingRoleAction = role;
    this.showRoleDeleteConfirmModal = true;
  }

  cancelDeleteRole(): void {
    this.showRoleDeleteConfirmModal = false;
    this.pendingRoleAction = null;
  }

  confirmDeleteRole(): void {
    const role = this.pendingRoleAction;
    if (!role) {
      return;
    }

    if ((role.users_count || 0) > 0) {
      this.toastService.warning(
        'This role has assigned users. Reassign users first before deleting.',
        'Delete Blocked'
      );
      this.cancelDeleteRole();
      return;
    }

    this.rolesService.deleteRole(role.id, { tenantMode: this.isTenantMode })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
      next: () => {
        console.log(`✅ Role "${role.name}" deleted successfully`);
        this.toastService.success(`Role "${role.name}" deleted successfully!`, 'Role Deleted');
        this.cancelDeleteRole();
        this.loadRoles();
        this.authService.refreshUser();
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error deleting role:', err);
        this.toastService.error(this.getFriendlyErrorMessage(err, 'Failed to delete role'), 'Error');
        this.cancelDeleteRole();
      }
    });
  }

  /**
   * Check if the current user can manage roles and permissions
   * - SuperAdmin, EkklesiaAdmin, EkklesiaManager can manage all roles
   * - Tenant Administrators can manage roles within their tenant
   */
  canManageRoles(): boolean {
    const user = this.authService.currentUserValue;
    if (!user) {
      return false;
    }
    return this.authService.canManageRbac(user);
  }

  /**
   * Check if the current user can create roles
   */
  canCreateRole(): boolean {
    if (this.isTenantMode) {
      return this.authService.isTenantAdmin() || this.authService.hasPermission('roles.create');
    }
    return this.canManageRoles() || this.authService.hasPermission('roles.create');
  }

  /**
   * Check if the current user can update roles
   */
  canUpdateRole(): boolean {
    if (this.isTenantMode) {
      return this.authService.isTenantAdmin() || this.authService.hasPermission('roles.update');
    }
    return this.canManageRoles() || this.authService.hasPermission('roles.update');
  }

  /**
   * Check if the current user can delete roles
   */
  canDeleteRole(): boolean {
    if (this.isTenantMode) {
      return this.authService.isTenantAdmin() || this.authService.hasPermission('roles.delete');
    }
    return this.canManageRoles() || this.authService.hasPermission('roles.delete');
  }

  /**
   * Check if the current user can assign permissions
   */
  canAssignPermissions(): boolean {
    if (this.isTenantMode) {
      return this.authService.isTenantAdmin() || this.authService.hasPermission('permissions.assign');
    }
    return this.canManageRoles() || this.authService.hasPermission('permissions.assign');
  }

  /**
   * Check if the current user can create permissions
   */
  canCreatePermission(): boolean {
    if (this.isTenantMode) {
      return false;
    }
    return this.canManageRoles() || this.authService.hasPermission('permissions.create');
  }

  /**
   * Check if the current user can update permissions
   */
  canUpdatePermission(): boolean {
    if (this.isTenantMode) {
      return false;
    }
    return this.canManageRoles() || this.authService.hasPermission('permissions.update');
  }

  /**
   * Check if the current user can delete permissions
   */
  canDeletePermission(): boolean {
    if (this.isTenantMode) {
      return false;
    }
    return this.canManageRoles() || this.authService.hasPermission('permissions.delete');
  }

  /**
   * Check if a role can have its status toggled
   * System roles (like Administrator) cannot be toggled
   */
  canToggleRoleStatus(role: Role): boolean {
    if (!this.canUpdateRole()) {
      return false;
    }

    if (this.isProtectedRole(role)) {
      return false;
    }

    if (this.isTenantMode) {
      return true;
    }

    // Platform/system mode keeps legacy behavior.
    return role.is_custom;
  }

  isProtectedTenantRole(role: Role): boolean {
    if (!this.isTenantMode) {
      return false;
    }

    return this.getRoleClassification(role) === 'protected';
  }

  canEditRoleRow(role: Role): boolean {
    if (!this.canUpdateRole() || this.isProtectedRole(role)) {
      return false;
    }

    if (this.isTenantMode) {
      return true;
    }

    return role.is_custom;
  }

  canDeleteRoleRow(role: Role): boolean {
    if (!this.canDeleteRole() || this.isProtectedRole(role)) {
      return false;
    }

    if (this.isTenantMode) {
      if ((role.users_count || 0) > 0) {
        return false;
      }
      return true;
    }

    return role.is_custom;
  }

  toggleRoleStatus(role: Role): void {
    // Double-check that the role can be toggled (safety check)
    if (!this.canToggleRoleStatus(role)) {
      this.toastService.warning(
        'System roles cannot be toggled. This role is protected and must remain active.',
        'Cannot Toggle Role'
      );
      return;
    }

    this.pendingRoleAction = role;
    this.pendingRoleStatusTarget = role.active === 1 ? 0 : 1;
    this.showRoleStatusConfirmModal = true;
  }

  cancelToggleRoleStatus(): void {
    this.showRoleStatusConfirmModal = false;
    this.pendingRoleAction = null;
    this.pendingRoleStatusTarget = null;
  }

  confirmToggleRoleStatus(): void {
    const role = this.pendingRoleAction;
    const newStatus = this.pendingRoleStatusTarget;
    if (!role || newStatus === null) {
      return;
    }

    const statusText = newStatus === 1 ? 'activated' : 'deactivated';

    this.rolesService.toggleRoleStatus(role.id, newStatus === 1, { tenantMode: this.isTenantMode })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
      next: () => {
        role.active = newStatus;
        console.log(`✅ Role "${role.name}" ${statusText} successfully`);
        this.cancelToggleRoleStatus();
        this.cdr.markForCheck();
        this.toastService.success(
          `Role "${role.name}" ${statusText} successfully!`,
          'Status Updated'
        );
      },
      error: (err) => {
        console.error('Error toggling role status:', err);
        this.toastService.error(
          this.getFriendlyErrorMessage(err, 'Failed to update role status'),
          'Error'
        );
      }
    });
  }

  getRoleDeleteImpactMessage(role: Role | null): string {
    if (!role) {
      return '';
    }

    const userCount = role.users_count || 0;
    const permissionCount = role.permissions_count || 0;

    if (userCount > 0) {
      return `Deleting this role is blocked because ${userCount} user${userCount > 1 ? 's are' : ' is'} still assigned.`;
    }

    return `Deleting this role will remove ${permissionCount} permission mapping${permissionCount === 1 ? '' : 's'} from this role definition.`;
  }

  // Permissions Management
  loadPermissions(): void {
    this.loadingPermissions = true;
    this.permissionsError = null;

    const params: any = { per_page: 'all' };

    this.permissionsService.getPermissions(params, { tenantMode: this.isTenantMode }).subscribe({
      next: (response) => {
        this.allPermissions = Array.isArray(response) ? response : response.data;
        this.updatePermissionsModuleOptions();
        this.applyFiltersAndPagination('permissions');
        this.groupPermissionsByModule();
        this.loadingPermissions = false;
      },
      error: (err) => {
        console.error('Error loading permissions:', err);
        this.permissionsError = this.getFriendlyErrorMessage(err, 'Failed to load permissions');
        this.loadingPermissions = false;
      }
    });
  }

  /**
   * Group permissions by their module
   */
  groupPermissionsByModule(): void {
    this.groupedPermissions = {};
    
    this.permissions.forEach(permission => {
      const module = permission.module || 'Uncategorized';
      
      if (!this.groupedPermissions[module]) {
        this.groupedPermissions[module] = [];
        // Initialize all modules as collapsed by default
        if (this.moduleCollapsedState[module] === undefined) {
          this.moduleCollapsedState[module] = true;
        }
      }
      
      this.groupedPermissions[module].push(permission);
    });
    
    // Sort permissions within each module by name
    Object.keys(this.groupedPermissions).forEach(module => {
      this.groupedPermissions[module].sort((a, b) => 
        a.name.localeCompare(b.name)
      );
    });
  }

  /**
   * Get all module names sorted alphabetically
   */
  getModuleNames(): string[] {
    return Object.keys(this.groupedPermissions).sort((a, b) => {
      // Put 'Uncategorized' at the end
      if (a === 'Uncategorized') return 1;
      if (b === 'Uncategorized') return -1;
      return a.localeCompare(b);
    });
  }

  /**
   * Toggle the collapsed state of a module
   */
  toggleModuleCollapse(module: string): void {
    this.moduleCollapsedState[module] = !this.moduleCollapsedState[module];
  }

  /**
   * Check if a module is collapsed
   */
  isModuleCollapsed(module: string): boolean {
    return this.moduleCollapsedState[module] || false;
  }

  /**
   * Get the count of permissions in a module
   */
  getModulePermissionsCount(module: string): number {
    return this.groupedPermissions[module]?.length || 0;
  }

  /**
   * Expand all modules
   */
  expandAllModules(): void {
    Object.keys(this.groupedPermissions).forEach(module => {
      this.moduleCollapsedState[module] = false;
    });
  }

  /**
   * Collapse all modules
   */
  collapseAllModules(): void {
    Object.keys(this.groupedPermissions).forEach(module => {
      this.moduleCollapsedState[module] = true;
    });
  }

  // Permissions Pagination
  onPermissionsPageChange(page: number): void {
    this.permissionsPage = page;
    this.applyFiltersAndPagination('permissions');
  }

  onPermissionsPageSizeChange(pageSize: number): void {
    this.permissionsPageSize = pageSize;
    this.permissionsPage = 1; // Reset to first page
    this.applyFiltersAndPagination('permissions');
  }

  // Permissions Sorting
  onPermissionsSort(event: SortEvent): void {
    this.permissionsSortColumn = event.column;
    this.permissionsSortDirection = event.direction;
    this.applyFiltersAndPagination('permissions');
  }

  openCreatePermissionModal(): void {
    this.showCreatePermissionModal = true;
  }

  closeCreatePermissionModal(): void {
    this.showCreatePermissionModal = false;
  }

  openEditPermissionModal(permission: Permission): void {
    this.selectedPermission = permission;
    this.showEditPermissionModal = true;
  }

  closeEditPermissionModal(): void {
    this.showEditPermissionModal = false;
    this.selectedPermission = null;
  }

  deletePermission(permission: Permission): void {
    if (!confirm(`Are you sure you want to delete the permission "${permission.display_name}"?\n\nThis action cannot be undone.`)) {
      return;
    }

    this.permissionsService.deletePermission(permission.id).subscribe({
      next: () => {
        console.log(`✅ Permission "${permission.display_name}" deleted successfully`);
        this.toastService.success(
          `Permission "${permission.display_name}" deleted successfully!`,
          'Permission Deleted'
        );
        this.loadPermissions();
      },
      error: (err) => {
        console.error('Error deleting permission:', err);
        this.toastService.error(
          this.getFriendlyErrorMessage(err, 'Failed to delete permission'),
          'Error'
        );
      }
    });
  }

  // Assignment Management
  openAssignPermissionsModal(role: Role): void {
    this.selectedRole = role;
    this.showAssignPermissionsModal = true;
  }

  closeAssignPermissionsModal(): void {
    this.showAssignPermissionsModal = false;
    this.selectedRole = null;
  }

  onPermissionsAssigned(): void {
    this.loadRoles(); // Reload roles to reflect changes
    this.authService.refreshUser();
    this.toastService.success('Permissions assigned successfully', 'Success');
  }

  // Assign Permissions Tab Methods
  selectRoleForAssignment(role: Role): void {
    if (role.active) {
      this.selectedRoleForAssignment = role;
    }
  }

  clearRoleSelection(): void {
    this.selectedRoleForAssignment = null;
  }

  get filteredRolesForAssignment(): Role[] {
    let roles = [...this.allRoles];
    const query = this.assignRoleSearchTerm.trim().toLowerCase();

    if (query) {
      roles = roles.filter((role) =>
        role.name.toLowerCase().includes(query) ||
        (role.description && role.description.toLowerCase().includes(query)) ||
        this.getRoleTenantGroupLabel(role).toLowerCase().includes(query)
      );
    }

    if (this.assignRoleStatusFilter !== 'all') {
      const activeValue = this.assignRoleStatusFilter === 'active' ? 1 : 0;
      roles = roles.filter((role) => role.active === activeValue);
    }

    if (this.assignRoleTypeFilter !== 'all') {
      if (this.assignRoleTypeFilter === 'custom') {
        roles = roles.filter((role) => this.getRoleClassification(role) === 'custom');
      } else if (this.assignRoleTypeFilter === 'system') {
        roles = roles.filter((role) => role.is_custom === false);
      } else if (this.assignRoleTypeFilter === 'protected') {
        roles = roles.filter((role) => this.getRoleClassification(role) === 'protected');
      } else if (this.assignRoleTypeFilter === 'default') {
        roles = roles.filter((role) => this.getRoleClassification(role) === 'default');
      }
    }

    return roles;
  }

  get groupedRolesForAssignment(): AssignRoleTenantGroup[] {
    const groups = new Map<string, AssignRoleTenantGroup>();

    this.filteredRolesForAssignment.forEach((role) => {
      const tenantKey = this.getRoleTenantGroupKey(role);
      const tenantLabel = this.getRoleTenantGroupLabel(role);

      if (!groups.has(tenantKey)) {
        groups.set(tenantKey, {
          tenantKey,
          tenantLabel,
          roles: []
        });
      }

      groups.get(tenantKey)!.roles.push(role);
    });

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        roles: [...group.roles].sort((a, b) => a.name.localeCompare(b.name))
      }))
      .sort((a, b) => {
        if (a.tenantKey === 'platform') {
          return -1;
        }
        if (b.tenantKey === 'platform') {
          return 1;
        }
        return a.tenantLabel.localeCompare(b.tenantLabel);
      });
  }

  getRoleTenantGroupKey(role: Role): string {
    if (!role.tenant_id) {
      return 'platform';
    }
    return `tenant-${role.tenant_id}`;
  }

  getRoleTenantGroupLabel(role: Role): string {
    if (!role.tenant_id) {
      return 'Platform';
    }
    return role.tenant?.name?.trim() || `Tenant ${role.tenant_id}`;
  }

  getRoleUsersCountLabel(role: Role): string {
    const count = role.users_count || 0;
    return count === 1 ? '1 user' : `${count} users`;
  }

  getRoleUsersCountTitle(role: Role): string {
    const count = role.users_count || 0;
    if (count === 0) {
      return 'No users assigned to this role';
    }
    return count === 1
      ? '1 user assigned to this role'
      : `${count} users assigned to this role`;
  }

  trackByTenantGroupKey(_index: number, group: AssignRoleTenantGroup): string {
    return group.tenantKey;
  }

  onAssignRoleSearchChange(value: string): void {
    this.assignRoleSearchTerm = value;
    this.cdr.markForCheck();
  }

  onAssignRoleAdvancedSearch(searchValues: { [key: string]: unknown }): void {
    this.assignRoleStatusFilter = (searchValues['status'] as 'all' | 'active' | 'inactive') || 'all';
    this.assignRoleTypeFilter = (searchValues['type'] as 'all' | 'system' | 'custom' | 'protected' | 'default') || 'all';
    this.syncAssignRoleSearchFieldValues(searchValues);
    this.showAssignRoleAdvancedSearch = false;
    this.cdr.markForCheck();
  }

  onClearAssignRoleAdvancedSearch(): void {
    this.assignRoleStatusFilter = 'all';
    this.assignRoleTypeFilter = 'all';
    this.assignRoleSearchFields.forEach((field) => {
      field.value = undefined;
    });
    this.showAssignRoleAdvancedSearch = false;
    this.cdr.markForCheck();
  }

  clearAssignRoleSearchAndFilters(): void {
    this.assignRoleSearchTerm = '';
    this.onClearAssignRoleAdvancedSearch();
  }

  getAssignRoleActiveFilters(): ActiveFilter[] {
    const filters: ActiveFilter[] = [];

    if (this.assignRoleStatusFilter !== 'all') {
      filters.push({
        key: 'status',
        label: 'Status',
        value: this.assignRoleStatusFilter,
        displayValue: this.assignRoleStatusFilter === 'active' ? 'Active' : 'Inactive'
      });
    }

    if (this.assignRoleTypeFilter !== 'all') {
      const typeLabels: Record<string, string> = {
        system: 'System',
        custom: 'Custom',
        protected: 'Protected',
        default: 'Default'
      };
      filters.push({
        key: 'type',
        label: 'Type',
        value: this.assignRoleTypeFilter,
        displayValue: typeLabels[this.assignRoleTypeFilter] || this.assignRoleTypeFilter
      });
    }

    return filters;
  }

  getAssignRoleActiveFilterCount(): number {
    return this.getAssignRoleActiveFilters().length;
  }

  hasAssignRoleActiveFiltersOrSearch(): boolean {
    return this.getAssignRoleActiveFilterCount() > 0 || this.assignRoleSearchTerm.trim().length > 0;
  }

  removeAssignRoleFilter(filter: ActiveFilter): void {
    if (filter.key === 'status') {
      this.assignRoleStatusFilter = 'all';
    } else if (filter.key === 'type') {
      this.assignRoleTypeFilter = 'all';
    }

    const field = this.assignRoleSearchFields.find((item) => item.key === filter.key);
    if (field) {
      field.value = undefined;
    }

    this.cdr.markForCheck();
  }

  private syncAssignRoleSearchFieldValues(searchValues: { [key: string]: unknown }): void {
    this.assignRoleSearchFields.forEach((field) => {
      field.value = searchValues[field.key];
    });
  }

  onPermissionsAssignedInTab(): void {
    this.loadRoles(); // Reload roles to reflect changes
    this.selectedRoleForAssignment = null; // Clear selection
    this.authService.refreshUser();
    this.toastService.success('Permissions assigned successfully', 'Success');
  }

  // Tenant User Role Assignment
  loadTenantUsers(): void {
    if (!this.isTenantMode) {
      this.tenantUsers = [];
      return;
    }

    this.loadingTenantUsers = true;
    this.tenantUsersError = null;

    this.usersService.getUsers({ per_page: 'all', status: 'active' })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.tenantUsers = response.data || [];
          this.syncSelectedUserForRoles();
          this.loadingTenantUsers = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.tenantUsersError = this.getFriendlyErrorMessage(err, 'Failed to load tenant users');
          this.loadingTenantUsers = false;
          this.cdr.markForCheck();
        }
      });
  }

  selectUserForRoleAssignment(user: User): void {
    this.selectedUserForRoles = user;
    this.selectedRoleIdsForUser = (user.roles || []).map((role) => role.id);
  }

  isRoleCheckedForSelectedUser(roleId: number): boolean {
    return this.selectedRoleIdsForUser.includes(roleId);
  }

  toggleRoleForSelectedUser(roleId: number, checked: boolean): void {
    if (checked) {
      if (!this.selectedRoleIdsForUser.includes(roleId)) {
        this.selectedRoleIdsForUser = [...this.selectedRoleIdsForUser, roleId];
      }
      return;
    }

    this.selectedRoleIdsForUser = this.selectedRoleIdsForUser.filter((id) => id !== roleId);
  }

  saveSelectedUserRoles(): void {
    if (!this.selectedUserForRoles) {
      return;
    }

    this.savingUserRoles = true;
    this.usersService.assignRoles(this.selectedUserForRoles.id, this.selectedRoleIdsForUser, { tenantMode: this.isTenantMode })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.savingUserRoles = false;
          this.toastService.success('User roles updated successfully', 'Success');
          this.loadTenantUsers();
          this.authService.refreshUser();
        },
        error: (err) => {
          this.savingUserRoles = false;
          this.toastService.error(this.getFriendlyErrorMessage(err, 'Failed to update user roles'), 'Error');
          this.cdr.markForCheck();
        }
      });
  }

  getUserRolesDisplay(user: User): string {
    const names = (user.roles || []).map((role) => role.name);
    return names.length ? names.join(', ') : 'No roles';
  }

  trackByRoleId(_index: number, role: Role): number {
    return role.id;
  }

  trackByPermissionId(_index: number, permission: Permission): number {
    return permission.id;
  }

  trackByUserId(_index: number, user: User): number {
    return user.id;
  }

  trackByModuleName(_index: number, module: string): string {
    return module;
  }

  get tenantUserTotal(): number {
    return this.tenantUsers.length;
  }

  get tenantAssignedUsersCount(): number {
    return this.tenantUsers.filter((user) => (user.roles || []).length > 0).length;
  }

  get tenantUnassignedUsersCount(): number {
    return this.tenantUsers.filter((user) => (user.roles || []).length === 0).length;
  }

  get tenantAdminUsersCount(): number {
    return this.tenantUsers.filter((user) => (user.roles || []).some((role) => this.isProtectedTenantRole(role))).length;
  }

  private getFriendlyErrorMessage(error: any, fallback: string): string {
    // errorInterceptor flattens HttpErrorResponse to { message, status, errors }.
    const status = error?.status;
    const apiMessage = error?.message || error?.error?.message;

    if (status === 0) {
      return 'Network connection failed. Please check your internet and try again.';
    }

    if (status === 403) {
      return apiMessage || 'You do not have permission to perform this action.';
    }

    if (status === 422) {
      const validationErrors = error?.errors || error?.error?.errors;
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

  /**
   * Full role catalog for assignment UIs (not the current paginated page).
   */
  get assignableRoles(): Role[] {
    return (this.allRoles || []).filter((role) => role.active === 1);
  }

  private syncSelectedRoleForAssignment(): void {
    if (!this.selectedRoleForAssignment) {
      return;
    }

    const refreshedRole = this.allRoles.find((role) => role.id === this.selectedRoleForAssignment!.id);
    if (!refreshedRole || refreshedRole.active !== 1) {
      this.selectedRoleForAssignment = null;
      return;
    }

    this.selectedRoleForAssignment = refreshedRole;
  }

  private syncSelectedUserForRoles(): void {
    if (!this.selectedUserForRoles) {
      return;
    }

    const refreshedUser = this.tenantUsers.find((user) => user.id === this.selectedUserForRoles!.id);
    if (!refreshedUser) {
      this.selectedUserForRoles = null;
      this.selectedRoleIdsForUser = [];
      return;
    }

    this.selectedUserForRoles = refreshedUser;
  }

  photoViewer: { src: string; alt: string; title: string; subtitle: string } | null = null;

  getUserPhotoUrl(user: User): string | null {
    return resolveUserProfileImageUrl(user);
  }

  openPhotoViewer(user: User, event: Event): void {
    event.stopPropagation();
    const url = this.getUserPhotoUrl(user);
    if (!url) {
      return;
    }

    this.photoViewer = {
      src: url,
      alt: user.name,
      title: user.name,
      subtitle: user.email,
    };
    this.cdr.markForCheck();
  }

  closePhotoViewer(): void {
    this.photoViewer = null;
    this.cdr.markForCheck();
  }

  private updatePermissionsModuleOptions(): void {
    const modules = [...new Set(
      this.allPermissions
        .map((permission) => permission.module?.trim())
        .filter((module): module is string => !!module)
    )].sort((a, b) => a.localeCompare(b));

    const moduleField = this.permissionsSearchFields.find((field) => field.key === 'module');
    if (moduleField) {
      moduleField.options = [
        { value: '', label: 'All Modules' },
        ...modules.map((module) => ({ value: module, label: module }))
      ];
    }
  }

  onRolesListSearchChange(value: string): void {
    this.rolesSearchTerm = value;
    this.rolesPage = 1;
    this.applyFiltersAndPagination('roles');
    this.cdr.markForCheck();
  }

  onPermissionsListSearchChange(value: string): void {
    this.permissionsSearchTerm = value;
    this.permissionsPage = 1;
    this.applyFiltersAndPagination('permissions');
    this.cdr.markForCheck();
  }

  onRolesAdvancedSearch(searchValues: { [key: string]: unknown }): void {
    this.rolesStatusFilter = (searchValues['status'] as 'all' | 'active' | 'inactive') || 'all';
    this.rolesTypeFilter = (searchValues['type'] as 'all' | 'system' | 'custom' | 'protected' | 'default') || 'all';
    this.syncSearchFieldValues(this.rolesSearchFields, searchValues);
    this.showRolesAdvancedSearch = false;
    this.rolesPage = 1;
    this.applyFiltersAndPagination('roles');
    this.cdr.markForCheck();
  }

  onPermissionsAdvancedSearch(searchValues: { [key: string]: unknown }): void {
    this.permissionsStatusFilter = (searchValues['status'] as 'all' | 'active' | 'inactive') || 'all';
    this.permissionsTypeFilter = (searchValues['type'] as 'all' | 'system' | 'custom') || 'all';
    this.permissionsModuleFilter = (searchValues['module'] as string) || '';
    this.syncSearchFieldValues(this.permissionsSearchFields, searchValues);
    this.showPermissionsAdvancedSearch = false;
    this.permissionsPage = 1;
    this.applyFiltersAndPagination('permissions');
    this.cdr.markForCheck();
  }

  onClearRolesAdvancedSearch(): void {
    this.rolesStatusFilter = 'all';
    this.rolesTypeFilter = 'all';
    this.rolesSearchFields.forEach((field) => {
      field.value = undefined;
    });
    this.showRolesAdvancedSearch = false;
    this.rolesPage = 1;
    this.applyFiltersAndPagination('roles');
    this.cdr.markForCheck();
  }

  onClearPermissionsAdvancedSearch(): void {
    this.permissionsStatusFilter = 'all';
    this.permissionsTypeFilter = 'all';
    this.permissionsModuleFilter = '';
    this.permissionsSearchFields.forEach((field) => {
      field.value = undefined;
    });
    this.showPermissionsAdvancedSearch = false;
    this.permissionsPage = 1;
    this.applyFiltersAndPagination('permissions');
    this.cdr.markForCheck();
  }

  getRolesActiveFilters(): ActiveFilter[] {
    const filters: ActiveFilter[] = [];

    if (this.rolesStatusFilter !== 'all') {
      filters.push({
        key: 'status',
        label: 'Status',
        value: this.rolesStatusFilter,
        displayValue: this.rolesStatusFilter === 'active' ? 'Active' : 'Inactive'
      });
    }

    if (this.rolesTypeFilter !== 'all') {
      const typeLabels: Record<string, string> = {
        system: 'System',
        custom: 'Custom',
        protected: 'Protected',
        default: 'Default'
      };
      filters.push({
        key: 'type',
        label: 'Type',
        value: this.rolesTypeFilter,
        displayValue: typeLabels[this.rolesTypeFilter] || this.rolesTypeFilter
      });
    }

    return filters;
  }

  getPermissionsActiveFilters(): ActiveFilter[] {
    const filters: ActiveFilter[] = [];

    if (this.permissionsStatusFilter !== 'all') {
      filters.push({
        key: 'status',
        label: 'Status',
        value: this.permissionsStatusFilter,
        displayValue: this.permissionsStatusFilter === 'active' ? 'Active' : 'Inactive'
      });
    }

    if (this.permissionsTypeFilter !== 'all') {
      filters.push({
        key: 'type',
        label: 'Type',
        value: this.permissionsTypeFilter,
        displayValue: this.permissionsTypeFilter === 'custom' ? 'Custom' : 'System'
      });
    }

    if (this.permissionsModuleFilter) {
      filters.push({
        key: 'module',
        label: 'Module',
        value: this.permissionsModuleFilter,
        displayValue: this.permissionsModuleFilter
      });
    }

    return filters;
  }

  getRolesActiveFilterCount(): number {
    return this.getRolesActiveFilters().length;
  }

  getPermissionsActiveFilterCount(): number {
    return this.getPermissionsActiveFilters().length;
  }

  removeRolesFilter(filter: ActiveFilter): void {
    if (filter.key === 'status') {
      this.rolesStatusFilter = 'all';
    } else if (filter.key === 'type') {
      this.rolesTypeFilter = 'all';
    }

    const field = this.rolesSearchFields.find((item) => item.key === filter.key);
    if (field) {
      field.value = undefined;
    }

    this.rolesPage = 1;
    this.applyFiltersAndPagination('roles');
    this.cdr.markForCheck();
  }

  removePermissionsFilter(filter: ActiveFilter): void {
    if (filter.key === 'status') {
      this.permissionsStatusFilter = 'all';
    } else if (filter.key === 'type') {
      this.permissionsTypeFilter = 'all';
    } else if (filter.key === 'module') {
      this.permissionsModuleFilter = '';
    }

    const field = this.permissionsSearchFields.find((item) => item.key === filter.key);
    if (field) {
      field.value = undefined;
    }

    this.permissionsPage = 1;
    this.applyFiltersAndPagination('permissions');
    this.cdr.markForCheck();
  }

  private syncSearchFieldValues(fields: SearchField[], searchValues: { [key: string]: unknown }): void {
    fields.forEach((field) => {
      field.value = searchValues[field.key];
    });
  }

  /**
   * Apply filters and pagination for roles or permissions
   */
  private applyFiltersAndPagination(type: 'roles' | 'permissions'): void {
    if (type === 'roles') {
      let filtered = [...this.allRoles];

      if (this.rolesSearchTerm.trim()) {
        const query = this.rolesSearchTerm.trim().toLowerCase();
        filtered = filtered.filter(role => 
          role.name.toLowerCase().includes(query) ||
          (role.description && role.description.toLowerCase().includes(query))
        );
      }

      if (this.rolesStatusFilter !== 'all') {
        const activeValue = this.rolesStatusFilter === 'active' ? 1 : 0;
        filtered = filtered.filter(role => role.active === activeValue);
      }

      if (this.rolesTypeFilter !== 'all') {
        if (this.rolesTypeFilter === 'custom') {
          filtered = filtered.filter((role) => this.getRoleClassification(role) === 'custom');
        } else if (this.rolesTypeFilter === 'system') {
          filtered = filtered.filter((role) => role.is_custom === false);
        } else if (this.rolesTypeFilter === 'protected') {
          filtered = filtered.filter((role) => this.getRoleClassification(role) === 'protected');
        } else if (this.rolesTypeFilter === 'default') {
          filtered = filtered.filter((role) => this.getRoleClassification(role) === 'default');
        }
      }

      // Update total count after filtering
      this.totalRoles = filtered.length;

      // Apply sorting
      if (this.rolesSortColumn && this.rolesSortDirection) {
        filtered = this.applySorting(type, filtered);
      }

      // Apply pagination
      this.roles = this.applyPagination(type, filtered);
    } else {
      let filtered = [...this.allPermissions];

      if (this.permissionsSearchTerm.trim()) {
        const query = this.permissionsSearchTerm.trim().toLowerCase();
        filtered = filtered.filter(permission => 
          permission.name.toLowerCase().includes(query) ||
          permission.display_name.toLowerCase().includes(query) ||
          (permission.module && permission.module.toLowerCase().includes(query)) ||
          (permission.category && permission.category.toLowerCase().includes(query))
        );
      }

      if (this.permissionsStatusFilter !== 'all') {
        const activeValue = this.permissionsStatusFilter === 'active' ? 1 : 0;
        filtered = filtered.filter(permission => permission.active === activeValue);
      }

      if (this.permissionsTypeFilter !== 'all') {
        const isCustomValue = this.permissionsTypeFilter === 'custom';
        filtered = filtered.filter(permission => permission.is_custom === isCustomValue);
      }

      if (this.permissionsModuleFilter) {
        const moduleQuery = this.permissionsModuleFilter.toLowerCase();
        filtered = filtered.filter(permission => 
          permission.module && permission.module.toLowerCase().includes(moduleQuery)
        );
      }

      // Update total count after filtering
      this.totalPermissions = filtered.length;

      // Apply sorting
      if (this.permissionsSortColumn && this.permissionsSortDirection) {
        filtered = this.applySorting(type, filtered);
      }

      // Apply pagination
      this.permissions = this.applyPagination(type, filtered);
      
      // Group permissions by module after filtering and pagination
      this.groupPermissionsByModule();
    }
  }

  hasActiveRolesFilters(): boolean {
    return this.rolesSearchTerm.trim() !== '' ||
      this.rolesStatusFilter !== 'all' ||
      this.rolesTypeFilter !== 'all';
  }

  hasActivePermissionsFilters(): boolean {
    return this.permissionsSearchTerm.trim() !== '' ||
      this.permissionsStatusFilter !== 'all' ||
      this.permissionsTypeFilter !== 'all' ||
      this.permissionsModuleFilter !== '';
  }

  // Helper Methods
  getRoleBadgeClass(role: Role): string {
    const classification = this.getRoleClassification(role);
    if (classification === 'protected') return 'badge-protected';
    if (classification === 'default') return 'badge-default';
    if (classification === 'custom') return 'badge-custom';
    return 'badge-system';
  }

  getRoleBadgeLabel(role: Role): string {
    const classification = this.getRoleClassification(role);
    if (classification === 'protected') return 'Protected';
    if (classification === 'default') return 'Default';
    if (classification === 'custom') return 'Custom';
    return 'System';
  }

  getRoleClassification(role: Role): 'protected' | 'default' | 'custom' | 'system' {
    if (role.role_classification === 'protected_system') {
      return 'protected';
    }

    if (role.role_classification === 'default_template') {
      return 'default';
    }

    if (role.role_classification === 'custom') {
      return 'custom';
    }

    // Fallback for older payloads.
    if (this.isProtectedRole(role)) {
      return 'protected';
    }

    return role.is_custom ? 'custom' : 'system';
  }

  private isProtectedRole(role: Role): boolean {
    return isProtectedRoleDefinition(role);
  }

  getStatusBadgeClass(active: 0 | 1): string {
    return active === 1 ? 'badge-active' : 'badge-inactive';
  }

  getStatusText(active: 0 | 1): string {
    return active === 1 ? 'Active' : 'Inactive';
  }

  getRolesEmptyTitle(): string {
    return this.hasActiveRolesFilters() ? 'No Roles Match Current Filters' : 'No Roles Found';
  }

  getRolesEmptyDescription(): string {
    if (this.hasActiveRolesFilters()) {
      return 'Try adjusting filters or clear them to view all roles.';
    }
    return this.isTenantMode
      ? 'No additional roles configured.'
      : 'No roles are currently available.';
  }

  getPermissionsEmptyTitle(): string {
    return this.hasActivePermissionsFilters() ? 'No Permissions Match Current Filters' : 'No Permissions Found';
  }

  getPermissionsEmptyDescription(): string {
    if (this.hasActivePermissionsFilters()) {
      return 'Try adjusting filters or clear them to view all permissions.';
    }
    return this.isTenantMode
      ? 'No tenant-assignable permissions are available right now.'
      : 'No permissions are currently available.';
  }

  getPermissionPrimaryLabel(permission: Permission): string {
    const description = permission.description?.trim();
    if (description) {
      return description;
    }

    const displayName = permission.display_name?.trim();
    if (displayName) {
      return displayName;
    }

    return 'Permission';
  }

  getPermissionSecondaryLabel(permission: Permission): string {
    const displayName = permission.display_name?.trim();
    if (displayName && displayName !== this.getPermissionPrimaryLabel(permission)) {
      return displayName;
    }

    const category = permission.category?.trim();
    if (category) {
      return category;
    }

    return '-';
  }

  // Sorting Helper Methods
  applySorting(type: 'roles' | 'permissions', data: any[]): any[] {
    if (type === 'roles' && this.rolesSortColumn && this.rolesSortDirection) {
      return [...data].sort((a, b) => {
        const aValue = this.getNestedValue(a, this.rolesSortColumn);
        const bValue = this.getNestedValue(b, this.rolesSortColumn);
        return this.compare(aValue, bValue, this.rolesSortDirection!);
      });
    } else if (type === 'permissions' && this.permissionsSortColumn && this.permissionsSortDirection) {
      return [...data].sort((a, b) => {
        const aValue = this.getNestedValue(a, this.permissionsSortColumn);
        const bValue = this.getNestedValue(b, this.permissionsSortColumn);
        return this.compare(aValue, bValue, this.permissionsSortDirection!);
      });
    }
    return data;
  }

  getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, prop) => current?.[prop], obj);
  }

  compare(a: any, b: any, direction: 'asc' | 'desc'): number {
    const isAsc = direction === 'asc';
    
    // Handle null/undefined
    if (a == null && b == null) return 0;
    if (a == null) return isAsc ? -1 : 1;
    if (b == null) return isAsc ? 1 : -1;
    
    // Handle different types
    if (typeof a === 'string' && typeof b === 'string') {
      return isAsc ? a.localeCompare(b) : b.localeCompare(a);
    }
    
    if (typeof a === 'number' && typeof b === 'number') {
      return isAsc ? a - b : b - a;
    }
    
    // Convert to strings for comparison
    const aStr = String(a);
    const bStr = String(b);
    return isAsc ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
  }

  // Pagination Helper Methods
  applyPagination(type: 'roles' | 'permissions', data: any[]): any[] {
    if (type === 'roles') {
      const startIndex = (this.rolesPage - 1) * this.rolesPageSize;
      const endIndex = startIndex + this.rolesPageSize;
      return data.slice(startIndex, endIndex);
    } else if (type === 'permissions') {
      const startIndex = (this.permissionsPage - 1) * this.permissionsPageSize;
      const endIndex = startIndex + this.permissionsPageSize;
      return data.slice(startIndex, endIndex);
    }
    return data;
  }

  get deleteConfirmMessage(): string {
    const role = this.pendingRoleAction;
    if (!role) return '';
    const users = role.users_count || 0;
    const perms = role.permissions_count || 0;
    return `${role.name}\nAssigned users: ${users} | Permissions: ${perms}\n\n${this.getRoleDeleteImpactMessage(role)}`;
  }

  get statusConfirmMessage(): string {
    const role = this.pendingRoleAction;
    if (!role) return '';
    if (this.pendingRoleStatusTarget === 0) {
      return `${role.name}\n\nInactive roles cannot be assigned to new users. Existing assignments remain visible.`;
    }
    return `${role.name}\n\nThis role will be available again for new user assignments.`;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

