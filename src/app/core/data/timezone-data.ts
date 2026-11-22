import { TimezoneEntry } from '../models/timezone.model';

export const TIMEZONE_DATABASE: TimezoneEntry[] = [
  // North America
  { id: 'America/New_York', name: 'New York', country: 'United States', region: 'Eastern Time' },
  { id: 'America/Chicago', name: 'Chicago', country: 'United States', region: 'Central Time' },
  { id: 'America/Denver', name: 'Denver', country: 'United States', region: 'Mountain Time' },
  { id: 'America/Los_Angeles', name: 'Los Angeles', country: 'United States', region: 'Pacific Time' },
  { id: 'America/Anchorage', name: 'Anchorage', country: 'United States', region: 'Alaska Time' },
  { id: 'Pacific/Honolulu', name: 'Honolulu', country: 'United States', region: 'Hawaii Time' },
  { id: 'America/Toronto', name: 'Toronto', country: 'Canada', region: 'Eastern Time' },
  { id: 'America/Vancouver', name: 'Vancouver', country: 'Canada', region: 'Pacific Time' },
  { id: 'America/Mexico_City', name: 'Mexico City', country: 'Mexico', region: 'Central Time' },

  // Europe
  { id: 'Europe/London', name: 'London', country: 'United Kingdom', region: 'GMT/BST' },
  { id: 'Europe/Paris', name: 'Paris', country: 'France', region: 'Central European Time' },
  { id: 'Europe/Berlin', name: 'Berlin', country: 'Germany', region: 'Central European Time' },
  { id: 'Europe/Rome', name: 'Rome', country: 'Italy', region: 'Central European Time' },
  { id: 'Europe/Madrid', name: 'Madrid', country: 'Spain', region: 'Central European Time' },
  { id: 'Europe/Amsterdam', name: 'Amsterdam', country: 'Netherlands', region: 'Central European Time' },
  { id: 'Europe/Zurich', name: 'Zurich', country: 'Switzerland', region: 'Central European Time' },
  { id: 'Europe/Vienna', name: 'Vienna', country: 'Austria', region: 'Central European Time' },
  { id: 'Europe/Stockholm', name: 'Stockholm', country: 'Sweden', region: 'Central European Time' },
  { id: 'Europe/Helsinki', name: 'Helsinki', country: 'Finland', region: 'Eastern European Time' },
  { id: 'Europe/Moscow', name: 'Moscow', country: 'Russia', region: 'Moscow Time' },

  // Asia
  { id: 'Asia/Tokyo', name: 'Tokyo', country: 'Japan', region: 'Japan Standard Time' },
  { id: 'Asia/Shanghai', name: 'Shanghai', country: 'China', region: 'China Standard Time' },
  { id: 'Asia/Hong_Kong', name: 'Hong Kong', country: 'Hong Kong', region: 'Hong Kong Time' },
  { id: 'Asia/Singapore', name: 'Singapore', country: 'Singapore', region: 'Singapore Time' },
  { id: 'Asia/Seoul', name: 'Seoul', country: 'South Korea', region: 'Korea Standard Time' },
  { id: 'Asia/Bangkok', name: 'Bangkok', country: 'Thailand', region: 'Indochina Time' },
  { id: 'Asia/Jakarta', name: 'Jakarta', country: 'Indonesia', region: 'Western Indonesia Time' },
  { id: 'Asia/Manila', name: 'Manila', country: 'Philippines', region: 'Philippine Time' },
  { id: 'Asia/Kuala_Lumpur', name: 'Kuala Lumpur', country: 'Malaysia', region: 'Malaysia Time' },
  { id: 'Asia/Kolkata', name: 'Kolkata', country: 'India', region: 'India Standard Time (Mumbai, New Delhi, Bengaluru)' },
  { id: 'Asia/Dubai', name: 'Dubai', country: 'UAE', region: 'Gulf Standard Time' },
  { id: 'Asia/Tehran', name: 'Tehran', country: 'Iran', region: 'Iran Standard Time' },

  // Australia/Oceania
  { id: 'Australia/Sydney', name: 'Sydney', country: 'Australia', region: 'Australian Eastern Time' },
  { id: 'Australia/Melbourne', name: 'Melbourne', country: 'Australia', region: 'Australian Eastern Time' },
  { id: 'Australia/Brisbane', name: 'Brisbane', country: 'Australia', region: 'Australian Eastern Time' },
  { id: 'Australia/Perth', name: 'Perth', country: 'Australia', region: 'Australian Western Time' },
  { id: 'Australia/Adelaide', name: 'Adelaide', country: 'Australia', region: 'Australian Central Time' },
  { id: 'Pacific/Auckland', name: 'Auckland', country: 'New Zealand', region: 'New Zealand Time' },

  // South America
  { id: 'America/Sao_Paulo', name: 'São Paulo', country: 'Brazil', region: 'Brasilia Time' },
  { id: 'America/Argentina/Buenos_Aires', name: 'Buenos Aires', country: 'Argentina', region: 'Argentina Time' },
  { id: 'America/Santiago', name: 'Santiago', country: 'Chile', region: 'Chile Time' },
  { id: 'America/Lima', name: 'Lima', country: 'Peru', region: 'Peru Time' },
  { id: 'America/Bogota', name: 'Bogotá', country: 'Colombia', region: 'Colombia Time' },

  // Africa
  { id: 'Africa/Cairo', name: 'Cairo', country: 'Egypt', region: 'Eastern European Time' },
  { id: 'Africa/Lagos', name: 'Lagos', country: 'Nigeria', region: 'West Africa Time' },
  { id: 'Africa/Johannesburg', name: 'Johannesburg', country: 'South Africa', region: 'South Africa Time' },
  { id: 'Africa/Casablanca', name: 'Casablanca', country: 'Morocco', region: 'Western European Time' },
  { id: 'Africa/Nairobi', name: 'Nairobi', country: 'Kenya', region: 'East Africa Time' },

  // Additional
  { id: 'Europe/Istanbul', name: 'Istanbul', country: 'Turkey', region: 'Turkey Time' },
  { id: 'Europe/Athens', name: 'Athens', country: 'Greece', region: 'Eastern European Time' },
  { id: 'Asia/Jerusalem', name: 'Jerusalem', country: 'Israel', region: 'Israel Standard Time' },
  { id: 'UTC', name: 'UTC', country: 'Coordinated Universal Time', region: 'Universal' },
  { id: 'America/Phoenix', name: 'Phoenix', country: 'United States', region: 'Mountain Time (no DST)' },
  { id: 'America/Halifax', name: 'Halifax', country: 'Canada', region: 'Atlantic Time' },
  { id: 'America/St_Johns', name: "St. John's", country: 'Canada', region: 'Newfoundland Time' },
  { id: 'Europe/Dublin', name: 'Dublin', country: 'Ireland', region: 'GMT/IST' },
  { id: 'Europe/Lisbon', name: 'Lisbon', country: 'Portugal', region: 'Western European Time' },
  { id: 'Europe/Warsaw', name: 'Warsaw', country: 'Poland', region: 'Central European Time' },
  { id: 'Europe/Kyiv', name: 'Kyiv', country: 'Ukraine', region: 'Eastern European Time' },
  { id: 'Asia/Karachi', name: 'Karachi', country: 'Pakistan', region: 'Pakistan Standard Time' },
  { id: 'Asia/Dhaka', name: 'Dhaka', country: 'Bangladesh', region: 'Bangladesh Standard Time' },
  { id: 'Asia/Kathmandu', name: 'Kathmandu', country: 'Nepal', region: 'Nepal Time' },
  { id: 'Asia/Ho_Chi_Minh', name: 'Ho Chi Minh City', country: 'Vietnam', region: 'Indochina Time' },
  { id: 'Asia/Taipei', name: 'Taipei', country: 'Taiwan', region: 'Taipei Standard Time' },
  { id: 'Asia/Riyadh', name: 'Riyadh', country: 'Saudi Arabia', region: 'Arabia Standard Time' },
  { id: 'Atlantic/Reykjavik', name: 'Reykjavik', country: 'Iceland', region: 'Greenwich Mean Time' },
];
