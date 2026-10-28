/**
 * After `vite build --mode preview-artifact`: inline the CSS and JS bundle into one HTML file,
 * dist-preview/keurkompas-preview.html, that can be shared as a single page.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'dist-preview';
const html = readFileSync(join(dir, 'index.html'), 'utf8');
const jsPath = /<script type="module"[^>]*src="\.\/([^"]+)"/.exec(html)?.[1];
const cssPath = /<link rel="stylesheet"[^>]*href="\.\/([^"]+)"/.exec(html)?.[1];
if (!jsPath || !cssPath)
  throw new Error('Script or stylesheet not found in dist-preview/index.html');

// Prevent a literal "</script" inside the bundle from closing the inline script tag.
const js = readFileSync(join(dir, jsPath), 'utf8').replace(/<\/script/gi, '<\\/script');
const css = readFileSync(join(dir, cssPath), 'utf8');

const page = `<title>KeurKompas</title>
<meta name="description" content="Je kompas op het terrein — keuringen van opslagtanks volgens VLAREM II.">
<style>${css}</style>
<div id="root"></div>
<script type="module">${js}</script>
`;
writeFileSync(join(dir, 'keurkompas-preview.html'), page);
console.log(`${dir}/keurkompas-preview.html: ${(page.length / 1024).toFixed(0)} kB`);
