import { chromium, type Browser, type Page } from 'playwright';
import type {
	ScrapedElement,
	ScrapeResult,
	InPagePayload,
	InPageScraperResult,
} from './types.ts';
import { COMPUTED_STYLE_PROPERTIES, SCRAPED_ID_PREFIX } from './types.ts';
import { IN_PAGE_SCRIPT } from './in-page-script.generated.ts';

export class Scraper {
	private browser: Browser | null = null;
	private page: Page | null = null;
	private readonly defaultTimeoutMs: number;

	constructor(defaultTimeoutMs: number = 60000) {
		this.defaultTimeoutMs = defaultTimeoutMs;
	}

	private async evaluateSelector(
		selector: string,
		startIndex: number
	): Promise<InPageScraperResult> {
		const payload: InPagePayload = {
			selector,
			startIndex,
			propertiesList: [...COMPUTED_STYLE_PROPERTIES],
			idPrefix: SCRAPED_ID_PREFIX,
		};

		const runInPage = new Function(
			'payload',
			IN_PAGE_SCRIPT
		) as (payload: InPagePayload) => InPageScraperResult;

		return this.page!.evaluate(runInPage, payload);
	}

	async run(url: string, selectors: string[], timeoutMs?: number): Promise<ScrapeResult> {
		const timeout = timeoutMs ?? this.defaultTimeoutMs;
		this.browser = await chromium.launch({ headless: true });
		const elements: ScrapedElement[] = [];

		try {
			this.page = await this.browser.newPage();
			await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout });

			for (const selector of selectors) {
				const trimmed = selector.trim();
				if (!trimmed) continue;

				await this.page!.waitForSelector(trimmed, {
					state: 'attached',
					timeout: 10000,
				}).catch(() => {});

				const result = await this.evaluateSelector(trimmed, elements.length);
				const resultElements = result?.elements ?? [];
				console.log(trimmed, 'querySelectorAll length', resultElements.length);

				if (result?.inPageError) {
					console.error('in-page error for selector', trimmed, result.inPageError);
				}

				for (const element of resultElements) {
					elements.push({ ...element, selector: trimmed });
				}
			}

			return { elements };
		} finally {
			await this.close();
		}
	}

	async close(): Promise<void> {
		if (!this.browser) return;

		await this.browser.close();
		this.browser = null;
		this.page = null;
	}
}
