import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, tap, map, catchError, throwError, of, timeout, finalize } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '@environments/environment';
import { AuthResponse, LoginRequest, RegisterRequest, User } from '@core/models';
import { PhoneCodeService } from '@core/services/phone-code.service';
import { getCountryCallingCode, CountryCode } from 'libphonenumber-js';
import { canViewMySubscription as canViewMySubscriptionAccess } from '@shared/utils/subscription-access.util';
import { SupportSessionService } from '@features/support-center/services/support-session.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private phoneCodeService = inject(PhoneCodeService);
  private supportSessions = inject(SupportSessionService);
  private readonly authEndpointPrefix = '/auth';
  
  private currentUserSubject = new BehaviorSubject<User | null>(this.getUserFromStorage());
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor() {}

  register(data: RegisterRequest): Observable<AuthResponse> {
    return this.postWithFallback<AuthResponse>('/register', data)
      .pipe(
        tap(response => this.handleAuthSuccess(response))
      );
  }

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.postWithFallback<AuthResponse>('/login', credentials)
      .pipe(
        tap(response => this.handleAuthSuccess(response))
      );
  }

  logout(): Observable<any> {
    return this.postWithFallback('/logout', {})
      .pipe(
        timeout(5000),
        catchError(() => of(null)),
        finalize(() => this.clearAuthState())
      );
  }

  /** Clear tokens, tenant context, and support session without calling the API. */
  clearAuthState(): void {
    this.handleLogout();
  }

  getCurrentUser(): Observable<User> {
    return this.getWithFallback<{ success: boolean; data: User; message: string }>('/get-user')
      .pipe(
        // Extract the user data from the response
        map(response => response.data)
      );
  }

  refreshUser(): void {
    this.getCurrentUser().subscribe({
      next: (user) => {
        this.setUser(user);
      },
      error: () => {
        this.handleLogout();
      }
    });
  }

  getToken(): string | null {
    return localStorage.getItem(environment.tokenKey);
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  refreshTokens(refreshToken: string): Observable<AuthResponse> {
    return this.postWithFallback<AuthResponse>('/refresh', { refresh_token: refreshToken })
      .pipe(
        tap(response => this.handleAuthSuccess(response))
      );
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(environment.refreshTokenKey);
  }

  private handleAuthSuccess(response: AuthResponse): void {
    // Store tokens
    localStorage.setItem(environment.tokenKey, response.access_token);
    localStorage.setItem(environment.refreshTokenKey, response.refresh_token);
    localStorage.setItem(environment.expiryTimeKey, response.expiry_time);
    localStorage.setItem(environment.userIdKey, response.user_id?.toString() || '');
    if (response.role_id) {
      localStorage.setItem(environment.roleIdKey, response.role_id.toString());
    }
    
    // Fetch and set user details
    this.getCurrentUser().subscribe({
      next: (user) => this.setUser(user),
      error: (err) => console.error('Failed to fetch user details:', err)
    });
  }

  private setToken(token: string): void {
    localStorage.setItem(environment.tokenKey, token);
  }

  private postWithFallback<T>(path: string, payload: unknown): Observable<T> {
    const primaryUrl = this.buildPrimaryAuthUrl(path);
    const fallbackUrl = this.buildFallbackAuthUrl(path);

    return this.http.post<T>(primaryUrl, payload).pipe(
      catchError((error) => {
        if (!this.shouldRetryOnFallback(error, primaryUrl, fallbackUrl)) {
          return throwError(() => error);
        }

        return this.http.post<T>(fallbackUrl, payload);
      })
    );
  }

  private getWithFallback<T>(path: string): Observable<T> {
    const primaryUrl = this.buildPrimaryAuthUrl(path);
    const fallbackUrl = this.buildFallbackAuthUrl(path);

    return this.http.get<T>(primaryUrl).pipe(
      catchError((error) => {
        if (!this.shouldRetryOnFallback(error, primaryUrl, fallbackUrl)) {
          return throwError(() => error);
        }

        return this.http.get<T>(fallbackUrl);
      })
    );
  }

  private shouldRetryOnFallback(error: any, primaryUrl: string, fallbackUrl: string): boolean {
    if (error?.status !== 0) {
      return false;
    }

    if (!fallbackUrl || primaryUrl === fallbackUrl) {
      return false;
    }

    return true;
  }

  private buildPrimaryAuthUrl(path: string): string {
    return `${environment.apiUrl}${this.authEndpointPrefix}${path}`;
  }

  private buildFallbackAuthUrl(path: string): string {
    if (typeof window === 'undefined' || !window.location?.origin) {
      return this.buildPrimaryAuthUrl(path);
    }

    return `${window.location.origin}/api${this.authEndpointPrefix}${path}`;
  }

  private setUser(user: User): void {
    localStorage.setItem(environment.userKey, JSON.stringify(user));
    this.currentUserSubject.next(user);

    // Update tenant country code cache and phone code globally
    try {
      const tenant = (user as any)?.tenant;
      if (tenant) {
        // Priority 1: Use country object from backend (most reliable)
        const tenantCountry = tenant.country;
        if (tenantCountry) {
          // Use phone_code from database if available
          if (tenantCountry.phone_code) {
            const phoneCode = tenantCountry.phone_code.startsWith('+') 
              ? tenantCountry.phone_code 
              : `+${tenantCountry.phone_code}`;
            this.phoneCodeService.setPhoneCode(phoneCode);
            try { localStorage.setItem('tenant_country_code', tenantCountry.iso2); } catch {}
            try { localStorage.setItem('tenant_country_id', tenantCountry.id.toString()); } catch {}
            return; // Successfully updated, exit early
          }
          // Fallback to ISO2 code
          else if (tenantCountry.iso2) {
            const upper = tenantCountry.iso2.toUpperCase();
            try { localStorage.setItem('tenant_country_code', upper); } catch {}
            try { localStorage.setItem('tenant_country_id', tenantCountry.id.toString()); } catch {}
            try {
              const code = getCountryCallingCode(upper as CountryCode);
              if (code) {
                this.phoneCodeService.setPhoneCode(`+${code}`);
              }
            } catch {}
            return; // Successfully updated, exit early
          }
        }
        
        // Priority 2: Try legacy country_code or country.iso2
        const iso2: string | undefined = tenant.country_code || tenant.country?.iso2;
        if (iso2 && typeof iso2 === 'string' && iso2.length >= 2) {
          const upper = iso2.toUpperCase();
          try { localStorage.setItem('tenant_country_code', upper); } catch {}
          try {
            const code = getCountryCallingCode(upper as CountryCode);
            if (code) {
              this.phoneCodeService.setPhoneCode(`+${code}`);
            }
          } catch {}
        }
        
        // Store country_id if available
        if (tenant.country_id) {
          try { localStorage.setItem('tenant_country_id', tenant.country_id.toString()); } catch {}
        }
      }
    } catch (error) {
      console.error('Error updating phone code from user:', error);
    }
  }

  private getUserFromStorage(): User | null {
    const userStr = localStorage.getItem(environment.userKey);
    return userStr ? JSON.parse(userStr) : null;
  }

  private handleLogout(): void {
    this.supportSessions.clearSession();
    localStorage.removeItem(environment.tokenKey);
    localStorage.removeItem(environment.refreshTokenKey);
    localStorage.removeItem(environment.expiryTimeKey);
    localStorage.removeItem(environment.userIdKey);
    localStorage.removeItem(environment.roleIdKey);
    localStorage.removeItem(environment.userKey);
    localStorage.removeItem(environment.tenantKey);
    // Backward-compat cleanup for any legacy auth keys.
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('tenant_id');
    this.currentUserSubject.next(null);
    this.router.navigate(['/auth/login']);
  }

  get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  /**
   * Check if the current user has a specific permission.
   * 
   * @param permission Permission name (e.g., 'users.create', 'roles.update')
   * @returns True if user has the permission, false otherwise
   */
  hasPermission(permission: string): boolean {
    const user = this.currentUserValue;
    if (!user || !user.permissions) {
      return false;
    }
    return user.permissions.some(p => p.name === permission);
  }

  /**
   * Check if the current user has any of the given permissions.
   * 
   * @param permissions Array of permission names
   * @returns True if user has at least one permission, false otherwise
   */
  hasAnyPermission(permissions: string[]): boolean {
    const user = this.currentUserValue;
    if (!user || !user.permissions) {
      return false;
    }
    return permissions.some(permission => 
      user.permissions!.some(p => p.name === permission)
    );
  }

  /**
   * Check if the current user has all of the given permissions.
   * 
   * @param permissions Array of permission names
   * @returns True if user has all permissions, false otherwise
   */
  hasAllPermissions(permissions: string[]): boolean {
    const user = this.currentUserValue;
    if (!user || !user.permissions) {
      return false;
    }
    return permissions.every(permission => 
      user.permissions!.some(p => p.name === permission)
    );
  }

  /**
   * Check if the current user has a specific role.
   * 
   * @param roleName Role name (e.g., 'Administrator', 'Manager')
   * @returns True if user has the role, false otherwise
   */
  hasRole(roleName: string): boolean {
    const user = this.currentUserValue;
    if (!user || !user.roles) {
      return false;
    }
    return user.roles.some(r => r.name === roleName);
  }

  /**
   * Check if the current user is a Super Admin.
   * 
   * @returns True if user is Super Admin, false otherwise
   */
  isSuperAdmin(): boolean {
    const user = this.currentUserValue;
    if (!user) return false;
    
    // Never treat generic has_ekklesia_role as SuperAdmin (covers Manager/User too).
    return this.hasRole('SuperAdmin') || 
           this.hasRole('Super Admin') ||
           user.role_name === 'SuperAdmin' ||
           user.role?.name === 'SuperAdmin';
  }

  /**
   * Check if the current user is an Ekklesia Admin.
   * 
   * @returns True if user is Ekklesia Admin, false otherwise
   */
  isEkklesiaAdmin(): boolean {
    const user = this.currentUserValue;
    if (!user) return false;
    
    // Never treat generic has_ekklesia_role as EkklesiaAdmin.
    return this.hasRole('EkklesiaAdmin') || 
           this.hasRole('Ekklesia Admin') ||
           user.role_name === 'EkklesiaAdmin' ||
           user.role?.name === 'EkklesiaAdmin';
  }

  /**
   * Check if the current user is a Tenant Administrator.
   * 
   * @returns True if user is a Tenant Administrator, false otherwise
   */
  isTenantAdmin(): boolean {
    const user = this.currentUserValue;
    if (!user) {
      return false;
    }

    const tenantAdminRoleNames = ['Administrator', 'Church Administrator'];

    return tenantAdminRoleNames.some((roleName) =>
      this.hasRole(roleName) || user.role_name === roleName || user.role?.name === roleName
    );
  }

  canAccessRbac(user: User | null = this.currentUserValue): boolean {
    if (!user) {
      return false;
    }

    if (this.isSuperAdmin() || this.isEkklesiaAdmin()) {
      return true;
    }

    const isEkklesiaManager =
      user.role_name === 'EkklesiaManager' ||
      user.role?.name === 'EkklesiaManager' ||
      !!user.roles?.some((role) => role.name === 'EkklesiaManager');

    if (isEkklesiaManager) {
      return true;
    }

    const isTenantAdmin = !!user.tenant_id && this.isTenantAdmin();
    const hasRbacViewPermission = this.hasAnyPermission(['roles.view', 'permissions.view']);

    return isTenantAdmin || hasRbacViewPermission;
  }

  canManageRbac(user: User | null = this.currentUserValue): boolean {
    if (!user) {
      return false;
    }

    if (this.isSuperAdmin() || this.isEkklesiaAdmin()) {
      return true;
    }

    const isEkklesiaManager =
      user.role_name === 'EkklesiaManager' ||
      user.role?.name === 'EkklesiaManager' ||
      !!user.roles?.some((role) => role.name === 'EkklesiaManager');

    if (isEkklesiaManager) {
      return true;
    }

    // Tenant manage requires administrator role OR explicit manage/assign permissions.
    // View-only (roles.view / permissions.view) must not unlock mutating UI.
    if (user.tenant_id && this.isTenantAdmin()) {
      return true;
    }

    return this.hasAnyPermission([
      'roles.create',
      'roles.update',
      'roles.delete',
      'roles.assign',
      'permissions.assign',
      'permissions.create',
      'permissions.update',
      'permissions.delete',
    ]);
  }

  /**
   * Whether the user may open Settings → My Subscription.
   * Shared by route guard, settings tile, banner CTA, and soft-gate redirects.
   */
  canViewMySubscription(user: User | null = this.currentUserValue): boolean {
    return canViewMySubscriptionAccess(user);
  }

  canAccessDonations(user: User | null = this.currentUserValue): boolean {
    if (!user) {
      return false;
    }

    // Platform admins should always be able to access/manage tenant financial modules.
    if (this.isSuperAdmin() || this.isEkklesiaAdmin()) {
      return true;
    }

    if (!user.tenant_id) {
      return false;
    }

    const tenantAdminRoleNames = ['Administrator', 'Church Administrator'];
    const hasTenantAdminRole = tenantAdminRoleNames.some((roleName) =>
      (user.roles || []).some((role) => role?.name === roleName) ||
      user.role_name === roleName ||
      user.role?.name === roleName
    );

    const primaryAdminRaw = (user as any).is_primary_admin;
    const isPrimaryAdmin = primaryAdminRaw === true || primaryAdminRaw === 1 || primaryAdminRaw === '1';
    if (isPrimaryAdmin || hasTenantAdminRole) {
      return true;
    }

    // Keep donations menu/route behavior aligned with working RBAC visibility.
    if (this.canAccessRbac(user)) {
      return true;
    }

    const permissionNames = [
      'donations.view',
      'donations.collect',
      'donations.manage',
      'donations.create',
      'donations.edit',
      'donations.delete',
      'donations.reports',
      'donations.export',
      'reports.view',
      'reports.export'
    ];

    return permissionNames.some((permissionName) =>
      (user.permissions || []).some((permission) => permission?.name === permissionName)
    );
  }

  /**
   * Tenant Ministries & Associations CRUD (/ministries) — not platform Insights.
   * SuperAdmin/EkklesiaAdmin need home tenant_id or an active Support session.
   */
  canAccessMinistries(
    user: User | null = this.currentUserValue,
    options: { hasActiveSupportSession?: boolean } = {}
  ): boolean {
    if (!user) {
      return false;
    }

    if (this.isSuperAdmin() || this.isEkklesiaAdmin()) {
      return !!user.tenant_id || !!options.hasActiveSupportSession;
    }

    if (!user.tenant_id) {
      return false;
    }

    // Align with MinistriesAssociationsPermissionSeeder tenant role sync list.
    const tenantRoleNames = ['Administrator', 'Parish Priest', 'Church Pastor'];
    const hasTenantMinistryRole = tenantRoleNames.some((roleName) =>
      (user.roles || []).some((role) => role?.name === roleName) ||
      user.role_name === roleName ||
      user.role?.name === roleName
    );

    const primaryAdminRaw = (user as any).is_primary_admin;
    const isPrimaryAdmin = primaryAdminRaw === true || primaryAdminRaw === 1 || primaryAdminRaw === '1';
    if (isPrimaryAdmin || hasTenantMinistryRole) {
      return true;
    }

    const permissionNames = [
      'ministries.view',
      'ministries.create',
      'ministries.edit',
      'ministries.delete',
      'ministries.manage_members',
      'ministries.manage_leadership',
      'ministries.configure',
    ];

    return permissionNames.some((permissionName) =>
      (user.permissions || []).some((permission) => permission?.name === permissionName)
    );
  }

  canAccessBcc(
    user: User | null = this.currentUserValue,
    options: { hasActiveSupportSession?: boolean } = {}
  ): boolean {
    if (!user) {
      return false;
    }

    if (this.isSuperAdmin() || this.isEkklesiaAdmin()) {
      return !!user.tenant_id || !!options.hasActiveSupportSession;
    }

    if (!user.tenant_id) {
      return false;
    }

    const tenantRoleNames = ['Administrator', 'Parish Priest', 'Church Pastor'];
    const hasTenantBccRole = tenantRoleNames.some(
      (roleName) =>
        (user.roles || []).some((role) => role?.name === roleName) ||
        user.role_name === roleName ||
        user.role?.name === roleName
    );

    const primaryAdminRaw = (user as any).is_primary_admin;
    const isPrimaryAdmin = primaryAdminRaw === true || primaryAdminRaw === 1 || primaryAdminRaw === '1';
    if (isPrimaryAdmin || hasTenantBccRole) {
      return true;
    }

    return [
      'bcc.view',
      'bcc.create',
      'bcc.edit',
      'bcc.delete',
      'bcc.manage_members',
      'bcc.manage_leadership',
    ].some((permissionName) =>
      (user.permissions || []).some((permission) => permission?.name === permissionName)
    );
  }

  canAccessPastoral(
    user: User | null = this.currentUserValue,
    options: { hasActiveSupportSession?: boolean } = {}
  ): boolean {
    if (!user) {
      return false;
    }

    if (this.isSuperAdmin() || this.isEkklesiaAdmin()) {
      return !!user.tenant_id || !!options.hasActiveSupportSession;
    }

    if (!user.tenant_id) {
      return false;
    }

    const tenantRoleNames = ['Administrator', 'Parish Priest', 'Church Pastor'];
    const hasPastoralRole = tenantRoleNames.some(
      (roleName) =>
        (user.roles || []).some((role) => role?.name === roleName) ||
        user.role_name === roleName ||
        user.role?.name === roleName
    );

    const primaryAdminRaw = (user as any).is_primary_admin;
    const isPrimaryAdmin = primaryAdminRaw === true || primaryAdminRaw === 1 || primaryAdminRaw === '1';
    if (isPrimaryAdmin || hasPastoralRole) {
      return true;
    }

    return ['pastoral.care.view', 'pastoral.care.create', 'pastoral.care.assign'].some((permissionName) =>
      (user.permissions || []).some((permission) => permission?.name === permissionName)
    );
  }
}

