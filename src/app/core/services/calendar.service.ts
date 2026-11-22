import { Injectable } from '@angular/core';

export interface CalendarEvent {
  title: string;
  start: number;        // epoch ms
  durationMinutes: number;
  description: string;
}

/** Builds calendar invites for a pinned time: .ics download, Google Calendar and Outlook links. */
@Injectable({ providedIn: 'root' })
export class CalendarService {
  private stamp(ms: number): string {
    return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }

  private escapeIcs(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r\n|\r|\n/g, '\\n')
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '');
  }

  /** RFC 5545 lines are folded at 75 octets. */
  private fold(line: string): string {
    const out: string[] = [];
    let rest = line;
    while (rest.length > 74) {
      out.push(rest.slice(0, 74));
      rest = ' ' + rest.slice(74);
    }
    out.push(rest);
    return out.join('\r\n');
  }

  toIcs(e: CalendarEvent): string {
    const end = e.start + e.durationMinutes * 60_000;
    const uid = `${e.start}-${Math.random().toString(36).slice(2)}@brainless-brilliant.github.io`;
    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//brainless-brilliant//World Time Zones//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${this.stamp(Date.now())}`,
      `DTSTART:${this.stamp(e.start)}`,
      `DTEND:${this.stamp(end)}`,
      this.fold(`SUMMARY:${this.escapeIcs(e.title)}`),
      this.fold(`DESCRIPTION:${this.escapeIcs(e.description)}`),
      'END:VEVENT',
      'END:VCALENDAR',
      '',
    ].join('\r\n');
  }

  downloadIcs(e: CalendarEvent): void {
    const blob = new Blob([this.toIcs(e)], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${e.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'meeting'}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  googleUrl(e: CalendarEvent): string {
    const end = e.start + e.durationMinutes * 60_000;
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: e.title,
      dates: `${this.stamp(e.start)}/${this.stamp(end)}`,
      details: e.description,
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  outlookUrl(e: CalendarEvent): string {
    const end = e.start + e.durationMinutes * 60_000;
    const params = new URLSearchParams({
      path: '/calendar/action/compose',
      rru: 'addevent',
      subject: e.title,
      startdt: new Date(e.start).toISOString(),
      enddt: new Date(end).toISOString(),
      body: e.description,
    });
    return `https://outlook.office.com/calendar/0/deeplink/compose?${params.toString()}`;
  }
}
