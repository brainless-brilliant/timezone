import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, catchError, map } from 'rxjs';
import { TimezoneEntry } from '../models/timezone.model';

interface GeocodingResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
  population?: number;
  country?: string;
  country_code?: string;
  admin1?: string;
  feature_code?: string;
}

interface GeocodingResponse {
  results?: GeocodingResult[];
  generationtime_ms?: number;
}

@Injectable({ providedIn: 'root' })
export class GeocodingService {
  private http = inject(HttpClient);
  private readonly API_URL = 'https://geocoding-api.open-meteo.com/v1/search';

  search(query: string): Observable<TimezoneEntry[]> {
    if (!query || query.length < 2) return of([]);

    return this.http.get<GeocodingResponse>(this.API_URL, {
      params: {
        name: query,
        count: '10',
        language: 'en',
        format: 'json',
      },
    }).pipe(
      map(response => {
        if (!response.results) return [];

        // Filter to cities/populated places, deduplicate by timezone+name
        const seen = new Set<string>();
        return response.results
          .filter(r => r.timezone && r.name)
          .filter(r => {
            const key = `${r.timezone}:${r.name}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .map(r => ({
            id: r.timezone,
            name: r.name,
            country: r.country || '',
            region: r.admin1 || '',
          }));
      }),
      catchError(() => of([])),
    );
  }
}
