import { Injectable, inject, signal, computed } from '@angular/core';
import { TimezoneRow, TimezoneEntry } from '../models/timezone.model';
import { TIMEZONE_DATABASE } from '../data/timezone-data';
import { canonicalZoneId } from '../data/timezone-aliases';
import { TimeCalculationService } from './time-calculation.service';
import { StorageService } from './storage.service';
import { UrlStateService } from './url-state.service';

export interface ZoneExplanation {
  line1: string;
  line2: string;
}

@Injectable({ providedIn: 'root' })
export class TimezoneService {
  private timeCalc = inject(TimeCalculationService);
  private storage = inject(StorageService);
  private urlState = inject(UrlStateService);

  // Custom entries from API search (runtime cache)
  private customEntries = new Map<string, TimezoneEntry>();

  // State signals
  currentTime = signal<Date>(new Date());
  selectedTimezoneIds = signal<string[]>([]);
  /** Kept for the (currently unused) time slider component. */
  sliderOffset = signal<number>(0);
  hoveredColumn = signal<number | null>(null);
  /** Column the user clicked or tapped to inspect; null follows the current hour. */
  pinnedColumn = signal<number | null>(null);
  hour12 = signal<boolean>(true);
  searchQuery = signal<string>('');

  readonly localZone = this.timeCalc.localZone();

  timezoneRows = computed<TimezoneRow[]>(() => {
    const now = this.currentTime();
    const ids = this.selectedTimezoneIds();
    const hour12 = this.hour12();
    if (ids.length === 0) return [];

    // First timezone is the reference for hour strip alignment
    const referenceId = ids[0];
    const refOffset = this.timeCalc.getOffsetHours(referenceId, now);

    return ids
      .map((id, i) => {
        const entry = this.resolveEntry(id);
        if (!entry) return null;
        const diff = this.timeCalc.getOffsetHours(id, now) - refOffset;
        const row: TimezoneRow = {
          entry,
          currentTime: this.timeCalc.formatTime(now, id, hour12),
          currentDate: this.timeCalc.formatDate(now, id),
          utcOffset: this.timeCalc.getUtcOffset(id, now),
          timezoneAbbr: this.timeCalc.getTimezoneAbbr(id, now),
          relativeOffset: i === 0 ? '' : this.timeCalc.formatRelativeOffset(diff),
          isDst: this.timeCalc.isDst(id, now),
          hourBlocks: this.timeCalc.generateHourBlocks(now, id, referenceId, hour12),
        };
        return row;
      })
      .filter((r): r is TimezoneRow => r !== null);
  });

  /** Plain-language explanation per zone, relative to the visitor's local zone. Refreshed hourly. */
  private currentHourKey = computed(() => Math.floor(this.currentTime().getTime() / 3_600_000));
  explanations = computed<Record<string, ZoneExplanation>>(() => {
    this.currentHourKey();
    const now = new Date();
    const out: Record<string, ZoneExplanation> = {};
    this.selectedTimezoneIds().forEach(id => {
      try {
        out[id] = this.timeCalc.describeRelativeToLocal(id, now);
      } catch {
        out[id] = { line1: '', line2: '' };
      }
    });
    return out;
  });

  initialize(): void {
    const savedEntries = this.storage.loadEntries();
    savedEntries.forEach(e => this.customEntries.set(canonicalZoneId(e.id), { ...e, id: canonicalZoneId(e.id) }));
    this.hour12.set(this.storage.loadHour12() ?? this.prefersHour12());

    const fromUrl = this.sanitizeIds(this.urlState.getTimezonesFromUrl());
    if (fromUrl.length > 0) {
      this.selectedTimezoneIds.set(fromUrl);
      return;
    }
    const fromStorage = this.sanitizeIds(this.storage.load());
    if (fromStorage.length > 0) {
      this.selectedTimezoneIds.set(fromStorage);
      return;
    }
    // Auto-detect local timezone (always add even if not in static database)
    this.ensureEntry(this.localZone);
    this.selectedTimezoneIds.set([this.localZone]);
  }

  tick(): void {
    this.currentTime.set(new Date());
  }

