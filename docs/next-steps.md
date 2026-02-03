# Next steps

## Immediate

1. **Run the full flow**
   Run the scraper against a real URL and a running converter (`ELEMENTOR_BASE_URL` set in `.env`), e.g.:
   ```bash
   npm run scrape -- --url "https://example.com" --selectors ".hero" --output results.json
   ```
   Confirm: page loads, selectors match, styles are scraped, HTML is built, converter responds, and the JSON output (or artifact) looks correct. This also validates that Playwright serializes the in-page helpers correctly.

2. **Add tests**
   - **Helpers** (`src/helpers.ts`): pure logic could be unit-tested with a small JSDOM (or similar) setup.
   - **Pipeline**: test that `buildPipeline` plus step definitions produce the expected `buildElementData` (and that it’s a function).
   - **Converter client**: mock `fetch`, assert URL and body shape for `post()` and that `buildHtmlWithStyles()` matches the expected HTML/CSS structure for a given `ScrapeResult`.

3. **Tighten error handling**
   - Clear errors for: no elements for a selector, page load timeout, converter non-2xx or network error.
   - Optional: retries or timeout/selector validation so failures are easier to debug.

## Optional

- **README**: add a “Testing the scraper” or “Verifying the flow” section with one end-to-end example.
- **GitHub Action**: run the workflow once and confirm the artifact is uploaded; optionally add a minimal smoke step (e.g. run scraper with a fixed URL and assert exit 0 and artifact exists).

## Related (converter plugin)

In the Elementor HTML/CSS converter plugin’s roadmap, the task **“Create Playwright environment that can scrape a page and send to Elementor converter api”** can be marked **Done**. The implementation lives in this repo and is runnable via CLI and GitHub Action.

