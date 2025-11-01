import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardComponent, PaginationComponent } from '@shared/components';
import { SortableDirective, SortEvent } from '@shared/directives/sortable.directive';
import { UsersService } from '@core/services/users.service';
import { ToastService } from '@core/services/toast.service';
import { User } from '@core/models';
import { UserFormModalComponent } from './user-form-modal/user-form-modal.component';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, CardComponent, PaginationComponent, SortableDirective, UserFormModalComponent],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss'
})
export class UsersComponent implements OnInit {
  allUsers: User[] = [];
  users: User[] = [];
  loading = false;
  error: string | null = null;
  totalUsers = 0;
  activeUsers = 0;
  inactiveUsers = 0;
  
  // Modal state
  showUserModal = false;
  selectedUser: User | null = null;

  // Pagination state
  currentPage: number = 1;
  pageSize: number = 20;
  pageSizeOptions: number[] = [10, 20, 50, 100];

  // Sorting state
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' | null = null;

  constructor(
    private usersService: UsersService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadUsers();
    this.loadStatistics();
  }

  loadUsers(): void {
    this.loading = true;
    this.error = null;

    this.usersService.getUsers({ per_page: 'all' }).subscribe({
      next: (response) => {
        if (response.success) {
          this.allUsers = response.data;
          this.totalUsers = response.pagination?.total || response.meta?.total || response.data.length;
          this.applyFilters();
        } else {
          this.error = response.message || 'Failed to load users';
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading users:', err);
        this.error = err.error?.message || 'Failed to load users';
        this.loading = false;
      }
    });
  }

  applyFilters(): void {
    let filtered = [...this.allUsers];

    // Apply sorting
    if (this.sortColumn && this.sortDirection) {
      filtered = this.applySorting(filtered, this.sortColumn, this.sortDirection);
    }

    // Apply pagination
    this.users = this.applyPagination(filtered, this.currentPage, this.pageSize);
  }

  loadStatistics(): void {
    this.usersService.getStatistics().subscribe({
      next: (response) => {
        if (response.success) {
          this.totalUsers = response.data.total;
          this.activeUsers = response.data.active;
          this.inactiveUsers = response.data.inactive;
        }
      },
      error: (err) => {
        console.error('Error loading statistics:', err);
      }
    });
  }

  toggleUserStatus(user: User): void {
    const newStatus = user.active === 1 ? 0 : 1;
    
    // Prevent deactivation of primary admin
    if (user.is_primary_admin && newStatus === 0) {
      this.toastService.error('The primary admin account cannot be deactivated. This account is essential for maintaining tenant administrative continuity.', 'Cannot Deactivate', 6000);
      return;
    }
    
    this.usersService.updateStatus(user.id, newStatus).subscribe({
      next: (response) => {
        if (response.success) {
          this.toastService.success(`User ${newStatus === 1 ? 'activated' : 'deactivated'} successfully`, 'Success', 4000);
          // Reload users to get fresh data from server
          this.loadUsers();
          this.loadStatistics();
        } else {
          this.toastService.error(response.message || 'Failed to update user status', 'Error', 5000);
        }
      },
      error: (err) => {
        console.error('Error updating user status:', err);
        this.toastService.error(err.error?.message || 'Failed to update user status', 'Error', 6000);
      }
    });
  }

  // Pagination event handlers
  onPageChange(page: number): void {
    this.currentPage = page;
    this.applyFilters();
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.currentPage = 1; // Reset to first page
    this.applyFilters();
  }

  // Sorting event handler
  onSort(event: SortEvent): void {
    this.sortColumn = event.column;
    this.sortDirection = event.direction;
    this.applyFilters();
  }

  // Helper methods for sorting and pagination
  private applySorting(data: User[], column: string, direction: 'asc' | 'desc'): User[] {
    return [...data].sort((a, b) => {
      const aValue = this.getNestedValue(a, column);
      const bValue = this.getNestedValue(b, column);
      return this.compare(aValue, bValue, direction);
    });
  }

  private applyPagination(data: User[], page: number, pageSize: number): User[] {
    const startIndex = (page - 1) * pageSize;
    return data.slice(startIndex, startIndex + pageSize);
  }

  private getNestedValue(obj: any, path: string): any {
    if (path === 'role') {
      return this.getRoleName(obj);
    }
    return path.split('.').reduce((current, prop) => current?.[prop], obj);
  }

  private compare(a: any, b: any, direction: 'asc' | 'desc'): number {
    if (a === null || a === undefined) return direction === 'asc' ? 1 : -1;
    if (b === null || b === undefined) return direction === 'asc' ? -1 : 1;

    const aValue = typeof a === 'string' ? a.toLowerCase() : a;
    const bValue = typeof b === 'string' ? b.toLowerCase() : b;

    if (aValue < bValue) return direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return direction === 'asc' ? 1 : -1;
    return 0;
  }

  /**
   * Get role name for single role (legacy support)
   * @deprecated Use getRoles() for multi-role support
   */
  getRoleName(user: User): string {
    return user.role?.name || user.role_name || 'N/A';
  }

  /**
   * Get all roles for a user (multi-role support)
   * Returns an array of role names
   */
  getRoles(user: User): string[] {
    if (user.roles && user.roles.length > 0) {
      return user.roles.map(role => role.name);
    }
    // Fallback to legacy single role
    if (user.role?.name) {
      return [user.role.name];
    }
    if (user.role_name) {
      return [user.role_name];
    }
    return ['No Role'];
  }

  /**
   * Get role count for a user
   */
  getRoleCount(user: User): number {
    return user.roles?.length || 0;
  }

  /**
   * Check if user has multiple roles
   */
  hasMultipleRoles(user: User): boolean {
    return (user.roles?.length || 0) > 1;
  }

  getStatusText(user: User): string {
    return user.active === 1 ? 'Active' : 'Inactive';
  }

  // Modal handlers
  openCreateUserModal(): void {
    this.selectedUser = null;
    this.showUserModal = true;
  }

  openEditUserModal(user: User): void {
    this.selectedUser = user;
    this.showUserModal = true;
  }

  closeUserModal(): void {
    this.showUserModal = false;
    this.selectedUser = null;
  }

  onUserSaved(user: User): void {
    // Reload the users list to reflect changes
    this.loadUsers();
    this.loadStatistics();
    this.closeUserModal();
  }
}

