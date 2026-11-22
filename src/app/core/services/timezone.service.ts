import { Injectable, inject, signal, computed } from '@angular/core';
import { Availability, RowStatus, TimezoneRow, TimezoneEntry, WorkHours } from '../models/timezone.model';
import { TIMEZONE_DATABASE } from '../data/timezone-data';
import { LEGACY_ZONE_ALIASES, canonicalZoneId } from '../data/timezone-aliases';
import { weekendDays } from '../data/weekends';
import { TimeCalculationService } from './time-calculation.service';
import { StorageService } from './storage.service';
import { UrlStateService } from './url-state.service';

export interface ZoneExplanation {
  line1: string;
  line2: string;
}

export interface ColumnAvailability {
  workCount: number;
  total: number;
  penalty: number;
  level: 'all' | 'most' | 'some' | 'none';
}

export interface MeetingSuggestion {
  startCol: number;
  endCol: number; // exclusive
  everyoneWorking: boolean;
  workingCount: number;
  total: number;
  /** People outside working hours at the suggested start, with their local time. */
  outliers: { name: string; time: string; status: string }[];
}

const HOUR_MS = 3_600_000;
const PENALTY: Record<Availability, number> = { work: 0, edge: 1, off: 3, weekend: 5, sleep: 8 };
const STATUS_LABEL: Record<Availability, string> = {
  work: 'Working hours',
  edge: 'Just outside work',
  off: 'Off hours',
  weekend: 'Weekend',
  sleep: 'Likely asleep',
};

/** A row key is the zone id, or "zone~Label" for custom names and duplicates of one zone. */
export function zoneOfKey(key: string): string {
  const i = key.indexOf('~');
  return i === -1 ? key : key.slice(0, i);
}

export function labelOfKey(key: string): string | null {
  const i = key.indexOf('~');
  return i === -1 ? null : key.slice(i + 1);
}

@Injectable({ providedIn: 'root' })
export class TimezoneService {
  private timeCalc = inject(TimeCalculationService);
  private storage = inject(StorageService);
  private urlState = inject(UrlStateService);

  /** Extra details (country, region) for rows added from search, keyed by row key. */
  private customEntries = new Map<string, TimezoneEntry>();

  // State
  currentTime = signal<Date>(new Date());
  selectedKeys = signal<string[]>([]);
  hoveredColumn = signal<number | null>(null);
  /** Exact pinned moment (epoch ms); null follows live time. */
  pinnedInstant = signal<number | null>(null);
  /** Days from the reference zone's today that the grid shows. */
  dayOffset = signal<number>(0);
  hour12 = signal<boolean>(true);
  workHours = signal<WorkHours>({ start: 9, end: 17 });

  readonly localZone = this.timeCalc.localZone();

  referenceZone = computed(() => zoneOfKey(this.selectedKeys()[0] ?? this.localZone));

  timezoneRows = computed<TimezoneRow[]>(() => {
    const now = this.currentTime();
    const keys = this.selectedKeys();
    const hour12 = this.hour12();
    const dayOffset = this.dayOffset();
    const work = this.workHours();
    if (keys.length === 0) return [];

    const referenceId = zoneOfKey(keys[0]);
    const refOffset = this.timeCalc.getOffsetHours(referenceId, now);

    return keys.map((key, i) => {
      const zone = zoneOfKey(key);
      const entry = this.resolveEntry(key);
      const diff = this.timeCalc.getOffsetHours(zone, now) - refOffset;
      const defaultName = this.defaultName(zone);
      return {
        key,
        entry,
        zoneCity: entry.name !== defaultName ? defaultName : '',
        currentTime: this.timeCalc.formatTime(now, zone, hour12),
        currentDate: this.timeCalc.formatDate(now, zone),
        utcOffset: this.timeCalc.getUtcOffset(zone, now),
        timezoneAbbr: this.timeCalc.getTimezoneAbbr(zone, now),
        relativeOffset: i === 0 ? '' : this.timeCalc.formatRelativeOffset(diff),
        isDst: this.timeCalc.isDst(zone, now),
        hourBlocks: this.timeCalc.generateHourBlocks(now, zone, referenceId, hour12, dayOffset, work, weekendDays(zone)),
      };
    });
  });

  /** Column of the grid that contains the pinned moment, if it is on the day being viewed. */
  pinnedColumn = computed<number | null>(() => {
    const pinned = this.pinnedInstant();
    const ref = this.timezoneRows()[0];
    if (pinned === null || !ref) return null;
    const col = ref.hourBlocks.findIndex(b => pinned >= b.instant && pinned < b.instant + HOUR_MS);
    return col === -1 ? null : col;
  });

  /** Is the grid showing the reference zone's today? */
  isToday = computed(() => this.dayOffset() === 0);

