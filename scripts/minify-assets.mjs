/**
 * Optional production build: writes minified copies under min/ (does not replace sources).
 * Run: npm install && npm run minify
 * Vercel already serves Brotli/Gzip; this is for smaller static copies if needed.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { minify as terserMinify } from 'terser';
import { minify as minifyCss } from 'csso';
import { PostHog } from 'posthog-node';

const posthog = new PostHog(process.env.POSTHOG_API_KEY, {
  host: process.env.POSTHOG_HOST,
  flushAt: 1,
  flushInterval: 0,
  enableExceptionAutocapture: true,
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outJs = path.join(root, 'min', 'js');
const outCss = path.join(root, 'min', 'css');
const outData = path.join(root, 'min', 'data');

fs.mkdirSync(outJs, { recursive: true });
fs.mkdirSync(outCss, { recursive: true });
fs.mkdirSync(outData, { recursive: true });

const jsDir = path.join(root, 'js');
for (const f of fs.readdirSync(jsDir).filter((x) => x.endsWith('.js'))) {
  const src = fs.readFileSync(path.join(jsDir, f), 'utf8');
  const r = await terserMinify(src, { compress: true, mangle: false });
  if (r.code) fs.writeFileSync(path.join(outJs, f), r.code);
}

const cssPath = path.join(root, 'css', 'styles.css');
if (fs.existsSync(cssPath)) {
  const css = fs.readFileSync(cssPath, 'utf8');
  fs.writeFileSync(path.join(outCss, 'styles.css'), minifyCss(css).css);
}

const ephem = path.join(root, 'data', 'mission-ephemeris.json');
if (fs.existsSync(ephem)) {
  const j = JSON.parse(fs.readFileSync(ephem, 'utf8'));
  fs.writeFileSync(path.join(outData, 'mission-ephemeris.json'), JSON.stringify(j));
}

console.log('Wrote min/js, min/css/styles.css, min/data/mission-ephemeris.json');

const jsFileCount = fs.readdirSync(jsDir).filter((x) => x.endsWith('.js')).length;
posthog.capture({
  distinctId: 'artemis-pipeline',
  event: 'assets minified',
  properties: {
    js_file_count: jsFileCount,
    css_minified: fs.existsSync(cssPath),
    ephemeris_minified: fs.existsSync(ephem),
  },
});
await posthog.shutdown();
