# Planning

## Purpose

This document outlines the plan for the Elementor Playwright Scraper: scope, goals, phases, and priorities. Tactical follow-ups are in [next-steps.md](next-steps.md).

## Scope

**In scope**

- Scrape public URLs with configurable CSS selectors.
- Collect DOM and interpreted CSS (inline → stylesheet → computed for dimensions; computed for other properties).
- Build a single HTML document with a `<style>` block and scraped nodes, using stable IDs (`scraped-0`, …).
- POST that HTML to the Elementor HTML/CSS converter API when `ELEMENTOR_BASE_URL` is set.
- Run via CLI (Node) and via GitHub Actions with artifact output.
- No login or authentication; public pages only.

**Out of scope (current version)**

- Authenticated or non-public pages.
- Running or hosting the converter plugin (consumes an existing endpoint).
- Converting HTML/CSS (handled by the converter); this repo only scrapes and sends.

## Goals

1. **Reliability** — Scraper runs end-to-end against a real URL and converter; output is valid and converter response is usable.
2. **Maintainability** — Clear structure (see [architecture.md](architecture.md)), tests for core logic, and documented behaviour.
3. **Operability** — Good error messages, optional retries/validation, and a working CI workflow for on-demand runs.

## Phases

| Phase | Focus | Status |
|-------|--------|--------|
| 1. Core implementation | CLI, scraper, in-page pipeline, converter client, GitHub Action | Done |
| 2. Verification | Run full flow against real URL + converter; fix serialization/runtime issues | Pending |
| 3. Quality | Tests (helpers, pipeline, converter client), clearer errors, basic validation | Pending |
| 4. Polish | README “Testing” section, optional smoke step in CI, retries if needed | Optional |

## Priorities

1. **Verify end-to-end** — One successful run: scrape → HTML built → converter POST → valid response. Unblocks confidence and further work.
2. **Tests** — Unit tests for helpers and converter client; pipeline test for composed `buildElementData`. Reduces regressions.
3. **Error handling** — Explicit errors for empty selectors, no matches, timeouts, and converter/network failures. Improves debugging.
4. **Docs and CI** — Keep README and architecture up to date; ensure the Action runs and produces an artifact.

## Decisions

- **Playwright only** — No Puppeteer or other runner; Chromium is sufficient for the current use case.
- **Single HTML payload** — One request to the converter per run (one URL, all selectors). No batching or streaming for now.
- **Declarative pipeline** — In-page steps are defined as data in `buildInPagePipeline()` and composed with `.bind()` so the evaluated function has no nested closures and serializes correctly.
- **Standalone repo** — Scraper lives outside the converter plugin; integration is via REST API and env/config.

## References

- [Architecture](architecture.md) — Flow, modules, in-page pipeline.
- [Next steps](next-steps.md) — Concrete tasks for verification, tests, and improvements.

