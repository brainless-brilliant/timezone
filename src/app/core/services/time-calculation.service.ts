import { Injectable } from '@angular/core';
import { TimeOfDay, HourBlock } from '../models/timezone.model';
import { LEGACY_ZONE_ALIASES, ZONE_ABBREVIATIONS } from '../data/timezone-aliases';

const HOUR_MS = 3_600_000;

@Injectable({ providedIn: 'root' })
export class TimeCalculationService {
  // Intl.DateTimeFormat construction is comparatively expensive; cache by key.
  private formatters = new Map<string, Intl.DateTimeFormat>();

  private fmt(timeZone: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
    const key = timeZone + '|' + JSON.stringify(options);
    let f = this.formatters.get(key);
    if (!f) {
      f = new Intl.DateTimeFormat('en-US', { timeZone, ...options });
      this.formatters.set(key, f);
    }
    return f;
  }

  classifyHour(hour: number): TimeOfDay {
    if (hour >= 0 && hour <= 5) return TimeOfDay.Night;
    if (hour >= 6 && hour <= 8) return TimeOfDay.EarlyMorning;
    if (hour >= 9 && hour <= 11) return TimeOfDay.Morning;
    if (hour >= 12 && hour <= 17) return TimeOfDay.Business;
    if (hour >= 18 && hour <= 20) return TimeOfDay.Evening;
    return TimeOfDay.LateEvening;
  }

