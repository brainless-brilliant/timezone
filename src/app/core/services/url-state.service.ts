import { Injectable, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class UrlStateService {
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  getTimezonesFromUrl(): string[] {
    return this.route.snapshot.queryParamMap.getAll('tz');
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
