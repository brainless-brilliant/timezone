import { Component, inject, signal, computed, OnInit, OnDestroy, ElementRef, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs';
import { TimezoneService } from '../../core/services/timezone.service';
import { GeocodingService } from '../../core/services/geocoding.service';
import { TimezoneSearchIndexService } from '../../core/services/timezone-search-index.service';
import { TimeCalculationService } from '../../core/services/time-calculation.service';
import { TimeQuery, TimeQueryService } from '../../core/services/time-query.service';
import { TimezoneEntry } from '../../core/models/timezone.model';
import { ClickOutsideDirective } from '../../shared/directives/click-outside.directive';

export interface Suggestion {
  entry: TimezoneEntry;
  detail: string;
  badge: string;
  source: 'zone' | 'city' | 'time';
  time?: TimeQuery;
}

@Component({
  selector: 'app-timezone-search',
  standalone: true,
  imports: [CommonModule, FormsModule, ClickOutsideDirective],
  templateUrl: './timezone-search.component.html',
  styleUrls: ['./timezone-search.component.scss']
})
export class TimezoneSearchComponent implements OnInit, OnDestroy {
  private timezoneService = inject(TimezoneService);
  private geocodingService = inject(GeocodingService);
  private searchIndex = inject(TimezoneSearchIndexService);
  private timeCalc = inject(TimeCalculationService);
  private timeQuery = inject(TimeQueryService);

  @ViewChild('input', { static: true }) private inputRef!: ElementRef<HTMLInputElement>;

  protected readonly placeholder = window.matchMedia('(max-width: 640px)').matches
    ? 'City, IST, CET+1 or "3pm London"'
    : 'Search a city, zone (IST, CET+1, UTC-5) or a time: "3pm London", "tomorrow 9am Tokyo"';

  protected searchQuery = signal('');
  protected isDropdownOpen = signal(false);
  protected isLoading = signal(false);
  protected activeIndex = signal(-1);
  protected zoneResults = signal<Suggestion[]>([]);
  protected cityResults = signal<Suggestion[]>([]);
  protected expression = signal<string | null>(null);
  protected timeResult = signal<Suggestion | null>(null);

  /** Zones first (instant, local), then cities from the geocoding API without duplicates. */
  protected suggestions = computed<Suggestion[]>(() => {
    const zones = this.zoneResults();
    const time = this.timeResult();
    const seen = new Set(zones.map(z => `${z.entry.id}:${z.entry.name.toLowerCase()}`));
    const cities = this.cityResults().filter(c => !seen.has(`${c.entry.id}:${c.entry.name.toLowerCase()}`));
    return [...(time ? [time] : []), ...zones, ...cities];
  });

  /** Explanation of the highlighted (or first) suggestion, relative to the visitor's zone. */
  protected activeExplanation = computed(() => {
    const items = this.suggestions();
    const item = items[this.activeIndex()] ?? items[0];
    if (!item || item.source === 'time') return null;
    try {
      const now = new Date();
      const e = this.timeCalc.describeRelativeToLocal(item.entry.id, now);
      const time = this.timeCalc.formatTime(now, item.entry.id, this.timezoneService.hour12());
      return { title: `${item.entry.name}: ${time} now`, ...e };
    } catch {
      return null;
    }
  });

  private searchSubject = new Subject<string>();
  private searchSub: Subscription | null = null;

  ngOnInit(): void {
    this.searchSub = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      tap(() => this.isLoading.set(true)),
      switchMap(query => this.geocodingService.search(query)),
    ).subscribe(results => {
      this.cityResults.set(results.map(entry => ({
        entry,
        detail: [entry.region, entry.country].filter(Boolean).join(', '),
        badge: this.safeAbbr(entry.id),
        source: 'city' as const,
      })));
      this.isLoading.set(false);
    });
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
  }

  /** "/" focuses the search from anywhere. */
  @HostListener('document:keydown', ['$event'])
  protected onGlobalKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const typing = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
    if (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      this.inputRef.nativeElement.focus();
    }
  }

  protected onSearchChange(value: string): void {
    this.searchQuery.set(value);
    this.activeIndex.set(-1);
    const trimmed = value.trim();

    this.expression.set(this.searchIndex.describeExpression(trimmed));
    this.timeResult.set(this.parseTime(trimmed));
    this.zoneResults.set(trimmed ? this.searchIndex.search(trimmed, 8) : []);
    this.isDropdownOpen.set(trimmed.length >= 1);

    // City lookups only make sense for words, not "+5:30" or "CET+1".
    if (trimmed.length >= 2 && !this.expression() && !this.timeResult()) {
      this.searchSubject.next(trimmed);
    } else {
      this.cityResults.set([]);
      this.isLoading.set(false);
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    const items = this.suggestions();

    if (event.key === 'Escape') {
      if (!this.searchQuery()) this.inputRef.nativeElement.blur();
      this.reset();
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const activeIdx = this.activeIndex();
      const selected = activeIdx >= 0 ? items[activeIdx] : items.find(s => !this.isAlreadySelected(s));
      if (selected) this.selectTimezone(selected);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!this.isDropdownOpen() && this.searchQuery()) this.isDropdownOpen.set(true);
      this.activeIndex.set(Math.min(this.activeIndex() + 1, items.length - 1));
      this.scrollActiveIntoView();
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeIndex.set(Math.max(this.activeIndex() - 1, -1));
      this.scrollActiveIntoView();
    }
  }

  protected isAlreadySelected(s: Suggestion): boolean {
    if (s.source === 'time') return false;
    return this.timezoneService.hasKey(this.timezoneService.keyFor(s.entry.id, s.entry.name));
  }

  protected selectTimezone(s: Suggestion): void {
    if (this.isAlreadySelected(s)) return;
    if (s.source === 'time' && s.time) {
      // Naming a place that is not on screen adds it, so the pinned time is visible there.
      const place = s.time.place;
      if (place && !place.key) this.timezoneService.addTimezone(place.entry.id, place.entry);
      this.timezoneService.pinInstant(s.time.instant);
      this.reset();
      return;
    }
    this.timezoneService.addTimezone(s.entry.id, s.entry);
    this.reset();
    this.timezoneService.syncState();
  }

  /** "3pm london" style queries become a pinned-time suggestion showing everyone's time. */
  private parseTime(text: string): Suggestion | null {
    const rows = this.timezoneService.timezoneRows();
    const hour12 = this.timezoneService.hour12();
    const q = this.timeQuery.parse(text, {
      now: new Date(),
      localZone: this.timezoneService.localZone,
      rows: rows.map(r => ({ key: r.key, entry: r.entry })),
      hour12,
    });
    if (!q) return null;
    const at = new Date(q.instant);
    const others = rows
      .filter(r => r.entry.id !== q.zoneId)
      .slice(0, 3)
      .map(r => `${this.timeCalc.formatTime(at, r.entry.id, hour12)} ${r.entry.name}`);
    const adds = q.place && !q.place.key ? ` Adds ${q.place.entry.name}.` : '';
    return {
      entry: q.place?.entry ?? { id: q.zoneId, name: 'Your time', country: '', region: '' },
      detail: (others.length ? '= ' + others.join(' · ') : 'Pins this moment on the grid.') + adds,
      badge: 'Pin',
      source: 'time',
      time: q,
    };
  }

  protected onFocus(): void {
    if (this.searchQuery().trim()) this.isDropdownOpen.set(true);
  }

  protected closeDropdown(): void {
    this.isDropdownOpen.set(false);
    this.activeIndex.set(-1);
  }

  protected getDropdownId(): string {
    return 'timezone-suggestions';
  }

  protected getOptionId(index: number): string {
    return `timezone-option-${index}`;
  }

  protected firstCityIndex(): number {
    return this.suggestions().findIndex(s => s.source === 'city');
  }

  private reset(): void {
    this.searchQuery.set('');
    this.zoneResults.set([]);
    this.cityResults.set([]);
    this.expression.set(null);
    this.timeResult.set(null);
    this.closeDropdown();
  }

  private safeAbbr(id: string): string {
    try {
      return this.timeCalc.getTimezoneAbbr(id);
    } catch {
      return '';
    }
  }

  private scrollActiveIntoView(): void {
    queueMicrotask(() => {
      document.getElementById(this.getOptionId(this.activeIndex()))?.scrollIntoView({ block: 'nearest' });
    });
  }
}
