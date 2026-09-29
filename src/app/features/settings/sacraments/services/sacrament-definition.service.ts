import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, shareReplay, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '@environments/environment';
import {
  SacramentDefinition,
  SacramentDefinitionsResponse,
} from '../models/sacrament-definition.model';
import { handleApiError } from '../utils/error-handler.util';

/**
 * Backend-authoritative definitions client (ADR-06).
 * Angular must not invent parallel business rules — consume this contract only.
 */
@Injectable({
  providedIn: 'root',
})
export class SacramentDefinitionService {
  private readonly url = `${environment.apiUrl}/sacraments/definitions`;
  private cache$: Observable<SacramentDefinitionsResponse> | null = null;
  private definitionsByCode = new Map<string, SacramentDefinition>();
  private participantsV1 = false;

  constructor(private readonly http: HttpClient) {}

  load(force = false): Observable<SacramentDefinitionsResponse> {
    if (!force && this.cache$) {
      return this.cache$;
    }

    this.cache$ = this.http.get<SacramentDefinitionsResponse>(this.url).pipe(
      tap((response) => {
        this.definitionsByCode.clear();
        for (const def of response.data ?? []) {
          this.definitionsByCode.set(def.code.toUpperCase(), def);
        }
        this.participantsV1 = !!response.meta?.participants_v1;
      }),
      shareReplay(1),
      catchError((error: HttpErrorResponse) => {
        this.cache$ = null;
        return throwError(() => new Error(handleApiError(error, 'Failed to load sacrament definitions')));
      })
    );

    return this.cache$;
  }

  getByCode(code: string | null | undefined): Observable<SacramentDefinition | null> {
    if (!code) {
      return of(null);
    }
    const key = code.toUpperCase().replace(/[\s-]+/g, '_');
    const cached = this.definitionsByCode.get(key)
      ?? this.definitionsByCode.get(this.alias(key));
    if (cached) {
      return of(cached);
    }
    return this.load().pipe(
      map(() => this.definitionsByCode.get(key)
        ?? this.definitionsByCode.get(this.alias(key))
        ?? null)
    );
  }

  isParticipantsV1Enabled(): boolean {
    return this.participantsV1;
  }

  clearCache(): void {
    this.cache$ = null;
    this.definitionsByCode.clear();
  }

  private alias(code: string): string {
    if (code === 'MARRIAGE' || code === 'WEDDING') {
      return 'MATRIMONY';
    }
    if (code === 'FIRST_COMMUNION' || code === 'FIRSTCOMMUNION') {
      return 'EUCHARIST';
    }
    return code;
  }
}
