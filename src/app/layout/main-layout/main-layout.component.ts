import { Component, inject, OnInit, OnDestroy, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { trigger, transition, style, animate } from '@angular/animations';

import { AppState } from '@core/store';
import { User, Tenant } from '@core/models';
import { selectCurrentUser } from '@core/store/auth/auth.selectors';
import { selectCurrentTenant } from '@core/store/tenant/tenant.selectors';
import * as AuthActions from '@core/store/auth/auth.actions';
import { AuthService } from '@core/services/auth.service';
import { ThemeService, FontSize, FontSizeConfig } from '@core/services/theme.service';
import { BreadcrumbComponent } from '@shared/components/breadcrumb/breadcrumb';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, BreadcrumbComponent],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
  animations: [
    trigger('slideIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.9) translateY(10px)' }),
        animate('300ms cubic-bezier(0.16, 1, 0.3, 1)', style({ opacity: 1, transform: 'scale(1) translateY(0)' }))
      ]),
      transition(':leave', [
        animate('200ms cubic-bezier(0.4, 0, 1, 1)', style({ opacity: 0, transform: 'scale(0.9) translateY(10px)' }))
      ])
    ]),
    trigger('slideDown', [
      transition(':enter', [
        style({ height: 0, opacity: 0, overflow: 'hidden' }),
        animate('300ms cubic-bezier(0.16, 1, 0.3, 1)', style({ height: '*', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('200ms cubic-bezier(0.4, 0, 1, 1)', style({ height: 0, opacity: 0, overflow: 'hidden' }))
      ])
    ])
  ]
})
export class MainLayoutComponent implements OnInit {
  private store = inject(Store<AppState>);
  private router = inject(Router);
  private authService = inject(AuthService);
  private elementRef = inject(ElementRef);
  public themeService = inject(ThemeService);

  currentUser$: Observable<User | null>;
  currentTenant$: Observable<Tenant | null>;
  isSidebarCollapsed = false;
  isUserMenuOpen = false;
  isUserMenuClosing = false;
  currentYear = new Date().getFullYear();
  
  // Theme settings panel
  isThemePanelOpen = false;
  currentFontSize$: Observable<FontSize>;
  fontSizeOptions: FontSizeConfig[];

  constructor() {
    this.currentUser$ = this.store.select(selectCurrentUser);
    this.currentTenant$ = this.store.select(selectCurrentTenant);
    this.currentFontSize$ = this.themeService.fontSize$;
    this.fontSizeOptions = this.themeService.fontSizeOptions;
  }

  ngOnInit(): void {
    // Load user data if authenticated but user is not in store (e.g., after page refresh)
    this.currentUser$.pipe(take(1)).subscribe(user => {
      if (!user && this.authService.isAuthenticated()) {
        // User is authenticated but not loaded in store, dispatch loadUser action
        this.store.dispatch(AuthActions.loadUser());
      }
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    // Close user menu when clicking outside
    if (this.isUserMenuOpen && !this.isUserMenuClosing) {
      const clickedInside = this.elementRef.nativeElement.querySelector('.user-dropdown')?.contains(event.target);
      if (!clickedInside) {
        this.closeUserMenu();
      }
    }

    // Close theme panel when clicking outside
    if (this.isThemePanelOpen) {
      const themeFab = this.elementRef.nativeElement.querySelector('.theme-settings-fab');
      const clickedInsideThemeFab = themeFab?.contains(event.target);
      if (!clickedInsideThemeFab) {
        this.isThemePanelOpen = false;
      }
    }
  }

  toggleSidebar(): void {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }

  toggleUserMenu(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    
    if (this.isUserMenuOpen) {
      this.closeUserMenu();
    } else {
      this.isUserMenuOpen = true;
      this.isUserMenuClosing = false;
    }
  }

  closeUserMenu(): void {
    if (this.isUserMenuClosing) return;
    
    this.isUserMenuClosing = true;
    
    // Wait for animation to complete before hiding
    setTimeout(() => {
      this.isUserMenuOpen = false;
      this.isUserMenuClosing = false;
    }, 300); // Match animation duration
  }

  getInitials(name: string): string {
    if (!name) return '?';
    
    const parts = name.trim().split(' ');
    if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase();
    }
    
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  navigateToProfile(): void {
    this.closeUserMenu();
    setTimeout(() => {
      this.router.navigate(['/profile']);
    }, 100);
  }

  logout(): void {
    this.closeUserMenu();
    setTimeout(() => {
      this.store.dispatch(AuthActions.logout());
    }, 100);
  }

  // Theme Panel Methods
  toggleThemePanel(): void {
    this.isThemePanelOpen = !this.isThemePanelOpen;
  }

  closeThemePanel(): void {
    this.isThemePanelOpen = false;
  }

  selectFontSize(size: FontSize): void {
    this.themeService.setFontSize(size);
    // Optionally close the panel after selection
    // this.isThemePanelOpen = false;
  }

  isCurrentFontSize(size: FontSize): boolean {
    return this.themeService.getCurrentFontSize() === size;
  }

  /**
   * Check if the current user can manage tenants.
   * Only SuperAdmin and EkklesiaAdmin can see the Tenants menu.
   */
  canManageTenants(user: User | null): boolean {
    if (!user) return false;
    
    // Check by role name (primary method)
    if (user.role_name === 'SuperAdmin' || user.role_name === 'EkklesiaAdmin') {
      return true;
    }
    
    // Fallback: Check by role object
    if (user.role?.name === 'SuperAdmin' || user.role?.name === 'EkklesiaAdmin') {
      return true;
    }
    
    // Tenant users (with tenant_id) cannot manage tenants
    return false;
  }

  /**
   * Check if the current user can manage roles and permissions.
   * SuperAdmin, EkklesiaAdmin, and tenant Administrators can manage roles.
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
}

