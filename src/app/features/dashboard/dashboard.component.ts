import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';

import { CardComponent } from '@shared/components';
import { AppState } from '@core/store';
import { User } from '@core/models';
import { selectCurrentUser } from '@core/store/auth/auth.selectors';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, CardComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
  private store = inject(Store<AppState>);
  currentUser$: Observable<User | null>;
  today = new Date();

  stats = [
    { title: 'Total Users', value: '1,234', change: '+12%', icon: '👥', trend: 'up' },
    { title: 'Active Sessions', value: '456', change: '+5%', icon: '📊', trend: 'up' },
    { title: 'Revenue', value: '$12,345', change: '+18%', icon: '💰', trend: 'up' },
    { title: 'New Signups', value: '89', change: '+23%', icon: '🎯', trend: 'up' }
  ];

  recentActivities = [
    { icon: '✅', title: 'User Registration', description: 'John Doe registered', time: '2 minutes ago', type: 'success' },
    { icon: '📝', title: 'Profile Updated', description: 'Jane Smith updated profile', time: '15 minutes ago', type: 'info' },
    { icon: '🔔', title: 'New Comment', description: 'Mike Johnson commented', time: '1 hour ago', type: 'info' },
    { icon: '⚠️', title: 'System Alert', description: 'Low disk space warning', time: '2 hours ago', type: 'warning' },
    { icon: '💡', title: 'Feature Request', description: 'New feature suggested', time: '3 hours ago', type: 'success' }
  ];

  quickActions = [
    { icon: '➕', label: 'Add User', action: 'addUser', color: 'primary' },
    { icon: '📊', label: 'View Reports', action: 'viewReports', color: 'secondary' },
    { icon: '⚙️', label: 'Settings', action: 'settings', color: 'info' },
    { icon: '📧', label: 'Send Email', action: 'sendEmail', color: 'success' }
  ];

  constructor() {
    this.currentUser$ = this.store.select(selectCurrentUser);
  }

  handleAction(action: string): void {
    console.log(`Action triggered: ${action}`);
    // Implement action handlers here
  }
}

