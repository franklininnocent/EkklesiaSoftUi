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
    localStorage.setItem(environment.userIdKey, response.user_id.toString());
    localStorage.setItem(environment.roleIdKey, response.role_id.toString());
    
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
}