  formatTime(date: Date, timezoneId: string, hour12 = true): string {
    if (!hour12) {
      return this.fmt(timezoneId, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
    }
    return this.fmt(timezoneId, { hour: 'numeric', minute: '2-digit', hour12: true }).format(date);
  }

  formatDate(date: Date, timezoneId: string): string {
    return this.fmt(timezoneId, { weekday: 'short', month: 'short', day: 'numeric' }).format(date);
  }

  formatWeekday(date: Date, timezoneId: string): string {
    return this.fmt(timezoneId, { weekday: 'short' }).format(date);
  }

  /** Offset in hours (fractional for :30 / :45 zones) at the given instant. */
  getOffsetHours(timezoneId: string, at: Date = new Date()): number {
    const parts = this.fmt(timezoneId, { timeZoneName: 'shortOffset' }).formatToParts(at);
    const value = parts.find(p => p.type === 'timeZoneName')?.value ?? '';
    const match = value.match(/GMT([+-])(\d+)(?::(\d+))?/);
    if (!match) return 0;
    const sign = match[1] === '-' ? -1 : 1;
    return sign * (Number(match[2]) + (match[3] ? Number(match[3]) / 60 : 0));
  }

  /** "UTC+5:30", "UTC-4", "UTC". */
  formatOffset(hours: number): string {
    if (hours === 0) return 'UTC';
    const sign = hours < 0 ? '-' : '+';
    const abs = Math.abs(hours);
    const h = Math.floor(abs);
    const m = Math.round((abs - h) * 60);
    return `UTC${sign}${h}${m ? ':' + String(m).padStart(2, '0') : ''}`;
  }

  getUtcOffset(timezoneId: string, at: Date = new Date()): string {
    return this.formatOffset(this.getOffsetHours(timezoneId, at));
  }

  /** "+5:30", "-10", "0". Offset relative to the reference row. */
  formatRelativeOffset(diff: number): string {
    if (diff === 0) return '0';
    const sign = diff < 0 ? '-' : '+';
    const abs = Math.abs(diff);
    const h = Math.floor(abs);
    const m = Math.round((abs - h) * 60);
    return `${sign}${h}${m ? ':' + String(m).padStart(2, '0') : ''}`;
  }

  isDst(timezoneId: string, at: Date = new Date()): boolean {
    const year = at.getUTCFullYear();
    const jan = this.getOffsetHours(timezoneId, new Date(Date.UTC(year, 0, 1)));
    const jul = this.getOffsetHours(timezoneId, new Date(Date.UTC(year, 6, 1)));
    if (jan === jul) return false;
    return this.getOffsetHours(timezoneId, at) === Math.max(jan, jul);
  }

  getTimezoneAbbr(timezoneId: string, at: Date = new Date()): string {
    const parts = this.fmt(timezoneId, { timeZoneName: 'short' }).formatToParts(at);
    const intl = parts.find(p => p.type === 'timeZoneName')?.value ?? '';
    if (/^[A-Z]{2,5}$/.test(intl)) return intl;
    const curated = ZONE_ABBREVIATIONS[timezoneId];
    if (curated) {
      return this.isDst(timezoneId, at) && curated[1] ? curated[1] : curated[0];
    }
    return this.getUtcOffset(timezoneId, at);
  }

  /** The visitor's own zone, in canonical form. */
  localZone(): string {
    const id = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    return LEGACY_ZONE_ALIASES[id] ?? id;
  }

  /** "4h 30m", "3h", "45m". */
  formatDuration(hours: number): string {
    const abs = Math.abs(hours);
    const h = Math.floor(abs + 1e-9);
    const m = Math.round((abs - h) * 60);
    if (h && m) return `${h}h ${m}m`;
    return h ? `${h}h` : `${m}m`;
  }

  private transitionCache = new Map<string, number | null>();

  /** Next instant (epoch ms) after `from` at which the zone's UTC offset changes, within ~13 months. */
  nextTransition(timezoneId: string, from: Date = new Date()): number | null {
    const dayKey = `${timezoneId}|${Math.floor(from.getTime() / 86_400_000)}`;
    if (this.transitionCache.has(dayKey)) return this.transitionCache.get(dayKey)!;
    const start = this.getOffsetHours(timezoneId, from);
    let found: number | null = null;
    let prev = from.getTime();
    for (let d = 1; d <= 400; d++) {
      const t = from.getTime() + d * 86_400_000;
      if (this.getOffsetHours(timezoneId, new Date(t)) !== start) {
        // Narrow to the hour.
        let lo = prev;
        let hi = t;
        while (hi - lo > HOUR_MS) {
          const mid = lo + Math.floor((hi - lo) / 2);
          if (this.getOffsetHours(timezoneId, new Date(mid)) === start) lo = mid; else hi = mid;
        }
        found = hi;
        break;
      }
      prev = t;
    }
    this.transitionCache.set(dayKey, found);
    return found;
  }

  /**
   * A one or two line, plain-language explanation of a zone relative to the
   * visitor's local zone, e.g.
   *   "4h 30m ahead of you (Europe/Berlin). Already Monday there."
   *   "Gap becomes 3h 30m on Sun, Mar 29 when clocks change."
   */
  describeRelativeToLocal(timezoneId: string, now: Date = new Date()): { line1: string; line2: string } {
    const local = this.localZone();
    const zoneOffset = this.getOffsetHours(timezoneId, now);
    const localOffset = this.getOffsetHours(local, now);
    const diff = zoneOffset - localOffset;
    const localLabel = local.split('/').pop()!.replace(/_/g, ' ');

    let line1: string;
    if (timezoneId === local) {
      line1 = `Your local time zone (${this.formatOffset(localOffset)}).`;
    } else if (Math.abs(diff) < 1e-9) {
      line1 = `Same time as you (${localLabel}).`;
    } else {
      line1 = `${this.formatDuration(diff)} ${diff > 0 ? 'ahead of' : 'behind'} you (${localLabel}).`;
      const here = this.formatWeekday(now, local);
      const there = this.formatWeekday(now, timezoneId);
      if (here !== there) {
        line1 += diff > 0 ? ` Already ${this.fullWeekday(now, timezoneId)} there.` : ` Still ${this.fullWeekday(now, timezoneId)} there.`;
      }
    }

    // Line 2: the next clock change that affects this zone or the gap to the visitor.
    const zoneNext = this.nextTransition(timezoneId, now);
    const localNext = timezoneId === local ? null : this.nextTransition(local, now);
    let line2: string;
    if (zoneNext === null && localNext === null) {
      line2 = timezoneId === local || Math.abs(diff) < 1e-9 ? 'No daylight saving changes ahead.' : 'Gap stays the same all year.';
    } else {
      const next = Math.min(zoneNext ?? Infinity, localNext ?? Infinity);
      const at = new Date(next + 60_000);
      const newDiff = this.getOffsetHours(timezoneId, at) - this.getOffsetHours(local, at);
      const when = this.formatDate(at, timezoneId === local || next === localNext ? local : timezoneId);
      if (timezoneId === local) {
        const shift = this.getOffsetHours(local, at) - localOffset;
        line2 = `Clocks go ${shift > 0 ? 'forward' : 'back'} ${this.formatDuration(shift)} on ${when}.`;
      } else if (Math.abs(newDiff - diff) < 1e-9) {
        line2 = `Both change clocks on ${when}; gap stays ${this.formatDuration(diff)}.`;
      } else {
        const who = next === localNext && next !== zoneNext ? 'your' : 'their';
        const gap = Math.abs(newDiff) < 1e-9 ? 'same time as you' : `${this.formatDuration(newDiff)} ${newDiff > 0 ? 'ahead' : 'behind'}`;
        line2 = `From ${when} (${who} clocks change): ${gap}.`;
      }
    }
    return { line1, line2 };
  }

  private fullWeekday(date: Date, timezoneId: string): string {
    return this.fmt(timezoneId, { weekday: 'long' }).format(date);
  }

  getCurrentHour(date: Date, timezoneId: string): number {
    return parseInt(this.fmt(timezoneId, { hour: 'numeric', hourCycle: 'h23' }).format(date), 10) % 24;
  }

  /** Wall-clock parts of an instant in a zone. */
  localParts(date: Date, timezoneId: string): { year: number; month: number; day: number; hour: number; minute: number; weekday: number } {
    const parts = this.fmt(timezoneId, {
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', hourCycle: 'h23', weekday: 'short',
    }).formatToParts(date);
    const get = (t: string) => parts.find(p => p.type === t)?.value ?? '0';
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return {
      year: Number(get('year')),
      month: Number(get('month')),
      day: Number(get('day')),
      hour: Number(get('hour')) % 24,
      minute: Number(get('minute')),
      weekday: weekdays.indexOf(get('weekday')),
    };
  }

  /**
   * The instant at which a zone's wall clock reads the given local date and time.
   * Uses the zone's offset at a first guess, then corrects once for DST changes.
   */
  zonedInstant(timezoneId: string, year: number, month: number, day: number, hour = 0, minute = 0): number {
    const asUtc = Date.UTC(year, month - 1, day, hour, minute);
    let guess = asUtc - this.getOffsetHours(timezoneId, new Date(asUtc)) * HOUR_MS;
    const corrected = asUtc - this.getOffsetHours(timezoneId, new Date(guess)) * HOUR_MS;
    if (corrected !== guess) guess = corrected;
    return guess;
  }

  /** Whole calendar days from the visitor's today to the instant's date in the visitor's zone. */
  dayDelta(instant: Date, fromZone: string, toZone: string): number {
    const a = this.localParts(instant, fromZone);
    const b = this.localParts(instant, toZone);
    return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000);
  }

