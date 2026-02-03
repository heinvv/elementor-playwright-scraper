import type { ScrapeResult } from './types.ts';
import { SCRAPED_ID_PREFIX } from './types.ts';

export interface ConvertHtmlResponse {
	success: boolean;
	widgets?: unknown[];
	post_id?: number;
	edit_url?: string;
	error?: string;
	warnings?: string[];
}

export class ConverterClient {
	private buildCssRule(id: string, styles: Record<string, string>): string {
		const decls = Object.entries(styles)
			.filter(([, v]) => v != null && v !== '')
			.map(([k, v]) => `${k}: ${v};`)
			.join(' ');
		return `#${id}{${decls}}`;
	}

	buildHtmlWithStyles(result: ScrapeResult): string {
		const rules: string[] = [];
		const htmlParts: string[] = [];
		result.elements.forEach((el, i) => {
			const id = `${SCRAPED_ID_PREFIX}${i}`;
			rules.push(this.buildCssRule(id, el.styles));
			htmlParts.push(el.html);
		});
		const styleBlock = `<style>\n${rules.join('\n')}\n</style>`;
		return styleBlock + '\n' + htmlParts.join('\n');
	}

	async post(baseUrl: string, html: string): Promise<ConvertHtmlResponse> {
		const url = baseUrl.replace(/\/$/, '') + '/wp-json/html-css-converter/v1/convert-html';
		const res = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				html,
				import_variables: false,
				import_classes: false,
			}),
		});
		if (!res.ok) {
			const text = await res.text();
			throw new Error(`Converter responded ${res.status}: ${text}`);
		}
		return (await res.json()) as ConvertHtmlResponse;
	}
}

