import { Injectable, inject } from '@angular/core';
import { TimezoneEntry } from '../models/timezone.model';
import { TIMEZONE_DATABASE } from '../data/timezone-data';
import { ABBREVIATIONS, ABBREVIATION_OFFSETS, canonicalZoneId } from '../data/timezone-aliases';
import { TimeCalculationService } from './time-calculation.service';

export interface ZoneSearchResult {
  entry: TimezoneEntry;
  /** Secondary line, e.g. "India Standard Time · UTC+5:30" */
  detail: string;
  /** Short tag shown on the right, e.g. "IST" */
  badge: string;
  source: 'zone';
}

interface IndexedZone {
  id: string;
  city: string;
  area: string;
  country: string;
  longName: string;
  genericName: string;
  abbrs: string[];
  offset: number;
  hay: string;
  curated: boolean;
}

/** Lowercase, strip accents and underscores so "sao_paulo" matches "São Paulo". */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[_/]+/g, ' ')
    .toLowerCase()
    .trim();
}

@Injectable({ providedIn: 'root' })
export class TimezoneSearchIndexService {
  private timeCalc = inject(TimeCalculationService);
  private index: IndexedZone[] | null = null;
  private builtAt = 0;

  private build(): IndexedZone[] {
    // Offsets shift with DST; rebuild at most every 6 hours.
    if (this.index && Date.now() - this.builtAt < 6 * 3_600_000) return this.index;

    const now = new Date();
    const ids = new Set<string>();
    const supported = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
    if (supported) {
      try {
        supported('timeZone').forEach(id => ids.add(canonicalZoneId(id)));
      } catch {
        // Older engines: fall back to the curated list only.
      }
    }
    TIMEZONE_DATABASE.forEach(e => ids.add(e.id));
    ids.add('UTC');

    const abbrByZone = new Map<string, string[]>();
    Object.entries(ABBREVIATIONS).forEach(([abbr, zones]) =>
      zones.forEach(z => abbrByZone.set(z, [...(abbrByZone.get(z) ?? []), abbr])),
    );

    const longFmt = (id: string, style: 'long' | 'longGeneric') => {
      try {
        const parts = new Intl.DateTimeFormat('en-US', { timeZone: id, timeZoneName: style }).formatToParts(now);
        return parts.find(p => p.type === 'timeZoneName')?.value ?? '';
      } catch {
        return '';
      }
    };

    const result: IndexedZone[] = [];
    ids.forEach(id => {
      let offset: number;
      try {
        offset = this.timeCalc.getOffsetHours(id, now);
      } catch {
        return;
      }
      const db = TIMEZONE_DATABASE.find(e => e.id === id);
      const segments = id.split('/');
      const city = db?.name ?? segments[segments.length - 1].replace(/_/g, ' ');
      const area = segments.length > 1 ? segments[0] : '';
      const longName = longFmt(id, 'long');
      const genericName = longFmt(id, 'longGeneric');
      const abbrs = [...(abbrByZone.get(id) ?? [])];
      const intlAbbr = this.timeCalc.getTimezoneAbbr(id, now);
      if (/^[A-Z]{2,5}$/.test(intlAbbr) && !abbrs.includes(intlAbbr)) abbrs.push(intlAbbr);
      const country = db?.country ?? '';
      const hay = normalize([city, id, area, country, db?.region ?? '', longName, genericName, ...abbrs].join(' '));
      result.push({ id, city, area, country, longName, genericName, abbrs, offset, hay, curated: !!db });
    });

    this.index = result;
    this.builtAt = Date.now();
    return result;
  }

  /**
   * Parses offset expressions into UTC hours: "UTC+5:30", "gmt -3", "+9", "+0530",
   * "utc", and abbreviation arithmetic such as "CET+1", "EST-2", "IST+0:30".
   * Returns null if the query is not an offset expression.
   */
  parseOffset(query: string): { hours: number; label: string } | null {
    const q = query.trim().replace(/\s+/g, '').replace(/\u2212/g, '-');
    const lower = q.toLowerCase();
    if (lower === 'utc' || lower === 'gmt' || lower === 'z') return { hours: 0, label: 'UTC' };
    const m = q.match(/^([A-Za-z]{1,5})?([+-])(\d{1,2})(?::?(\d{2}))?$/);
    if (!m) return null;
    const prefix = (m[1] ?? '').toUpperCase();
    let base = 0;
    if (prefix && prefix !== 'UTC' && prefix !== 'GMT') {
      if (!(prefix in ABBREVIATION_OFFSETS)) return null;
      base = ABBREVIATION_OFFSETS[prefix];
    }
    const h = Number(m[3]);
    const min = m[4] ? Number(m[4]) : 0;
    if (h > 14 || min >= 60) return null;
    const hours = base + (m[2] === '+' ? 1 : -1) * (h + min / 60);
    if (hours < -12 || hours > 14) return null;
    const label = prefix && prefix !== 'UTC' && prefix !== 'GMT'
      ? `${prefix}${m[2]}${h}${min ? ':' + String(min).padStart(2, '0') : ''} = ${this.timeCalc.formatOffset(hours)}`
      : this.timeCalc.formatOffset(hours);
    return { hours, label };
  }

