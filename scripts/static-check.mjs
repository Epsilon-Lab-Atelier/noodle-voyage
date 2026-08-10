import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const errors = [];

function walk(directory, predicate = () => true) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (['node_modules', '.git', '.vite', 'dist', 'coverage'].includes(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(fullPath, predicate));
    else if (predicate(fullPath)) files.push(fullPath);
  }
  return files;
}

const sourceFiles = [
  ...walk(path.join(root, 'src'), (file) => /\.(?:ts|tsx)$/.test(file)),
  ...walk(path.join(root, 'tests'), (file) => /\.ts$/.test(file))
];

const relativeImportPattern = /(?:from\s+|import\s*)['"](\.[^'"]+)['"]/g;
for (const filePath of sourceFiles) {
  const source = fs.readFileSync(filePath, 'utf8');
  for (const match of source.matchAll(relativeImportPattern)) {
    const specifier = match[1];
    if (!specifier) continue;
    const base = path.resolve(path.dirname(filePath), specifier);
    const candidates = [
      base,
      `${base}.ts`,
      `${base}.tsx`,
      `${base}.js`,
      path.join(base, 'index.ts'),
      path.join(base, 'index.tsx')
    ];
    if (!candidates.some((candidate) => fs.existsSync(candidate))) {
      errors.push(`${path.relative(root, filePath)}: unresolved relative import ${specifier}`);
    }
  }
}

