import { Component, EventEmitter, Input, OnInit, OnChanges, SimpleChanges, Output, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Role, Permission } from '@core/models';
import { PermissionsService } from '@core/services/permissions.service';
import { ToastService } from '@core/services/toast.service';
import { AuthService } from '@core/services/auth.service';
import { FilterPanelComponent, FilterPanelConfig, FilterValues } from '@shared/components/filter-panel/filter-panel.component';
import { isProtectedRoleDefinition } from '@shared/utils/rbac-role.util';

interface PermissionGroup {
  module: string;
  permissions: Permission[];
  selectedCount: number;
  totalCount: number;
  allSelected: boolean;
  someSelected: boolean;
}

@Component({
  selector: 'app-assign-permissions-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, FilterPanelComponent],
  templateUrl: './assign-permissions-modal.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './assign-permissions-modal.component.scss'
})
export class AssignPermissionsModalComponent implements OnInit, OnChanges {
  private static readonly REQUIRED_ADMIN_PERMISSION_NAMES = [
    'roles.view',
    'roles.create',
    'roles.update',
    'roles.delete',
    'permissions.assign',
    'roles.assign',
    'users.view',
    'users.update'
  ];

  @Input() show = false;
  @Input() role: Role | null = null;
  @Input() tenantMode = false;
  @Input() isInline = false; // New: Support inline rendering in tabs
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  // Permissions data
  allPermissions: Permission[] = [];
  selectedPermissionIds: Set<number> = new Set();
  originalPermissionIds: Set<number> = new Set();
  permissionGroups: PermissionGroup[] = [];
  
  // Loading and error states
  isLoading = false;
  isSaving = false;
  errorMessage: string | null = null;
  
  // Search and filter
  searchQuery = '';
  filteredGroups: PermissionGroup[] = [];
  showFilterPanel = false;
  moduleFilter = '';
  
  // Module collapse states
  moduleCollapsedState: { [module: string]: boolean } = {};
  
  // Filter Panel Configuration
  filterConfig: FilterPanelConfig = {
    title: 'Filter Permissions',
    showSearch: true,
    showModuleFilter: true,
    showStatusFilter: false,
    showTypeFilter: false,
    showRoleFilter: false,
    searchPlaceholder: 'Search permissions by name...',
    moduleOptions: []
  };
  
  // Statistics
  totalPermissions = 0;
  selectedPermissionsCount = 0;

  constructor(
    private permissionsService: PermissionsService,
    private toastService: ToastService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    if (this.show && this.role) {
      this.loadData();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['show'] && this.show && this.role) {
      this.loadData();
    } else if (changes['show'] && !this.show) {
      this.reset();
    }
  }

  /**
   * Load all permissions and currently assigned permissions for the role
   */
  private loadData(): void {
    this.isLoading = true;
    this.errorMessage = null;

    // Load all permissions and role's permissions in parallel
    Promise.all([
      this.loadAllPermissions(),
      this.loadRolePermissions()
    ]).then(() => {
      this.groupPermissionsByModule();
      this.updateFilterPanelConfig(); // Update filter options
      this.updateStatistics();
      this.applySearch();
      this.isLoading = false;
      this.cdr.detectChanges();
    }).catch((error) => {
      console.error('Error loading permissions:', error);
      this.errorMessage = this.getFriendlyErrorMessage(error, 'Failed to load permissions');
      this.isLoading = false;
      this.cdr.detectChanges();
    });
  }

