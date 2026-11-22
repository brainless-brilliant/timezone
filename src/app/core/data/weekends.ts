/**
 * Weekend days per zone where they differ from Saturday and Sunday.
 * Day numbers follow Date.getDay(): 0 = Sunday ... 6 = Saturday.
 */
const FRIDAY_SATURDAY = [5, 6];

const ZONE_WEEKENDS: Record<string, number[]> = {
  'Asia/Riyadh': FRIDAY_SATURDAY,
  'Asia/Kuwait': FRIDAY_SATURDAY,
  'Asia/Qatar': FRIDAY_SATURDAY,
  'Asia/Bahrain': FRIDAY_SATURDAY,
  'Asia/Muscat': FRIDAY_SATURDAY,
  'Asia/Baghdad': FRIDAY_SATURDAY,
  'Asia/Amman': FRIDAY_SATURDAY,
  'Asia/Jerusalem': FRIDAY_SATURDAY,
  'Asia/Dhaka': FRIDAY_SATURDAY,
  'Africa/Cairo': FRIDAY_SATURDAY,
  'Africa/Algiers': FRIDAY_SATURDAY,
  'Africa/Khartoum': FRIDAY_SATURDAY,
  'Africa/Tripoli': FRIDAY_SATURDAY,
  'Asia/Tehran': [5],
  'Asia/Kabul': [5],
};

const DEFAULT_WEEKEND = [0, 6];

export function weekendDays(zoneId: string): number[] {
  return ZONE_WEEKENDS[zoneId] ?? DEFAULT_WEEKEND;
}

export function weekendLabel(zoneId: string): string {
  const days = weekendDays(zoneId);
  if (days === DEFAULT_WEEKEND) return '';
  return days.length === 1 ? 'Friday weekend' : 'Friday-Saturday weekend';
}
