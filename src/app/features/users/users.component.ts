import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PaginationComponent } from '@shared/components';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { ListToolbarComponent } from '@shared/components/list-toolbar/list-toolbar.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { StatusBadgeComponent, StatusBadgeTone } from '@shared/components/status-badge/status-badge.component';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { SortableDirective, SortEvent } from '@shared/directives/sortable.directive';
import { UsersService } from '@core/services/users.service';
import { ToastService } from '@core/services/toast.service';
import { AuthService } from '@core/services/auth.service';
import { User } from '@core/models';
import { UserFormModalComponent } from './user-form-modal/user-form-modal.component';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    CommonModule,
    PaginationComponent,
    SortableDirective,
    UserFormModalComponent,
    PageHeaderComponent,
    ListToolbarComponent,
    DataTableComponent,
    StatusBadgeComponent,
    CfEmptyStateComponent,
    LoadingSkeletonComponent,
  ],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UsersComponent implements OnInit, OnDestroy {
  allUsers: User[] = [];
  users: User[] = [];
  loading = false;
  error: string | null = null;
  totalUsers = 0;
  activeUsers = 0;
  inactiveUsers = 0;
  filteredTotal = 0;
  search = '';

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

  private destroy$ = new Subject<void>();
  private cdr = inject(ChangeDetectorRef);

  constructor(
    private usersService: UsersService,
    private toastService: ToastService,
    private authService: AuthService
  ) {}

  get isTenantAdmin(): boolean {
    return this.authService.isTenantAdmin();
  }

  get hasActiveSearch(): boolean {
    return this.search.trim().length > 0;
  }

  ngOnInit(): void {
    this.loadUsers();
    this.loadStatistics();
  }

  loadUsers(): void {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    this.usersService.getUsers({ per_page: 'all' })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.allUsers = response.data;
            this.totalUsers = response.pagination?.total || response.meta?.total || response.data.length;
            this.applyFilters();
          } else {
            this.error = response.message || 'Failed to load users';
          }
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error loading users:', err);
          this.error = err.error?.message || 'Failed to load users';
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  onSearchChange(value: string): void {
    this.search = value ?? '';
    this.currentPage = 1;
    this.applyFilters();
    this.cdr.markForCheck();
  }

  applyFilters(): void {
    let filtered = [...this.allUsers];

    const query = this.search.trim().toLowerCase();
    if (query) {
      filtered = filtered.filter((user) => {
        const name = (user.name || '').toLowerCase();
        const email = (user.email || '').toLowerCase();
        const contact = (user.contact_number || '').toLowerCase();
        return name.includes(query) || email.includes(query) || contact.includes(query);
      });
    }

    if (this.sortColumn && this.sortDirection) {
      filtered = this.applySorting(filtered, this.sortColumn, this.sortDirection);
    }

    this.filteredTotal = filtered.length;
    this.users = this.applyPagination(filtered, this.currentPage, this.pageSize);
  }

  loadStatistics(): void {
    this.usersService.getStatistics()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.totalUsers = response.data.total;
            this.activeUsers = response.data.active;
            this.inactiveUsers = response.data.inactive;
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error loading statistics:', err);
          this.cdr.markForCheck();
        }
      });
  }

  toggleUserStatus(user: User): void {
    const newStatus = user.active === 1 ? 0 : 1;

    if (user.is_primary_admin && newStatus === 0) {
      this.toastService.error('The primary admin account cannot be deactivated. This account is essential for maintaining tenant administrative continuity.', 'Cannot Deactivate', 6000);
      return;
    }

    this.usersService.updateStatus(user.id, newStatus)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.toastService.success(`User ${newStatus === 1 ? 'activated' : 'deactivated'} successfully`, 'Success', 4000);
            this.loadUsers();
            this.loadStatistics();
          } else {
            this.toastService.error(response.message || 'Failed to update user status', 'Error', 5000);
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error updating user status:', err);
          this.toastService.error(err.error?.message || 'Failed to update user status', 'Error', 6000);
          this.cdr.markForCheck();
        }
      });
  }

  deleteUser(user: User): void {
    if (!this.isTenantAdmin) {
      this.toastService.error('Only Tenant Administrators can delete users.', 'Permission Denied', 5000);
      return;
    }

    if (user.is_primary_admin) {
      this.toastService.error('The primary admin account cannot be deleted. This account is essential for maintaining tenant administrative continuity.', 'Cannot Delete', 6000);
      return;
    }

    const currentUser = this.authService.currentUserValue;
    if (currentUser && user.id === currentUser.id) {
      this.toastService.error('You cannot delete your own account.', 'Cannot Delete', 5000);
      return;
    }

    const userName = user.name || user.email || 'this user';
    if (!confirm(`Are you sure you want to delete ${userName}? This action cannot be undone.`)) {
      return;
    }

    this.loading = true;
    this.cdr.markForCheck();

    this.usersService.deleteUser(user.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.toastService.success('User deleted successfully', 'Success', 4000);
            this.loadUsers();
            this.loadStatistics();
          } else {
            this.toastService.error(response.message || 'Failed to delete user', 'Error', 5000);
          }
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error deleting user:', err);
          this.toastService.error(err.error?.message || 'Failed to delete user', 'Error', 6000);
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.applyFilters();
    this.cdr.markForCheck();
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.currentPage = 1;
    this.applyFilters();
    this.cdr.markForCheck();
  }

  onSort(event: SortEvent): void {
    this.sortColumn = event.column;
    this.sortDirection = event.direction;
    this.applyFilters();
    this.cdr.markForCheck();
  }

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

  getRoleName(user: User): string {
    return user.role?.name || user.role_name || 'N/A';
  }

  getRoles(user: User): string[] {
    if (user.roles && user.roles.length > 0) {
      return user.roles.map(role => role.name);
    }
    if (user.role?.name) {
      return [user.role.name];
    }
    if (user.role_name) {
      return [user.role_name];
    }
    return ['No Role'];
  }

  roleTone(index: number, role: string): StatusBadgeTone {
    if (role === 'No Role') {
      return 'neutral';
    }
    return index === 0 ? 'info' : 'neutral';
  }

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

  onUserSaved(_user: User): void {
    this.loadUsers();
    this.loadStatistics();
    this.closeUserModal();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
