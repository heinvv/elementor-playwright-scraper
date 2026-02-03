# Elementor Playwright Scraper

Scrape a URL with comma-separated CSS selectors, collect DOM and interpreted styles, build HTML+CSS, and optionally POST to the Elementor HTML/CSS converter endpoint.

## Requirements

- Node 20+
- Playwright (Chromium only)

The converter endpoint is provided by the [Elementor HTML/CSS converter](https://github.com/elementor/elementor-html-css-converter) plugin. This scraper does not include that plugin; you run it against a WordPress site where the converter is installed.

## Setup

```bash
cp .env.example .env
npm install
npx playwright install chromium
```

**Environment**

| Variable | Required | Description |
|----------|----------|-------------|
| `ELEMENTOR_BASE_URL` | For converter | Base URL of the site that hosts the converter (e.g. `http://elementor.local/`). Used only for the converter POST. If unset, scrape still runs but no API call is made. |

## Usage

```bash
npm run scrape -- --url "https://example.com" --selectors ".hero, .card"
```

**Options**

| Option | Required | Description |
|--------|----------|-------------|
| `-u, --url <url>` | Yes | URL to scrape (public page). |
| `-s, --selectors <list>` | Yes | Comma-separated CSS selectors. |
| `-o, --output <path>` | No | Write result JSON to file (directory created if needed). |
| `-t, --timeout <ms>` | No | Page load timeout in ms (default: 60000). |

**Output**

- stdout: JSON with `scrape` (elements array), optional `htmlSent`, optional `converter` (API response), optional `error` if converter call failed.
- With `--output`: same structure written to file (scrape + converter only).

**Development**

- `npm run build:watch` — rebuilds `dist/cli.js` on file changes.
- `npm run scrape` — runs TypeScript source via tsx (no build step).
- `npm run scrape:prod` — builds then runs `dist/cli.js`.

## GitHub Action

Workflow: `.github/workflows/scrape.yml` (manual run only).

1. Actions → Scrape → Run workflow.
2. Inputs: `url`, `selectors`; optional `timeout`, `elementor_base_url` (or set as repo secret `ELEMENTOR_BASE_URL`).
3. Result JSON is uploaded as an artifact.

## Documentation

- [Planning](docs/planning.md) — scope, goals, phases, priorities, decisions.
- [Architecture](docs/architecture.md) — flow, modules, in-page pipeline, IDs and converter format.
- [Next steps](docs/next-steps.md) — verification, tests, error handling, optional improvements.

## Important details

- Only **public** pages are scraped; no login or auth.
- Width/height are taken from inline → stylesheet → computed; other properties use computed style.
- Element IDs in the built HTML are `scraped-0`, `scraped-1`, … and must match the converter’s expectations.
- The in-page logic runs inside the browser via Playwright’s `page.evaluate()`; helpers are serialized and must stay dependency-free for that context.

