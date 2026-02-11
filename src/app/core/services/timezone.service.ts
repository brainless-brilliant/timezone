import { Injectable, inject, signal, computed } from '@angular/core';
import { TimezoneRow, TimezoneEntry } from '../models/timezone.model';
import { TIMEZONE_DATABASE } from '../data/timezone-data';
import { TimeCalculationService } from './time-calculation.service';
import { StorageService } from './storage.service';
import { UrlStateService } from './url-state.service';

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
  sliderOffset = signal<number>(0);
  hoveredColumn = signal<number | null>(null);
  searchQuery = signal<string>('');

  // Computed: full TimezoneRow[] from selectedTimezoneIds + currentTime + sliderOffset
  timezoneRows = computed<TimezoneRow[]>(() => {
    const now = this.currentTime();
    const offset = this.sliderOffset();
    const ids = this.selectedTimezoneIds();
    if (ids.length === 0) return [];

    // First timezone is the reference for hour strip alignment
    const referenceId = ids[0];

    const rows = ids
      .map(id => {
        const entry = this.resolveEntry(id);
        if (!entry) return null;
        return {
          entry,
          currentTime: this.timeCalc.formatTime(now, id),
          currentDate: this.timeCalc.formatDate(now, id),
          utcOffset: this.timeCalc.getUtcOffset(id),
          timezoneAbbr: this.timeCalc.getTimezoneAbbr(id),
          relativeOffset: '',
          hourBlocks: this.timeCalc.generateHourBlocks(now, id, referenceId, offset),
        };
      })
      .filter((r): r is TimezoneRow => r !== null);

    // Compute relative offsets
    if (rows.length > 0) {
      const firstOffset = this.timeCalc.getOffsetHours(rows[0].entry.id);
      rows.forEach((row, i) => {
        if (i === 0) {
          row.relativeOffset = '';
        } else {
          const diff = this.timeCalc.getOffsetHours(row.entry.id) - firstOffset;
          const sign = diff >= 0 ? '+' : '';
          row.relativeOffset = diff % 1 === 0 ? `${sign}${diff}` : `${sign}${diff}`;
        }
      });
    }
    return rows;
  });

  // Methods
  initialize(): void {
    // Load custom entries from storage
    const savedEntries = this.storage.loadEntries();
    savedEntries.forEach(e => this.customEntries.set(e.id, e));

    const fromUrl = this.urlState.getTimezonesFromUrl();
    if (fromUrl.length > 0) {
      this.selectedTimezoneIds.set(fromUrl);
      return;
    }
    const fromStorage = this.storage.load();
    if (fromStorage.length > 0) {
      this.selectedTimezoneIds.set(fromStorage);
      return;
    }
    // Auto-detect local timezone (always add even if not in static database)
    const local = Intl.DateTimeFormat().resolvedOptions().timeZone;
    this.ensureEntry(local);
    this.selectedTimezoneIds.set([local]);
  }

  tick(): void {
    this.currentTime.set(new Date());
  }

  addTimezone(id: string, entry?: TimezoneEntry): void {
    if (entry) {
      this.customEntries.set(id, entry);
    } else {
      this.ensureEntry(id);
    }
    if (!this.selectedTimezoneIds().includes(id)) {
      this.selectedTimezoneIds.update(ids => [...ids, id]);
    }
  }

  removeTimezone(id: string): void {
    this.selectedTimezoneIds.update(ids => ids.filter(i => i !== id));
  }

  reorderTimezones(previousIndex: number, currentIndex: number): void {
    this.selectedTimezoneIds.update(ids => {
      const result = [...ids];
      const [moved] = result.splice(previousIndex, 1);
      result.splice(currentIndex, 0, moved);
      return result;
    });
  }

  setSliderOffset(offset: number): void {
    this.sliderOffset.set(offset);
  }

  setSearchQuery(query: string): void {
    this.searchQuery.set(query);
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

  // Resolve entry: custom cache -> static database -> derive from IANA ID
  private resolveEntry(id: string): TimezoneEntry | null {
    const custom = this.customEntries.get(id);
    if (custom) return custom;

    const fromDb = TIMEZONE_DATABASE.find(tz => tz.id === id);
    if (fromDb) return fromDb;

    // Derive from IANA ID: "America/New_York" -> "New York"
    return this.deriveEntry(id);
  }

  // Ensure an entry exists for a given timezone ID
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
