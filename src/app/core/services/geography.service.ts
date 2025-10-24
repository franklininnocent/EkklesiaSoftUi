/**
 * Geography Service
 * 
 * Provides geographic data (countries, states) for cascading dropdowns in address forms.
 * Implements caching for better performance.
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { tap, catchError, shareReplay } from 'rxjs/operators';
import { environment } from '@environments/environment';

/**
 * Country interface matching backend response
 */
export interface Country {
  id: number;
  name: string;
  iso2: string;
  iso3: string;
  phone_code?: string;
  emoji?: string;
}

/**
 * State/Province interface matching backend response
 */
export interface State {
  id: number;
  country_id: number;
  name: string;
  state_code?: string;
  type?: string;
}

/**
 * Generic API response interface
 */
export interface GeographyResponse<T> {
  success: boolean;
  data: T[];
  count: number;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class GeographyService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/geography`;

  // Cache for countries (loaded once and reused)
  private countriesSubject = new BehaviorSubject<Country[]>([]);
  public countries$ = this.countriesSubject.asObservable();
  
  private countriesCache$: Observable<GeographyResponse<Country>> | null = null;

  // Cache for states by country (Map<countryId, Observable<State[]>>)
  private statesCache = new Map<number, Observable<GeographyResponse<State>>>();

  /**
   * Get all active countries.
   * Results are cached for the session.
   */
  getCountries(): Observable<GeographyResponse<Country>> {
    // Return cached observable if available
    if (this.countriesCache$) {
      return this.countriesCache$;
    }

    // Create new observable and cache it
    this.countriesCache$ = this.http.get<GeographyResponse<Country>>(
      `${this.apiUrl}/countries`
    ).pipe(
      tap(response => {
        if (response.success) {
          this.countriesSubject.next(response.data);
          console.log(`✅ Loaded ${response.count} countries`);
        }
      }),
      shareReplay(1), // Share the result with all subscribers
      catchError(error => {
        console.error('❌ Error loading countries:', error);
        this.countriesCache$ = null; // Clear cache on error
        throw error;
      })
    );

    return this.countriesCache$;
  }

  /**
   * Get states/provinces for a specific country.
   * Results are cached per country for the session.
   * 
   * @param countryId The ID of the country
   */
  getStatesByCountry(countryId: number): Observable<GeographyResponse<State>> {
    if (!countryId) {
      return of({ success: true, data: [], count: 0 });
    }

    // Return cached observable if available
    if (this.statesCache.has(countryId)) {
      return this.statesCache.get(countryId)!;
    }

    // Create new observable and cache it
    const states$ = this.http.get<GeographyResponse<State>>(
      `${this.apiUrl}/countries/${countryId}/states`
    ).pipe(
      tap(response => {
        if (response.success) {
          console.log(`✅ Loaded ${response.count} states for country ${countryId}`);
        }
      }),
      shareReplay(1), // Share the result with all subscribers
      catchError(error => {
        console.error(`❌ Error loading states for country ${countryId}:`, error);
        this.statesCache.delete(countryId); // Clear cache on error
        throw error;
      })
    );

    this.statesCache.set(countryId, states$);
    return states$;
  }

  /**
   * Search countries by name or code.
   * 
   * @param searchTerm Search term (minimum 2 characters)
   */
  searchCountries(searchTerm: string): Observable<GeographyResponse<Country>> {
    if (!searchTerm || searchTerm.trim().length < 2) {
      return of({ success: false, data: [], count: 0, message: 'Search term too short' });
    }

    return this.http.get<GeographyResponse<Country>>(
      `${this.apiUrl}/countries/search`,
      { params: { q: searchTerm.trim() } }
    ).pipe(
      catchError(error => {
        console.error('❌ Error searching countries:', error);
        throw error;
      })
    );
  }

  /**
   * Search states/provinces within a country.
   * 
   * @param countryId The ID of the country
   * @param searchTerm Search term (minimum 2 characters)
   */
  searchStates(countryId: number, searchTerm: string): Observable<GeographyResponse<State>> {
    if (!searchTerm || searchTerm.trim().length < 2) {
      return of({ success: false, data: [], count: 0, message: 'Search term too short' });
    }

    return this.http.get<GeographyResponse<State>>(
      `${this.apiUrl}/countries/${countryId}/states/search`,
      { params: { q: searchTerm.trim() } }
    ).pipe(
      catchError(error => {
        console.error(`❌ Error searching states for country ${countryId}:`, error);
        throw error;
      })
    );
  }

  /**
   * Clear all caches (useful when switching tenants or logging out)
   */
  clearCache(): void {
    this.countriesCache$ = null;
    this.statesCache.clear();
    this.countriesSubject.next([]);
    console.log('🗑️ Geography cache cleared');
  }

  /**
   * Get cached countries synchronously (if available)
   */
  get cachedCountries(): Country[] {
    return this.countriesSubject.value;
  }

  /**
   * Check if countries are loaded
   */
  get hasCountries(): boolean {
    return this.countriesSubject.value.length > 0;
  }
}


