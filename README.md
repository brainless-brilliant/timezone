# World Time Zones

A timezone comparison tool inspired by WorldTimeBuddy. Compare times across multiple timezones with an intuitive horizontal time grid, drag-to-reorder, and shareable URL state.

## Features

- **Smart search**: cities, countries, IANA ids, zone names ("Pacific Time"), abbreviations (IST, CET, PST), offsets (UTC+5:30, +9) and abbreviation arithmetic (CET+1, EST-2)
- **Natural-language times**: "3pm London", "tomorrow 9:30am in Tokyo", "noon IST", "next fri 4pm New York" pin that moment for everyone
- **Meeting finder**: availability strip and a best-time suggestion based on working hours, local weekends (including Friday-Saturday countries) and sleep hours
- **Pin a moment**: click an hour, nudge it with the arrow keys, copy everyone's time, or add it to a calendar (.ics, Google, Outlook)
- **Any day**: step through days or pick a date; DST changes are handled per zone
- **Labels and duplicates**: rename rows (e.g. a person or office) and add the same zone more than once; labels and the pinned time travel in shared links
- **Explanations**: each zone is described relative to the visitor's own zone, including upcoming clock changes
- **Status at a glance**: working hours, off hours, likely asleep, weekend, tomorrow/yesterday
- **Offline and installable** (PWA), light and dark appearance, 12/24-hour clock
- **Shareable URLs**: `#/?tz=Asia/Kolkata&tz=America/New_York~Alice&at=2026-11-23T09:30Z`

## Tech Stack

- Angular 19 (standalone components, signals)
- Angular CDK (drag-drop)
- IBM Plex Sans / Mono fonts
- SCSS with CSS custom properties
- GitHub Pages deployment via angular-cli-ghpages

## Local Development

```bash
git clone https://github.com/yourusername/timezones.git
cd timezones
npm install
ng serve
```

Navigate to `http://localhost:4200`

## Build

```bash
ng build --configuration production
```

## Deploy

```bash
npx ng deploy --base-href=/timezone/
```

Output: `dist/timezones-angular/`

## Project Structure

```
src/app/
  core/
    models/timezone.model.ts     -- Interfaces and enums
    data/timezone-data.ts        -- 55 timezone entries
    services/
      timezone.service.ts        -- Signal-based state management
      time-calculation.service.ts -- Formatting, offset, hour blocks
      url-state.service.ts       -- Hash routing URL sync
      storage.service.ts         -- localStorage wrapper
  components/
    header/                      -- App title
    timezone-search/             -- Search with autocomplete
    timezone-grid/               -- CDK drag-drop container + slider
    timezone-row/                -- Per-timezone info + 24h color blocks
    time-slider/                 -- Draggable vertical time indicator
    empty-state/                 -- Quick-add buttons
    footer/                      -- Copy link + info
  shared/directives/
    click-outside.directive.ts   -- Close dropdowns on outside click
```

## Deployment

Deployed automatically to GitHub Pages via `.github/workflows/pages.yml` on push to `main`.

## License

MIT