for (const filePath of walk(root, (file) => file.endsWith('.json'))) {
  try { JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch (error) { errors.push(`${path.relative(root, filePath)}: invalid JSON (${error instanceof Error ? error.message : String(error)})`); }
}

for (const filePath of walk(path.join(root, 'src'), (file) => file.endsWith('.css'))) {
  const source = fs.readFileSync(filePath, 'utf8');
  if ((source.match(/{/g) ?? []).length !== (source.match(/}/g) ?? []).length) {
    errors.push(`${path.relative(root, filePath)}: CSS brace count mismatch`);
  }
}

const requiredFiles = [
  'index.html',
  'public/data/catalog.json',
  'public/data/manifest.json',
  'public/icons/icon-192.png',
  'public/icons/icon-512.png',
  'public/icons/maskable-512.png',
  'src/types/react-plotly.d.ts',
  'src/utils/externalSearch.ts',
  'src/utils/scatterLayout.ts',
  'tests/scatterLayout.test.ts',
  '.github/workflows/deploy-pages.yml'
];
for (const relativePath of requiredFiles) {
  if (!fs.existsSync(path.join(root, relativePath))) errors.push(`Missing required file: ${relativePath}`);
}

function pngDimensions(filePath) {
  const buffer = fs.readFileSync(filePath);
  const signature = buffer.subarray(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a') return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}
for (const [file, expected] of [['icon-192.png', 192], ['icon-512.png', 512], ['maskable-512.png', 512]]) {
  const dimensions = pngDimensions(path.join(root, 'public/icons', file));
  if (!dimensions || dimensions.width !== expected || dimensions.height !== expected) {
    errors.push(`public/icons/${file}: expected ${expected}x${expected} PNG`);
  }
}


const sourceText = sourceFiles.map((filePath) => fs.readFileSync(filePath, 'utf8')).join('\n');
if (sourceText.includes('DishIllustration')) errors.push('Legacy DishIllustration reference remains in source files');
if (!sourceText.includes('Google画像検索')) errors.push('Google image-search action is missing from source files');
if (!fs.readFileSync(path.join(root, 'src/types/react-plotly.d.ts'), 'utf8').includes('PlotClickEvent')) {
  errors.push('react-plotly.js local click-event declaration is missing');
}

const tasteMapSource = fs.readFileSync(path.join(root, 'src/components/TasteMap.tsx'), 'utf8');
for (const marker of ['groupIntoBubbles', "sizemode: 'area'", "scaleanchor: 'x'", 'taste-scatter-frame', '0-5全体に戻す', '結果に合わせる', '選択を解除']) {
  if (!tasteMapSource.includes(marker)) errors.push(`Taste-map chart is missing: ${marker}`);
}
// The v2.1.2 layout moved dishes away from their real coordinates; it must stay gone.
if (fs.existsSync(path.join(root, 'src/utils/scatterLayout.ts'))) {
  const layoutSource = fs.readFileSync(path.join(root, 'src/utils/scatterLayout.ts'), 'utf8');
  if (layoutSource.includes('spreadOverlappingPoints')) errors.push('Artificial point spreading must not return');
}

const mapsSource = fs.readFileSync(path.join(root, 'src/components/Maps.tsx'), 'utf8');
for (const marker of ['prefectureTiles', 'worldLandPath', 'worldBorderPath', 'world-country-list']) {
  if (!mapsSource.includes(marker)) errors.push(`Map requirement is missing: ${marker}`);
}
const worldGeometry = fs.readFileSync(path.join(root, 'src/components/worldMapGeometry.ts'), 'utf8');
if (!/export const worldLandPath\s*=\s*\n?\s*'M/.test(worldGeometry)) {
  errors.push('src/components/worldMapGeometry.ts: world outline path is missing or empty');
}

const layoutSource = fs.readFileSync(path.join(root, 'src/components/AppLayout.tsx'), 'utf8');
for (const marker of ['NOODLE VOYAGE by EpsilonLab', 'aria-expanded={exploreOpen}', 'explore-menu-list']) {
  if (!layoutSource.includes(marker)) errors.push(`Layout requirement is missing: ${marker}`);
}

const recordsSource = fs.readFileSync(path.join(root, 'src/pages/RecordsPage.tsx'), 'utf8');
for (const marker of ['食べたい', 'ごちそうさま', 'お気に入り', '自分のお店', '旧お気に入りの整理']) {
  if (!recordsSource.includes(marker)) errors.push(`Records page requirement is missing: ${marker}`);
}

const exploreSource = fs.readFileSync(path.join(root, 'src/pages/ExplorePage.tsx'), 'utf8');
for (const marker of ['tasteMapPresets', 'おすすめの見方', '自由に組み合わせる', '好みとの一致度', '位置づけ', 'culturalScope']) {
  if (!exploreSource.includes(marker)) errors.push(`Taste-map controls are missing: ${marker}`);
}
// Standard styles have no place, so the map view has to say so instead of
// silently showing an empty map.
if (!exploreSource.includes('特定の地域を割り当てていません')) {
  errors.push('Explore map is missing the placeless-style notice');
}

const dishSource = fs.readFileSync(path.join(root, 'src/pages/DishPage.tsx'), 'utf8');
for (const marker of ['近いスタイル', '代表例', '味・構造が近い料理', 'regionalExampleIds', 'relatedStyleIds', '全国で広く親しまれる定番スタイル', '特定の地域には属しません', '現代の派生スタイル', '複数の店へ広がった現代のスタイル']) {
  if (!dishSource.includes(marker)) errors.push(`Dish relation section is missing: ${marker}`);
}
// A numeric threshold makes a dish findable; it never states a classification.
if (!dishSource.includes('公式にそう分類されているという意味ではありません')) {
  errors.push('DishPage must explain that numeric facets are estimates');
}
const facetLookupSource = fs.readFileSync(path.join(root, 'src/features/tags/facetLookup.ts'), 'utf8');
if (!facetLookupSource.includes('に近い:')) errors.push('facetLookup must phrase a numeric match as a resemblance');
const filterSource = fs.readFileSync(path.join(root, 'src/features/explore/featureFilters.ts'), 'utf8');
if (!filterSource.includes('searchableFacetIds')) errors.push('Search must run on the canonical facet index');

for (const relativePath of [
  'data/master/relations.csv',
  'data/facets/facet-index.seed.json',
  'data/facets/manual-review-overrides.json',
  'data/facets/facet-derivation-rules.v2.3.0.json',
  'data/facets/review-queue.csv',
  'data/facets/base-215-density-audit.csv',
  'data/contemporary-styles/dishes.csv',
  'decision-records/ADR-023-public-venue-and-ranking-policy.md',
  'src/features/tags/facetLookup.ts',
  'scripts/build-facet-index.mjs',
  'data/master/release-targets.json',
  'data/master/feature-tag-taxonomy.ja.json',
  'data/standard-styles/merge-manifest.json',
  'data/standard-styles/research-notes.csv',
  'data/additions/v2.2.1/toyohashi-curry-udon.patch.json',
  'data/additions/v2.2.1/v2.2.1-manifest.patch.json',
  'src/features/tags/resolveFeatureTag.ts',
  'src/features/explore/featureFilters.ts',
  'data/additions/v2.3.0/private-place-menu-schema.json',
  'src/types/records.ts',
  'src/features/places/urlSafety.ts',
  'src/features/places/duplicateCheck.ts',
  'tests/storage-v4.test.ts',
  'tests/url-safety.test.ts',
  'tests/duplicate-check.test.ts',
  'src/features/places/nearby.ts',
  'src/features/places/placeSummary.ts',
  'src/components/PlaceCard.tsx',
  'src/components/StyleShopSearch.tsx',
  'src/pages/PlaceFormPage.tsx',
  'src/pages/PlaceDetailPage.tsx',
  'tests/nearby.test.ts',
  'tests/place-records.test.ts',
  'data/master/design-tokens.json',
  'data/master/ui-copy.ja.json',
  'scripts/build-tokens.mjs',
  'scripts/check-pwa.mjs',
  'src/styles.tokens.css',
  'src/features/install/installState.ts',
  'src/features/install/useInstallPrompt.ts',
  'src/features/install/useOnlineStatus.ts',
  'src/components/InstallGuide.tsx',
  'src/components/InstallHint.tsx',
  'src/components/UpdatePrompt.tsx',
  'src/components/TabStrip.tsx',
  'src/components/ActionRow.tsx',
  'src/components/ExternalLink.tsx',
  'src/components/ScopeBadge.tsx',
  'public/icons/maskable-192.png',
  'tests/install-state.test.ts',
  'tests/pwa-ui.test.tsx'
]) {
  if (!fs.existsSync(path.join(root, relativePath))) errors.push(`Missing required file: ${relativePath}`);
}

// Feature tags are stored as English identifiers and must reach the screen only
// through the Japanese dictionary.
for (const [file, forbidden] of [
  ['src/components/DishCard.tsx', 'dish.tags.slice'],
  ['src/pages/DishPage.tsx', 'dish.tags.map']
]) {
  if (fs.readFileSync(path.join(root, file), 'utf8').includes(forbidden)) {
    errors.push(`${file}: raw feature tags must be resolved through resolveFeatureTag`);
  }
}
if (!fs.readFileSync(path.join(root, 'src/components/DishCard.tsx'), 'utf8').includes('resolveDishDisplayFeatures')) {
  errors.push('DishCard must render Japanese feature labels');
}
if (exploreSource.includes('特徴タグ')) errors.push('ExplorePage must not label the feature filter as タグ');
if (!exploreSource.includes('特徴から絞り込む')) errors.push('ExplorePage is missing the 特徴から絞り込む filter');

// Expected counts belong in release-targets.json, not in the checks or tests.
for (const file of ['scripts/validate-data.mjs', 'tests/data.test.ts', 'tests/toyohashi-curry-udon.test.ts', 'tests/regional-example-cardinality.test.ts']) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  for (const literal of ['289', '86']) {
    if (new RegExp(`(?<![\\w.])${literal}(?![\\w.])`).test(source)) {
      errors.push(`${file}: release counts must come from release-targets.json, found ${literal}`);
    }
  }
}

// v2.3.0 storage schema v4: the reader's own places and menus stay on the
// device, so the invariants that keep them there are checked here too.
const migrationSource = fs.readFileSync(path.join(root, 'src/state/migration.ts'), 'utf8');
for (const marker of ["storageKey = 'noodle-voyage-state-v4'", "'noodle-voyage-state-v3'", 'storageSchemaVersion: 4', 'migrateToV4', 'pruneOrphans']) {
  if (!migrationSource.includes(marker)) errors.push(`Storage schema v4 requirement is missing: ${marker}`);
}
// A record the reader created is private unless they publish it themselves.
if (!/const visibility[\s\S]{0,200}?'private'\)/.test(migrationSource)) {
  errors.push('migration.ts must default a reader-created record to private');
}
const recordTypesSource = fs.readFileSync(path.join(root, 'src/types/records.ts'), 'utf8');
for (const marker of ['RecordVisibility', 'PlaceRecord', 'MenuRecord', 'CustomConcept', 'targetType', 'placeSnapshot']) {
  if (!recordTypesSource.includes(marker)) errors.push(`Private record type is missing: ${marker}`);
}
const urlSafetySource = fs.readFileSync(path.join(root, 'src/features/places/urlSafety.ts'), 'utf8');
for (const marker of ["url.protocol !== 'https:'", 'googleMapsHosts', 'tabelogHosts', 'URLSearchParams']) {
  if (!urlSafetySource.includes(marker)) errors.push(`URL safety requirement is missing: ${marker}`);
}
// Nothing about a saved shop is merged or deleted without the reader saying so.
const duplicateSource = fs.readFileSync(path.join(root, 'src/features/places/duplicateCheck.ts'), 'utf8');
for (const forbidden of ['mergePlaces', 'autoMerge']) {
  if (duplicateSource.includes(forbidden)) errors.push(`duplicateCheck.ts must not merge places automatically: ${forbidden}`);
}

// v2.3.0 places and menus: the screens have to keep saying where the data
// lives, and the routes older versions linked to have to keep working.
const privacyLine = 'この情報は、この端末だけに保存されます。';
for (const file of ['src/pages/PlaceFormPage.tsx', 'src/pages/PlaceDetailPage.tsx', 'src/pages/RecordsPage.tsx']) {
  if (!fs.readFileSync(path.join(root, file), 'utf8').includes(privacyLine)) {
    errors.push(`${file}: must tell the reader that the record stays on the device`);
  }
}
const placeFormSource = fs.readFileSync(path.join(root, 'src/pages/PlaceFormPage.tsx'), 'utf8');
for (const marker of ['店名だけで保存', '同じお店かもしれません', 'findDuplicatePlaces', 'checkUrl']) {
  if (!placeFormSource.includes(marker)) errors.push(`Place form requirement is missing: ${marker}`);
}
const appSource = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
for (const marker of ['/places/new', '/places/:placeId', '/my-places', '/collection']) {
  if (!appSource.includes(marker)) errors.push(`Route is missing: ${marker}`);
}
for (const marker of ['このスタイルのお店を地図で探す', '自分のお店を追加', 'StyleShopSearch']) {
  if (!dishSource.includes(marker)) errors.push(`Dish page action is missing: ${marker}`);
}
// Location is read on a button press only, and never written into a record.
const nearbySource = fs.readFileSync(path.join(root, 'src/features/places/nearby.ts'), 'utf8');
if (!nearbySource.includes('coarsen')) errors.push('nearby.ts must reduce the precision of a position before it reaches a link');
if (/latitude:\s*(?:coordinates|position)/.test(fs.readFileSync(path.join(root, 'src/pages/PlaceFormPage.tsx'), 'utf8'))) {
  errors.push('src/pages/PlaceFormPage.tsx: a saved place must not store the reader position');
}

// Every link that leaves the app opens in a new tab without handing over the
// opener (spec 15.2).
for (const filePath of sourceFiles.filter((file) => file.endsWith('.tsx'))) {
  const source = fs.readFileSync(filePath, 'utf8');
  for (const match of source.matchAll(/target="_blank"/g)) {
    // The two attributes may sit on separate lines, so the whole tag is read.
    const tagStart = source.lastIndexOf('<', match.index);
    const tagEnd = source.indexOf('>', match.index);
    const tag = source.slice(tagStart, tagEnd === -1 ? source.length : tagEnd);
    if (!tag.includes('rel="noopener noreferrer"')) {
      const line = source.slice(0, match.index).split('\n').length;
      errors.push(`${path.relative(root, filePath)}:${line}: target="_blank" needs rel="noopener noreferrer"`);
    }
  }
}

// --- v2.3.0 Urban Food Travel Editorial -------------------------------------
const stylesheet = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');
if (!stylesheet.includes('@import "./styles.tokens.css"')) {
  errors.push('src/styles.css must take its palette from the generated tokens');
}
// A hand-written colour would drift away from design-tokens.json.
for (const legacy of ['#8b2f1f', '#b55335', '#f4f2ed', '#fffaf0', '#1b2b38']) {
  if (stylesheet.includes(legacy)) errors.push(`src/styles.css still contains the pre-v2.3.0 colour ${legacy}`);
}
// #C9472B is 4.38 against the page ground, below AA for normal text, so text
// uses --brand-text (the darker step, 5.88) and fills keep --brand.
if (!stylesheet.includes('--brand-text: var(--t-color-primary-hover)')) {
  errors.push('src/styles.css must define --brand-text for primary used as text');
}
for (const rule of ['a { color: var(--brand-text)', '.eyebrow { margin: 0 0 0.45rem; color: var(--brand-text)']) {
  if (!stylesheet.includes(rule)) errors.push(`Text on the page ground must use --brand-text: ${rule}`);
}

// The four record tabs stay on one row at 390px: the row scrolls, never wraps.
const tabStripRule = stylesheet.match(/\.tab-strip-scroller \{[^}]*\}/)?.[0] ?? '';
for (const property of ['flex-wrap: nowrap', 'overflow-x: auto']) {
  if (!tabStripRule.includes(property)) errors.push(`.tab-strip-scroller must set ${property}`);
}
const actionRowRule = stylesheet.match(/\.action-row \{[^}]*\}/)?.[0] ?? '';
if (!actionRowRule.includes('flex-wrap: nowrap')) errors.push('.action-row must not wrap its controls');
// Fixed furniture clears the notch and the home indicator.
for (const marker of ['env(safe-area-inset-bottom', 'env(safe-area-inset-top', 'env(safe-area-inset-left', 'env(safe-area-inset-right']) {
  if (!stylesheet.includes(marker)) errors.push(`src/styles.css must use ${marker})`);
}
if (!/\.bottom-nav \{[\s\S]{0,600}?padding-bottom: var\(--safe-bottom\)/.test(stylesheet)) {
  errors.push('The bottom navigation must add the safe-area inset to its padding');
}

const layoutSourceV23 = fs.readFileSync(path.join(root, 'src/components/AppLayout.tsx'), 'utf8');
for (const marker of ['bottom-nav', 'more-sheet', 'compare-tray', 'マイ記録', 'アプリとして使う', 'UpdatePrompt', 'InstallHint']) {
  if (!layoutSourceV23.includes(marker)) errors.push(`Layout requirement is missing: ${marker}`);
}
for (const [id, label] of [['home', 'ホーム'], ['explore', '探す'], ['diagnosis', '診断'], ['records', '記録']]) {
  if (!layoutSourceV23.includes(`label: '${label}', icon: '${id}'`)) {
    errors.push(`Bottom navigation is missing ${label}`);
  }
}
const homeSource = fs.readFileSync(path.join(root, 'src/pages/HomePage.tsx'), 'utf8');
for (const marker of ['一杯から、旅をはじめよう。', '好みから探す', '自由にめぐる', '気分に合う探し方を選ぶ']) {
  if (!homeSource.includes(marker)) errors.push(`Home first view is missing: ${marker}`);
}
if (!homeSource.includes('showMore')) errors.push('The home screen must keep its later blocks behind a control');
if (!recordsSource.includes('マイ記録')) errors.push('The records page heading must read マイ記録');

// Wording the reader sees: no jargon, and no App Store impressions.
const uiText = sourceFiles
  .filter((file) => file.endsWith('.tsx'))
  .map((filePath) => fs.readFileSync(filePath, 'utf8'))
  .join('\n');
for (const forbidden of ['ヒーロー', 'App Storeからダウンロード', 'Google Playからダウンロード', 'ネイティブアプリ', 'PWAをインストール']) {
  if (uiText.includes(forbidden)) errors.push(`User-facing wording must not use: ${forbidden}`);
}
const installGuideSource = fs.readFileSync(path.join(root, 'src/components/InstallGuide.tsx'), 'utf8');
for (const marker of ['アプリとして使う', 'ホーム画面に追加', 'iPhoneに追加する', 'Safariで開いてから追加してください', '記録はクラウドへ送信されません']) {
  if (!installGuideSource.includes(marker)) errors.push(`Install guide is missing: ${marker}`);
}
// A reload must never be the thing that clears the reader's records.
const updateSource = fs.readFileSync(path.join(root, 'src/components/UpdatePrompt.tsx'), 'utf8');
for (const marker of ['新しいバージョンがあります', '保存した記録はそのまま引き継がれます。', 'あとで']) {
  if (!updateSource.includes(marker)) errors.push(`Update prompt is missing: ${marker}`);
}
for (const forbidden of ['idb-keyval', 'indexedDB', 'resetAll', 'clear()']) {
  if (updateSource.includes(forbidden)) errors.push(`The update prompt must not touch stored records: ${forbidden}`);
}
const viteConfig = fs.readFileSync(path.join(root, 'vite.config.ts'), 'utf8');
if (!viteConfig.includes("registerType: 'prompt'")) errors.push('The service worker must wait for the reader before reloading');
if (!viteConfig.includes('id: base') || !viteConfig.includes('scope: base')) {
  errors.push('Manifest id and scope must be derived from the Vite base path');
}
if (/(id|scope|start_url):\s*'\/noodle-voyage\//.test(viteConfig)) {
  errors.push('vite.config.ts must not hard-code the repository path');
}
if (!fs.existsSync(path.join(root, 'src/styles.tokens.css'))) {
  errors.push('Missing generated file: src/styles.tokens.css (run npm run data:build)');
}

const privacySource = fs.readFileSync(path.join(root, 'scripts/privacy-scan.mjs'), 'utf8');
for (const marker of ['generatedDependencyMetadataFiles', 'skipGeneratedDependencyDeprecation', 'privateRecordKeys', 'publishedDataDirectories']) {
  if (!privacySource.includes(marker)) errors.push(`Privacy lockfile regression guard is missing: ${marker}`);
}

const workflow = fs.readFileSync(path.join(root, '.github/workflows/deploy-pages.yml'), 'utf8');
for (const marker of ['npm run release:check', 'actions/upload-pages-artifact@v3', 'actions/deploy-pages@v4']) {
  if (!workflow.includes(marker)) errors.push(`GitHub Pages workflow is missing: ${marker}`);
}

if (errors.length) {
  console.error(`Static check failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Static check passed: ${sourceFiles.length} source/test files, required assets and workflow verified.`);
