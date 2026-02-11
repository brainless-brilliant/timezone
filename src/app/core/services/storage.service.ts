import { Injectable } from '@angular/core';
import { TimezoneEntry } from '../models/timezone.model';

@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly STORAGE_KEY = 'tz_selected_ids';
  private readonly ENTRIES_KEY = 'tz_custom_entries';

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

  clear(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      localStorage.removeItem(this.ENTRIES_KEY);
    } catch {
      // Silently fail if localStorage is unavailable
    }
  }
}
