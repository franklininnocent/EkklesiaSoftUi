import { Component, EventEmitter, Input, OnInit, OnChanges, SimpleChanges, Output, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Role, Permission } from '@core/models';
import { PermissionsService } from '@core/services/permissions.service';
import { ToastService } from '@core/services/toast.service';
import { FilterPanelComponent, FilterPanelConfig, FilterValues } from '@shared/components/filter-panel/filter-panel.component';

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
  styleUrl: './assign-permissions-modal.component.scss'
})
export class AssignPermissionsModalComponent implements OnInit, OnChanges {
  @Input() show = false;
  @Input() role: Role | null = null;
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
      this.errorMessage = 'Failed to load permissions. Please try again.';
      this.isLoading = false;
      this.cdr.detectChanges();
    });
  }

  /**
   * Load all available permissions
   */
  private loadAllPermissions(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.permissionsService.getPermissions({ per_page: 'all' }).subscribe({
        next: (response) => {
          this.allPermissions = Array.isArray(response) ? response : response.data;
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
   */
  private loadRolePermissions(): Promise<void> {
    if (!this.role) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.permissionsService.getPermissionsForRole(this.role!.id).subscribe({
        next: (response) => {
          const rolePermissions = Array.isArray(response) ? response : (response.data || []);
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
   */
  private groupPermissionsByModule(): void {
    const grouped: { [module: string]: Permission[] } = {};

    // Group permissions by module
    this.allPermissions.forEach(permission => {
      const module = permission.module || 'Uncategorized';
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
   */
  selectAll(): void {
    this.allPermissions.forEach(permission => {
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

    const permissionIds = Array.from(this.selectedPermissionIds);

    this.permissionsService.bulkAssignToRole({
      role_id: this.role.id,
      permission_ids: permissionIds
    }).subscribe({
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
        const errorMsg = err.error?.message || 'Failed to save permissions. Please try again.';
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

  /**
   * Update filter panel configuration with module options
   */
  private updateFilterPanelConfig(): void {
    const modules = Array.from(new Set(this.allPermissions.map(p => p.module || 'Uncategorized')))
      .sort((a, b) => {
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
}

