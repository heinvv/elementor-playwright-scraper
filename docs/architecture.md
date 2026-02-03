# Architecture

## Overview

The scraper visits a URL, runs in a headless Chromium page, collects DOM and interpreted CSS for elements matching given selectors, then optionally sends the built HTML+CSS to the Elementor HTML/CSS converter API. All in-page logic runs inside the browser via Playwright’s `page.evaluate()`; the rest runs in Node.

## Flow

1. **CLI** (`src/cli.ts`) parses URL, selectors, output path, timeout; loads `.env`; runs `ScrapeCommand`.
2. **ScrapeCommand** runs the scraper, then (if elements were found and `ELEMENTOR_BASE_URL` is set) builds HTML with `ConverterClient` and POSTs to the converter. Optionally writes JSON to a file.
3. **Scraper** (`src/scrape.ts`) launches Chromium, opens the URL, and for each selector:
   - Builds an `InPagePayload` (selector, startIndex, propertiesList, idPrefix).
   - Calls `page.evaluate(getInPageScraperFunction(), payload)` so the browser runs the in-page pipeline and returns `InPageScraperResult`.
   - Appends the returned elements (with selector) to the overall result.
4. **In the browser**, the evaluated function (`runInPage` from helpers) receives the payload, runs `document.querySelectorAll(selector)`, and for each node calls `buildElementData` to collect computed styles, resolve width/height from inline → stylesheet → computed, clone the node with a generated id, and return one `ScrapedElement`-like object per node.
5. **ConverterClient** (`src/converter-client.ts`) turns a `ScrapeResult` into a single HTML string (a `<style>` block with `#scraped-0`, `#scraped-1`, … plus the concatenated element HTML), and POSTs it to `{baseUrl}/wp-json/html-css-converter/v1/convert-html`.

## Modules

| Module | Role |
|--------|------|
| **cli.ts** | Entry point; Commander options; `ScrapeCommand` orchestrates scraper + converter + optional file output. |
| **scrape.ts** | `Scraper` class: browser/page lifecycle, pipeline builder, `getInPageScraperFunction()` (returns the function passed to `evaluate`), `evaluateSelector()`, `run()`. |
| **helpers.ts** | Pure functions used both in Node and (when serialized) in the browser: style resolution (`findRuleValue`, `getValueFromSheet`, `getPropertyFromStylesheets`, `getDimensionWithSource`), `collectComputedStyles`, `applyDimensionOverrides`, `cloneElementWithId`, `buildElementData`, `buildElementDataRunner`, `runInPage`. |
| **types.ts** | Shared types and constants: `ScrapedElement`, `ScrapeResult`, `InPagePayload`, `InPageScraperResult`, function types, `COMPUTED_STYLE_PROPERTIES`, `SCRAPED_ID_PREFIX`. |
| **converter-client.ts** | `ConverterClient`: `buildHtmlWithStyles(ScrapeResult)`, `post(baseUrl, html)`. |

## In-page pipeline

The function passed to `page.evaluate()` is `runInPage.bind(null, buildElementData)`. `buildElementData` is produced by a **declarative pipeline** in `Scraper.buildInPagePipeline()`:

1. `buildPipeline(steps)` runs each step’s `create(resolved)` in order and stores the result by step name; later steps can use `resolved.previousStepName`.
2. The steps are: `findRuleValue` → `getValueFromSheet` → `getPropertyFromStylesheets` → `getDimensionWithSource` → `collectComputedStyles` → `applyDimensionOverrides` → `cloneElementWithId` → `buildElementData`.
3. Helpers are composed with `.bind(null, dependency)` so that the function sent to the browser has no inner closures; Playwright serializes the bound helpers into the page.

Style resolution order for width/height: **inline** → **stylesheet** (last matching rule) → **computed**. Other properties use computed style only. All collected properties are listed in `COMPUTED_STYLE_PROPERTIES`.

## IDs and converter format

Each scraped element is assigned an id `scraped-0`, `scraped-1`, … (see `SCRAPED_ID_PREFIX`). The same ids are used in the `<style>` block sent to the converter so that the generated CSS applies to the cloned HTML.

## Environment and deployment

- **Local**: `.env` with `ELEMENTOR_BASE_URL`; run via `npm run scrape` (tsx) or `npm run scrape:prod` (built `dist/cli.js`).
- **CI**: GitHub Action (`.github/workflows/scrape.yml`) runs on `workflow_dispatch` with inputs for `url`, `selectors`, `timeout`, `elementor_base_url`; builds the project, runs the scraper, and uploads the JSON result as an artifact.

