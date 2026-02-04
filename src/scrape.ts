import { chromium, type Browser, type Page, type CDPSession } from 'playwright';
import type {
	ScrapedElement,
	ScrapeResult,
	InPageScraperResult,
	ScrapedNodeStyles,
} from './types.ts';
import type { DimensionSource } from './types.ts';
import { SCRAPED_ID_PREFIX } from './types.ts';

interface CDPCSSProperty {
	name: string;
	value?: string;
}

interface CDPCSSStyle {
	cssProperties?: CDPCSSProperty[];
}

const CDP_ORIGIN_REGULAR = 'regular';
const CDP_ORIGIN_INJECTED = 'injected';

const NON_INHERITED_CSS_PROPERTIES = new Set([
	'position', 'display', 'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
	'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
	'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height',
	'top', 'right', 'bottom', 'left',
	'border', 'border-width', 'border-style', 'border-color', 'border-radius',
	'border-top', 'border-right', 'border-bottom', 'border-left',
	'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
	'background', 'background-color', 'background-image', 'background-repeat', 'background-attachment',
	'background-position', 'background-position-x', 'background-position-y', 'background-size', 'background-origin', 'background-clip',
	'overflow', 'overflow-x', 'overflow-y',
	'flex', 'flex-grow', 'flex-shrink', 'flex-basis', 'flex-direction', 'flex-wrap',
	'align-self', 'justify-self', 'order',
	'grid', 'grid-area', 'grid-column', 'grid-row', 'grid-template', 'grid-template-areas', 'grid-template-columns', 'grid-template-rows',
	'box-sizing', 'vertical-align', 'float', 'clear', 'z-index',
	'transform', 'transform-origin',
	'scroll-behavior',
]);

interface CDPRuleMatch {
	rule?: { style?: CDPCSSStyle; origin?: string; selectorList?: { text?: string } };
}

interface CDPInheritedStyleEntry {
	inlineStyle?: CDPCSSStyle;
	matchedCSSRules?: CDPRuleMatch[];
}

interface CDPMatchedStylesResponse {
	inlineStyle?: CDPCSSStyle;
	attributesStyle?: CDPCSSStyle;
	matchedCSSRules?: CDPRuleMatch[];
	inherited?: CDPInheritedStyleEntry[];
}

interface AuthorStyleCollect {
	authorSet: Set<string>;
	propertySource: Record<string, string>;
}

function isAuthorOrigin(origin: string | undefined): boolean {
	return origin === CDP_ORIGIN_REGULAR || origin === CDP_ORIGIN_INJECTED;
}

function collectAuthorPropertyNames(matched: CDPMatchedStylesResponse): AuthorStyleCollect {
	const names = new Set<string>();
	const fromElement = new Set<string>();
	const propertySource: Record<string, string> = {};
	const addFromStyle = (
		style: CDPCSSStyle | undefined,
		trackOnElement: boolean,
		source: string,
		onlyInheritedProperties: boolean = false
	) => {
		if (!style?.cssProperties) return;
		for (const p of style.cssProperties) {
			if (!p.name) continue;
			const key = p.name.toLowerCase();
			if (onlyInheritedProperties && NON_INHERITED_CSS_PROPERTIES.has(key)) continue;
			if (!propertySource[key]) propertySource[key] = source;
			names.add(key);
			if (trackOnElement) fromElement.add(key);
		}
	};
	addFromStyle(matched.inlineStyle, true, 'inline');
	addFromStyle(matched.attributesStyle, true, 'attributes');
	if (matched.matchedCSSRules) {
		for (const rm of matched.matchedCSSRules) {
			if (!isAuthorOrigin(rm.rule?.origin)) continue;
			const selectorText = rm.rule?.selectorList?.text?.trim() ?? '';
			addFromStyle(rm.rule?.style, true, `matched:${selectorText || '(anonymous)'}`);
		}
	}
	if (matched.inherited) {
		for (const entry of matched.inherited) {
			addFromStyle(entry.inlineStyle, false, 'inherited-inline', true);
			if (entry.matchedCSSRules) {
				for (const rm of entry.matchedCSSRules) {
					if (!isAuthorOrigin(rm.rule?.origin)) continue;
					const selectorText = rm.rule?.selectorList?.text?.trim() ?? '';
					addFromStyle(rm.rule?.style, false, `inherited:${selectorText || '(anonymous)'}`, true);
				}
			}
		}
	}
	for (const key of names) {
		if (key.startsWith('--') && !fromElement.has(key)) {
			names.delete(key);
			delete propertySource[key];
		}
	}
	return { authorSet: names, propertySource };
}

