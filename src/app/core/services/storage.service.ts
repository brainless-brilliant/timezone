import { Injectable } from '@angular/core';
import { TimezoneEntry } from '../models/timezone.model';

@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly STORAGE_KEY = 'tz_selected_ids';
  private readonly ENTRIES_KEY = 'tz_custom_entries';
  private readonly HOUR12_KEY = 'tz_hour12';

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
