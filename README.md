# World Time Zones

A timezone comparison tool inspired by WorldTimeBuddy. Compare times across multiple timezones with an intuitive horizontal time grid, drag-to-reorder, and shareable URL state.

## Features

- **Visual Time Grid**: 24-hour color-coded blocks per timezone (night, morning, business, evening)
- **Real-time Updates**: All times update every second
- **Time Slider**: Drag a vertical slider to explore different hours across all timezones
- **Drag to Reorder**: Reorder timezone rows via drag-and-drop
- **Shareable URLs**: URL state via hash routing (`#/?tz=America/New_York&tz=Europe/London`)
- **Persistent Storage**: Selections saved to localStorage and restored on revisit
- **Auto-detect**: Detects local timezone on first visit
- **Smart Search**: Search 55 cities by name, country, or region
- **Responsive**: Mobile layout with horizontal scroll for hour blocks

## Tech Stack

- Angular 19 (standalone components, signals)
- Angular CDK (drag-drop)
- IBM Plex Sans / Mono fonts
- SCSS with CSS custom properties
- GitHub Pages deployment via Actions

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
