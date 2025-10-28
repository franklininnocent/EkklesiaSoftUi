import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { AppState } from '@core/store';
import { User } from '@core/models';
import { selectCurrentUser } from '@core/store/auth/auth.selectors';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent implements OnInit {
  currentUser$: Observable<User | null>;
  
  settingsSections = [
    { title: 'Profile Settings', description: 'Manage your personal information', icon: '👤', route: null },
    { title: 'Security', description: 'Password and authentication settings', icon: '🔒', route: null },
    { title: 'Notifications', description: 'Configure notification preferences', icon: '🔔', route: null },
    { title: 'Billing', description: 'Manage subscription and payment methods', icon: '💳', route: null },
    { title: 'Teams', description: 'Manage team members and roles', icon: '👥', route: null },
    { title: 'Integrations', description: 'Connect third-party services', icon: '🔗', route: null },
    { 
      title: 'Roles & Permissions', 
      description: 'Manage user roles and permissions', 
      icon: '🛡️', 
      route: '/settings/roles-permissions',
      requiresRoleManagement: true
    },
    { 
      title: 'Ecclesiastical Data', 
      description: 'Manage dioceses, bishops, and church hierarchy', 
      icon: '⛪', 
      route: '/settings/ecclesiastical',
      requiresEkklesiaRole: true
    }
  ];

  constructor(
    private router: Router,
    private store: Store<AppState>
  ) {
    this.currentUser$ = this.store.select(selectCurrentUser);
  }

  ngOnInit(): void {}

  onConfigure(section: any): void {
    if (section.route) {
      this.router.navigate([section.route]);
    } else {
      console.log(`Configure ${section.title} - Coming soon!`);
    }
  }

  /**
   * Check if the current user can manage roles and permissions.
   */
  canManageRoles(user: User | null): boolean {
    if (!user) return false;
    
    // SuperAdmins and EkklesiaAdmins can always manage roles
    if (user.role_name === 'SuperAdmin' || user.role_name === 'EkklesiaAdmin' || user.role_name === 'EkklesiaManager') {
      return true;
    }
    
    // Fallback: Check by role object
    if (user.role?.name === 'SuperAdmin' || user.role?.name === 'EkklesiaAdmin' || user.role?.name === 'EkklesiaManager') {
      return true;
    }
    
    // Tenant Administrators can also manage roles for their tenant
    if (user.role_name === 'Administrator' && user.tenant_id) {
      return true;
    }
    
    return false;
  }

  /**
   * Check if the current user has an Ekklesia role.
   * Only Ekklesia users (SuperAdmin, EkklesiaAdmin, EkklesiaManager, EkklesiaUser) can access Ecclesiastical Data.
   */
  hasEkklesiaRole(user: User | null): boolean {
    if (!user) return false;
    
    // Primary check: Use the backend-provided flag
    if (user.has_ekklesia_role !== undefined) {
      return user.has_ekklesia_role;
    }
    
    // Fallback: Check by role name
    const ekklesiaRoles = ['SuperAdmin', 'EkklesiaAdmin', 'EkklesiaManager', 'EkklesiaUser'];
    if (user.role_name && ekklesiaRoles.includes(user.role_name)) {
      return true;
    }
    
    // Fallback: Check by role object
    if (user.role?.name && ekklesiaRoles.includes(user.role.name)) {
      return true;
    }
    
    return false;
  }

  /**
   * Check if a section should be displayed based on user permissions.
   */
  shouldDisplaySection(section: any, user: User | null): boolean {
    if (section.requiresEkklesiaRole) {
      return this.hasEkklesiaRole(user);
    }
    if (section.requiresRoleManagement) {
      return this.canManageRoles(user);
    }
    return true;
  }
}