  /** A short explanation for an offset expression, e.g. "CET+1 = UTC+2". */
  describeExpression(query: string): string | null {
    const parsed = this.parseOffset(query);
    return parsed ? parsed.label : null;
  }

  search(query: string, limit = 8): ZoneSearchResult[] {
    const raw = query.trim();
    if (!raw) return [];
    const zones = this.build();
    const scored = new Map<string, { z: IndexedZone; score: number }>();
    const bump = (z: IndexedZone, score: number) => {
      const prev = scored.get(z.id);
      if (!prev || prev.score < score) scored.set(z.id, { z, score });
    };

    // 1. UTC offsets
    const offset = this.parseOffset(raw);
    if (offset !== null) {
      zones
        .filter(z => Math.abs(z.offset - offset.hours) < 1e-6)
        .forEach(z => bump(z, 160 + (z.curated ? 15 : 0) + (z.id === 'UTC' ? 20 : 0)));
      if (scored.size === 0) {
        // No real zone uses this offset right now; offer the fixed Etc/GMT zone when one exists.
        const whole = Number.isInteger(offset.hours) && offset.hours !== 0;
        const etc = whole ? `Etc/GMT${offset.hours > 0 ? '-' : '+'}${Math.abs(offset.hours)}` : null;
        if (etc) {
          try {
            new Intl.DateTimeFormat('en-US', { timeZone: etc });
            const label = this.timeCalc.formatOffset(offset.hours);
            return [{
              entry: { id: etc, name: label, country: 'Fixed offset', region: label },
              detail: 'Fixed offset, no daylight saving',
              badge: label,
              source: 'zone',
            }];
          } catch {
            // Not supported; fall through to text search.
          }
        }
      }
      if (/^[+-]/.test(raw.trim()) || /^(utc|gmt)/i.test(raw.trim()) || /[+-]/.test(raw)) {
        return this.rank(scored, limit);
      }
    }

    // 2. Abbreviations (exact, case-insensitive)
    const upper = raw.toUpperCase();
    const abbrZones = ABBREVIATIONS[upper];
    if (abbrZones) {
      abbrZones.forEach((id, i) => {
        const z = zones.find(x => x.id === id);
        if (z) bump(z, 200 - i);
      });
    }

    // 3. Text match over city, IANA id, names, country, abbreviations
    const q = normalize(raw);
    if (q.length >= 1) {
      const terms = q.split(/\s+/).filter(Boolean);
      for (const z of zones) {
        if (!terms.every(t => z.hay.includes(t))) continue;
        const city = normalize(z.city);
        const id = normalize(z.id);
        let score = 10;
        if (city === q || id === q) score = 150;
        else if (normalize(z.country) === q) score = 130;
        else if (city.startsWith(q)) score = 120;
        else if (z.abbrs.some(a => a.toLowerCase() === q)) score = 110;
        else if (normalize(z.genericName).startsWith(q) || normalize(z.longName).startsWith(q)) score = 95;
        else if (id.split(' ').some(seg => seg.startsWith(q))) score = 90;
        else if (city.includes(q)) score = 50;
        else if (normalize(z.country).startsWith(q)) score = 45;
        if (z.curated) score += 8;
        // Single-letter queries only make sense as a prefix of a city.
        if (q.length < 2 && score < 120) continue;
        bump(z, score);
      }
    }

    return this.rank(scored, limit);
  }

  private rank(scored: Map<string, { z: IndexedZone; score: number }>, limit: number): ZoneSearchResult[] {
    return [...scored.values()]
      .sort((a, b) => b.score - a.score || a.z.city.localeCompare(b.z.city))
      .slice(0, limit)
      .map(({ z }) => this.toResult(z));
  }

  private toResult(z: IndexedZone): ZoneSearchResult {
    const name = z.genericName || z.longName;
    const offsetLabel = this.timeCalc.formatOffset(z.offset);
    const place = z.country || z.area.replace(/_/g, ' ');
    const detailParts = [place, name && name !== offsetLabel ? name : '', offsetLabel].filter(Boolean);
    return {
      entry: { id: z.id, name: z.city, country: place, region: name },
      detail: detailParts.join(' · '),
      badge: z.abbrs[0] ?? offsetLabel,
      source: 'zone',
    };
  }
}
