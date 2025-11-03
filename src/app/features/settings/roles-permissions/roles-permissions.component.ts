import { Component, OnInit, ChangeDetectorRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Role, Permission } from '@core/models';
import { RolesService } from '@core/services/roles.service';
import { PermissionsService } from '@core/services/permissions.service';
import { ToastService } from '@core/services/toast.service';
import { AuthService } from '@core/services/auth.service';
import { CardComponent, PaginationComponent, FilterPanelComponent, FilterPanelConfig, FilterValues } from '@shared/components';
import { SortableDirective, SortEvent } from '@shared/directives/sortable.directive';
import { RoleFormModalComponent } from './role-form-modal/role-form-modal.component';
import { AssignPermissionsModalComponent } from './assign-permissions-modal/assign-permissions-modal.component';
import { PopeDetailsManagementComponent } from '../ecclesiastical/pope-details/pope-details-management.component';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-roles-permissions',
  standalone: true,
  imports: [CommonModule, FormsModule, CardComponent, PaginationComponent, FilterPanelComponent, SortableDirective, RoleFormModalComponent, AssignPermissionsModalComponent, PopeDetailsManagementComponent],
  templateUrl: './roles-permissions.component.html',
  styleUrl: './roles-permissions.component.scss'
})
export class RolesPermissionsComponent implements OnInit {
  @ViewChild('assignModal') assignModalRef!: AssignPermissionsModalComponent;
  
  activeTab: 'roles' | 'permissions' | 'assign' | 'pope' = 'roles';
  hasEkklesiaRole = false;
  
  // Filter Panel State
  showRolesFilterPanel = false;
  showPermissionsFilterPanel = false;
  
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
  
  // Filters
  searchQuery = '';
  statusFilter: 'all' | 'active' | 'inactive' = 'all';
  typeFilter: 'all' | 'system' | 'custom' = 'all';
  moduleFilter = '';

  // Filter Panel Configurations
  rolesFilterConfig: FilterPanelConfig = {
    title: 'Filter Roles',
    showSearch: true,
    showStatusFilter: true,
    showTypeFilter: true,
    showModuleFilter: false,
    searchPlaceholder: 'Search roles by name or display name...'
  };

  permissionsFilterConfig: FilterPanelConfig = {
    title: 'Filter Permissions',
    showSearch: true,
    showStatusFilter: true,
    showTypeFilter: true,
    showModuleFilter: true,
    searchPlaceholder: 'Search permissions by name, display name, module...'
  };
  
  // Modals
  showCreateRoleModal = false;
  showEditRoleModal = false;
  showCreatePermissionModal = false;
  showEditPermissionModal = false;
  showAssignPermissionsModal = false;
  
  selectedRole: Role | null = null;
  selectedPermission: Permission | null = null;
  selectedRoleForAssignment: Role | null = null; // For Assign Permissions tab

  constructor(
    private rolesService: RolesService,
    private permissionsService: PermissionsService,
    private toastService: ToastService,
    public authService: AuthService,  // Made public for template access
    public cdr: ChangeDetectorRef  // Changed to public for template access
  ) {}

  ngOnInit(): void {
    this.loadRoles();
    this.loadPermissions();
    this.checkEkklesiaRole();
  }

