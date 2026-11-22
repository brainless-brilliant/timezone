export interface TimezoneEntry {
  id: string;        // IANA timezone ID e.g. 'America/New_York'
  name: string;      // Display name e.g. 'New York'
  country: string;   // Country name
  region: string;    // Region description
}

export enum TimeOfDay {
  Night = 'night',              // 0-5
  EarlyMorning = 'early-morning', // 6-8
  Morning = 'morning',          // 9-11
  Business = 'business',        // 12-17
  Evening = 'evening',          // 18-20
  LateEvening = 'late-evening', // 21-23
}

/** What a person in this zone is most likely doing at a given time. */
export type Availability = 'work' | 'edge' | 'off' | 'sleep' | 'weekend';

export interface WorkHours {
  start: number; // hour, 0-23
  end: number;   // hour, 1-24 (exclusive)
}

export interface HourBlock {
  hour: number;          // 0-23 local hour in that timezone
  minutes: number;       // 0, 30 or 45 for fractional-offset zones
  displayHour: string;   // formatted e.g. '9 AM', '1:30 PM', '13:30'
  hourLabel: string;     // e.g. '9', '1:30', '13'
  periodLabel: string;   // 'am' | 'pm' | '' in 24-hour mode
  dayLabel: string;      // weekday shown at local midnight, e.g. 'Tue'
  timeOfDay: TimeOfDay;
  availability: Availability;
  isCurrentHour: boolean;
  crossesMidnight: boolean;
  instant: number;       // epoch ms of this column (reference zone hh:00)
}

export interface RowStatus {
  availability: Availability;
  label: string;         // 'Working', 'Asleep', 'Weekend', ...
}

export interface TimezoneRow {
  /** Unique row key: the zone id, or "zone~Label" for renamed or duplicate rows. */
  key: string;
  entry: TimezoneEntry;
  /** City behind a custom label, shown when it differs from the label. */
  zoneCity: string;
  currentTime: string;    // e.g. '2:45 PM'
  currentDate: string;    // e.g. 'Mon, Feb 10'
  utcOffset: string;      // e.g. 'UTC-5'
  relativeOffset: string; // e.g. '+2', '-9:30', '' for the reference row
  isDst: boolean;
  timezoneAbbr: string;   // e.g. 'GMT', 'EST', 'IST'
  hourBlocks: HourBlock[];
}