function getWidthHeightSource(
	matched: CDPMatchedStylesResponse,
	authorSet: Set<string>
): { widthSource?: DimensionSource; heightSource?: DimensionSource } {
	const hasInline = (s: CDPCSSStyle | undefined) =>
		s?.cssProperties?.some((p) => p.name === 'width' || p.name === 'height');
	let widthFromInline = false;
	let widthFromSheet = false;
	let heightFromInline = false;
	let heightFromSheet = false;
	if (matched.inlineStyle && hasInline(matched.inlineStyle)) {
		matched.inlineStyle.cssProperties!.forEach((p) => {
			if (p.name === 'width') widthFromInline = true;
			if (p.name === 'height') heightFromInline = true;
		});
	}
	if (matched.attributesStyle && hasInline(matched.attributesStyle)) {
		matched.attributesStyle.cssProperties!.forEach((p) => {
			if (p.name === 'width') widthFromInline = true;
			if (p.name === 'height') heightFromInline = true;
		});
	}
	if (matched.matchedCSSRules) {
		for (const rm of matched.matchedCSSRules) {
			if (!isAuthorOrigin(rm.rule?.origin)) continue;
			rm.rule?.style?.cssProperties?.forEach((p) => {
				if (p.name === 'width') widthFromSheet = true;
				if (p.name === 'height') heightFromSheet = true;
			});
		}
	}
	if (matched.inherited) {
		for (const entry of matched.inherited) {
			if (entry.inlineStyle && hasInline(entry.inlineStyle)) {
				entry.inlineStyle.cssProperties!.forEach((p) => {
					if (p.name === 'width') widthFromSheet = true;
					if (p.name === 'height') heightFromSheet = true;
				});
			}
			entry.matchedCSSRules?.forEach((rm) => {
				if (!isAuthorOrigin(rm.rule?.origin)) return;
				rm.rule?.style?.cssProperties?.forEach((p) => {
					if (p.name === 'width') widthFromSheet = true;
					if (p.name === 'height') heightFromSheet = true;
				});
			});
		}
	}
	const widthSource: DimensionSource | undefined = widthFromInline
		? 'inline'
		: authorSet.has('width')
			? 'stylesheet'
			: undefined;
	const heightSource: DimensionSource | undefined = heightFromInline
		? 'inline'
		: authorSet.has('height')
			? 'stylesheet'
			: undefined;
	return { widthSource, heightSource };
}

async function getSubtreeElementNodeIds(
	client: CDPSession,
	nodeId: number
): Promise<number[]> {
	const allDescendants = (await client.send('DOM.querySelectorAll', {
		nodeId,
		selector: '*',
	})) as { nodeIds?: number[] };
	const nodeIds = allDescendants.nodeIds ?? [];
	return [nodeId, ...nodeIds];
}

function buildStylesForNode(
	authorSet: Set<string>,
	computedList: { name: string; value: string }[]
): Record<string, string> {
	const styles: Record<string, string> = {};
	for (const p of computedList) {
		if (p.name && authorSet.has(p.name.toLowerCase()) && p.value != null && p.value !== '') {
			styles[p.name] = p.value;
		}
	}
	return styles;
}

export class Scraper {
	private browser: Browser | null = null;
	private page: Page | null = null;
	private readonly defaultTimeoutMs: number;

	constructor(defaultTimeoutMs: number = 60000) {
		this.defaultTimeoutMs = defaultTimeoutMs;
	}

