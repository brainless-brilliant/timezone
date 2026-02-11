import { Injectable } from '@angular/core';
import { TimeOfDay, HourBlock } from '../models/timezone.model';

@Injectable({ providedIn: 'root' })
export class TimeCalculationService {
  classifyHour(hour: number): TimeOfDay {
    if (hour >= 0 && hour <= 5) return TimeOfDay.Night;
    if (hour >= 6 && hour <= 8) return TimeOfDay.EarlyMorning;
    if (hour >= 9 && hour <= 11) return TimeOfDay.Morning;
    if (hour >= 12 && hour <= 17) return TimeOfDay.Business;
    if (hour >= 18 && hour <= 20) return TimeOfDay.Evening;
    return TimeOfDay.LateEvening;
  }

  formatTime(date: Date, timezoneId: string): string {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezoneId,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return formatter.format(date);
  }

  formatDate(date: Date, timezoneId: string): string {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezoneId,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    return formatter.format(date);
  }

  getUtcOffset(timezoneId: string): string {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezoneId,
      timeZoneName: 'shortOffset',
    });

    const parts = formatter.formatToParts(now);
    const offsetPart = parts.find(part => part.type === 'timeZoneName');

    if (offsetPart && offsetPart.value) {
      return offsetPart.value.replace('GMT', 'UTC');
    }

    return 'UTC';
  }

  getCurrentHour(date: Date, timezoneId: string): number {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezoneId,
      hour: 'numeric',
      hour12: false,
    });

    const hourStr = formatter.format(date);
    return parseInt(hourStr, 10) % 24;
  }

  generateHourBlocks(
    date: Date,
    timezoneId: string,
    referenceTimezoneId: string,
    sliderOffset: number
  ): HourBlock[] {
    // The current hour column is based on the reference timezone
    const refCurrentHour = this.getCurrentHour(date, referenceTimezoneId);
    const targetColumnIndex = ((refCurrentHour + sliderOffset) % 24 + 24) % 24;

    // Calculate offset difference: how many hours this timezone is ahead of reference
    const refOffsetHours = this.getOffsetHours(referenceTimezoneId);
    const thisOffsetHours = this.getOffsetHours(timezoneId);
    const diffHours = thisOffsetHours - refOffsetHours;

    const blocks: HourBlock[] = [];
    let prevWholeHour = -1;

    for (let col = 0; col < 24; col++) {
      // What time is it in this timezone when the reference is at hour `col`?
      const exactHour = col + diffHours;
      const normalizedHour = ((exactHour % 24) + 24) % 24;
      const wholeHour = Math.floor(normalizedHour);
      const minutes = Math.round((normalizedHour - wholeHour) * 60);

      // Detect midnight crossing: when whole hour wraps from 23->0 or jumps backward
      const crossesMidnight = col > 0 && wholeHour < prevWholeHour;
      prevWholeHour = wholeHour;

      const isPM = wholeHour >= 12;
      const displayHourNum = wholeHour === 0 ? 12 : wholeHour > 12 ? wholeHour - 12 : wholeHour;
      const minuteStr = minutes > 0 ? `:${minutes.toString().padStart(2, '0')}` : '';
      const displayHour = `${displayHourNum}${minuteStr} ${isPM ? 'PM' : 'AM'}`;

      blocks.push({
        hour: wholeHour,
        minutes,
        displayHour,
        timeOfDay: this.classifyHour(wholeHour),
        isCurrentHour: col === targetColumnIndex,
        crossesMidnight,
      });
    }

    return blocks;
  }

  getTimezoneAbbr(timezoneId: string): string {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezoneId,
      timeZoneName: 'short',
    });
    const parts = formatter.formatToParts(new Date());
    const tzPart = parts.find(p => p.type === 'timeZoneName');
    return tzPart ? tzPart.value : '';
  }

  getOffsetHours(timezoneId: string): number {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezoneId,
      timeZoneName: 'shortOffset',
    });
    const parts = formatter.formatToParts(now);
    const offsetPart = parts.find(p => p.type === 'timeZoneName');
    if (!offsetPart) return 0;
    const match = offsetPart.value.match(/GMT([+-]?\d+(?::\d+)?)/);
    if (!match) return 0;
    const [hours, minutes] = match[1].split(':').map(Number);
    return hours + (minutes ? (hours < 0 ? -minutes / 60 : minutes / 60) : 0);
  }
}
