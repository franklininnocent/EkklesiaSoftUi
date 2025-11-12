import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AppState } from '@core/store';
import { User } from '@core/models';
import { selectCurrentUser } from '@core/store/auth/auth.selectors';
import { AuthService } from '@core/services';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent implements OnInit {
  private authService = inject(AuthService);
  currentUser$: Observable<User | null>;
  visibleSections$: Observable<any[]>;
  
  settingsSections = [
    { title: 'Profile Settings', description: 'Manage your personal information', icon: '👤', route: null },
    { title: 'Security', description: 'Password and authentication settings', icon: '🔒', route: null },
    { title: 'Notifications', description: 'Configure notification preferences', icon: '🔔', route: null },
    { title: 'Billing', description: 'Manage subscription and payment methods', icon: '💳', route: null },
    { title: 'Teams', description: 'Manage team members and roles', icon: '👥', route: null },
    { title: 'Integrations', description: 'Connect third-party services', icon: '🔗', route: null },
    { 
      title: 'Tenants', 
      description: 'Manage tenant organizations and subscriptions', 
      icon: '🏢', 
      route: '/tenants',
      requiresSuperAdmin: true
    },
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
    },
    { 
      title: 'Pope Details', 
      description: 'Manage Pope image and details for General Information', 
      icon: '👑', 
      route: '/settings/pope',
      requiresSuperAdmin: true // CRITICAL SECURITY: Pope Details is SuperAdmin only
    },
    { 
      title: 'Sacrament Types', 
      description: 'Manage sacrament types master data', 
      icon: '✝️', 
      route: '/settings/ecclesiastical/sacrament-types',
      requiresEkklesiaRole: true
    },
    { 
      title: 'Sacraments', 
      description: 'Manage baptisms, confirmations, marriages, and all sacraments', 
      icon: '📋', 
      route: '/settings/sacraments',
      requiresTenantAccess: true
    }
  ];

  constructor(
    private router: Router,
    private store: Store<AppState>
  ) {
    this.currentUser$ = this.store.select(selectCurrentUser);
    this.visibleSections$ = this.currentUser$.pipe(
      map(user => this.getVisibleSections(user))
    );
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
   * Check if the current user is a SuperAdmin.
   * Only SuperAdmin and EkklesiaAdmin can access tenant management.
   */
  isSuperAdmin(user: User | null): boolean {
    if (!user) return false;
    
    // Primary check: Use the backend-provided flag (this is the most reliable)
    if (user.is_admin === true) {
      return true;
    }
    
    // Also check specifically for SuperAdmin flag
    if (user.is_super_admin === true) {
      return true;
    }
    
    // Fallback: Check if user is SuperAdmin or EkklesiaAdmin by role name
    if (user.role_name === 'SuperAdmin' || user.role_name === 'EkklesiaAdmin') {
      return true;
    }
    
    // Fallback: Check by role object
    if (user.role?.name === 'SuperAdmin' || user.role?.name === 'EkklesiaAdmin') {
      return true;
    }
    
    return false;
  }

  /**
   * Check if the current user has an Ekklesia role.
   * Only Ekklesia users (SuperAdmin, EkklesiaAdmin, EkklesiaManager, EkklesiaUser) can access Ecclesiastical Data.
   * 
   * IMPORTANT: Users with tenant_id are TENANT users and should NEVER have access to Ekklesia features.
   */
  hasEkklesiaRole(user: User | null): boolean {
    if (!user) return false;
    
    // CRITICAL CHECK: If user has a tenant_id, they are a TENANT user, NOT an Ekklesia user
    // Tenant users should NEVER have access to Ecclesiastical Data or Sacrament Types
    if (user.tenant_id !== null && user.tenant_id !== undefined) {
      return false;
    }
    
    // Primary check: Use the backend-provided flag (this is the most reliable)
    if (user.has_ekklesia_role === true) {
      return true;
    }
    
    // If has_ekklesia_role is explicitly false, return false immediately
    if (user.has_ekklesia_role === false) {
      return false;
    }
    
    // Fallback: Check by role name (only if has_ekklesia_role is undefined)
    const ekklesiaRoles = ['SuperAdmin', 'EkklesiaAdmin', 'EkklesiaManager', 'EkklesiaUser'];
    if (user.role_name && ekklesiaRoles.includes(user.role_name)) {
      return true;
    }
    
    // Fallback: Check by role object
    if (user.role?.name && ekklesiaRoles.includes(user.role.name)) {
      return true;
    }
    
    // Default to false for safety - tenant users should NOT have access
    return false;
  }

  /**
   * Check if a section should be displayed based on user permissions.
   */
  shouldDisplaySection(section: any, user: User | null): boolean {
    if (section.requiresSuperAdmin) {
      return this.isSuperAdmin(user);
    }
    if (section.requiresEkklesiaRole) {
      return this.hasEkklesiaRole(user);
    }
    if (section.requiresRoleManagement) {
      return this.canManageRoles(user);
    }
    if (section.requiresTenantAccess) {
      // ONLY Tenant users (NOT Ekklesia users) can access Sacraments
      // Must have tenant_id AND must NOT have Ekklesia role
      return user !== null && user.tenant_id !== null && !this.hasEkklesiaRole(user);
    }
    if (section.requiresPermission) {
      return this.authService.hasPermission(section.requiresPermission);
    }
    return true;
  }

  /**
   * Get all visible sections for the current user
   */
  getVisibleSections(user: User | null): any[] {
    return this.settingsSections.filter(section => this.shouldDisplaySection(section, user));
  }
}

