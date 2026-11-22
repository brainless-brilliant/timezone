import { Injectable } from '@angular/core';
import { TimezoneEntry } from '../models/timezone.model';

@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly STORAGE_KEY = 'tz_selected_ids';
  private readonly ENTRIES_KEY = 'tz_custom_entries';
  private readonly HOUR12_KEY = 'tz_hour12';
  private readonly ROW_ENTRIES_KEY = 'tz_row_entries';
  private readonly WORK_KEY = 'tz_work_hours';

  load(): string[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  save(ids: string[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(ids));
    } catch {
      // Silently fail if localStorage is unavailable
    }
  }

  loadEntries(): TimezoneEntry[] {
    try {
      const stored = localStorage.getItem(this.ENTRIES_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  saveEntries(entries: TimezoneEntry[]): void {
    try {
      localStorage.setItem(this.ENTRIES_KEY, JSON.stringify(entries));
    } catch {
      // Silently fail if localStorage is unavailable
    }
  }

  loadRowEntries(): [string, TimezoneEntry][] {
    try {
      const parsed = JSON.parse(localStorage.getItem(this.ROW_ENTRIES_KEY) ?? '[]');
      return Array.isArray(parsed) ? parsed.filter(p => Array.isArray(p) && typeof p[0] === 'string' && p[1]) : [];
    } catch {
      return [];
    }
  }

  saveRowEntries(entries: [string, TimezoneEntry][]): void {
    try {
      localStorage.setItem(this.ROW_ENTRIES_KEY, JSON.stringify(entries));
    } catch {
      // Silently fail if localStorage is unavailable
    }
  }

  loadWorkHours(): { start: number; end: number } | null {
    try {
      const parsed = JSON.parse(localStorage.getItem(this.WORK_KEY) ?? 'null');
      if (parsed && Number.isInteger(parsed.start) && Number.isInteger(parsed.end) && parsed.start >= 0 && parsed.end <= 24 && parsed.end > parsed.start) {
        return { start: parsed.start, end: parsed.end };
      }
      return null;
    } catch {
      return null;
    }
  }

  saveWorkHours(work: { start: number; end: number }): void {
    try {
      localStorage.setItem(this.WORK_KEY, JSON.stringify(work));
    } catch {
      // Silently fail if localStorage is unavailable
    }
  }

  loadHour12(): boolean | null {
    try {
      const v = localStorage.getItem(this.HOUR12_KEY);
      return v === null ? null : v === '1';
    } catch {
      return null;
    }
  }

  saveHour12(value: boolean): void {
    try {
      localStorage.setItem(this.HOUR12_KEY, value ? '1' : '0');
    } catch {
      // Silently fail if localStorage is unavailable
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      localStorage.removeItem(this.ENTRIES_KEY);
    } catch {
      // Silently fail if localStorage is unavailable
    }
  }
}
