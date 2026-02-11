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

export interface HourBlock {
  hour: number;          // 0-23 whole hour in that timezone
  minutes: number;       // 0 or 30 (for half-hour offset timezones)
  displayHour: string;   // formatted e.g. '9 AM', '1:30 PM'
  timeOfDay: TimeOfDay;
  isCurrentHour: boolean;
  crossesMidnight: boolean; // true if this column crosses midnight boundary
}

export interface TimezoneRow {
  entry: TimezoneEntry;
  currentTime: string;    // e.g. '2:45 PM'
  currentDate: string;    // e.g. 'Mon, Feb 10'
  utcOffset: string;      // e.g. 'UTC-5'
  relativeOffset: string; // e.g. '+2', '-10.5', '' for first row
  timezoneAbbr: string;   // e.g. 'GMT', 'EST', 'IST'
  hourBlocks: HourBlock[];
}
