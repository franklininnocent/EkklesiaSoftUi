import { Component, EventEmitter, Input, OnInit, OnChanges, SimpleChanges, Output, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Role, Permission } from '@core/models';
import { PermissionsService } from '@core/services/permissions.service';
import { ToastService } from '@core/services/toast.service';
import { AuthService } from '@core/services/auth.service';
import { isProtectedRoleDefinition } from '@shared/utils/rbac-role.util';
import { isHighRiskPermissionName } from '@shared/utils/rbac-permission.util';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { ListToolbarComponent } from '@shared/components/list-toolbar/list-toolbar.component';
import { AdvancedSearchPanelComponent, SearchField, ActiveFilter } from '@shared/components/advanced-search-panel/advanced-search-panel.component';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';

interface PermissionGroup {
  module: string;
  permissions: Permission[];
  selectedCount: number;
  totalCount: number;
  allSelected: boolean;
  someSelected: boolean;
}

type AssignmentFilter = '' | 'all' | 'assigned' | 'not_assigned';

@Component({
  selector: 'app-assign-permissions-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ModalShellComponent,
    ListToolbarComponent,
    AdvancedSearchPanelComponent,
    CfEmptyStateComponent
  ],
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

  private static readonly AUTO_EXPAND_ALL_THRESHOLD = 30;

  private static readonly ACTION_LABEL_ORDER = [
    'view', 'create', 'update', 'delete', 'manage', 'export', 'assign', 'approve'
  ];

  @Input() show = false;
  @Input() role: Role | null = null;
  @Input() tenantMode = false;
  @Input() isInline = false;
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  allPermissions: Permission[] = [];
  selectedPermissionIds: Set<number> = new Set();
  originalPermissionIds: Set<number> = new Set();
  permissionGroups: PermissionGroup[] = [];

  isLoading = false;
  isSaving = false;
  errorMessage: string | null = null;

  searchQuery = '';
  filteredGroups: PermissionGroup[] = [];
  showAdvancedSearch = false;
  moduleFilter = '';
  actionFilter = '';
  assignmentFilter: AssignmentFilter = '';

  moduleCollapsedState: { [module: string]: boolean } = {};
  searchFields: SearchField[] = [];

  totalPermissions = 0;
  selectedPermissionsCount = 0;
  filteredPermissionCount = 0;
  selectedInViewCount = 0;

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

  private loadData(): void {
    this.isLoading = true;
    this.errorMessage = null;

    Promise.all([
      this.loadAllPermissions(),
      this.loadRolePermissions()
    ]).then(() => {
      this.groupPermissionsByModule();
      this.updateSearchFields();
      this.updateStatistics();
      this.applyDefaultCollapseState();
      this.applyFilters();
      this.isLoading = false;
      this.cdr.detectChanges();
    }).catch((error) => {
      console.error('Error loading permissions:', error);
      this.errorMessage = this.getFriendlyErrorMessage(error, 'Failed to load permissions');
      this.isLoading = false;
      this.cdr.detectChanges();
    });
  }

  private loadAllPermissions(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.permissionsService.getPermissions({ per_page: 'all' }, { tenantMode: this.tenantMode }).subscribe({
        next: (response) => {
          let permissions = this.extractPermissionsFromResponse(response);
          if (!permissions) {
            permissions = [];
          }

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

  private loadRolePermissions(): Promise<void> {
    if (!this.role) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.permissionsService.getPermissionsForRole(this.role!.id, { tenantMode: this.tenantMode }).subscribe({
        next: (response) => {
          let rolePermissions = Array.isArray(response) ? response : (response.data || []);

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

  private groupPermissionsByModule(): void {
    const grouped: { [module: string]: Permission[] } = {};

    this.allPermissions.forEach(permission => {
      if ((permission.module === 'Tenants' || permission.module === 'Pope') && !this.authService.isSuperAdmin()) {
        return;
      }

      const module = this.resolvePermissionModule(permission);
      if (!grouped[module]) {
        grouped[module] = [];
      }
      grouped[module].push(permission);
    });

    Object.keys(grouped).forEach(module => {
      grouped[module].sort((a, b) => a.display_name.localeCompare(b.display_name));
    });

    this.permissionGroups = Object.keys(grouped)
      .sort((a, b) => {
        if (a === 'Uncategorized') return 1;
        if (b === 'Uncategorized') return -1;
        return a.localeCompare(b);
      })
      .map(module => {
        const permissions = grouped[module];
        const selectedCount = permissions.filter(p => this.selectedPermissionIds.has(p.id)).length;
        const totalCount = permissions.length;

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

  togglePermission(permission: Permission): void {
    if (this.selectedPermissionIds.has(permission.id)) {
      this.selectedPermissionIds.delete(permission.id);
    } else {
      this.selectedPermissionIds.add(permission.id);
    }
    this.updateGroupStatistics();
    this.updateStatistics();
  }

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

  toggleModuleCollapse(module: string): void {
    this.moduleCollapsedState[module] = !this.moduleCollapsedState[module];
  }

  isModuleCollapsed(module: string): boolean {
    return this.moduleCollapsedState[module] || false;
  }

  private updateGroupStatistics(): void {
    this.permissionGroups.forEach(group => {
      group.selectedCount = group.permissions.filter(p => this.selectedPermissionIds.has(p.id)).length;
      group.allSelected = group.selectedCount === group.totalCount;
      group.someSelected = group.selectedCount > 0 && group.selectedCount < group.totalCount;
    });

    this.applyFilters();
  }

  private updateStatistics(): void {
    this.selectedPermissionsCount = this.selectedPermissionIds.size;
  }

  applyFilters(): void {
    let groups = [...this.permissionGroups];
    const query = this.searchQuery.trim().toLowerCase();

    if (this.moduleFilter) {
      groups = groups.filter(group => group.module === this.moduleFilter);
    }

    this.filteredGroups = groups
      .map(group => {
        let filteredPermissions = [...group.permissions];

        if (this.actionFilter) {
          filteredPermissions = filteredPermissions.filter(permission =>
            this.getPermissionAction(permission.name) === this.actionFilter
          );
        }

        if (this.assignmentFilter === 'assigned') {
          filteredPermissions = filteredPermissions.filter(permission =>
            this.selectedPermissionIds.has(permission.id)
          );
        } else if (this.assignmentFilter === 'not_assigned') {
          filteredPermissions = filteredPermissions.filter(permission =>
            !this.selectedPermissionIds.has(permission.id)
          );
        }

        if (query) {
          filteredPermissions = filteredPermissions.filter(permission => this.matchesSearch(permission, query));
        }

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

    this.filteredPermissionCount = this.filteredGroups.reduce((sum, group) => sum + group.permissions.length, 0);
    this.selectedInViewCount = this.filteredGroups.reduce((sum, group) => sum + group.selectedCount, 0);

    if (this.hasActiveFiltersOrSearch()) {
      this.filteredGroups.forEach(group => {
        this.moduleCollapsedState[group.module] = false;
      });
    }
  }

  onSearchChange(value: string): void {
    this.searchQuery = value;
    this.applyFilters();
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.applyFilters();
  }

  onAdvancedSearch(searchValues: { [key: string]: unknown }): void {
    this.moduleFilter = (searchValues['module'] as string) || '';
    this.actionFilter = (searchValues['action'] as string) || '';
    this.assignmentFilter = (searchValues['assignment'] as AssignmentFilter) || '';
    this.syncSearchFieldValues(searchValues);
    this.applyFilters();
    this.showAdvancedSearch = false;
  }

  onClearAdvancedSearch(): void {
    this.moduleFilter = '';
    this.actionFilter = '';
    this.assignmentFilter = '';
    this.searchFields.forEach(field => {
      field.value = undefined;
    });
    this.applyFilters();
    this.showAdvancedSearch = false;
  }

  clearAllFilters(): void {
    this.clearSearch();
    this.onClearAdvancedSearch();
  }

  getActiveFilters(): ActiveFilter[] {
    const filters: ActiveFilter[] = [];

    if (this.moduleFilter) {
      filters.push({
        key: 'module',
        label: 'Module',
        value: this.moduleFilter,
        displayValue: this.moduleFilter
      });
    }

    if (this.actionFilter) {
      filters.push({
        key: 'action',
        label: 'Action',
        value: this.actionFilter,
        displayValue: this.formatActionLabel(this.actionFilter)
      });
    }

    if (this.assignmentFilter && this.assignmentFilter !== 'all') {
      filters.push({
        key: 'assignment',
        label: 'Assignment',
        value: this.assignmentFilter,
        displayValue: this.assignmentFilter === 'assigned' ? 'Assigned' : 'Not Assigned'
      });
    }

    return filters;
  }

  getActiveFilterCount(): number {
    return this.getActiveFilters().length;
  }

  hasActiveFiltersOrSearch(): boolean {
    return this.getActiveFilterCount() > 0 || this.searchQuery.trim().length > 0;
  }

  hasActiveDrawerFilters(): boolean {
    return this.getActiveFilterCount() > 0;
  }

  removeFilter(filter: ActiveFilter): void {
    if (filter.key === 'module') {
      this.moduleFilter = '';
    } else if (filter.key === 'action') {
      this.actionFilter = '';
    } else if (filter.key === 'assignment') {
      this.assignmentFilter = '';
    }

    const field = this.searchFields.find(item => item.key === filter.key);
    if (field) {
      field.value = undefined;
    }

    this.applyFilters();
  }

  selectAll(): void {
    this.allPermissions.forEach(permission => {
      if ((permission.module === 'Tenants' || permission.module === 'Pope') && !this.authService.isSuperAdmin()) {
        return;
      }
      this.selectedPermissionIds.add(permission.id);
    });
    this.updateGroupStatistics();
    this.updateStatistics();
  }

  deselectAll(): void {
    this.selectedPermissionIds.clear();
    this.updateGroupStatistics();
    this.updateStatistics();
  }

  expandAll(): void {
    Object.keys(this.moduleCollapsedState).forEach(module => {
      this.moduleCollapsedState[module] = false;
    });
  }

  collapseAll(): void {
    Object.keys(this.moduleCollapsedState).forEach(module => {
      this.moduleCollapsedState[module] = true;
    });
  }

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

    if (!this.authService.isSuperAdmin()) {
      const restrictedPermissionIds = this.allPermissions
        .filter(p => p.module === 'Tenants' || p.module === 'Pope')
        .map(p => p.id);

      const originalCount = permissionIds.length;
      permissionIds = permissionIds.filter(id => !restrictedPermissionIds.includes(id));

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

  private reset(): void {
    this.selectedPermissionIds.clear();
    this.originalPermissionIds.clear();
    this.allPermissions = [];
    this.permissionGroups = [];
    this.filteredGroups = [];
    this.searchQuery = '';
    this.moduleFilter = '';
    this.actionFilter = '';
    this.assignmentFilter = '';
    this.showAdvancedSearch = false;
    this.filteredPermissionCount = 0;
    this.selectedInViewCount = 0;
    this.moduleCollapsedState = {};
    this.errorMessage = null;
    this.isLoading = false;
    this.isSaving = false;
  }

  openAdvancedSearch(): void {
    this.showAdvancedSearch = true;
  }

  getRoleBadgeClass(): string {
    const classification = this.getRoleClassification();
    if (classification === 'protected') return 'badge-protected';
    if (classification === 'default') return 'badge-default';
    if (classification === 'custom') return 'badge-custom';
    return 'badge-system';
  }

  getRoleBadgeLabel(): string {
    const classification = this.getRoleClassification();
    if (classification === 'protected') return 'Protected';
    if (classification === 'default') return 'Default';
    if (classification === 'custom') return 'Custom';
    return 'System';
  }

  private getRoleClassification(): 'protected' | 'default' | 'custom' | 'system' {
    if (!this.role) {
      return 'system';
    }

    if (this.role.role_classification === 'protected_system') {
      return 'protected';
    }

    if (this.role.role_classification === 'default_template') {
      return 'default';
    }

    if (this.role.role_classification === 'custom') {
      return 'custom';
    }

    if (isProtectedRoleDefinition(this.role)) {
      return 'protected';
    }

    return this.role.is_custom ? 'custom' : 'system';
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
    const state = this.selectedPermissionIds.has(permission.id) ? 'assigned' : 'not assigned';
    return `Toggle permission ${permission.display_name || permission.name} (${permission.name}), currently ${state}`;
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

  getPermissionSubtitle(permission: Permission): string | null {
    const label = this.getPermissionLabel(permission);
    const displayName = permission.display_name?.trim();
    const description = permission.description?.trim();

    if (description && label === description && displayName) {
      return displayName;
    }

    if (!description && displayName && label === displayName) {
      return permission.name;
    }

    if (description && label !== description) {
      return description;
    }

    return displayName && label !== displayName ? displayName : null;
  }

  getPermissionAction(name: string): string {
    const parts = (name || '').split('.');
    const action = (parts[parts.length - 1] || 'other').toLowerCase();
    if (action === 'list' || action === 'read') {
      return 'view';
    }
    return action;
  }

  formatActionLabel(action: string): string {
    if (!action) {
      return '';
    }
    return action.charAt(0).toUpperCase() + action.slice(1).replace(/_/g, ' ');
  }

  isMandatoryAdminPermission(permission: Permission): boolean {
    return AssignPermissionsModalComponent.REQUIRED_ADMIN_PERMISSION_NAMES.includes(permission.name);
  }

  isHighRiskPermission(permission: Permission): boolean {
    return isHighRiskPermissionName(permission.name);
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

  getResultsSummary(): string {
    const count = this.filteredPermissionCount;
    const noun = count === 1 ? 'permission' : 'permissions';
    let summary = `${count} ${noun}`;

    if (this.hasActiveFiltersOrSearch()) {
      summary += ` · ${this.selectedInViewCount} selected in view`;
    }

    return summary;
  }

  private applyDefaultCollapseState(): void {
    if (this.hasActiveFiltersOrSearch()) {
      this.expandAll();
      return;
    }

    if (this.allPermissions.length <= AssignPermissionsModalComponent.AUTO_EXPAND_ALL_THRESHOLD) {
      this.expandAll();
      return;
    }

    this.permissionGroups.forEach((group, index) => {
      this.moduleCollapsedState[group.module] = index !== 0;
    });
  }

  private updateSearchFields(): void {
    let modules = Array.from(new Set(this.allPermissions.map((permission) => this.resolvePermissionModule(permission))));

    if (!this.authService.isSuperAdmin()) {
      modules = modules.filter(m => m !== 'Tenants' && m !== 'Pope');
    }

    modules.sort((a, b) => {
      if (a === 'Uncategorized') return 1;
      if (b === 'Uncategorized') return -1;
      return a.localeCompare(b);
    });

    const actionSet = new Set(this.allPermissions.map(permission => this.getPermissionAction(permission.name)));
    const orderedActions = AssignPermissionsModalComponent.ACTION_LABEL_ORDER.filter(action => actionSet.has(action));
    const remainingActions = Array.from(actionSet)
      .filter(action => !AssignPermissionsModalComponent.ACTION_LABEL_ORDER.includes(action))
      .sort((a, b) => a.localeCompare(b));

    this.searchFields = [
      {
        key: 'module',
        label: 'Module',
        type: 'select',
        group: 'Permission filters',
        options: [
          { value: '', label: 'All Modules' },
          ...modules.map(module => ({ value: module, label: module }))
        ],
        value: this.moduleFilter || undefined
      },
      {
        key: 'action',
        label: 'Action',
        type: 'select',
        group: 'Permission filters',
        options: [
          { value: '', label: 'All Actions' },
          ...[...orderedActions, ...remainingActions].map(action => ({
            value: action,
            label: this.formatActionLabel(action)
          }))
        ],
        value: this.actionFilter || undefined
      },
      {
        key: 'assignment',
        label: 'Assignment State',
        type: 'select',
        group: 'Permission filters',
        options: [
          { value: '', label: 'All' },
          { value: 'assigned', label: 'Assigned' },
          { value: 'not_assigned', label: 'Not Assigned' }
        ],
        value: this.assignmentFilter || undefined
      }
    ];
  }

  private syncSearchFieldValues(searchValues: { [key: string]: unknown }): void {
    this.searchFields.forEach(field => {
      field.value = searchValues[field.key];
    });
  }

  private matchesSearch(permission: Permission, query: string): boolean {
    const module = this.resolvePermissionModule(permission);
    return (
      permission.name.toLowerCase().includes(query) ||
      permission.display_name.toLowerCase().includes(query) ||
      (permission.description?.toLowerCase().includes(query) ?? false) ||
      (permission.category?.toLowerCase().includes(query) ?? false) ||
      module.toLowerCase().includes(query) ||
      (permission.module?.toLowerCase().includes(query) ?? false)
    );
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

  toDomId(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'uncategorized';
  }

  resolvePermissionModule(permission: Permission): string {
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