  /**
   * Load all available permissions
   * CRITICAL SECURITY: Filters out "Tenants" and "Pope" module permissions for non-SuperAdmin users
   */
  private loadAllPermissions(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.permissionsService.getPermissions({ per_page: 'all' }, { tenantMode: this.tenantMode }).subscribe({
        next: (response) => {
          let permissions = this.extractPermissionsFromResponse(response);
          if (!permissions) {
            permissions = [];
          }
          
          // CRITICAL SECURITY: Filter out "Tenants" and "Pope" module permissions for non-SuperAdmin users
          // This is a defense-in-depth measure in addition to backend filtering
          if (!this.authService.isSuperAdmin()) {
            permissions = permissions.filter((permission: Permission) => {
              return permission.module !== 'Tenants' && permission.module !== 'Pope';
            });
          }
          
          this.allPermissions = permissions;
          this.totalPermissions = this.allPermissions.length;
          resolve();
        },
        error: (err) => {
          console.error('Error loading all permissions:', err);
          reject(err);
        }
      });
    });
  }

  /**
   * Load permissions currently assigned to the role
   * CRITICAL SECURITY: Filters out "Tenants" and "Pope" module permissions for non-SuperAdmin users
   */
  private loadRolePermissions(): Promise<void> {
    if (!this.role) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.permissionsService.getPermissionsForRole(this.role!.id, { tenantMode: this.tenantMode }).subscribe({
        next: (response) => {
          let rolePermissions = Array.isArray(response) ? response : (response.data || []);
          
          // CRITICAL SECURITY: Filter out "Tenants" and "Pope" module permissions for non-SuperAdmin users
          // This is a defense-in-depth measure in addition to backend filtering
          if (!this.authService.isSuperAdmin()) {
            rolePermissions = rolePermissions.filter((perm: Permission) => {
              return perm.module !== 'Tenants' && perm.module !== 'Pope';
            });
          }
          
          this.selectedPermissionIds.clear();
          this.originalPermissionIds.clear();
          
          if (rolePermissions && Array.isArray(rolePermissions)) {
            rolePermissions.forEach((perm: Permission) => {
              this.selectedPermissionIds.add(perm.id);
              this.originalPermissionIds.add(perm.id);
            });
          }
          
          resolve();
        },
        error: (err) => {
          console.error('Error loading role permissions:', err);
          reject(err);
        }
      });
    });
  }

  /**
   * Group permissions by their module
   * CRITICAL SECURITY: Excludes "Tenants" and "Pope" modules for non-SuperAdmin users
   */
  private groupPermissionsByModule(): void {
    const grouped: { [module: string]: Permission[] } = {};

    // Group permissions by module
    // CRITICAL SECURITY: Additional filter to ensure "Tenants" and "Pope" modules are excluded for non-SuperAdmin users
    this.allPermissions.forEach(permission => {
      // Skip "Tenants" and "Pope" module permissions for non-SuperAdmin users (defense in depth)
      if ((permission.module === 'Tenants' || permission.module === 'Pope') && !this.authService.isSuperAdmin()) {
        return;
      }
      
      const module = this.resolvePermissionModule(permission);
      if (!grouped[module]) {
        grouped[module] = [];
      }
      grouped[module].push(permission);
    });

    // Sort permissions within each module
    Object.keys(grouped).forEach(module => {
      grouped[module].sort((a, b) => a.display_name.localeCompare(b.display_name));
    });

    // Convert to PermissionGroup array
    this.permissionGroups = Object.keys(grouped)
      .sort((a, b) => {
        // Put 'Uncategorized' at the end
        if (a === 'Uncategorized') return 1;
        if (b === 'Uncategorized') return -1;
        return a.localeCompare(b);
      })
      .map(module => {
        const permissions = grouped[module];
        const selectedCount = permissions.filter(p => this.selectedPermissionIds.has(p.id)).length;
        const totalCount = permissions.length;

        // Initialize collapsed state (collapsed by default)
        if (this.moduleCollapsedState[module] === undefined) {
          this.moduleCollapsedState[module] = true;
        }

        return {
          module,
          permissions,
          selectedCount,
          totalCount,
          allSelected: selectedCount === totalCount,
          someSelected: selectedCount > 0 && selectedCount < totalCount
        };
      });
  }

  /**
   * Toggle permission selection
   */
  togglePermission(permission: Permission): void {
    if (this.selectedPermissionIds.has(permission.id)) {
      this.selectedPermissionIds.delete(permission.id);
    } else {
      this.selectedPermissionIds.add(permission.id);
    }
    this.updateGroupStatistics();
    this.updateStatistics();
  }

  /**
   * Toggle all permissions in a module
   */
  toggleModule(group: PermissionGroup): void {
    const shouldSelectAll = !group.allSelected;

    group.permissions.forEach(permission => {
      if (shouldSelectAll) {
        this.selectedPermissionIds.add(permission.id);
      } else {
        this.selectedPermissionIds.delete(permission.id);
      }
    });

    this.updateGroupStatistics();
    this.updateStatistics();
  }

  /**
   * Toggle module collapse state
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
   * Update group selection statistics
   */
  private updateGroupStatistics(): void {
    this.permissionGroups.forEach(group => {
      group.selectedCount = group.permissions.filter(p => this.selectedPermissionIds.has(p.id)).length;
      group.allSelected = group.selectedCount === group.totalCount;
      group.someSelected = group.selectedCount > 0 && group.selectedCount < group.totalCount;
    });

    // Update filtered groups as well
    this.applySearch();
  }

  /**
   * Update overall statistics
   */
  private updateStatistics(): void {
    this.selectedPermissionsCount = this.selectedPermissionIds.size;
  }

  /**
   * Apply search and module filters
   */
  applySearch(): void {
    let groups = [...this.permissionGroups];

    // Apply module filter
    if (this.moduleFilter) {
      groups = groups.filter(group => group.module === this.moduleFilter);
    }

    // Apply search filter
    if (!this.searchQuery.trim()) {
      this.filteredGroups = groups;
      return;
    }

    const query = this.searchQuery.toLowerCase();
    this.filteredGroups = groups
      .map(group => {
        const filteredPermissions = group.permissions.filter(permission =>
          permission.name.toLowerCase().includes(query) ||
          permission.display_name.toLowerCase().includes(query) ||
          permission.description?.toLowerCase().includes(query) ||
          permission.category?.toLowerCase().includes(query)
        );

        if (filteredPermissions.length === 0) {
          return null;
        }

        const selectedCount = filteredPermissions.filter(p => this.selectedPermissionIds.has(p.id)).length;
        return {
          ...group,
          permissions: filteredPermissions,
          selectedCount,
          totalCount: filteredPermissions.length,
          allSelected: selectedCount === filteredPermissions.length,
          someSelected: selectedCount > 0 && selectedCount < filteredPermissions.length
        };
      })
      .filter(group => group !== null) as PermissionGroup[];
  }

  /**
   * Clear search
   */
  clearSearch(): void {
    this.searchQuery = '';
    this.applySearch();
  }

  /**
   * Select all permissions
   * CRITICAL SECURITY: Only selects permissions that are visible (Tenants and Pope modules excluded for non-SuperAdmin)
   */
  selectAll(): void {
    // Only select permissions that are currently visible (already filtered to exclude Tenants and Pope for non-SuperAdmin)
    this.allPermissions.forEach(permission => {
      // Additional safety check (defense in depth)
      if ((permission.module === 'Tenants' || permission.module === 'Pope') && !this.authService.isSuperAdmin()) {
        return;
      }
      this.selectedPermissionIds.add(permission.id);
    });
    this.updateGroupStatistics();
    this.updateStatistics();
  }

  /**
   * Deselect all permissions
   */
  deselectAll(): void {
    this.selectedPermissionIds.clear();
    this.updateGroupStatistics();
    this.updateStatistics();
  }

  /**
   * Expand all modules
   */
  expandAll(): void {
    Object.keys(this.moduleCollapsedState).forEach(module => {
      this.moduleCollapsedState[module] = false;
    });
  }

  /**
   * Collapse all modules
   */
  collapseAll(): void {
    Object.keys(this.moduleCollapsedState).forEach(module => {
      this.moduleCollapsedState[module] = true;
    });
  }

  /**
   * Check if there are unsaved changes
   */
  hasChanges(): boolean {
    if (this.selectedPermissionIds.size !== this.originalPermissionIds.size) {
      return true;
    }
    
    for (const id of this.selectedPermissionIds) {
      if (!this.originalPermissionIds.has(id)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Save permission assignments
   * CRITICAL SECURITY: Validates that non-SuperAdmin users cannot submit Tenants or Pope permission IDs
   */
  save(): void {
    if (!this.role) {
      return;
    }

    if (!this.hasChanges()) {
      this.toastService.info('No changes to save', 'Info');
      this.close();
      return;
    }

    this.isSaving = true;
    this.errorMessage = null;

    let permissionIds = Array.from(this.selectedPermissionIds);

    if (this.hasAdminPermissionConflict()) {
      const missing = this.getMissingRequiredAdminPermissionLabels();
      this.isSaving = false;
      this.errorMessage = `Administrator role must retain critical permissions: ${missing.join(', ')}`;
      this.toastService.warning(this.errorMessage, 'Safeguard');
      return;
    }

    // CRITICAL SECURITY: Filter out any Tenants and Pope permission IDs for non-SuperAdmin users (defense in depth)
    if (!this.authService.isSuperAdmin()) {
      const restrictedPermissionIds = this.allPermissions
        .filter(p => p.module === 'Tenants' || p.module === 'Pope')
        .map(p => p.id);
      
      const originalCount = permissionIds.length;
      permissionIds = permissionIds.filter(id => !restrictedPermissionIds.includes(id));
      
      // If any restricted permissions were filtered out, log a warning
      const filteredCount = originalCount - permissionIds.length;
      if (filteredCount > 0) {
        console.warn(`Filtered out ${filteredCount} restricted module permission(s) - SuperAdmin only`);
        this.toastService.warning(
          'Tenants and Pope module permissions cannot be assigned. Only Super Administrators can manage these permissions.',
          'Security Restriction'
        );
      }
    }

    this.permissionsService.bulkAssignToRole({
      role_id: this.role.id,
      permission_ids: permissionIds
    }, { tenantMode: this.tenantMode }).subscribe({
      next: () => {
        this.isSaving = false;
        this.toastService.success(
          `Successfully assigned ${permissionIds.length} permission${permissionIds.length !== 1 ? 's' : ''} to "${this.role!.name}"`,
          'Success'
        );
        this.saved.emit();
        this.close();
      },
      error: (err) => {
        this.isSaving = false;
        console.error('Error saving permissions:', err);
        const errorMsg = this.getFriendlyErrorMessage(err, 'Failed to save permissions');
        this.errorMessage = errorMsg;
        this.toastService.error(errorMsg, 'Error');
      }
    });
  }

  /**
   * Close modal
   */
  close(): void {
    if (this.isSaving) {
      return;
    }

    if (this.hasChanges()) {
      const confirmClose = confirm('You have unsaved changes. Are you sure you want to close?');
      if (!confirmClose) {
        return;
      }
    }

    this.closed.emit();
  }

  /**
   * Reset modal state
   */
  private reset(): void {
    this.selectedPermissionIds.clear();
    this.originalPermissionIds.clear();
    this.allPermissions = [];
    this.permissionGroups = [];
    this.filteredGroups = [];
    this.searchQuery = '';
    this.errorMessage = null;
    this.isLoading = false;
    this.isSaving = false;
  }

  /**
   * Handle backdrop click
   */
  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  // ============ FILTER PANEL METHODS ============

  /**
   * Open filter panel
   */
  openFilterPanel(): void {
    this.showFilterPanel = true;
  }

  /**
   * Close filter panel
   */
  closeFilterPanel(): void {
    this.showFilterPanel = false;
  }

  /**
   * Apply filters from filter panel
   */
  applyFilters(values: FilterValues): void {
    this.searchQuery = values.search || '';
    this.moduleFilter = values.module || '';
    this.applySearch();
  }

  /**
   * Reset filters
   */
  resetFilters(): void {
    this.searchQuery = '';
    this.moduleFilter = '';
    this.applySearch();
  }

  /**
   * Get current filter values for filter panel
   */
  getCurrentFilterValues(): FilterValues {
    return {
      search: this.searchQuery,
      module: this.moduleFilter
    };
  }

  /**
   * Check if any filters are active
   */
  hasActiveFilters(): boolean {
    return this.searchQuery !== '' || this.moduleFilter !== '';
  }

  isProtectedTenantRole(): boolean {
    if (!this.tenantMode || !this.role) {
      return false;
    }
    return isProtectedRoleDefinition(this.role);
  }

  getMissingRequiredAdminPermissions(): string[] {
    if (!this.isProtectedTenantRole()) {
      return [];
    }

    const selectedNames = this.allPermissions
      .filter((permission) => this.selectedPermissionIds.has(permission.id))
      .map((permission) => permission.name);

    return AssignPermissionsModalComponent.REQUIRED_ADMIN_PERMISSION_NAMES.filter(
      (requiredName) => !selectedNames.includes(requiredName)
    );
  }

  getMissingRequiredAdminPermissionLabels(): string[] {
    return this.getMissingRequiredAdminPermissions().map((permissionName) => this.getRequiredPermissionLabel(permissionName));
  }

  hasAdminPermissionConflict(): boolean {
    return this.getMissingRequiredAdminPermissions().length > 0;
  }

  trackByModuleName(_index: number, group: PermissionGroup): string {
    return group.module;
  }

  trackByPermissionId(_index: number, permission: Permission): number {
    return permission.id;
  }

  getModuleCheckboxId(module: string): string {
    return `assign-permissions-module-${this.toDomId(module)}`;
  }

  getPermissionCheckboxId(module: string, permissionId: number): string {
    return `assign-permissions-permission-${this.toDomId(module)}-${permissionId}`;
  }

  getPermissionAriaLabel(permission: Permission): string {
    return `Toggle permission ${permission.display_name || permission.name} (${permission.name})`;
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

  isMandatoryAdminPermission(permission: Permission): boolean {
    return AssignPermissionsModalComponent.REQUIRED_ADMIN_PERMISSION_NAMES.includes(permission.name);
  }

  getModuleRiskLevel(module: string): 'high' | 'medium' | 'low' {
    const normalizedModule = module.toLowerCase();
    const highRiskModules = ['users', 'churchsettings', 'settings'];
    const mediumRiskModules = ['donations', 'reports', 'attendance', 'families'];

    if (highRiskModules.includes(normalizedModule)) {
      return 'high';
    }
    if (mediumRiskModules.includes(normalizedModule)) {
      return 'medium';
    }
    return 'low';
  }

  getModuleRiskLabel(module: string): string {
    const risk = this.getModuleRiskLevel(module);
    if (risk === 'high') {
      return 'High Risk';
    }
    if (risk === 'medium') {
      return 'Medium Risk';
    }
    return 'Standard';
  }

  /**
   * Update filter panel configuration with module options
   * CRITICAL SECURITY: Excludes "Tenants" and "Pope" modules from filter options for non-SuperAdmin users
   */
  private updateFilterPanelConfig(): void {
    let modules = Array.from(new Set(this.allPermissions.map((permission) => this.resolvePermissionModule(permission))));
    
    // CRITICAL SECURITY: Filter out "Tenants" and "Pope" modules from filter options for non-SuperAdmin users
    if (!this.authService.isSuperAdmin()) {
      modules = modules.filter(m => m !== 'Tenants' && m !== 'Pope');
    }
    
    modules.sort((a, b) => {
      if (a === 'Uncategorized') return 1;
      if (b === 'Uncategorized') return -1;
      return a.localeCompare(b);
    });

    this.filterConfig = {
      ...this.filterConfig,
      moduleOptions: [
        { value: '', label: 'All Modules' },
        ...modules.map(m => ({ value: m, label: m }))
      ]
    };
  }

  private getFriendlyErrorMessage(error: any, fallback: string): string {
    const status = error?.status;
    const apiMessage = error?.error?.message;

    if (status === 0) {
      return 'Network connection failed. Please check your internet and try again.';
    }

    if (status === 403) {
      return apiMessage || 'You do not have permission to perform this action.';
    }

    if (status === 422) {
      const validationErrors = error?.error?.errors;
      if (validationErrors) {
        const firstKey = Object.keys(validationErrors)[0];
        const firstMessage = firstKey ? validationErrors[firstKey]?.[0] : null;
        if (firstMessage) {
          return firstMessage;
        }
      }
      return apiMessage || 'Validation failed. Please review your selection and try again.';
    }

    if (status >= 500) {
      return 'Server error occurred. Please try again in a moment.';
    }

    return apiMessage || fallback;
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
      return 'Uncategorized';
    }

    if (explicitModule === 'Authentication') {
      return 'Users';
    }
    if (explicitModule === 'RolesAndPermissions') {
      return 'Roles & Permissions';
    }

    return explicitModule;
  }

  private getRequiredPermissionLabel(permissionName: string): string {
    const matchedPermission = this.allPermissions.find((permission) => permission.name === permissionName);
    if (matchedPermission) {
      return this.getPermissionLabel(matchedPermission);
    }

    const [domain, action] = permissionName.split('.');
    const normalizedDomain = (domain || '').replace(/_/g, ' ');
    const normalizedAction = (action || '').replace(/_/g, ' ');
    const sentence = `${normalizedAction} ${normalizedDomain}`.trim();
    if (!sentence) {
      return 'Required permission';
    }
    return sentence.charAt(0).toUpperCase() + sentence.slice(1);
  }

  private extractPermissionsFromResponse(response: any): Permission[] | null {
    if (!response) {
      return null;
    }

    if (Array.isArray(response)) {
      return response;
    }

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

    return candidate.flatMap((group: any) => {
      const moduleName = group?.module ?? 'Uncategorized';
      return (group.permissions || []).map((permission: Permission) => ({
        ...permission,
        module: permission.module ?? moduleName
      }));
    });
  }
}

