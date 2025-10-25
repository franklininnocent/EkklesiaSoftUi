import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Role, Permission } from '@core/models';
import { RolesService } from '@core/services/roles.service';
import { PermissionsService } from '@core/services/permissions.service';
import { CardComponent } from '@shared/components';
import { RoleFormModalComponent } from './role-form-modal/role-form-modal.component';

@Component({
  selector: 'app-roles-permissions',
  standalone: true,
  imports: [CommonModule, FormsModule, CardComponent, RoleFormModalComponent],
  templateUrl: './roles-permissions.component.html',
  styleUrl: './roles-permissions.component.scss'
})
export class RolesPermissionsComponent implements OnInit {
  activeTab: 'roles' | 'permissions' | 'assign' = 'roles';
  
  // Roles data
  roles: Role[] = [];
  loadingRoles = false;
  rolesError: string | null = null;
  totalRoles = 0;
  
  // Permissions data
  permissions: Permission[] = [];
  loadingPermissions = false;
  permissionsError: string | null = null;
  totalPermissions = 0;
  
  // Filters
  searchQuery = '';
  statusFilter: 'all' | 'active' | 'inactive' = 'all';
  typeFilter: 'all' | 'system' | 'custom' = 'all';
  moduleFilter = '';
  
  // Modals
  showCreateRoleModal = false;
  showEditRoleModal = false;
  showCreatePermissionModal = false;
  showEditPermissionModal = false;
  showAssignPermissionsModal = false;
  
  selectedRole: Role | null = null;
  selectedPermission: Permission | null = null;

  constructor(
    private rolesService: RolesService,
    private permissionsService: PermissionsService,
    public cdr: ChangeDetectorRef  // Changed to public for template access
  ) {}

  ngOnInit(): void {
    this.loadRoles();
    this.loadPermissions();
  }

  // Tab Management
  selectTab(tab: 'roles' | 'permissions' | 'assign'): void {
    this.activeTab = tab;
  }

  isActiveTab(tab: 'roles' | 'permissions' | 'assign'): boolean {
    return this.activeTab === tab;
  }

  // Roles Management
  loadRoles(): void {
    this.loadingRoles = true;
    this.rolesError = null;

    const params: any = { per_page: 'all' };
    
    if (this.statusFilter !== 'all') {
      params.active = this.statusFilter === 'active' ? 1 : 0;
    }
    
    if (this.typeFilter !== 'all') {
      params.is_custom = this.typeFilter === 'custom';
    }
    
    if (this.searchQuery) {
      params.search = this.searchQuery;
    }

    this.rolesService.getRoles(params).subscribe({
      next: (response) => {
        this.roles = Array.isArray(response) ? response : response.data;
        this.totalRoles = Array.isArray(response) ? response.length : response.total;
        this.loadingRoles = false;
      },
      error: (err) => {
        console.error('Error loading roles:', err);
        this.rolesError = err.error?.message || 'Failed to load roles';
        this.loadingRoles = false;
      }
    });
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
      alert(`Role "${role.name}" created successfully!`);
    } else if (this.showEditRoleModal) {
      console.log(`✅ Role "${role.name}" updated successfully!`);
      alert(`Role "${role.name}" updated successfully!`);
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
        alert(`Role "${role.name}" deleted successfully`);
        this.loadRoles();
      },
      error: (err) => {
        console.error('Error deleting role:', err);
        alert(err.error?.message || 'Failed to delete role');
      }
    });
  }

  toggleRoleStatus(role: Role): void {
    const newStatus = role.active === 1 ? 0 : 1;
    const statusText = newStatus === 1 ? 'activated' : 'deactivated';
    
    this.rolesService.toggleRoleStatus(role.id, newStatus === 1).subscribe({
      next: () => {
        role.active = newStatus;
        console.log(`✅ Role "${role.name}" ${statusText} successfully`);
      },
      error: (err) => {
        console.error('Error toggling role status:', err);
        alert(err.error?.message || 'Failed to update role status');
      }
    });
  }

  // Permissions Management
  loadPermissions(): void {
    this.loadingPermissions = true;
    this.permissionsError = null;

    const params: any = { per_page: 'all' };
    
    if (this.statusFilter !== 'all') {
      params.active = this.statusFilter === 'active' ? 1 : 0;
    }
    
    if (this.typeFilter !== 'all') {
      params.is_custom = this.typeFilter === 'custom';
    }
    
    if (this.moduleFilter) {
      params.module = this.moduleFilter;
    }
    
    if (this.searchQuery) {
      params.search = this.searchQuery;
    }

    this.permissionsService.getPermissions(params).subscribe({
      next: (response) => {
        this.permissions = Array.isArray(response) ? response : response.data;
        this.totalPermissions = Array.isArray(response) ? response.length : response.total;
        this.loadingPermissions = false;
      },
      error: (err) => {
        console.error('Error loading permissions:', err);
        this.permissionsError = err.error?.message || 'Failed to load permissions';
        this.loadingPermissions = false;
      }
    });
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
        alert(`Permission "${permission.display_name}" deleted successfully`);
        this.loadPermissions();
      },
      error: (err) => {
        console.error('Error deleting permission:', err);
        alert(err.error?.message || 'Failed to delete permission');
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

  // Filters
  onSearchChange(): void {
    if (this.activeTab === 'roles') {
      this.loadRoles();
    } else if (this.activeTab === 'permissions') {
      this.loadPermissions();
    }
  }

  onStatusFilterChange(): void {
    if (this.activeTab === 'roles') {
      this.loadRoles();
    } else if (this.activeTab === 'permissions') {
      this.loadPermissions();
    }
  }

  onTypeFilterChange(): void {
    if (this.activeTab === 'roles') {
      this.loadRoles();
    } else if (this.activeTab === 'permissions') {
      this.loadPermissions();
    }
  }

  onModuleFilterChange(): void {
    if (this.activeTab === 'permissions') {
      this.loadPermissions();
    }
  }

  resetFilters(): void {
    this.searchQuery = '';
    this.statusFilter = 'all';
    this.typeFilter = 'all';
    this.moduleFilter = '';
    
    if (this.activeTab === 'roles') {
      this.loadRoles();
    } else if (this.activeTab === 'permissions') {
      this.loadPermissions();
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
}

