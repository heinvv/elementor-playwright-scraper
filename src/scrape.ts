import { chromium, type Browser, type Page } from 'playwright';
import type {
	ScrapedElement,
	ScrapeResult,
	InPagePayload,
	InPageScraperResult,
	FindRuleValueFunction,
	GetValueFromSheetFunction,
	GetPropertyFromStylesheetsFunction,
	GetDimensionWithSourceFunction,
	CollectComputedStylesFunction,
	ApplyDimensionOverridesFunction,
	CloneElementWithIdFunction,
	BuildElementDataFunction,
} from './types.ts';
import { COMPUTED_STYLE_PROPERTIES, SCRAPED_ID_PREFIX } from './types.ts';
import {
	findRuleValue,
	getValueFromSheet,
	getPropertyFromStylesheets,
	getDimensionWithSource,
	collectComputedStyles,
	applyDimensionOverrides,
	cloneElementWithId,
	buildElementDataRunner,
	runInPage,
} from './helpers.ts';

export class Scraper {
	private browser: Browser | null = null;
	private page: Page | null = null;
	private readonly defaultTimeoutMs: number;

	constructor(defaultTimeoutMs: number = 60000) {
		this.defaultTimeoutMs = defaultTimeoutMs;
	}

	private buildPipeline(
		steps: { name: string; create: (p: Record<string, unknown>) => unknown }[]
	): Record<string, unknown> {
		const resolved: Record<string, unknown> = {};

		for (const step of steps) {
			resolved[step.name] = step.create(resolved);
		}

		return resolved;
	}

	private buildInPagePipeline(): { buildElementData: BuildElementDataFunction } {
		const pipeline = this.buildPipeline([
			{
				name: 'findRuleValue',
				create: () => findRuleValue,
			},
			{
				name: 'getValueFromSheet',
				create: (resolved) =>
					getValueFromSheet.bind(
						null,
						resolved.findRuleValue as FindRuleValueFunction
					),
			},
			{
				name: 'getPropertyFromStylesheets',
				create: (resolved) =>
					getPropertyFromStylesheets.bind(
						null,
						resolved.getValueFromSheet as GetValueFromSheetFunction
					),
			},
			{
				name: 'getDimensionWithSource',
				create: (resolved) =>
					getDimensionWithSource.bind(
						null,
						resolved.getPropertyFromStylesheets as GetPropertyFromStylesheetsFunction
					),
			},
			{
				name: 'collectComputedStyles',
				create: () => collectComputedStyles,
			},
			{
				name: 'applyDimensionOverrides',
				create: (resolved) =>
					applyDimensionOverrides.bind(
						null,
						resolved.getDimensionWithSource as GetDimensionWithSourceFunction
					),
			},
			{
				name: 'cloneElementWithId',
				create: () => cloneElementWithId,
			},
			{
				name: 'buildElementData',
				create: (resolved) =>
					buildElementDataRunner.bind(
						null,
						resolved.collectComputedStyles as CollectComputedStylesFunction,
						resolved.applyDimensionOverrides as ApplyDimensionOverridesFunction,
						resolved.cloneElementWithId as CloneElementWithIdFunction
					),
			},
		]);

		return {
			buildElementData: pipeline.buildElementData as BuildElementDataFunction,
		};
	}

	getInPageScraperFunction(): (payload: InPagePayload) => InPageScraperResult {
		const { buildElementData } = this.buildInPagePipeline();
		return runInPage.bind(null, buildElementData);
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

		return this.page!.evaluate(this.getInPageScraperFunction(), payload);
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

				const result = await this.evaluateSelector(trimmed, elements.length);

				for (const element of result.elements) {
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