	private async evaluateSelectorViaCDP(
		client: CDPSession,
		rootNodeId: number,
		selector: string,
		startIndex: number
	): Promise<InPageScraperResult> {
		const nodeIds = (await client.send('DOM.querySelectorAll', {
			nodeId: rootNodeId,
			selector,
		})) as { nodeIds: number[] };
		const ids = nodeIds.nodeIds ?? [];
		const elements: InPageScraperResult['elements'] = [];

		for (let i = 0; i < ids.length; i++) {
			const rootNodeId = ids[i];
			const baseId = `${SCRAPED_ID_PREFIX}${startIndex + i}`;
			let tagName = 'div';
			let html = '';
			let styles: Record<string, string> = {};
			let widthSource: DimensionSource | undefined;
			let heightSource: DimensionSource | undefined;
			let descendantStyles: ScrapedNodeStyles[] = [];

			try {
				const subtreeIds = await getSubtreeElementNodeIds(client, rootNodeId);
				const generatedIds: string[] = [];
				const nodeStylesList: Record<string, string>[] = [];
				for (let k = 0; k < subtreeIds.length; k++) {
					generatedIds.push(k === 0 ? baseId : `${baseId}-${k}`);
				}
				let rootMatched: CDPMatchedStylesResponse | null = null;
				let rootAuthorSet: Set<string> = new Set();
				for (const nid of subtreeIds) {
					const matched = (await client.send('CSS.getMatchedStylesForNode', {
						nodeId: nid,
					})) as CDPMatchedStylesResponse;
					const { authorSet } = collectAuthorPropertyNames(matched);
					if (nid === rootNodeId) {
						rootMatched = matched;
						rootAuthorSet = authorSet;
					}
					const computed = (await client.send('CSS.getComputedStyleForNode', {
						nodeId: nid,
					})) as { computedStyle?: { name: string; value: string }[] };
					const computedList = computed.computedStyle ?? [];
					nodeStylesList.push(buildStylesForNode(authorSet, computedList));
				}
				const dimensionSources = rootMatched
					? getWidthHeightSource(rootMatched, rootAuthorSet)
					: { widthSource: undefined, heightSource: undefined };
				widthSource = dimensionSources.widthSource;
				heightSource = dimensionSources.heightSource;
				styles = nodeStylesList[0] ?? {};

				const resolved = (await client.send('DOM.resolveNode', { nodeId: rootNodeId })) as {
					object?: { objectId?: string };
				};
				const objectId = resolved.object?.objectId;
				if (objectId) {
					const callResult = (await client.send('Runtime.callFunctionOn', {
						objectId,
						functionDeclaration: `function(idsJson) {
							var clone = this.cloneNode(true);
							var ids = JSON.parse(idsJson);
							var i = 0;
							function walk(el) {
								if (el.nodeType === 1) {
									el.id = ids[i++] || '';
									for (var c = 0; c < el.children.length; c++) walk(el.children[c]);
								}
							}
							walk(clone);
							return clone.outerHTML;
						}`,
						arguments: [{ value: JSON.stringify(generatedIds) }],
					})) as { result?: { value?: string }; exceptionDetails?: unknown };
					if (callResult.exceptionDetails) {
						throw new Error(String(callResult.exceptionDetails));
					}
					html = callResult.result?.value ?? '';
				} else {
					const outer = (await client.send('DOM.getOuterHTML', { nodeId: rootNodeId })) as {
						outerHTML?: string;
					};
					html = outer.outerHTML ?? '';
					if (html && !html.includes(' id=')) {
						html = html.replace(/^(\s*<[a-zA-Z][^>]*?)>/, `$1 id="${baseId}">`);
					}
				}
				descendantStyles = generatedIds.map((id, k) => ({
					id,
					styles: nodeStylesList[k] ?? {},
				}));

				const described = (await client.send('DOM.describeNode', { nodeId: rootNodeId })) as {
					node?: { nodeName?: string };
				};
				tagName = (described.node?.nodeName ?? 'div').toLowerCase();
			} catch (e) {
				console.error('CDP error for node', rootNodeId, e);
			}

			elements.push({
				index: i,
				tagName,
				html,
				styles,
				descendantStyles,
				widthSource,
				heightSource,
			});
		}

		return { selector, elements };
	}

	async run(url: string, selectors: string[], timeoutMs?: number): Promise<ScrapeResult> {
		const timeout = timeoutMs ?? this.defaultTimeoutMs;
		this.browser = await chromium.launch({ headless: true });
		const elements: ScrapedElement[] = [];

		try {
			this.page = await this.browser.newPage();
			await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout });

			let client: CDPSession;
			let rootNodeId: number;
			try {
				client = await this.page.context().newCDPSession(this.page!);
				await client.send('DOM.enable');
				await client.send('CSS.enable');
				const doc = (await client.send('DOM.getDocument', { depth: -1 })) as {
					root?: { nodeId?: number };
				};
				rootNodeId = doc.root?.nodeId ?? 0;
			} catch (e) {
				throw new Error(
					`CDP setup failed (Chromium required): ${e instanceof Error ? e.message : String(e)}`
				);
			}

			for (const selector of selectors) {
				const trimmed = selector.trim();
				if (!trimmed) continue;

				await this.page!.waitForSelector(trimmed, {
					state: 'attached',
					timeout: 10000,
				}).catch(() => {});

				const result = await this.evaluateSelectorViaCDP(
					client,
					rootNodeId,
					trimmed,
					elements.length
				);
				const resultElements = result.elements ?? [];
				console.log(trimmed, 'querySelectorAll length', resultElements.length);

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