  /** "Today", "Tomorrow", "Yesterday" or "In 5 days" for the viewed day, plus its date. */
  viewDay = computed(() => {
    const ref = this.timezoneRows()[0];
    const offset = this.dayOffset();
    if (!ref) return { relative: 'Today', date: '' };
    const date = this.timeCalc.formatDate(new Date(ref.hourBlocks[12].instant), ref.entry.id);
    const relative = offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : offset === -1 ? 'Yesterday'
      : offset > 0 ? `In ${offset} days` : `${-offset} days ago`;
    return { relative, date };
  });

  /** For each column: how many people are in working hours and how inconvenient it is overall. */
  availability = computed<ColumnAvailability[]>(() => {
    const rows = this.timezoneRows();
    if (rows.length === 0) return [];
    return Array.from({ length: 24 }, (_, col) => {
      let workCount = 0;
      let penalty = 0;
      rows.forEach(r => {
        const a = r.hourBlocks[col].availability;
        if (a === 'work') workCount++;
        penalty += PENALTY[a];
      });
      const total = rows.length;
      const level: ColumnAvailability['level'] = workCount === total ? 'all'
        : workCount >= Math.ceil(total / 2) ? 'most' : workCount > 0 ? 'some' : 'none';
      return { workCount, total, penalty, level };
    });
  });

  /**
   * The least inconvenient meeting window on the viewed day: the longest run of hours
   * with the lowest total penalty, preferring hours that have not passed yet today.
   */
  meetingSuggestion = computed<MeetingSuggestion | null>(() => {
    const rows = this.timezoneRows();
    const cols = this.availability();
    if (rows.length < 2 || cols.length === 0) return null;
    const nowMs = this.currentTime().getTime();
    const upcoming = (c: number) => rows[0].hourBlocks[c].instant + HOUR_MS > nowMs;

    const runs: { start: number; end: number; penalty: number }[] = [];
    let start = 0;
    for (let c = 1; c <= 24; c++) {
      if (c === 24 || cols[c].penalty !== cols[start].penalty) {
        runs.push({ start, end: c, penalty: cols[start].penalty });
        start = c;
      }
    }
    const best = runs.sort((a, b) => {
      if (a.penalty !== b.penalty) return a.penalty - b.penalty;
      if (this.dayOffset() === 0) {
        const ua = upcoming(a.end - 1) ? 0 : 1;
        const ub = upcoming(b.end - 1) ? 0 : 1;
        if (ua !== ub) return ua - ub;
      }
      return (b.end - b.start) - (a.end - a.start) || a.start - b.start;
    })[0];

    // If part of today's window has passed, start from the current hour.
    let startCol = best.start;
    if (this.dayOffset() === 0) {
      while (startCol < best.end - 1 && !upcoming(startCol)) startCol++;
    }

    const at = new Date(rows[0].hourBlocks[startCol].instant);
    const outliers = rows
      .filter(r => r.hourBlocks[startCol].availability !== 'work')
      .map(r => ({
        name: r.entry.name,
        time: this.timeCalc.formatTime(at, r.entry.id, this.hour12()),
        status: STATUS_LABEL[r.hourBlocks[startCol].availability].toLowerCase(),
      }));
    return {
      startCol,
      endCol: best.end,
      everyoneWorking: outliers.length === 0,
      workingCount: rows.length - outliers.length,
      total: rows.length,
      outliers,
    };
  });

  /** Plain-language explanation per row, relative to the visitor's local zone. Refreshed hourly. */
  private currentHourKey = computed(() => Math.floor(this.currentTime().getTime() / HOUR_MS));
  explanations = computed<Record<string, ZoneExplanation>>(() => {
    this.currentHourKey();
    const now = new Date();
    const out: Record<string, ZoneExplanation> = {};
    this.selectedKeys().forEach(key => {
      try {
        out[key] = this.timeCalc.describeRelativeToLocal(zoneOfKey(key), now);
      } catch {
        out[key] = { line1: '', line2: '' };
      }
    });
    return out;
  });

  initialize(): void {
    const savedEntries = this.storage.loadEntries();
    // Entries saved under a legacy id (e.g. Asia/Calcutta) carry an outdated name; let them re-derive.
    const legacyNames = new Set(Object.keys(LEGACY_ZONE_ALIASES).map(k => k.split('/').pop()!.replace(/_/g, ' ')));
    savedEntries
      .filter(e => canonicalZoneId(e.id) === e.id && !legacyNames.has(e.name))
      .forEach(e => this.customEntries.set(e.id, e));
    this.storage.loadRowEntries().forEach(([key, e]) => this.customEntries.set(key, e));
    this.hour12.set(this.storage.loadHour12() ?? this.prefersHour12());
    const work = this.storage.loadWorkHours();
    if (work) this.workHours.set(work);

    const fromUrl = this.sanitizeKeys(this.urlState.getTimezonesFromUrl());
    if (fromUrl.length > 0) {
      this.selectedKeys.set(fromUrl);
    } else {
      const fromStorage = this.sanitizeKeys(this.storage.load());
      this.selectedKeys.set(fromStorage.length > 0 ? fromStorage : [this.localZone]);
    }

    const at = this.urlState.getPinnedFromUrl();
    if (at !== null) this.pinInstant(at, false);
  }

