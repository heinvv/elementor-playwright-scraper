import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENTRY = path.join(ROOT, 'src', 'in-page-script.ts');
const OUT = path.join(ROOT, 'src', 'in-page-script.generated.ts');

const result = esbuild.buildSync({
	entryPoints: [ENTRY],
	bundle: true,
	format: 'esm',
	platform: 'browser',
	write: false,
	target: 'es2020',
});

const raw = result.outputFiles[0].text;
const withoutExport = raw.replace(/\s*export\s*\{\s*runInPage\s*\}\s*;?\s*$/m, '');
const script = withoutExport.trim() + '; return runInPage(payload);';

const generated = `export const IN_PAGE_SCRIPT = ${JSON.stringify(script)};
`;

fs.writeFileSync(OUT, generated, 'utf8');
