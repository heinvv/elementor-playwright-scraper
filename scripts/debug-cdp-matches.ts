import { chromium } from 'playwright';

const URL = 'https://labelvier.nl/';
const SELECTOR = '.page-footer-top';

async function main() {
	const browser = await chromium.launch({ headless: true });
	const page = await browser.newPage();
	await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 15000 });

	const client = await page.context().newCDPSession(page);
	await client.send('DOM.enable');
	await client.send('CSS.enable');
	const doc = (await client.send('DOM.getDocument', { depth: -1 })) as { root?: { nodeId?: number } };
	const rootNodeId = doc.root?.nodeId ?? 0;
	const { nodeIds } = (await client.send('DOM.querySelectorAll', {
		nodeId: rootNodeId,
		selector: SELECTOR,
	})) as { nodeIds: number[] };

	if (nodeIds.length === 0) {
		console.log('No nodes found');
		await browser.close();
		return;
	}

	const nodeId = nodeIds[0];
	const matched = (await client.send('CSS.getMatchedStylesForNode', { nodeId })) as {
		inlineStyle?: { cssProperties?: { name: string; value?: string }[] };
		attributesStyle?: { cssProperties?: { name: string; value?: string }[] };
		matchedCSSRules?: { rule?: { origin?: string; selectorList?: { text?: string }; style?: { cssProperties?: { name: string; value?: string }[] } } }[];
		inherited?: { inlineStyle?: { cssProperties?: { name: string }[] }; matchedCSSRules?: { rule?: { origin?: string; selectorList?: { text?: string }; style?: { cssProperties?: { name: string }[] } } }[] }[];
	};

	const dumpRule = (label: string, rule: { origin?: string; selectorList?: { text?: string }; style?: { cssProperties?: { name: string; value?: string }[] } } | undefined) => {
		if (!rule) return;
		const sel = rule.selectorList?.text ?? '(no selector)';
		const origin = rule.origin ?? '(no origin)';
		const props = rule.style?.cssProperties ?? [];
		const hasPosition = props.some((p) => p.name === 'position');
		if (!hasPosition && !label.includes('inline')) return;
		console.log(label, 'origin:', origin, 'selector:', sel);
		props.filter((p) => p.name === 'position' || label.includes('inline')).forEach((p) => {
			console.log('  ', p.name + ':', p.value);
		});
	};

	console.log('=== INLINE ===');
	if (matched.inlineStyle?.cssProperties?.some((p) => p.name === 'position')) {
		matched.inlineStyle.cssProperties.filter((p) => p.name === 'position').forEach((p) => console.log('  ', p.name + ':', p.value));
	} else {
		console.log('  (no position)');
	}

	console.log('\n=== MATCHED RULES (element) ===');
	matched.matchedCSSRules?.forEach((rm, i) => {
		dumpRule(`rule[${i}]`, rm.rule);
	});

	console.log('\n=== INHERITED ===');
	matched.inherited?.forEach((entry, i) => {
		entry.matchedCSSRules?.forEach((rm, j) => {
			dumpRule(`inherited[${i}].rule[${j}]`, rm.rule);
		});
	});

	console.log('\n=== FULL matchedCSSRules (origin + selector for each) ===');
	matched.matchedCSSRules?.forEach((rm, i) => {
		const r = rm.rule;
		console.log(i, 'origin:', r?.origin, 'selector:', r?.selectorList?.text);
	});

	await browser.close();
}

main().catch(console.error);
