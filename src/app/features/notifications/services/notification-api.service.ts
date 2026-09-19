import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import { AuthService } from '@core/services/auth.service';
import {
  NotificationListResponse,
  NotificationPreference,
  NotificationView,
  UserNotification,
} from '../models/notification.model';

@Injectable({ providedIn: 'root' })
export class NotificationApiService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  private basePath(): string {
    const user = this.auth.currentUserValue;
    if (user?.tenant_id) {
      return `${environment.apiUrl}/tenant/notifications`;
    }
    return `${environment.apiUrl}/admin/notifications`;
  }

  list(filters: {
    view?: NotificationView;
    cursor?: string | null;
    q?: string;
    category?: string;
    module?: string;
    per_page?: number;
  } = {}): Observable<NotificationListResponse> {
    let params = new HttpParams();
    if (filters.view) params = params.set('view', filters.view);
    if (filters.cursor) params = params.set('cursor', filters.cursor);
    if (filters.q) params = params.set('q', filters.q);
    if (filters.category) params = params.set('category', filters.category);
    if (filters.module) params = params.set('module', filters.module);
    if (filters.per_page) params = params.set('per_page', String(filters.per_page));

    return this.http.get<NotificationListResponse>(this.basePath(), { params });
  }

  unreadCount(): Observable<{ success: boolean; data: { unread_count: number } }> {
    return this.http.get<{ success: boolean; data: { unread_count: number } }>(
      `${this.basePath()}/unread-count`
    );
  }

  get(id: string): Observable<{ success: boolean; data: UserNotification }> {
    return this.http.get<{ success: boolean; data: UserNotification }>(`${this.basePath()}/${id}`);
  }

  open(id: string): Observable<{ success: boolean; data: { route: string; params: Record<string, string> } }> {
    return this.http.get<{ success: boolean; data: { route: string; params: Record<string, string> } }>(
      `${this.basePath()}/${id}/open`
    );
  }

  markRead(id: string): Observable<{ success: boolean; data: UserNotification }> {
    return this.http.patch<{ success: boolean; data: UserNotification }>(
      `${this.basePath()}/${id}/read`,
      {}
    );
  }

  markUnread(id: string): Observable<{ success: boolean; data: UserNotification }> {
    return this.http.patch<{ success: boolean; data: UserNotification }>(
      `${this.basePath()}/${id}/unread`,
      {}
    );
  }

  markAllRead(): Observable<{ success: boolean; data: { watermark: string; affected: number } }> {
    return this.http.patch<{ success: boolean; data: { watermark: string; affected: number } }>(
      `${this.basePath()}/read-all`,
      {}
    );
  }

  archive(id: string): Observable<{ success: boolean; data: UserNotification }> {
    return this.http.patch<{ success: boolean; data: UserNotification }>(
      `${this.basePath()}/${id}/archive`,
      {}
    );
  }

  restore(id: string): Observable<{ success: boolean; data: UserNotification }> {
    return this.http.patch<{ success: boolean; data: UserNotification }>(
      `${this.basePath()}/${id}/restore`,
      {}
    );
  }

  bulkAction(action: 'read' | 'archive' | 'restore', ids: string[]): Observable<{ success: boolean; data: { affected: number } }> {
    return this.http.post<{ success: boolean; data: { affected: number } }>(
      `${this.basePath()}/bulk-action`,
      { action, ids }
    );
  }

  getPreferences(): Observable<{ success: boolean; data: NotificationPreference[] }> {
    return this.http.get<{ success: boolean; data: NotificationPreference[] }>(
      `${this.basePath()}/preferences`
    );
  }

  updatePreferences(
    preferences: NotificationPreference[]
  ): Observable<{ success: boolean; message: string }> {
    return this.http.put<{ success: boolean; message: string }>(
      `${this.basePath()}/preferences`,
      { preferences }
    );
  }
}