  tick(): void {
    this.currentTime.set(new Date());
  }

  // ---- Rows ----

  defaultName(zone: string): string {
    return TIMEZONE_DATABASE.find(tz => tz.id === zone)?.name ?? zone.split('/').pop()!.replace(/_/g, ' ');
  }

  /** Key a (zone, name) pair would get as a row. */
  keyFor(zone: string, name?: string): string {
    zone = canonicalZoneId(zone);
    const clean = (name ?? '').replace(/~/g, '-').trim();
    return !clean || clean === this.defaultName(zone) ? zone : `${zone}~${clean}`;
  }

  hasKey(key: string): boolean {
    return this.selectedKeys().includes(key);
  }

  /** Adds a row and returns its key. Same zone with a different name becomes its own row. */
  addTimezone(id: string, entry?: TimezoneEntry): string {
    const zone = canonicalZoneId(id);
    const key = this.keyFor(zone, entry?.name);
    if (entry) this.customEntries.set(key, { ...entry, id: zone });
    if (!this.hasKey(key)) this.selectedKeys.update(keys => [...keys, key]);
    return key;
  }

  removeTimezone(key: string): void {
    this.selectedKeys.update(keys => keys.filter(k => k !== key));
  }

  /** Renames a row. Returns false if another row already uses that name for the same zone. */
  renameRow(key: string, label: string): boolean {
    const zone = zoneOfKey(key);
    const newKey = this.keyFor(zone, label);
    if (newKey === key) return true;
    if (this.hasKey(newKey)) return false;
    const old = this.customEntries.get(key);
    if (old) {
      this.customEntries.delete(key);
      this.customEntries.set(newKey, { ...old, name: labelOfKey(newKey) ?? this.defaultName(zone) });
    }
    this.selectedKeys.update(keys => keys.map(k => (k === key ? newKey : k)));
    this.syncState();
    return true;
  }

  reorderTimezones(previousIndex: number, currentIndex: number): void {
    if (previousIndex === currentIndex) return;
    this.selectedKeys.update(keys => {
      const result = [...keys];
      const [moved] = result.splice(previousIndex, 1);
      result.splice(currentIndex, 0, moved);
      return result;
    });
    // Keep the pinned moment visible under the new reference zone's calendar day.
    const pinned = this.pinnedInstant();
    if (pinned !== null) this.pinInstant(pinned, false);
  }

  /** Moves a row to the top so the hour grid is aligned to its zone. */
  setReference(key: string): void {
    const index = this.selectedKeys().indexOf(key);
    if (index > 0) this.reorderTimezones(index, 0);
  }

  // ---- Time navigation ----

  /** Pins an exact moment and moves the grid to the day that contains it. */
  pinInstant(ms: number, sync = true): void {
    const ref = this.referenceZone();
    this.dayOffset.set(this.daysFromToday(ms, ref));
    this.pinnedInstant.set(ms);
    if (sync) this.syncState();
  }

  togglePinnedColumn(col: number): void {
    const block = this.timezoneRows()[0]?.hourBlocks[col];
    if (!block) return;
    if (this.pinnedColumn() === col) this.clearPin();
    else this.pinInstant(block.instant);
  }

  /** Moves the pin by whole hours, crossing into the next or previous day as needed. */
  nudgePin(hours: number): void {
    const base = this.pinnedInstant() ?? this.timezoneRows()[0]?.hourBlocks[this.currentColumn()]?.instant;
    if (base === undefined) return;
    this.pinInstant(base + hours * HOUR_MS);
  }

  clearPin(): void {
    this.pinnedInstant.set(null);
    this.syncState();
  }

  /** Shows another day. A pinned time moves with it, keeping its time of day. */
  setDayOffset(offset: number): void {
    const delta = offset - this.dayOffset();
    if (delta === 0) return;
    const pinned = this.pinnedInstant();
    this.dayOffset.set(offset);
    if (pinned !== null) {
      const ref = this.referenceZone();
      const p = this.timeCalc.localParts(new Date(pinned), ref);
      const target = new Date(Date.UTC(p.year, p.month - 1, p.day + delta));
      this.pinnedInstant.set(this.timeCalc.zonedInstant(ref, target.getUTCFullYear(), target.getUTCMonth() + 1, target.getUTCDate(), p.hour, p.minute));
      this.syncState();
    }
  }

