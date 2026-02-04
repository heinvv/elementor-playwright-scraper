import type { InPagePayload, InPageScraperResult } from './types.ts';

export function runInPage(payload: InPagePayload): InPageScraperResult {
	try {
		const selector = payload.selector;
		const startIndex = payload.startIndex;
		const propertiesList = payload.propertiesList;
		const idPrefix = payload.idPrefix;

		function findRuleValue(
			cssRules: CSSRuleList,
			element: Element,
			property: string
		): string | null {
			for (let i = cssRules.length - 1; i >= 0; i--) {
				const cssRule = cssRules[i];
				if (cssRule.type !== 1) continue;
				const styleRule = cssRule as CSSStyleRule;
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

		function getValueFromSheet(
			styleSheet: CSSStyleSheet,
			element: Element,
			prop: string
		): string | null {
			try {
				const cssRules = styleSheet.cssRules || (styleSheet as CSSStyleSheet & { rules?: CSSRuleList }).rules;
				if (!cssRules) return null;
				return findRuleValue(cssRules, element, prop);
			} catch {
				return null;
			}
		}

		function getPropertyFromStylesheets(element: Element, prop: string): string | null {
			const stylesheets = Array.from(document.styleSheets);
			for (const stylesheet of stylesheets) {
				const value = getValueFromSheet(stylesheet, element, prop);
				if (value) return value;
			}
			return null;
		}

		function getDimensionWithSource(
			element: Element,
			prop: 'width' | 'height'
		): { value: string; source: 'inline' | 'stylesheet' | 'computed' } {
			const el = element as HTMLElement;
			const inlineStyles = el.style && (el.style as CSSStyleDeclaration)[prop];
			if (inlineStyles && String(inlineStyles).trim() !== '') {
				return { value: String(inlineStyles).trim(), source: 'inline' };
			}
			const fromSheet = getPropertyFromStylesheets(element, prop);
			if (fromSheet) return { value: fromSheet, source: 'stylesheet' };
			const computed = getComputedStyle(element).getPropertyValue(prop);
			const value = computed && computed !== 'none' ? computed.trim() : '';
			return { value, source: 'computed' };
		}

		function collectComputedStyles(
			element: Element,
			props: readonly string[]
		): Record<string, string> {
			const computed = getComputedStyle(element);
			const styles: Record<string, string> = {};
			for (let i = 0; i < props.length; i++) {
				const prop = props[i];
				const val = computed.getPropertyValue(prop);
				if (val) styles[prop] = val;
			}
			return styles;
		}

		function applyDimensionOverrides(
			styles: Record<string, string>,
			element: Element
		): {
			widthSource?: 'inline' | 'stylesheet' | 'computed';
			heightSource?: 'inline' | 'stylesheet' | 'computed';
		} {
			const widthInfo = getDimensionWithSource(element, 'width');
			const heightInfo = getDimensionWithSource(element, 'height');
			if (widthInfo.value) styles['width'] = widthInfo.value;
			if (heightInfo.value) styles['height'] = heightInfo.value;
			return {
				widthSource: widthInfo.value ? widthInfo.source : undefined,
				heightSource: heightInfo.value ? heightInfo.source : undefined,
			};
		}

		function cloneElementWithId(element: Element, id: string): HTMLElement {
			const clone = element.cloneNode(true) as HTMLElement;
			clone.setAttribute('id', id);
			return clone;
		}

		function buildElementData(
			element: Element,
			index: number,
			accumulatedCount: number,
			start: number,
			props: readonly string[]
		): InPageScraperResult['elements'][number] {
			const styles = collectComputedStyles(element, props);
			const dimensionSources = applyDimensionOverrides(styles, element);
			const generatedId = idPrefix + (start + accumulatedCount);
			const clone = cloneElementWithId(element, generatedId);
			return {
				index,
				tagName: element.tagName.toLowerCase(),
				html: clone.outerHTML,
				styles,
				widthSource: dimensionSources.widthSource,
				heightSource: dimensionSources.heightSource,
			};
		}

		const nodes = document.querySelectorAll(selector);
		const elements: InPageScraperResult['elements'] = [];
		for (let i = 0; i < nodes.length; i++) {
			elements.push(
				buildElementData(nodes[i], i, elements.length, startIndex, propertiesList)
			);
		}
		return { selector, elements };
	} catch (e) {
		return {
			selector: payload.selector,
			elements: [],
			inPageError: (e && (e as Error).message) ? (e as Error).message : String(e),
		};
	}
}
