import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '@environments/environment';

export interface SupportCatalogCategory {
  id: number;
  name: string;
  sort_order: number;
  active: boolean;
}

export interface SupportCatalogRequestType {
  id: number;
  slug: string;
  name: string;
  sort_order: number;
  active: boolean;
  requires_bug_fields: boolean;
  categories: SupportCatalogCategory[];
  tickets_count: number;
}

export interface UpsertRequestTypePayload {
  name: string;
  sort_order?: number;
  active?: boolean;
  requires_bug_fields?: boolean;
}

export interface UpsertCategoryPayload {
  name: string;
  sort_order?: number;
  active?: boolean;
}

@Injectable({ providedIn: 'root' })
export class SupportTicketCatalogService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/support/ticket-catalog/request-types`;

  list(): Observable<SupportCatalogRequestType[]> {
    return this.http
      .get<{ success: boolean; data: SupportCatalogRequestType[] }>(this.base)
      .pipe(map((r) => r.data));
  }

  createType(payload: UpsertRequestTypePayload): Observable<SupportCatalogRequestType> {
    return this.http
      .post<{ success: boolean; data: SupportCatalogRequestType }>(this.base, payload)
      .pipe(map((r) => r.data));
  }

  updateType(id: number, payload: UpsertRequestTypePayload): Observable<SupportCatalogRequestType> {
    return this.http
      .put<{ success: boolean; data: SupportCatalogRequestType }>(`${this.base}/${id}`, payload)
      .pipe(map((r) => r.data));
  }

  deleteType(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  createCategory(typeId: number, payload: UpsertCategoryPayload): Observable<SupportCatalogCategory> {
    return this.http
      .post<{ success: boolean; data: SupportCatalogCategory }>(`${this.base}/${typeId}/categories`, payload)
      .pipe(map((r) => r.data));
  }

  updateCategory(
    typeId: number,
    categoryId: number,
    payload: UpsertCategoryPayload
  ): Observable<SupportCatalogCategory> {
    return this.http
      .put<{ success: boolean; data: SupportCatalogCategory }>(
        `${this.base}/${typeId}/categories/${categoryId}`,
        payload
      )
      .pipe(map((r) => r.data));
  }

  deleteCategory(typeId: number, categoryId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${typeId}/categories/${categoryId}`);
  }
}