  addTimezone(id: string, entry?: TimezoneEntry): void {
    id = canonicalZoneId(id);
    if (entry) {
      this.customEntries.set(id, { ...entry, id });
    } else {
      this.ensureEntry(id);
    }
    if (!this.selectedTimezoneIds().includes(id)) {
      this.selectedTimezoneIds.update(ids => [...ids, id]);
    }
  }

  removeTimezone(id: string): void {
    this.selectedTimezoneIds.update(ids => ids.filter(i => i !== id));
    if (this.selectedTimezoneIds().length === 0) this.pinnedColumn.set(null);
  }

  reorderTimezones(previousIndex: number, currentIndex: number): void {
    if (previousIndex === currentIndex) return;
    this.selectedTimezoneIds.update(ids => {
      const result = [...ids];
      const [moved] = result.splice(previousIndex, 1);
      result.splice(currentIndex, 0, moved);
      return result;
    });
    // Column indexes are relative to the reference row; a new reference invalidates the pin.
    if (previousIndex === 0 || currentIndex === 0) this.pinnedColumn.set(null);
  }

  /** Moves a zone to the top so the hour grid is aligned to it. */
  setReference(id: string): void {
    const index = this.selectedTimezoneIds().indexOf(id);
    if (index > 0) this.reorderTimezones(index, 0);
  }

  togglePinnedColumn(col: number): void {
    this.pinnedColumn.update(current => (current === col ? null : col));
  }

  setHour12(value: boolean): void {
    this.hour12.set(value);
    this.storage.saveHour12(value);
  }

  setSliderOffset(offset: number): void {
    this.sliderOffset.set(offset);
  }

  setSearchQuery(query: string): void {
    this.searchQuery.set(query);
  }

  /** Plain-text summary of every selected zone at the given column, for pasting into invites or chat. */
  summarizeColumn(col: number): string {
    const rows = this.timezoneRows();
    const block = rows[0]?.hourBlocks[col];
    if (!block) return '';
    const at = new Date(block.instant);
    const hour12 = this.hour12();
    return rows
      .map(r => {
        const time = this.timeCalc.formatTime(at, r.entry.id, hour12);
        const date = this.timeCalc.formatDate(at, r.entry.id);
        return `${time} ${date} - ${r.entry.name} (${this.timeCalc.getTimezoneAbbr(r.entry.id, at)})`;
      })
      .join('\n');
  }

  syncState(): void {
    const ids = this.selectedTimezoneIds();
    this.urlState.updateUrl(ids);
    this.storage.save(ids);
    // Persist custom entries for selected timezones
    const entries = ids
      .map(id => this.customEntries.get(id))
      .filter((e): e is TimezoneEntry => e !== undefined);
    this.storage.saveEntries(entries);
  }

  /** Canonicalize, drop ids the browser cannot format, and de-duplicate. */
  private sanitizeIds(ids: string[]): string[] {
    const out: string[] = [];
    ids.forEach(raw => {
      const id = canonicalZoneId(raw);
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: id });
      } catch {
        return;
      }
      if (!out.includes(id)) out.push(id);
    });
    return out;
  }

  private prefersHour12(): boolean {
    try {
      return new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hour12 ?? true;
    } catch {
      return true;
    }
  }

  // Resolve entry: custom cache -> static database -> derive from IANA ID
  private resolveEntry(id: string): TimezoneEntry | null {
    const custom = this.customEntries.get(id);
    if (custom) return custom;

    const fromDb = TIMEZONE_DATABASE.find(tz => tz.id === id);
    if (fromDb) return fromDb;

    return this.deriveEntry(id);
  }

  private ensureEntry(id: string): void {
    if (this.customEntries.has(id)) return;
    if (TIMEZONE_DATABASE.some(tz => tz.id === id)) return;
    this.customEntries.set(id, this.deriveEntry(id));
  }

  private deriveEntry(id: string): TimezoneEntry {
    const parts = id.split('/');
    const name = parts[parts.length - 1].replace(/_/g, ' ');
    const region = parts.length > 1 ? parts[0] : '';
    return { id, name, country: region, region: '' };
  }
}
