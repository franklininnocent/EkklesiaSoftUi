import { Component, inject, OnInit, OnDestroy, HostListener, ElementRef, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable, Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';

import { AppState } from '@core/store';
import { User, Tenant } from '@core/models';
import { selectCurrentUser } from '@core/store/auth/auth.selectors';
import { selectCurrentTenant } from '@core/store/tenant/tenant.selectors';
import * as AuthActions from '@core/store/auth/auth.actions';
import { AuthService } from '@core/services/auth.service';
import { ApplicationContextService } from '@core/services/application-context.service';
import { NavMenuService, NavMenuId } from '@core/services/nav-menu.service';
import { BreadcrumbComponent } from '@shared/components/breadcrumb/breadcrumb';
import { QuickCollectDrawerComponent } from '@features/donations/components/quick-collect-drawer/quick-collect-drawer.component';
import { QuickCollectService } from '@features/donations/services/quick-collect.service';
import { CommandPaletteComponent } from '@shared/components/command-palette/command-palette.component';
import { GlobalFamilySearchComponent } from '@shared/components/global-family-search/global-family-search.component';
import { SupportSessionBannerComponent } from '@features/support-center/components/support-session-banner/support-session-banner.component';
import { SupportSessionService } from '@features/support-center/services/support-session.service';
import { SubscriptionStatusBannerComponent } from '@shared/components/subscription-status-banner/subscription-status-banner.component';
import { SubscriptionAccessService } from '@core/services/subscription-access.service';
import { UserAvatarComponent, ImageViewerComponent } from '@shared/components';
import { resolveUserProfileImageUrl } from '@core/utils/user-profile-image.util';
import { SidebarNavForestComponent } from '../sidebar-nav/sidebar-nav-forest.component';
import { NotificationBellComponent } from '@features/notifications/components/notification-bell/notification-bell.component';
import { NotificationPopoverComponent } from '@features/notifications/components/notification-popover/notification-popover.component';
import {
  buildAppSidebarSections,
  filterSidebarSections,
} from '../sidebar-nav/app-sidebar.config';
import { SidebarNavSection } from '../sidebar-nav/sidebar-nav.model';
@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    BreadcrumbComponent,
    QuickCollectDrawerComponent,
    CommandPaletteComponent,
    GlobalFamilySearchComponent,
    SupportSessionBannerComponent,
    SubscriptionStatusBannerComponent,
    UserAvatarComponent,
    ImageViewerComponent,
    SidebarNavForestComponent,
    NotificationBellComponent,
    NotificationPopoverComponent,
  ],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainLayoutComponent implements OnInit, OnDestroy {
  private store = inject(Store<AppState>);
  private router = inject(Router);
  private authService = inject(AuthService);
  private appContext = inject(ApplicationContextService);
  private navMenu = inject(NavMenuService);
  private elementRef = inject(ElementRef);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();
  private quickCollectService = inject(QuickCollectService);
  private supportSessions = inject(SupportSessionService);
  private subscriptionAccess = inject(SubscriptionAccessService);

  currentUser$: Observable<User | null>;
  currentTenant$: Observable<Tenant | null>;
  isSidebarCollapsed = false;
  isMobileNavOpen = false;
  isMobileViewport = false;
  isUserMenuOpen = false;
  isUserMenuClosing = false;
  currentYear = new Date().getFullYear();
  currentUser: User | null = null;
  visibleSidebarSections: SidebarNavSection[] = [];
  private readonly sidebarSections = buildAppSidebarSections();

  constructor() {
    this.currentUser$ = this.store.select(selectCurrentUser);
    this.currentTenant$ = this.store.select(selectCurrentTenant);
  }

  ngOnInit(): void {
    // Soft refresh of profile on layout entry. loadUserFailure no longer wipes the
    // session on transient errors, so this is safe after post-login navigation.
    if (this.authService.isAuthenticated()) {
      this.store.dispatch(AuthActions.loadUser());
    }

    this.currentUser$.pipe(takeUntil(this.destroy$)).subscribe(user => {
      this.currentUser = user;
      this.visibleSidebarSections = filterSidebarSections(
        this.sidebarSections,
        (menuId) => this.navMenu.isVisible(menuId as NavMenuId, user)
      );
      if (this.appContext.hasParishResourceContext(user)) {
        this.subscriptionAccess.ensureLoaded();
      } else {
        this.subscriptionAccess.clear();
      }
      this.cdr.markForCheck();
    });

    this.subscriptionAccess.snapshot$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.cdr.markForCheck();
    });

    this.supportSessions.session$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.cdr.markForCheck();
    });

    if (!this.authService.isPlatformActor()) {
      this.supportSessions.clearSession();
    } else if (this.authService.canAccessSupportCenter()) {
      this.supportSessions.syncWithServer().pipe(takeUntil(this.destroy$)).subscribe();
    }

    // Breadcrumb audit: when a support session is active, log navigations.
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((event) => {
        if (this.isMobileNavOpen) {
          this.closeMobileNav();
        }

        if (!this.supportSessions.isSessionLive) {
          return;
        }
        const url = event.urlAfterRedirects || event.url;
        const module = this.moduleFromUrl(url);
        this.supportSessions
          .recordEvent({
            event_type: 'page_view',
            module,
            page: url,
            action: 'navigate',
          })
          .subscribe();
      });

    this.updateViewportState();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.updateViewportState();
  }

  toggleSidebar(): void {
    if (this.isMobileViewport) {
      this.toggleMobileNav();
      return;
    }
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
    this.cdr.markForCheck();
  }

  toggleMobileNav(): void {
    this.isMobileNavOpen = !this.isMobileNavOpen;
    this.cdr.markForCheck();
  }

  closeMobileNav(): void {
    if (!this.isMobileNavOpen) {
      return;
    }
    this.isMobileNavOpen = false;
    this.cdr.markForCheck();
  }

  private updateViewportState(): void {
    const wasMobile = this.isMobileViewport;
    this.isMobileViewport = window.innerWidth <= 768;
    if (wasMobile && !this.isMobileViewport) {
      this.isMobileNavOpen = false;
    }
    this.cdr.markForCheck();
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

  photoViewer: { src: string; alt: string; title: string; subtitle: string } | null = null;

  getUserPhotoUrl(user: User): string | null {
    return resolveUserProfileImageUrl(user);
  }

  openPhotoViewer(user: User, event: Event): void {
    event.stopPropagation();
    const url = this.getUserPhotoUrl(user);
    if (!url) {
      return;
    }

    this.photoViewer = {
      src: url,
      alt: user.name,
      title: user.name,
      subtitle: user.email,
    };
    this.cdr.markForCheck();
  }

  closePhotoViewer(): void {
    this.photoViewer = null;
    this.cdr.markForCheck();
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

  navigateToChangePassword(): void {
    this.closeUserMenu();
    setTimeout(() => {
      this.router.navigate(['/profile'], { queryParams: { changePassword: '1' } });
    }, 100);
  }

  logout(): void {
    this.closeUserMenu();
    setTimeout(() => {
      this.store.dispatch(AuthActions.logout());
    }, 100);
  }

  isVisible(id: NavMenuId, user: User | null): boolean {
    return this.navMenu.isVisible(id, user);
  }

  canManageTenants(user: User | null): boolean {
    return this.isVisible('tenants', user);
  }

  canManageRoles(user: User | null): boolean {
    return this.isVisible('roles-permissions', user);
  }

  canAccessSupport(user: User | null): boolean {
    return this.isVisible('support', user);
  }

  canAccessSupportCenter(user: User | null): boolean {
    return this.isVisible('support-center', user);
  }

  canAccessApplicationAccess(user: User | null): boolean {
    return this.isVisible('application-access', user);
  }

  canViewDonations(user: User | null): boolean {
    return this.isVisible('donations', user);
  }

  canAccessBcc(user: User | null): boolean {
    return this.isVisible('bccs', user);
  }

  canAccessMinistries(user: User | null): boolean {
    return this.isVisible('ministries', user);
  }

  hasParishContext(user: User | null): boolean {
    return !!user?.tenant_id && !this.authService.isPlatformActor(user);
  }

  isSubscriptionReadOnly(): boolean {
    return this.subscriptionAccess.isReadOnly();
  }

  openQuickCollect(): void {
    if (this.isSubscriptionReadOnly()) {
      return;
    }
    this.quickCollectService.open();
  }

  private moduleFromUrl(url: string): string {
    const path = url.split('?')[0].replace(/^\//, '');
    const first = path.split('/')[0] || 'app';
    return first;
  }
}

