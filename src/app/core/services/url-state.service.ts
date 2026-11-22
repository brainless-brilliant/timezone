import { Injectable, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class UrlStateService {
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  /**
   * Reads ?tz= values straight from the hash. The router has not finished its initial
   * navigation when the app initializes, so ActivatedRoute.snapshot is still empty then;
   * relying on it made every shared link fall back to the visitor's local zone.
   */
  getTimezonesFromUrl(): string[] {
    const hash = window.location.hash || '';
    const queryIndex = hash.indexOf('?');
    const query = queryIndex >= 0 ? hash.slice(queryIndex + 1) : window.location.search.slice(1);
    if (!query) return this.route.snapshot.queryParamMap.getAll('tz');
    return new URLSearchParams(query).getAll('tz').filter(Boolean);
  }

  updateUrl(timezoneIds: string[]): void {
    this.router.navigate([], {
      queryParams: { tz: timezoneIds },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  generateShareableUrl(timezoneIds: string[]): string {
    const base = window.location.origin + window.location.pathname;
    const params = timezoneIds.map(id => `tz=${encodeURIComponent(id)}`).join('&');
    return `${base}#/?${params}`;
  }
}
