import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const mobile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const web = path.resolve(mobile, '../snack-ladder-game');
const output = path.join(mobile, '.web-export');
const run = (command, args, options) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { ...options, stdio: 'inherit' });
  child.on('error', reject);
  child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`Web game build failed: ${code}`)));
});

await run('pnpm', ['exec', 'vite', 'build', '--base', '/', '--outDir', output, '--emptyOutDir'], {
  cwd: web,
  env: { ...process.env, NODE_ENV: 'production', BASE_PATH: '/', PORT: process.env.PORT || '5000',
    SNACK_LADDER_MOBILE_EXPORT: '1' },
});

// Package the actual web build, including its fonts, images and sound effects.
// No network or Metro is needed to render/play a local game in the installed app.
let html = await readFile(path.join(output, 'index.html'), 'utf8');
const files = await readdir(path.join(output, 'assets'));
const cssFiles = files.filter((name) => name.endsWith('.css'));
let css = (await Promise.all(cssFiles.map((name) => readFile(path.join(output, 'assets', name), 'utf8')))).join('\n');
const fontCache = new Map();
async function inlineFontCss(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Font stylesheet failed: HTTP ${response.status}`);
  let fontCss = await response.text();
  for (const match of fontCss.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)) {
    const fontUrl = match[1];
    if (!fontCache.has(fontUrl)) {
      const font = await fetch(fontUrl, { signal: AbortSignal.timeout(30000) });
      if (!font.ok) throw new Error(`Offline font download failed: HTTP ${font.status}`);
      const mime = fontUrl.includes('.woff2') ? 'font/woff2' : 'font/ttf';
      fontCache.set(fontUrl, `data:${mime};base64,${Buffer.from(await font.arrayBuffer()).toString('base64')}`);
    }
    fontCss = fontCss.replaceAll(fontUrl, fontCache.get(fontUrl));
  }
  return fontCss;
}
for (const match of css.matchAll(/@import\s*(?:url\()?["']?(https:\/\/fonts\.googleapis\.com\/[^"')]+)["']?\)?;/g)) {
  css = css.replace(match[0], await inlineFontCss(match[1]));
}
if (css.includes('fonts.googleapis.com') || css.includes('fonts.gstatic.com'))
  throw new Error('Font embedding incomplete; refusing an online-dependent mobile game.');

html = html.replace(/<link\b[^>]*rel="stylesheet"[^>]*>/g, '');
html = html.replace(/<link\b[^>]*href="(https:\/\/fonts\.(?:googleapis|gstatic)\.com\/[^"]+)"[^>]*>/g, '');
html = html.replace('</head>', `<style>${css.replaceAll('</style', '<\\/style')}</style></head>`);
for (const match of html.matchAll(/<script\b[^>]*src="\/assets\/([^"]+)"[^>]*><\/script>/g)) {
  const script = await readFile(path.join(output, 'assets', match[1]), 'utf8');
  html = html.replace(match[0], `<script type="module">${script.replaceAll('</script', '<\\/script')}</script>`);
}
const mimeTypes = { '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
for (const match of html.matchAll(/\b(?:src|href)="(\/[^"]+)"/g)) {
  const assetPath = path.join(output, decodeURIComponent(match[1].split(/[?#]/, 1)[0].slice(1)));
  try {
    const extension = path.extname(assetPath).toLowerCase();
    const mime = mimeTypes[extension];
    if (mime) {
      const dataUrl = `data:${mime}${extension === '.svg' ? ';charset=utf-8' : ''};base64,${(await readFile(assetPath)).toString('base64')}`;
      html = html.replace(match[0], match[0].replace(match[1], dataUrl));
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
html = html.replace('<head>', '<head><!--SNACK_LADDER_MOBILE_BOOTSTRAP-->');
const missingAssets = [...html.matchAll(/\b(?:src|href)="(?:\/assets\/|https:\/\/fonts\.(?:googleapis|gstatic)\.com\/)[^"]*"/g)]
  .map((match) => match[0]);
if (missingAssets.length)
  throw new Error(`External build assets remain; refusing an incomplete mobile package: ${missingAssets.join(', ')}`);
await mkdir(path.join(mobile, 'lib/generated'), { recursive: true });
await writeFile(path.join(mobile, 'lib/generated/web-game.js'),
  `// Generated from the browser game. Run pnpm --filter @workspace/snack-ladder-mobile bundle:web.\nmodule.exports = ${JSON.stringify(html)};\n`);
console.info(`Same web game packaged for mobile: ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MiB, ${fontCache.size} embedded fonts.`);