  /** Jumps to a calendar date ("YYYY-MM-DD") in the reference zone. */
  goToDate(iso: string): void {
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return;
    const ref = this.referenceZone();
    const today = this.timeCalc.localParts(this.currentTime(), ref);
    this.setDayOffset(Math.round((Date.UTC(y, m - 1, d) - Date.UTC(today.year, today.month - 1, today.day)) / 86_400_000));
  }

  /** The viewed day as "YYYY-MM-DD" in the reference zone, for the date input. */
  viewDateIso = computed(() => {
    const ref = this.timezoneRows()[0];
    if (!ref) return '';
    const p = this.timeCalc.localParts(new Date(ref.hourBlocks[12].instant), ref.entry.id);
    return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
  });

  currentColumn(): number {
    const now = this.currentTime().getTime();
    const blocks = this.timezoneRows()[0]?.hourBlocks ?? [];
    const col = blocks.findIndex(b => now >= b.instant && now < b.instant + HOUR_MS);
    return col === -1 ? 12 : col;
  }

  backToNow(): void {
    this.pinnedInstant.set(null);
    this.dayOffset.set(0);
    this.syncState();
  }

  // ---- Settings ----

  setHour12(value: boolean): void {
    this.hour12.set(value);
    this.storage.saveHour12(value);
  }

  setWorkHours(start: number, end: number): void {
    if (end <= start) return;
    this.workHours.set({ start, end });
    this.storage.saveWorkHours({ start, end });
  }

  // ---- Status and summaries ----

  statusAt(zone: string, instant: number): RowStatus {
    const p = this.timeCalc.localParts(new Date(instant), zone);
    const availability = this.timeCalc.availability(p.hour, p.weekday, weekendDays(zone), this.workHours());
    return { availability, label: STATUS_LABEL[availability] };
  }

  /** "tomorrow" / "yesterday" relative to the visitor's own date, or ''. */
  dayRelationToLocal(zone: string, instant: number): string {
    const d = this.timeCalc.dayDelta(new Date(instant), this.localZone, zone);
    return d === 1 ? 'Tomorrow' : d === -1 ? 'Yesterday' : d > 1 ? `+${d} days` : d < -1 ? `${d} days` : '';
  }

  /** Plain-text list of everyone's time at a moment, for chat or invites. */
  summarizeInstant(ms: number): string {
    const at = new Date(ms);
    const hour12 = this.hour12();
    return this.timezoneRows()
      .map(r => {
        const time = this.timeCalc.formatTime(at, r.entry.id, hour12);
        const date = this.timeCalc.formatDate(at, r.entry.id);
        return `${time} ${date} - ${r.entry.name} (${this.timeCalc.getTimezoneAbbr(r.entry.id, at)})`;
      })
      .join('\n');
  }

  meetingTitle(): string {
    const names = this.timezoneRows().map(r => r.entry.name);
    return names.length > 3 ? `Meeting: ${names.slice(0, 3).join(', ')} +${names.length - 3}` : `Meeting: ${names.join(', ')}`;
  }

  syncState(): void {
    const keys = this.selectedKeys();
    this.urlState.updateUrl(keys, this.pinnedInstant());
    this.storage.save(keys);
    const entries = keys
      .filter(k => this.customEntries.has(k))
      .map(k => [k, this.customEntries.get(k)!] as [string, TimezoneEntry]);
    this.storage.saveRowEntries(entries);
  }

  // ---- Internals ----

  private daysFromToday(ms: number, ref: string): number {
    const today = this.timeCalc.localParts(this.currentTime(), ref);
    const day = this.timeCalc.localParts(new Date(ms), ref);
    return Math.round((Date.UTC(day.year, day.month - 1, day.day) - Date.UTC(today.year, today.month - 1, today.day)) / 86_400_000);
  }

  /** Canonicalize zones, drop zones the browser cannot format, and de-duplicate. */
  private sanitizeKeys(keys: string[]): string[] {
    const out: string[] = [];
    keys.forEach(raw => {
      const zone = canonicalZoneId(zoneOfKey(raw));
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: zone });
      } catch {
        return;
      }
      const key = this.keyFor(zone, labelOfKey(raw) ?? undefined);
      if (!out.includes(key)) out.push(key);
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

  private resolveEntry(key: string): TimezoneEntry {
    const zone = zoneOfKey(key);
    const label = labelOfKey(key);
    const custom = this.customEntries.get(key);
    const fromDb = TIMEZONE_DATABASE.find(tz => tz.id === zone);
    const base: TimezoneEntry = custom ?? fromDb ?? {
      id: zone,
      name: this.defaultName(zone),
      country: zone.includes('/') ? zone.split('/')[0] : '',
      region: '',
    };
    return {
      ...base,
      id: zone,
      name: label ?? base.name,
      country: base.country || fromDb?.country || '',
    };
  }
}
