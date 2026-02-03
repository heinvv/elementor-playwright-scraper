#!/usr/bin/env node

import { program } from 'commander';
import { config } from 'dotenv';
import { writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import { Scraper } from './scrape.ts';
import { ConverterClient } from './converter-client.ts';
import type { ScrapeResult } from './types.ts';
import type { ConvertHtmlResponse } from './converter-client.ts';

config();

export interface RunResult {
	scrape: ScrapeResult;
	htmlSent?: string;
	converter?: ConvertHtmlResponse;
	error?: string;
}

export class ScrapeCommand {
	private readonly scraper: Scraper;
	private readonly converterClient: ConverterClient;

	constructor(defaultTimeoutMs: number = 60000) {
		this.scraper = new Scraper(defaultTimeoutMs);
		this.converterClient = new ConverterClient();
	}

	static parseSelectors(selectorsStr: string): string[] {
		return selectorsStr
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);
	}

	async run(
		url: string,
		selectors: string[],
		baseUrl: string | undefined,
		writeOutputPath: string | null,
		timeoutMs: number
	): Promise<RunResult> {
		const scrapeResult = await this.scraper.run(url, selectors, timeoutMs);
		const result: RunResult = { scrape: scrapeResult };
		if (scrapeResult.elements.length === 0) {
			return result;
		}
		const html = this.converterClient.buildHtmlWithStyles(scrapeResult);
		result.htmlSent = html;
		if (baseUrl) {
			try {
				result.converter = await this.converterClient.post(baseUrl, html);
			} catch (err) {
				result.error = err instanceof Error ? err.message : String(err);
			}
		}
		if (writeOutputPath) {
			await mkdir(dirname(writeOutputPath), { recursive: true });
			await writeFile(
				writeOutputPath,
				JSON.stringify({ scrape: scrapeResult, converter: result.converter }, null, 2),
				'utf-8'
			);
		}
		return result;
	}
}

program
	.name('scrape')
	.description('Scrape URL with selectors and send to Elementor HTML/CSS converter')
	.requiredOption('-u, --url <url>', 'URL to scrape')
	.requiredOption('-s, --selectors <list>', 'Comma-separated CSS selectors')
	.option('-o, --output <path>', 'Write result JSON to file')
	.option('-t, --timeout <ms>', 'Page load timeout in ms', '60000')
	.action(async (opts) => {
		const selectors = ScrapeCommand.parseSelectors(opts.selectors);
		const baseUrl = process.env.ELEMENTOR_BASE_URL;
		const outputPath = opts.output ?? null;
		const timeoutMs = parseInt(String(opts.timeout), 10) || 60000;
		const command = new ScrapeCommand(timeoutMs);
		const result = await command.run(opts.url, selectors, baseUrl, outputPath, timeoutMs);
		console.log(JSON.stringify(result, null, 2));
		if (result.error) {
			process.exit(1);
	}
});

program.parse();

