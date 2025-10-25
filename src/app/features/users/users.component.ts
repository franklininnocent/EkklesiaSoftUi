import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardComponent, ButtonComponent } from '@shared/components';
import { UsersService } from '@core/services/users.service';
import { User } from '@core/models';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, CardComponent, ButtonComponent],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss'
})
export class UsersComponent implements OnInit {
  users: User[] = [];
  loading = false;
  error: string | null = null;
  totalUsers = 0;
  activeUsers = 0;
  inactiveUsers = 0;

  constructor(private usersService: UsersService) {}

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
          this.users = response.data;
          this.totalUsers = response.total || response.data.length;
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
    
    this.usersService.updateStatus(user.id, newStatus).subscribe({
      next: (response) => {
        if (response.success) {
          user.active = newStatus;
          this.loadStatistics(); // Refresh stats
        } else {
          alert(response.message || 'Failed to update user status');
        }
      },
      error: (err) => {
        console.error('Error updating user status:', err);
        alert(err.error?.message || 'Failed to update user status');
      }
    });
  }

  getRoleName(user: User): string {
    return user.role?.name || user.role_name || 'N/A';
  }

  getStatusText(user: User): string {
    return user.active === 1 ? 'Active' : 'Inactive';
  }
}

