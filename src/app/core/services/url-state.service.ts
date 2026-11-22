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
  private hashQuery(): URLSearchParams {
    const hash = window.location.hash || '';
    const queryIndex = hash.indexOf('?');
    const query = queryIndex >= 0 ? hash.slice(queryIndex + 1) : window.location.search.slice(1);
    return new URLSearchParams(query);
  }

  /**
   * Reads ?tz= values straight from the hash. The router has not finished its initial
   * navigation when the app initializes, so ActivatedRoute.snapshot is still empty then.
   * Values are row keys: a zone id, optionally "~Label" (e.g. "Asia/Kolkata~Delhi").
   */
  getTimezonesFromUrl(): string[] {
    const fromHash = this.hashQuery().getAll('tz').filter(Boolean);
    return fromHash.length ? fromHash : this.route.snapshot.queryParamMap.getAll('tz');
  }

  /** Pinned moment from ?at= (ISO 8601 or epoch ms), or null. */
  getPinnedFromUrl(): number | null {
    const raw = this.hashQuery().get('at');
    if (!raw) return null;
    const ms = /^\d+$/.test(raw) ? Number(raw) : Date.parse(raw);
    // Ignore anything outside +/- 10 years; extreme values would produce invalid Dates.
    const TEN_YEARS = 10 * 366 * 86_400_000;
    if (!Number.isFinite(ms) || Math.abs(ms - Date.now()) > TEN_YEARS) return null;
    return ms;
  }

  private isoMinute(ms: number): string {
    return new Date(ms).toISOString().replace(/:\d{2}\.\d{3}Z$/, 'Z');
  }

  updateUrl(keys: string[], pinned: number | null = null): void {
    this.router.navigate([], {
      queryParams: { tz: keys, at: pinned === null ? null : this.isoMinute(pinned) },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  generateShareableUrl(keys: string[], pinned: number | null = null): string {
    const base = window.location.origin + window.location.pathname;
    const params = keys.map(id => `tz=${encodeURIComponent(id)}`);
    if (pinned !== null) params.push(`at=${encodeURIComponent(this.isoMinute(pinned))}`);
    return `${base}#/?${params.join('&')}`;
  }
}
