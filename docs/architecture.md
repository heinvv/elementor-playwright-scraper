# Architecture

## Overview

The scraper visits a URL, runs in a headless Chromium page, collects DOM and CSS for elements matching given selectors via the **Chrome DevTools Protocol (CDP)**, then optionally sends the built HTML+CSS to the Elementor HTML/CSS converter API. Style collection is Chromium-only and uses CDP; no in-page script is used for styles.

## Flow

1. **CLI** (`src/cli.ts`) parses URL, selectors, output path, timeout; loads `.env`; runs `ScrapeCommand`.
2. **ScrapeCommand** runs the scraper, then (if elements were found and `ELEMENTOR_BASE_URL` is set) builds HTML with `ConverterClient` and POSTs to the converter. Optionally writes JSON to a file.
3. **Scraper** (`src/scrape.ts`) launches Chromium, opens the URL, creates a CDP session, enables DOM and CSS, and gets the document root. For each selector:
   - Calls `DOM.querySelectorAll` to get node IDs.
   - For each node: `CSS.getMatchedStylesForNode` (author-defined set), `CSS.getComputedStyleForNode` (resolved values), `DOM.resolveNode` + `Runtime.callFunctionOn` (clone node, set id, return outerHTML), `DOM.describeNode` (tagName).
   - Builds elements with styles filtered to author-defined properties only and values from computed style; appends to the result.
4. **ConverterClient** (`src/converter-client.ts`) turns a `ScrapeResult` into a single HTML string (a `<style>` block with `#scraped-0`, `#scraped-1`, … plus the concatenated element HTML), and POSTs it to `{baseUrl}/wp-json/html-css-converter/v1/convert-html`.

## Modules

| Module | Role |
|--------|------|
| **cli.ts** | Entry point; Commander options; `ScrapeCommand` orchestrates scraper + converter + optional file output. |
| **scrape.ts** | `Scraper` class: browser/page lifecycle, CDP session, `evaluateSelectorViaCDP()` (DOM.querySelectorAll, getMatchedStylesForNode, getComputedStyleForNode, resolveNode + callFunctionOn for HTML, describeNode), `run()`. |
| **types.ts** | Shared types and constants: `ScrapedElement`, `ScrapeResult`, `InPageScraperResult`, `SCRAPED_ID_PREFIX`, etc. |
| **converter-client.ts** | `ConverterClient`: `buildHtmlWithStyles(ScrapeResult)`, `post(baseUrl, html)`. |

## Style collection (CDP)

Styles are **author-defined only**: the scraper uses `CSS.getMatchedStylesForNode` (inline, attributes, matched rules, inherited) to build a set of property names, then fills values from `CSS.getComputedStyleForNode` for those properties only. Width/height source is set from inline, stylesheet, or left unset when only computed. This avoids browser-default styling and preserves ancestor-defined (inherited) styles.

## IDs and converter format

Each scraped element is assigned an id `scraped-0`, `scraped-1`, … (see `SCRAPED_ID_PREFIX`). The same ids are used in the `<style>` block sent to the converter so that the generated CSS applies to the cloned HTML.

## Environment and deployment

- **Local**: `.env` with `ELEMENTOR_BASE_URL`; run via `npm run scrape` (tsx) or `npm run scrape:prod` (built `dist/cli.js`).
- **CI**: GitHub Action (`.github/workflows/scrape.yml`) runs on `workflow_dispatch` with inputs for `url`, `selectors`, `timeout`, `elementor_base_url`; builds the project, runs the scraper, and uploads the JSON result as an artifact.

