import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, shareReplay, catchError } from 'rxjs/operators';
import { environment } from '@environments/environment';
import { EcclesiasticalTitle } from '@core/models/ecclesiastical/ecclesiastical-title.model';
import { ApiResponse } from '@core/models';

@Injectable({
  providedIn: 'root'
})
export class EcclesiasticalTitleService {
  private readonly baseUrl = `${environment.apiUrl}/ecclesiastical/titles`;
  private cache$: Observable<EcclesiasticalTitle[]> | null = null;

  constructor(private http: HttpClient) {}

  getTitleOptions(forceRefresh = false): Observable<EcclesiasticalTitle[]> {
    if (!forceRefresh && this.cache$) {
      return this.cache$;
    }

    this.cache$ = this.http.get<ApiResponse<EcclesiasticalTitle[]>>(this.baseUrl).pipe(
      map((response) => {
        const payload = response?.data;
        return Array.isArray(payload) ? payload : [];
      }),
      shareReplay(1),
      catchError(() => of([]))
    );

    return this.cache$;
  }

  clearCache(): void {
    this.cache$ = null;
  }
}
