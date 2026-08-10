import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Checks the built PWA against the path the site is actually published under.
 *
 * GitHub Pages serves the app from a repository sub-path, so every identity and
 * URL in the manifest and the service worker has to sit under that path. The
 * path itself is computed the same way vite.config.ts computes it, so it is
 * never written twice.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'noodle-voyage';
const base = process.env.VITE_BASE_PATH ?? `/${repositoryName}/`;
const origin = 'https://example.invalid';
const errors = [];

if (!fs.existsSync(dist)) {
  console.error('PWA check failed: dist/ is missing. Run npm run build first.');
  process.exit(1);
}

const manifestPath = path.join(dist, 'manifest.webmanifest');
if (!fs.existsSync(manifestPath)) errors.push('dist/manifest.webmanifest is missing');

let manifest = {};
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
} catch (error) {
  errors.push(`dist/manifest.webmanifest is not valid JSON (${error instanceof Error ? error.message : String(error)})`);
}

for (const field of ['name', 'short_name', 'description', 'id', 'start_url', 'scope', 'display', 'theme_color', 'background_color', 'icons']) {
  if (manifest[field] === undefined || manifest[field] === '') errors.push(`Manifest is missing ${field}`);
}
if (manifest.display !== 'standalone') errors.push(`Manifest display must be standalone, found ${manifest.display}`);

// `id` and `scope` resolve against the origin; `start_url` against the manifest.
const manifestUrl = new URL(`${base}manifest.webmanifest`, origin);
const resolved = {
  id: manifest.id === undefined ? null : new URL(manifest.id, origin),
  scope: manifest.scope === undefined ? null : new URL(manifest.scope, origin),
  startUrl: manifest.start_url === undefined ? null : new URL(manifest.start_url, manifestUrl)
};
if (resolved.id?.pathname !== base) errors.push(`Manifest id must resolve to ${base}, found ${resolved.id?.pathname}`);
if (resolved.scope?.pathname !== base) errors.push(`Manifest scope must resolve to ${base}, found ${resolved.scope?.pathname}`);
if (resolved.startUrl?.pathname !== base) errors.push(`Manifest start_url must resolve inside ${base}, found ${resolved.startUrl?.pathname}`);
// An installed copy keeps its identity only while the id keeps matching what a
// browser would have derived from start_url with the fragment removed.
if (resolved.id && resolved.startUrl && resolved.id.pathname !== resolved.startUrl.pathname) {
  errors.push('Manifest id no longer matches the identity derived from start_url; an installed app would become a second app');
}

function pngDimensions(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
for (const icon of icons) {
  const iconUrl = new URL(icon.src, manifestUrl);
  if (!iconUrl.pathname.startsWith(base)) {
    errors.push(`Icon ${icon.src} resolves outside ${base}`);
    continue;
  }
  const filePath = path.join(dist, iconUrl.pathname.slice(base.length));
  if (!fs.existsSync(filePath)) {
    errors.push(`Icon file is missing from the build: ${icon.src}`);
    continue;
  }
  if (!filePath.endsWith('.png')) continue;
  const [width, height] = String(icon.sizes).split('x').map(Number);
  const dimensions = pngDimensions(filePath);
  if (!dimensions || dimensions.width !== width || dimensions.height !== height) {
    errors.push(`Icon ${icon.src} is declared ${icon.sizes} but the file is ${dimensions ? `${dimensions.width}x${dimensions.height}` : 'not a PNG'}`);
  }
}

const hasIcon = (size, purpose) => icons.some((icon) => icon.sizes === size && String(icon.purpose ?? 'any').split(/\s+/).includes(purpose));
if (!hasIcon('192x192', 'any')) errors.push('Manifest needs a 192x192 icon');
if (!hasIcon('512x512', 'any')) errors.push('Manifest needs a 512x512 icon');
if (!icons.some((icon) => String(icon.purpose ?? '').split(/\s+/).includes('maskable'))) {
  errors.push('Manifest needs a maskable icon');
}

if (!fs.existsSync(path.join(dist, 'sw.js'))) errors.push('dist/sw.js is missing');

const indexHtml = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
if (!indexHtml.includes(`${base}manifest.webmanifest`)) errors.push(`index.html must link ${base}manifest.webmanifest`);
if (!indexHtml.includes('apple-mobile-web-app-capable')) errors.push('index.html is missing the iOS home-screen meta tags');

// The registration itself has to name the sub-path, not the domain root.
const bundles = fs.readdirSync(path.join(dist, 'assets')).filter((file) => file.endsWith('.js'));
const bundleText = bundles.map((file) => fs.readFileSync(path.join(dist, 'assets', file), 'utf8')).join('\n');
if (!bundleText.includes(`${base}sw.js`)) errors.push(`The bundle must register ${base}sw.js`);
if (!bundleText.includes(`scope:"${base}"`) && !bundleText.includes(`scope: "${base}"`)) {
  errors.push(`The service worker must be registered with scope ${base}`);
}

if (errors.length) {
  console.error(`PWA check failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`PWA check passed: manifest, ${icons.length} icons and the service worker all resolve under ${base}.`);