  /**
   * Check if user has Ekklesia role to show Pope tab
   */
  private checkEkklesiaRole(): void {
    // Check immediately first
    this.updateEkklesiaRole(this.authService.currentUserValue);
    
    // Also subscribe to user changes
    this.authService.currentUser$.pipe(take(1)).subscribe(user => {
      this.updateEkklesiaRole(user);
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

  // Tab Management
  selectTab(tab: 'roles' | 'permissions' | 'assign' | 'pope'): void {
    this.activeTab = tab;
  }

  isActiveTab(tab: 'roles' | 'permissions' | 'assign' | 'pope'): boolean {
    return this.activeTab === tab;
  }

  // Roles Management
  loadRoles(): void {
    this.loadingRoles = true;
    this.rolesError = null;

    const params: any = { per_page: 'all' };

    this.rolesService.getRoles(params).subscribe({
      next: (response) => {
        this.allRoles = Array.isArray(response) ? response : response.data;
        this.applyFiltersAndPagination('roles');
        this.loadingRoles = false;
      },
      error: (err) => {
        console.error('Error loading roles:', err);
        this.rolesError = err.error?.message || 'Failed to load roles';
        this.loadingRoles = false;
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
    if (!confirm(`Are you sure you want to delete the role "${role.name}"?\n\nThis action cannot be undone.`)) {
      return;
    }

    this.rolesService.deleteRole(role.id).subscribe({
      next: () => {
        console.log(`✅ Role "${role.name}" deleted successfully`);
        this.toastService.success(`Role "${role.name}" deleted successfully!`, 'Role Deleted');
        this.loadRoles();
      },
      error: (err) => {
        console.error('Error deleting role:', err);
        this.toastService.error(err.error?.message || 'Failed to delete role', 'Error');
      }
    });
  }

  /**
   * Check if a role can have its status toggled
   * System roles (like Administrator) cannot be toggled
   */
  canToggleRoleStatus(role: Role): boolean {
    // System roles cannot be toggled
    if (!role.is_custom) {
      return false;
    }
    
    // Additional check: Don't allow toggling if role name is "Administrator" or "Super Administrator"
    const protectedRoles = ['Administrator', 'Super Administrator', 'Super Admin'];
    if (protectedRoles.includes(role.name)) {
      return false;
    }
    
    return true;
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

    const newStatus = role.active === 1 ? 0 : 1;
    const statusText = newStatus === 1 ? 'activated' : 'deactivated';
    
    this.rolesService.toggleRoleStatus(role.id, newStatus === 1).subscribe({
      next: () => {
        role.active = newStatus;
        console.log(`✅ Role "${role.name}" ${statusText} successfully`);
        this.toastService.success(
          `Role "${role.name}" ${statusText} successfully!`,
          'Status Updated'
        );
      },
      error: (err) => {
        console.error('Error toggling role status:', err);
        this.toastService.error(
          err.error?.message || 'Failed to update role status',
          'Error'
        );
      }
    });
  }

  // Permissions Management
  loadPermissions(): void {
    this.loadingPermissions = true;
    this.permissionsError = null;

    const params: any = { per_page: 'all' };

    this.permissionsService.getPermissions(params).subscribe({
      next: (response) => {
        this.allPermissions = Array.isArray(response) ? response : response.data;
        this.applyFiltersAndPagination('permissions');
        this.groupPermissionsByModule();
        this.loadingPermissions = false;
      },
      error: (err) => {
        console.error('Error loading permissions:', err);
        this.permissionsError = err.error?.message || 'Failed to load permissions';
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
          err.error?.message || 'Failed to delete permission',
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

  onPermissionsAssignedInTab(): void {
    this.loadRoles(); // Reload roles to reflect changes
    this.selectedRoleForAssignment = null; // Clear selection
    this.toastService.success('Permissions assigned successfully', 'Success');
  }

  // Filters
  onSearchChange(): void {
    this.permissionsPage = 1; // Reset to first page
    this.applyFiltersAndPagination('permissions');
  }

  onStatusFilterChange(): void {
    this.permissionsPage = 1; // Reset to first page
    this.applyFiltersAndPagination('permissions');
  }

  onTypeFilterChange(): void {
    this.permissionsPage = 1; // Reset to first page
    this.applyFiltersAndPagination('permissions');
  }

  onModuleFilterChange(): void {
    this.permissionsPage = 1; // Reset to first page
    this.applyFiltersAndPagination('permissions');
  }

  resetFilters(): void {
    this.searchQuery = '';
    this.statusFilter = 'all';
    this.typeFilter = 'all';
    this.moduleFilter = '';
    this.permissionsPage = 1; // Reset to first page
    this.applyFiltersAndPagination('permissions');
  }

  /**
   * Apply filters and pagination for roles or permissions
   */
  private applyFiltersAndPagination(type: 'roles' | 'permissions'): void {
    if (type === 'roles') {
      let filtered = [...this.allRoles];

      // Apply search filter
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        filtered = filtered.filter(role => 
          role.name.toLowerCase().includes(query) ||
          (role.description && role.description.toLowerCase().includes(query))
        );
      }

      // Apply status filter
      if (this.statusFilter !== 'all') {
        const activeValue = this.statusFilter === 'active' ? 1 : 0;
        filtered = filtered.filter(role => role.active === activeValue);
      }

      // Apply type filter
      if (this.typeFilter !== 'all') {
        const isCustomValue = this.typeFilter === 'custom';
        filtered = filtered.filter(role => role.is_custom === isCustomValue);
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

      // Apply search filter
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        filtered = filtered.filter(permission => 
          permission.name.toLowerCase().includes(query) ||
          permission.display_name.toLowerCase().includes(query) ||
          (permission.module && permission.module.toLowerCase().includes(query)) ||
          (permission.category && permission.category.toLowerCase().includes(query))
        );
      }

      // Apply status filter
      if (this.statusFilter !== 'all') {
        const activeValue = this.statusFilter === 'active' ? 1 : 0;
        filtered = filtered.filter(permission => permission.active === activeValue);
      }

      // Apply type filter
      if (this.typeFilter !== 'all') {
        const isCustomValue = this.typeFilter === 'custom';
        filtered = filtered.filter(permission => permission.is_custom === isCustomValue);
      }

      // Apply module filter
      if (this.moduleFilter) {
        const moduleQuery = this.moduleFilter.toLowerCase();
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

  // Filter Panel Methods
  openRolesFilterPanel(): void {
    this.showRolesFilterPanel = true;
  }

  closeRolesFilterPanel(): void {
    this.showRolesFilterPanel = false;
  }

  applyRolesFilters(filters: FilterValues): void {
    this.searchQuery = filters.search || '';
    this.statusFilter = (filters.status as 'all' | 'active' | 'inactive') || 'all';
    this.typeFilter = (filters.type as 'all' | 'system' | 'custom') || 'all';
    this.rolesPage = 1; // Reset to first page
    this.applyFiltersAndPagination('roles');
  }

  resetRolesFilters(): void {
    this.searchQuery = '';
    this.statusFilter = 'all';
    this.typeFilter = 'all';
    this.rolesPage = 1;
    this.applyFiltersAndPagination('roles');
  }

  openPermissionsFilterPanel(): void {
    this.showPermissionsFilterPanel = true;
  }

  closePermissionsFilterPanel(): void {
    this.showPermissionsFilterPanel = false;
  }

  applyPermissionsFilters(filters: FilterValues): void {
    this.searchQuery = filters.search || '';
    this.statusFilter = (filters.status as 'all' | 'active' | 'inactive') || 'all';
    this.typeFilter = (filters.type as 'all' | 'system' | 'custom') || 'all';
    this.moduleFilter = filters.module || '';
    this.permissionsPage = 1; // Reset to first page
    this.applyFiltersAndPagination('permissions');
  }

  resetPermissionsFilters(): void {
    this.searchQuery = '';
    this.statusFilter = 'all';
    this.typeFilter = 'all';
    this.moduleFilter = '';
    this.permissionsPage = 1;
    this.applyFiltersAndPagination('permissions');
  }

  getCurrentFilterValues(): FilterValues {
    return {
      search: this.searchQuery,
      status: this.statusFilter,
      type: this.typeFilter,
      module: this.moduleFilter
    };
  }

  // Maximum number of filter chips to display before showing "+ more"
  maxVisibleChips = 3;

  hasActiveFilters(): boolean {
    return this.searchQuery !== '' ||
           this.statusFilter !== 'all' ||
           this.typeFilter !== 'all' ||
           this.moduleFilter !== '';
  }

  // Cached filter chips to prevent infinite change detection
  private _cachedChips: Array<{type: string, label: string, value: string}> = [];
  private _cachedVisibleChips: Array<{type: string, label: string, value: string}> = [];
  private _cachedHiddenChips: Array<{type: string, label: string, value: string}> = [];
  private _cachedHiddenCount: number = 0;
  private _cachedTooltip: string = '';
  private _lastFilterState = '';

  getActiveFilterChips(): Array<{type: string, label: string, value: string}> {
    // Cache based on current filter state to prevent infinite loops
    const currentState = `${this.searchQuery}|${this.statusFilter}|${this.typeFilter}|${this.moduleFilter}`;
    
    if (this._lastFilterState === currentState) {
      return this._cachedChips;
    }
    
    this._lastFilterState = currentState;
    const chips: Array<{type: string, label: string, value: string}> = [];
    
    if (this.searchQuery) {
      chips.push({
        type: 'search',
        label: 'Search',
        value: this.searchQuery
      });
    }
    
    if (this.statusFilter !== 'all') {
      chips.push({
        type: 'status',
        label: 'Status',
        value: this.statusFilter === 'active' ? 'Active' : 'Inactive'
      });
    }
    
    if (this.typeFilter !== 'all') {
      chips.push({
        type: 'type',
        label: 'Type',
        value: this.typeFilter === 'system' ? 'System' : 'Custom'
      });
    }
    
    if (this.moduleFilter) {
      chips.push({
        type: 'module',
        label: 'Module',
        value: this.moduleFilter
      });
    }
    
    this._cachedChips = chips;
    
    // Update all dependent caches at once
    this._cachedVisibleChips = chips.slice(0, this.maxVisibleChips);
    this._cachedHiddenChips = chips.slice(this.maxVisibleChips);
    this._cachedHiddenCount = this._cachedHiddenChips.length;
    this._cachedTooltip = this._cachedHiddenChips.map(chip => `${chip.label}: ${chip.value}`).join('\n');
    
    return chips;
  }

  getVisibleFilterChips(): Array<{type: string, label: string, value: string}> {
    // Ensure cache is up to date
    const currentState = `${this.searchQuery}|${this.statusFilter}|${this.typeFilter}|${this.moduleFilter}`;
    if (this._lastFilterState !== currentState) {
      this.getActiveFilterChips();
    }
    return this._cachedVisibleChips;
  }

  getHiddenFilterChips(): Array<{type: string, label: string, value: string}> {
    // Ensure cache is up to date
    const currentState = `${this.searchQuery}|${this.statusFilter}|${this.typeFilter}|${this.moduleFilter}`;
    if (this._lastFilterState !== currentState) {
      this.getActiveFilterChips();
    }
    return this._cachedHiddenChips;
  }

  getHiddenChipsCount(): number {
    // Ensure cache is up to date
    const currentState = `${this.searchQuery}|${this.statusFilter}|${this.typeFilter}|${this.moduleFilter}`;
    if (this._lastFilterState !== currentState) {
      this.getActiveFilterChips();
    }
    return this._cachedHiddenCount;
  }

  getHiddenChipsTooltip(): string {
    // Ensure cache is up to date
    const currentState = `${this.searchQuery}|${this.statusFilter}|${this.typeFilter}|${this.moduleFilter}`;
    if (this._lastFilterState !== currentState) {
      this.getActiveFilterChips();
    }
    return this._cachedTooltip;
  }

  openFilterPanelWithCurrentFilters(): void {
    // Open the appropriate filter panel based on active tab
    if (this.activeTab === 'roles') {
      this.openRolesFilterPanel();
    } else {
      this.openPermissionsFilterPanel();
    }
  }

  removeFilter(filterType: string): void {
    switch (filterType) {
      case 'search':
        this.searchQuery = '';
        break;
      case 'status':
        this.statusFilter = 'all';
        break;
      case 'type':
        this.typeFilter = 'all';
        break;
      case 'module':
        this.moduleFilter = '';
        break;
    }
    
    // Determine which tab we're on and reapply filters
    if (this.activeTab === 'roles') {
      this.rolesPage = 1; // Reset to first page
      this.applyFiltersAndPagination('roles');
    } else {
      this.permissionsPage = 1; // Reset to first page
      this.applyFiltersAndPagination('permissions');
    }
  }

  // Helper Methods
  getRoleBadgeClass(role: Role): string {
    if (role.is_custom) return 'badge-custom';
    return 'badge-system';
  }

  getStatusBadgeClass(active: 0 | 1): string {
    return active === 1 ? 'badge-active' : 'badge-inactive';
  }

  getStatusText(active: 0 | 1): string {
    return active === 1 ? 'Active' : 'Inactive';
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
}