  /**
   * One instant per hour of the reference zone's calendar day `dayOffset` days from today.
   * Column i is "i o'clock" on that day in the reference zone (DST days are still 24 columns).
   */
  columnInstants(now: Date, referenceTimezoneId: string, dayOffset = 0): Date[] {
    const today = this.localParts(now, referenceTimezoneId);
    const target = new Date(Date.UTC(today.year, today.month - 1, today.day + dayOffset));
    const midnight = this.zonedInstant(
      referenceTimezoneId, target.getUTCFullYear(), target.getUTCMonth() + 1, target.getUTCDate(),
    );
    const instants: Date[] = [];
    for (let col = 0; col < 24; col++) instants.push(new Date(midnight + col * HOUR_MS));
    return instants;
  }

  /** Likely availability of someone in `zone` at a local hour, given working hours and weekends. */
  availability(hour: number, weekday: number, weekendDays: number[], work: { start: number; end: number }): 'work' | 'edge' | 'off' | 'sleep' | 'weekend' {
    if (hour < 7 || hour >= 23) return 'sleep';
    if (weekendDays.includes(weekday)) return 'weekend';
    if (hour >= work.start && hour < work.end) return 'work';
    if (hour === work.start - 1 || hour === work.end) return 'edge';
    return 'off';
  }

  generateHourBlocks(
    now: Date,
    timezoneId: string,
    referenceTimezoneId: string,
    hour12 = true,
    dayOffset = 0,
    work: { start: number; end: number } = { start: 9, end: 17 },
    weekendDays: number[] = [0, 6],
  ): HourBlock[] {
    const instants = this.columnInstants(now, referenceTimezoneId, dayOffset);
    const nowMs = now.getTime();
    const blocks: HourBlock[] = [];
    let prevWholeHour = -1;

    instants.forEach((instant, col) => {
      const local = this.localParts(instant, timezoneId);
      const wholeHour = local.hour;
      const minutes = local.minute;
      const crossesMidnight = col > 0 && wholeHour < prevWholeHour;
      prevWholeHour = wholeHour;

      const minuteStr = minutes > 0 ? `:${String(minutes).padStart(2, '0')}` : '';
      let hourLabel: string;
      let periodLabel: string;
      if (hour12) {
        const displayHourNum = wholeHour === 0 ? 12 : wholeHour > 12 ? wholeHour - 12 : wholeHour;
        hourLabel = `${displayHourNum}${minuteStr}`;
        periodLabel = wholeHour >= 12 ? 'pm' : 'am';
      } else {
        hourLabel = `${String(wholeHour).padStart(2, '0')}${minuteStr}`;
        periodLabel = '';
      }

      const t = instant.getTime();
      blocks.push({
        hour: wholeHour,
        minutes,
        displayHour: `${hourLabel}${periodLabel ? ' ' + periodLabel.toUpperCase() : ''}`,
        hourLabel,
        periodLabel,
        dayLabel: wholeHour === 0 ? this.formatWeekday(instant, timezoneId) : '',
        timeOfDay: this.classifyHour(wholeHour),
        availability: this.availability(wholeHour, local.weekday, weekendDays, work),
        isCurrentHour: nowMs >= t && nowMs < t + HOUR_MS,
        crossesMidnight,
        instant: t,
      });
    });

    return blocks;
  }
}
