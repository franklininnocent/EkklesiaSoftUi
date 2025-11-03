import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, tap, map } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '@environments/environment';
import { AuthResponse, LoginRequest, RegisterRequest, User } from '@core/models';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  
  private currentUserSubject = new BehaviorSubject<User | null>(this.getUserFromStorage());
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor() {}

  register(data: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/register`, data)
      .pipe(
        tap(response => this.handleAuthSuccess(response))
      );
  }

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/login`, credentials)
      .pipe(
        tap(response => this.handleAuthSuccess(response))
      );
  }

  logout(): Observable<any> {
    return this.http.post(`${environment.apiUrl}/auth/logout`, {})
      .pipe(
        tap(() => this.handleLogout())
      );
  }

  getCurrentUser(): Observable<User> {
    return this.http.get<{ success: boolean; data: User; message: string }>(`${environment.apiUrl}/auth/get-user`)
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
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/refresh`, { refresh_token: refreshToken })
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

  private setUser(user: User): void {
    localStorage.setItem(environment.userKey, JSON.stringify(user));
    this.currentUserSubject.next(user);
  }

  private getUserFromStorage(): User | null {
    const userStr = localStorage.getItem(environment.userKey);
    return userStr ? JSON.parse(userStr) : null;
  }

  private handleLogout(): void {
    localStorage.removeItem(environment.tokenKey);
    localStorage.removeItem(environment.refreshTokenKey);
    localStorage.removeItem(environment.expiryTimeKey);
    localStorage.removeItem(environment.userIdKey);
    localStorage.removeItem(environment.roleIdKey);
    localStorage.removeItem(environment.userKey);
    localStorage.removeItem(environment.tenantKey);
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
    
    // Check both formats for compatibility
    return this.hasRole('SuperAdmin') || 
           this.hasRole('Super Admin') ||
           user.role_name === 'SuperAdmin' ||
           user.role?.name === 'SuperAdmin' ||
           user.has_ekklesia_role === true;
  }

  /**
   * Check if the current user is an Ekklesia Admin.
   * 
   * @returns True if user is Ekklesia Admin, false otherwise
   */
  isEkklesiaAdmin(): boolean {
    const user = this.currentUserValue;
    if (!user) return false;
    
    // Check both formats for compatibility
    return this.hasRole('EkklesiaAdmin') || 
           this.hasRole('Ekklesia Admin') ||
           user.role_name === 'EkklesiaAdmin' ||
           user.role?.name === 'EkklesiaAdmin' ||
           user.has_ekklesia_role === true;
  }

  /**
   * Check if the current user is a Tenant Administrator.
   * 
   * @returns True if user is a Tenant Administrator, false otherwise
   */
  isTenantAdmin(): boolean {
    return this.hasRole('Administrator');
  }
}

