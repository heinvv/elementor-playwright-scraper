export const SCRAPED_ID_PREFIX = 'scraped-';

export interface ScrapedNodeStyles {
	id: string;
	styles: Record<string, string>;
}

export interface ScrapedElement {
	selector: string;
	index: number;
	tagName: string;
	html: string;
	styles: Record<string, string>;
	descendantStyles?: ScrapedNodeStyles[];
	widthSource?: 'inline' | 'stylesheet' | 'computed';
	heightSource?: 'inline' | 'stylesheet' | 'computed';
}

export interface ScrapeResult {
	elements: ScrapedElement[];
}

export type InPagePayload = {
	selector: string;
	startIndex: number;
	propertiesList: string[];
	idPrefix: string;
};

export type InPageScraperResult = {
	selector: string;
	elements: Omit<ScrapedElement, 'selector'>[];
	inPageError?: string;
};

export type DimensionSource = 'inline' | 'stylesheet' | 'computed';

export interface ValueFromSheetParams {
	sheet: CSSStyleSheet;
	element: Element;
	prop: string;
}

export type FindRuleValueFunction = (
	cssRules: CSSRuleList,
	element: Element,
	property: string
) => string | null;

export type GetValueFromSheetFunction = (params: ValueFromSheetParams) => string | null;

export type GetPropertyFromStylesheetsFunction = (
	element: Element,
	prop: string
) => string | null;

export type DimensionWithSource = { value: string; source: DimensionSource };

export type GetDimensionWithSourceFunction = (
	element: Element,
	prop: 'width' | 'height'
) => DimensionWithSource;

export type CollectComputedStylesFunction = (
	element: Element,
	props: string[]
) => Record<string, string>;

export type ApplyDimensionOverridesFunction = (
	styles: Record<string, string>,
	el: Element
) => { widthSource?: DimensionSource; heightSource?: DimensionSource };

export type CloneElementWithIdFunction = (
	element: Element,
	id: string
) => HTMLElement;

export interface BuildElementDataParameters {
	collectComputedStylesFunction: CollectComputedStylesFunction;
	applyDimensionOverridesFunction: ApplyDimensionOverridesFunction;
	cloneElementWithIdFunction: CloneElementWithIdFunction;
	element: Element;
	index: number;
	accumulatedCount: number;
	start: number;
	props: string[];
	idPrefix: string;
}

export type BuildElementDataFunction = (
	element: Element,
	index: number,
	accumulatedCount: number,
	start: number,
	props: string[],
	idPrefix: string
) => Omit<ScrapedElement, 'selector'>;

export const COMPUTED_STYLE_PROPERTIES = [
	'width',
	'height',
	'min-width',
	'max-width',
	'min-height',
	'max-height',
	'margin',
	'margin-top',
	'margin-right',
	'margin-bottom',
	'margin-left',
	'padding',
	'padding-top',
	'padding-right',
	'padding-bottom',
	'padding-left',
	'color',
	'background-color',
	'background',
	'border',
	'border-width',
	'border-style',
	'border-color',
	'border-radius',
	'font-size',
	'font-weight',
	'font-family',
	'line-height',
	'display',
	'position',
	'top',
	'right',
	'bottom',
	'left',
	'flex-direction',
	'flex-wrap',
	'align-items',
	'justify-content',
	'gap',
	'box-sizing',
] as const;

