import { Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable, Subject } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';
import { AppState } from '@core/store';
import { User } from '@core/models';
import { selectCurrentUser } from '@core/store/auth/auth.selectors';
import { AuthService } from '@core/services';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();
  currentUser$: Observable<User | null>;
  visibleSections$: Observable<any[]>;
  
  settingsSections = [
    { title: 'Profile Settings', description: 'Manage your personal information', icon: 'user', route: null },
    { title: 'Security', description: 'Password and authentication settings', icon: 'lock', route: null },
    { title: 'Notifications', description: 'Configure notification preferences', icon: 'bell', route: null },
    { title: 'Billing', description: 'Manage subscription and payment methods', icon: 'credit-card', route: null },
    { title: 'Teams', description: 'Manage team members and roles', icon: 'users', route: null },
    { title: 'Integrations', description: 'Connect third-party services', icon: 'link', route: null },
    { 
      title: 'Tenants', 
      description: 'Manage tenant organizations and subscriptions', 
      icon: 'building', 
      route: '/tenants',
      requiresSuperAdmin: true
    },
    { 
      title: 'Roles & Permissions', 
      description: 'Manage user roles and permissions', 
      icon: 'shield', 
      route: '/settings/roles-permissions',
      requiresRoleManagement: true
    },
    { 
      title: 'Ecclesiastical Data',
      description: 'Manage dioceses, bishops, and church hierarchy', 
      icon: 'church', 
      route: '/settings/ecclesiastical',
      requiresEkklesiaRole: true
    },
    { 
      title: 'Pope Details', 
      description: 'Manage Pope image and details for General Information', 
      icon: 'crown', 
      route: '/settings/pope',
      requiresSuperAdmin: true // CRITICAL SECURITY: Pope Details is SuperAdmin only
    },
    { 
      title: 'Sacrament Types', 
      description: 'Manage sacrament types master data', 
      icon: 'cross', 
      route: '/settings/ecclesiastical/sacrament-types',
      requiresEkklesiaRole: true
    },
    { 
      title: 'Sacraments', 
      description: 'Manage baptisms, confirmations, marriages, and all sacraments', 
      icon: 'file', 
      route: '/settings/sacraments',
      requiresTenantAccess: true
    },
    { 
      title: 'Priests', 
      description: 'Manage church leadership, priests, and pastoral staff', 
      icon: 'church', 
      route: '/church-profile',
      requiresTenantAccess: true,
      queryParams: { tab: 'leadership' }
    }
  ];

  constructor(
    private router: Router,
    private store: Store<AppState>
  ) {
    this.currentUser$ = this.store.select(selectCurrentUser);
    this.visibleSections$ = this.currentUser$.pipe(
      map(user => this.getVisibleSections(user)),
      takeUntil(this.destroy$)
    );
  }

  ngOnInit(): void {
    this.visibleSections$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Get SVG icon HTML for a given icon type
   */
  getIconSvg(iconType: string): string {
    const icons: { [key: string]: string } = {
      'user': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="24" height="24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
      'lock': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="24" height="24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>',
      'bell': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="24" height="24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>',
      'credit-card': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="24" height="24"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>',
      'users': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="24" height="24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
      'link': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="24" height="24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>',
      'building': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="24" height="24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line></svg>',
      'shield': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="24" height="24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>',
      'church': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="24" height="24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>',
      'crown': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="24" height="24"><path d="M5 15l-1-4 4-1 1-4 3 3 3-3 1 4 4 1-4 1-1 4-3-3-3 3z"></path><path d="M12 3v18"></path></svg>',
      'cross': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="24" height="24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>',
      'file': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="24" height="24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>',
      'settings': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="24" height="24"><circle cx="12" cy="12" r="3"></circle><path d="M12 1v6m0 6v6m0-13a2 2 0 0 1 2 2m0 0a2 2 0 0 1-2 2m0-4a2 2 0 0 0-2 2m0 0a2 2 0 0 0 2 2m-5.5 5.5l5.5-5.5m0 0l5.5 5.5M1 12h6m6 0h6"></path></svg>'
    };
    return icons[iconType] || icons['settings'];
  }

  onConfigure(section: any): void {
    if (section.route) {
      const navigationExtras = section.queryParams ? { queryParams: section.queryParams } : {};
      this.router.navigate([section.route], navigationExtras);
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

