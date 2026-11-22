import { Injectable, inject } from '@angular/core';
import { TimeCalculationService } from './time-calculation.service';
import { TimezoneSearchIndexService, normalize } from './timezone-search-index.service';
import { TimezoneEntry } from '../models/timezone.model';

export interface PlaceCandidate {
  key?: string;          // existing row key, when the place is already on screen
  entry: TimezoneEntry;
}

export interface TimeQuery {
  instant: number;
  /** Zone the time was expressed in. */
  zoneId: string;
  /** Place the user named; null when the time is in the visitor's own zone. */
  place: PlaceCandidate | null;
  /** Human summary, e.g. "3:00 PM tomorrow in London". */
  label: string;
}

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_RE = /\b(today|tonight|tomorrow|tmrw|tmr|yesterday|(next\s+)?(sun|mon|tue|wed|thu|fri|sat)[a-z]*)\b/;
const NAMED_TIME_RE = /\b(noon|midday|midnight|now)\b/;
const CLOCK_RE = /(?:^|[\s,@])(\d{1,2})(?:[:.h](\d{2}))?\s*(a\.?m\.?|p\.?m\.?|a|p)?(?=$|[\s,])/;
const CONNECTORS_RE = /\b(in|at|on|for|time|o'?clock|local)\b/g;

/**
 * Understands short natural-language times such as "3pm london", "tomorrow 9:30 in tokyo",
 * "noon IST", "next fri 4pm new york", "14:00 berlin", "midnight" or "now".
 */
@Injectable({ providedIn: 'root' })
export class TimeQueryService {
  private timeCalc = inject(TimeCalculationService);
  private searchIndex = inject(TimezoneSearchIndexService);

  parse(
    raw: string,
    ctx: { now: Date; localZone: string; rows: { key: string; entry: TimezoneEntry }[]; hour12: boolean },
  ): TimeQuery | null {
    let q = ` ${raw.toLowerCase().trim()} `;
    if (!q.trim() || this.searchIndex.parseOffset(raw) !== null) return null;

    // Day
    let dayWord: string | null = null;
    let nextWeek = false;
    let weekday = -1;
    const dayMatch = q.match(DAY_RE);
    if (dayMatch) {
      dayWord = dayMatch[1];
      if (dayMatch[3]) {
        weekday = WEEKDAYS.indexOf(dayMatch[3]);
        nextWeek = !!dayMatch[2];
      }
      q = q.replace(dayMatch[0], ' ');
    }

    // Time
    let hour: number | null = null;
    let minute = 0;
    let isNow = false;
    const named = q.match(NAMED_TIME_RE);
    if (named) {
      if (named[1] === 'now') isNow = true;
      else hour = named[1] === 'midnight' ? 0 : 12;
      q = q.replace(named[0], ' ');
    } else {
      const clock = q.match(CLOCK_RE);
      if (!clock) return null;
      const h = Number(clock[1]);
      const m = clock[2] ? Number(clock[2]) : 0;
      const mer = clock[3]?.replace(/\./g, '');
      // A bare number ("5 london") is too ambiguous; require am/pm, minutes or a day word.
      if (!mer && !clock[2] && !dayWord) return null;
      if (m > 59) return null;
      if (mer) {
        if (h < 1 || h > 12) return null;
        hour = (h % 12) + (mer.startsWith('p') ? 12 : 0);
      } else {
        if (h > 23) return null;
        hour = h;
        if (dayWord === 'tonight' && h < 12) hour += 12;
      }
      minute = m;
      q = q.replace(clock[0], ' ');
    }

    // Place: whatever is left after removing connectors and punctuation.
    const placeText = q.replace(CONNECTORS_RE, ' ').replace(/[,@]/g, ' ').replace(/\s+/g, ' ').trim();
    let zoneId = ctx.localZone;
    let place: PlaceCandidate | null = null;
    if (placeText) {
      place = this.resolvePlace(placeText, ctx.rows);
      if (!place) return null;
      zoneId = place.entry.id;
    }

    // Date in that zone
    let instant: number;
    if (isNow) {
      instant = ctx.now.getTime();
    } else {
      const today = this.timeCalc.localParts(ctx.now, zoneId);
      let add = 0;
      if (dayWord === 'tomorrow' || dayWord === 'tmrw' || dayWord === 'tmr') add = 1;
      else if (dayWord === 'yesterday') add = -1;
      else if (weekday >= 0) {
        add = (weekday - today.weekday + 7) % 7;
        if (nextWeek && add === 0) add = 7;
      }
      const at = (days: number) => {
        const target = new Date(Date.UTC(today.year, today.month - 1, today.day + days));
        return this.timeCalc.zonedInstant(
          zoneId, target.getUTCFullYear(), target.getUTCMonth() + 1, target.getUTCDate(), hour ?? 0, minute,
        );
      };
      instant = at(add);
      // With no day given, a time more than 12 hours ago almost always means the next one
      // ("midnight" in the evening is tonight's midnight, not this morning's).
      if (!dayWord && instant < ctx.now.getTime() - 12 * 3_600_000) instant = at(add + 1);
    }

    const when = this.timeCalc.formatTime(new Date(instant), zoneId, ctx.hour12);
    const day = isNow ? '' : this.relativeDay(new Date(instant), zoneId, ctx.now);
    const where = place ? `in ${place.entry.name}` : 'your time';
    return { instant, zoneId, place, label: `${isNow ? 'Now' : when}${day ? ' ' + day : ''} ${where}` };
  }

  /** "today", "tomorrow", "yesterday" or "on Fri, Nov 27", relative to that zone's today. */
  relativeDay(at: Date, zoneId: string, now: Date): string {
    const a = this.timeCalc.localParts(now, zoneId);
    const b = this.timeCalc.localParts(at, zoneId);
    const diff = Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000);
    if (diff === 0) return 'today';
    if (diff === 1) return 'tomorrow';
    if (diff === -1) return 'yesterday';
    return 'on ' + this.timeCalc.formatDate(at, zoneId);
  }

  private resolvePlace(text: string, rows: { key: string; entry: TimezoneEntry }[]): PlaceCandidate | null {
    const q = normalize(text);
    // Prefer places already on screen, including custom labels like "Alice".
    const onScreen = rows.find(r => normalize(r.entry.name) === q)
      ?? rows.find(r => normalize(r.entry.name).startsWith(q))
      ?? rows.find(r => r.entry.id.toLowerCase() === text.toLowerCase());
    if (onScreen) return { key: onScreen.key, entry: onScreen.entry };
    const hit = this.searchIndex.search(text, 1)[0];
    return hit ? { entry: hit.entry } : null;
  }
}
