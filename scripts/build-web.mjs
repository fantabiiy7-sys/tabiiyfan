// Frontend yig'ish: esbuild (React 19 + TSX). Natija: web/dist
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'web/dist');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const dev = process.argv.includes('--dev');

const result = await build({
  entryPoints: [path.join(root, 'web/src/main.tsx')],
  outdir: path.join(out, 'assets'),
  bundle: true, splitting: true, format: 'esm', target: 'es2022', platform: 'browser',
  minify: !dev, sourcemap: dev ? 'inline' : false, metafile: true, jsx: 'automatic',
  entryNames: '[name]-[hash]', chunkNames: 'chunks/[name]-[hash]', assetNames: 'media/[name]-[hash]',
  loader: { '.svg': 'dataurl', '.woff2': 'file' },
  define: { 'process.env.NODE_ENV': dev ? '"development"' : '"production"' },
  logLevel: 'info',
});
const entry = Object.entries(result.metafile.outputs).find(([, o]) => o.entryPoint === 'web/src/main.tsx');
const js = path.relative(out, path.join(root, entry[0]));
const css = Object.keys(result.metafile.outputs).find(f => f.endsWith('.css') && path.basename(f).startsWith('main-'));
let html = fs.readFileSync(path.join(root, 'web/index.html'), 'utf8');
html = html.replace('<!--ASSETS-->', `${css ? `<link rel="stylesheet" href="/${path.relative(out, path.join(root, css))}">` : ''}\n  <script type="module" src="/${js}"></script>`);
fs.writeFileSync(path.join(out, 'index.html'), html);
for (const f of fs.readdirSync(path.join(root, 'web/public'))) fs.copyFileSync(path.join(root, 'web/public', f), path.join(out, f));
console.log('Web build tayyor:', out);
