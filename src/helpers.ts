import type {
	ScrapedElement,
	InPagePayload,
	InPageScraperResult,
	DimensionSource,
	ValueFromSheetParams,
	FindRuleValueFunction,
	GetValueFromSheetFunction,
	GetPropertyFromStylesheetsFunction,
	GetDimensionWithSourceFunction,
	CollectComputedStylesFunction,
	ApplyDimensionOverridesFunction,
	CloneElementWithIdFunction,
	BuildElementDataFunction,
	BuildElementDataParameters,
} from './types.ts';

export function findRuleValue(
	cssRules: CSSRuleList,
	element: Element,
	property: string
): string | null {
	for (let i = cssRules.length - 1; i >= 0; i--) {
		const rule = cssRules[i];
		if (rule.type !== CSSRule.STYLE_RULE) continue;

		const styleRule = rule as CSSStyleRule;
		try {
			if (!element.matches(styleRule.selectorText)) continue;
		} catch {
			continue;
		}

		const val = styleRule.style.getPropertyValue(property);
		if (val && val.trim() !== '') return val.trim();
	}
	return null;
}

export function getValueFromSheet(
	findRuleValueFunction: FindRuleValueFunction,
	params: ValueFromSheetParams
): string | null {
	const { sheet, element, prop } = params;
	try {
		const cssRules = sheet.cssRules ?? sheet.rules;
		if (!cssRules) return null;
		return findRuleValueFunction(cssRules, element, prop);
	} catch {
		return null;
	}
}

export function getPropertyFromStylesheets(
	getValueFromSheetFunction: GetValueFromSheetFunction,
	element: Element,
	prop: string
): string | null {
	const stylesheets = Array.from(document.styleSheets);
	for (const stylesheet of stylesheets) {
		const value = getValueFromSheetFunction({
			sheet: stylesheet,
			element,
			prop,
		});
		if (value) return value;
	}
	return null;
}

export function getDimensionWithSource(
	getPropertyFromStylesheetsFunction: GetPropertyFromStylesheetsFunction,
	element: Element,
	prop: 'width' | 'height'
): { value: string; source: DimensionSource } {
	const inlineStyles = (element as HTMLElement).style?.[prop];
	if (inlineStyles && inlineStyles.trim() !== '') {
		return { value: inlineStyles.trim(), source: 'inline' };
	}

	const fromSheet = getPropertyFromStylesheetsFunction(element, prop);
	if (fromSheet) return { value: fromSheet, source: 'stylesheet' };

	const computed = getComputedStyle(element).getPropertyValue(prop);
	const value = computed && computed !== 'none' ? computed.trim() : '';
	return { value, source: 'computed' };
}

export function collectComputedStyles(
	element: Element,
	props: string[]
): Record<string, string> {
	const computed = getComputedStyle(element);
	const styles: Record<string, string> = {};
	for (const prop of props) {
		const val = computed.getPropertyValue(prop);
		if (val) styles[prop] = val;
	}
	return styles;
}

export function applyDimensionOverrides(
	getDimensionWithSourceFunction: GetDimensionWithSourceFunction,
	styles: Record<string, string>,
	element: Element
): { widthSource?: DimensionSource; heightSource?: DimensionSource } {
	const widthInfo = getDimensionWithSourceFunction(element, 'width');
	const heightInfo = getDimensionWithSourceFunction(element, 'height');
	if (widthInfo.value) styles['width'] = widthInfo.value;
	if (heightInfo.value) styles['height'] = heightInfo.value;
	return {
		widthSource: widthInfo.value ? widthInfo.source : undefined,
		heightSource: heightInfo.value ? heightInfo.source : undefined,
	};
}

export function cloneElementWithId(element: Element, id: string): HTMLElement {
	const clone = element.cloneNode(true) as HTMLElement;
	clone.setAttribute('id', id);
	return clone;
}

export function buildElementData(
	parameters: BuildElementDataParameters
): Omit<ScrapedElement, 'selector'> {
	const {
		collectComputedStylesFunction,
		applyDimensionOverridesFunction,
		cloneElementWithIdFunction,
		element,
		index,
		accumulatedCount,
		start,
		props,
		idPrefix,
	} = parameters;

	const styles = collectComputedStylesFunction(element, props);
	const { widthSource, heightSource } = applyDimensionOverridesFunction(
		styles,
		element
	);
	const generatedId = `${idPrefix}${start + accumulatedCount}`;
	const clone = cloneElementWithIdFunction(element, generatedId);

	return {
		index,
		tagName: element.tagName.toLowerCase(),
		html: clone.outerHTML,
		styles,
		widthSource,
		heightSource,
	};
}

export function buildElementDataRunner(
	collectComputedStylesFunction: CollectComputedStylesFunction,
	applyDimensionOverridesFunction: ApplyDimensionOverridesFunction,
	cloneElementWithIdFunction: CloneElementWithIdFunction,
	element: Element,
	index: number,
	accumulatedCount: number,
	start: number,
	props: string[],
	idPrefix: string
): Omit<ScrapedElement, 'selector'> {
	return buildElementData({
		collectComputedStylesFunction,
		applyDimensionOverridesFunction,
		cloneElementWithIdFunction,
		element,
		index,
		accumulatedCount,
		start,
		props,
		idPrefix,
	});
}

export function runInPage(
	buildElementDataFunction: BuildElementDataFunction,
	payload: InPagePayload
): InPageScraperResult {
	const { selector, startIndex, propertiesList, idPrefix } = payload;
	const nodes = document.querySelectorAll(selector);
	const elements: Omit<ScrapedElement, 'selector'>[] = [];

	for (let i = 0; i < nodes.length; i++) {
		const data = buildElementDataFunction(
			nodes[i],
			i,
			elements.length,
			startIndex,
			propertiesList,
			idPrefix
		);
		elements.push(data);
	}

	return { selector, elements };
}

