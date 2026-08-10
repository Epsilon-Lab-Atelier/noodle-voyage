import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from './csv.mjs';
import { buildFacetIndex } from './build-facet-index.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const masterDir = path.join(root, 'data/master');
const outputDir = path.join(root, 'public/data');

const readCsv = (name) => parseCsv(fs.readFileSync(path.join(masterDir, name), 'utf8'));
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(masterDir, name), 'utf8'));

const taxonomy = readJson('taxonomy.json');
const featureTags = readJson('feature-tag-taxonomy.ja.json');
const releaseTargets = readJson('release-targets.json');
const contextualLabels = taxonomy.contextualLabels ?? {};
const scoreMethodLabels = taxonomy.scoreMethods ?? {};
const regionMaster = readJson('regions.json');
const dishRows = readCsv('dishes.csv');
const tasteRows = readCsv('taste-scores.csv');
const sourceRows = readCsv('sources.csv');
const relationRows = readCsv('relations.csv');

const { tasteKeys, noodleKeys } = taxonomy;

const split = (value) => (value ? value.split('|').map((item) => item.trim()).filter(Boolean) : []);
const unique = (items) => [...new Set(items.filter(Boolean))];
const clamp = (value, min = 0, max = 5) => Math.min(max, Math.max(min, value));
const round = (value) => Number(Number(value).toFixed(2));

const prefectureByCode = new Map(regionMaster.prefectures.map((pref) => [pref.code, pref]));
const regionByCode = new Map(regionMaster.regions.map((region) => [region.code, region]));

const sources = sourceRows.map((row) => ({
  id: row.id,
  title: row.title,
  publisher: row.publisher,
  url: row.url || null,
  kind: row.kind,
  note: row.note,
  visibility: row.visibility === 'internal' ? 'internal' : 'public'
}));
const sourceById = new Map(sources.map((source) => [source.id, source]));
const publicSources = sources.filter((source) => source.visibility === 'public');

const tasteById = new Map(tasteRows.map((row) => [row.id, row]));

const formLabels = taxonomy.forms;

function readTaste(row, dishId) {
  const taste = {};
  for (const key of tasteKeys) {
    const typical = Number(row[`${key}_typical`]);
    const min = Number(row[`${key}_min`]);
    const max = Number(row[`${key}_max`]);
    if (![typical, min, max].every(Number.isFinite)) {
      throw new Error(`Missing taste value ${key} for ${dishId}`);
    }
    taste[key] = { typical: round(clamp(typical)), min: round(clamp(min)), max: round(clamp(max)) };
  }
  return taste;
}

function buildDish(row) {
  const tasteRow = tasteById.get(row.id);
  if (!tasteRow) throw new Error(`Missing taste-scores row for ${row.id}`);

  const prefectureCodes = split(row.prefecture_codes).sort();
  for (const code of prefectureCodes) {
    if (!prefectureByCode.has(code)) throw new Error(`Unknown prefecture code ${code} for ${row.id}`);
  }
  const prefectures = prefectureCodes.map((code) => prefectureByCode.get(code));
  const regionCodes = unique(prefectures.map((pref) => pref.regionCode))
    .sort((a, b) => regionByCode.get(a).displayOrder - regionByCode.get(b).displayOrder);

  const declaredSourceIds = split(row.public_source_ids);
  for (const id of declaredSourceIds) {
    if (!sourceById.has(id)) throw new Error(`Unknown source id ${id} for ${row.id}`);
  }
  // Internal placeholders stay in the master CSV but never reach public output.
  const publicSourceIds = declaredSourceIds.filter((id) => sourceById.get(id).visibility === 'public');

  const taste = readTaste(tasteRow, row.id);
  const noodle = {
    materials: split(row.noodle_materials),
    shape: row.noodle_shape || 'medium',
    notes: split(tasteRow.noodle_notes)
  };
  for (const key of noodleKeys) {
    const value = Number(tasteRow[`noodle_${key}`]);
    if (!Number.isFinite(value)) throw new Error(`Missing noodle metric ${key} for ${row.id}`);
    noodle[key] = round(clamp(value));
  }
  if (noodle.materials.length === 0) noodle.materials = ['wheat'];

  const form = row.form || 'soup';
  const hasCoordinates = row.lat !== '' && row.lon !== '' && Number.isFinite(Number(row.lat)) && Number.isFinite(Number(row.lon));
  const tags = unique(split(row.keywords).length ? split(row.tags) : split(row.tags));
  const keywords = split(row.keywords);

  return {
    id: row.id,
    slug: row.slug || row.id,
    name: row.name,
    localName: row.local_name || null,
    aliases: split(row.aliases),

    domain: row.domain,
    noodleCategory: row.noodle_category,
    culturalScope: row.cultural_scope,
    publicationStatus: row.publication_status || 'published',

    countryCode: row.country_code,
    country: row.country_code === 'JP' ? '日本' : row.country_code,
    prefectureCodes,
    prefectureNames: prefectures.map((pref) => pref.name),
    prefectureLabel: prefectures.length ? prefectures.map((pref) => pref.name).join('・') : null,
    regionCodes,
    regionNames: regionCodes.map((code) => regionByCode.get(code).name),
    city: row.city || null,
    coordinates: hasCoordinates ? { lat: Number(row.lat), lon: Number(row.lon) } : null,

    form,
    formLabel: formLabels[form] ?? '汁あり',
    categoryLabel: contextualLabels[`${row.domain}.${row.cultural_scope}.${row.noodle_category}`]
      ?? taxonomy.noodleCategories[row.noodle_category],
    noodle,
    broth: {
      bases: split(row.broth_bases).length ? split(row.broth_bases) : ['店舗ごとに異なる'],
      seasonings: split(row.seasonings).length ? split(row.seasonings) : ['醤油・塩・味噌など地域差あり'],
      aromatics: split(row.aromatics),
      clarity: taste.richness.typical < 2.1 ? 'clear' : taste.richness.typical > 3.8 ? 'opaque' : 'varied'
    },
    ingredients: split(row.ingredients),
    tags,
    keywords,
    taste,

    culture: {
      summary: row.summary,
      background: row.background,
      tradition: round(clamp(Number(row.tradition || (row.domain === 'japan' ? 3.8 : 3.6)))),
      uniqueness: round(clamp(Number(row.uniqueness || 3.0))),
      adventure: round(clamp(Number(row.adventure || (row.domain === 'japan' ? 2.6 : 3.8))))
    },

    variation: row.variation,
    allergenNote: row.allergen_note || '',
    scoreMethod: row.score_method || '',
    publicSourceIds,
    verificationLevel: row.verification_level === 'reviewed' ? 'reviewed' : 'basic',
    reviewedAt: row.reviewed_at,

    parentStyleIds: split(row.parent_style_ids),
    regionalExampleIds: [],
    derivedStyleIds: [],
    relatedStyleIds: [],
    relatedIds: [],
    bridgeIds: [],
    searchText: ''
  };
}

const allDishes = dishRows.map(buildDish);
const dishes = allDishes.filter((dish) => dish.publicationStatus === 'published');
const dishById = new Map(dishes.map((dish) => [dish.id, dish]));

// Curated relations are authored once, in relations.csv. Every endpoint has to
// resolve to a published dish, otherwise the public data would link nowhere.
const unresolvedEndpoints = new Set();
const authored = new Map();
for (const row of relationRows) {
  for (const id of [row.source_id, row.target_id]) {
    if (!dishById.has(id)) unresolvedEndpoints.add(id);
  }
  if (!dishById.has(row.source_id) || !dishById.has(row.target_id)) continue;
  const entry = authored.get(row.source_id) ?? { regional_example: [], related_style: [], bridge: [] };
  if (!(row.relation_type in entry)) throw new Error(`Unknown relation type ${row.relation_type} for ${row.source_id}`);
  entry[row.relation_type].push(row.target_id);
  authored.set(row.source_id, entry);
}

for (const dish of dishes) {
  for (const parentId of dish.parentStyleIds) {
    if (!dishById.has(parentId)) unresolvedEndpoints.add(parentId);
  }
  const entry = authored.get(dish.id);
  if (!entry) continue;
  dish.regionalExampleIds = unique(entry.regional_example);
  dish.relatedStyleIds = unique([...entry.related_style, ...entry.bridge]);
}

// A contemporary style names the standard style it grew out of; the standard
// style lists it back without needing a second authored relation.
for (const dish of dishes) {
  if (dish.culturalScope !== 'contemporary') continue;
  for (const parentId of dish.parentStyleIds) {
    dishById.get(parentId)?.derivedStyleIds.push(dish.id);
  }
}

if (unresolvedEndpoints.size > 0) {
  throw new Error(`未解決の関連ID: ${[...unresolvedEndpoints].sort().join(', ')}`);
}

// Descriptive text is authored in the master CSV. Anything still missing gets a
// neutral fallback rather than an invented characterisation of the dish.
for (const dish of dishes) {
  const place = dish.prefectureLabel ?? dish.country;
  if (!dish.culture.summary) {
    dish.culture.summary = `${place}で親しまれてきた${dish.name}。店舗や作り手によって味わいには幅があります。`;
  }
  if (!dish.culture.background) {
    dish.culture.background = dish.culturalScope === 'standard'
      ? `全国で広く親しまれている${dish.name}の基本的なスタイルです。`
      : `${place}の食文化と結びついて親しまれている麺料理です。`;
  }
  if (!dish.variation) {
    dish.variation = '同じ名称でも、店舗や地域内の系統によって味わいに幅があります。';
  }
  dish.searchText = unique([
    dish.name,
    dish.localName,
    ...dish.aliases,
    dish.country,
    ...dish.prefectureNames,
    ...dish.regionNames,
    dish.city,
    ...dish.tags,
    ...dish.keywords
  ]).join(' ').toLowerCase();
}

function distance(a, b) {
  const tasteDistance = tasteKeys.reduce((sum, key) => {
    const delta = a.taste[key].typical - b.taste[key].typical;
    return sum + delta * delta;
  }, 0) / tasteKeys.length;
  const noodleDistance = ['thickness', 'firmness', 'elasticity', 'chewiness'].reduce((sum, key) => {
    const delta = a.noodle[key] - b.noodle[key];
    return sum + delta * delta;
  }, 0) / 4;
  const shared = a.tags.filter((tag) => b.tags.includes(tag)).length;
  return Math.sqrt(tasteDistance * 0.72 + noodleDistance * 0.28) - shared * 0.18;
}

const nearest = (dish, pool, count) => pool
  .filter((candidate) => candidate.id !== dish.id)
  .map((candidate) => ({ id: candidate.id, value: distance(dish, candidate) }))
  .sort((a, b) => a.value - b.value)
  .slice(0, count)
  .map((item) => item.id);

const japanDishes = dishes.filter((dish) => dish.domain === 'japan');
const worldDishes = dishes.filter((dish) => dish.domain === 'world');

for (const dish of dishes) {
  dish.relatedIds = nearest(dish, dishes, 6);
  dish.bridgeIds = nearest(dish, dish.domain === 'japan' ? worldDishes : japanDishes, 3);
}

const countBy = (items, pick, keys) => Object.fromEntries(
  keys.map((key) => [key, items.filter((item) => pick(item) === key).length])
);

const manifest = {
  appVersion: '2.3.0',
  dataVersion: '2026.08.10-v2.3.0-researched-data-v1',
  catalogSchemaVersion: 3,
  featureTagVersion: featureTags.version,
  lastReviewed: '2026-08-10',
  generatedAt: '2026-08-09T00:00:00.000Z',
  counts: {
    total: dishes.length,
    japan: japanDishes.length,
    world: worldDishes.length,
    regionalExampleRelations: dishes.reduce((sum, dish) => sum + dish.regionalExampleIds.length, 0),
    byCategory: countBy(dishes, (dish) => dish.noodleCategory, Object.keys(taxonomy.noodleCategories)),
    byCulturalScope: countBy(dishes, (dish) => dish.culturalScope, Object.keys(taxonomy.culturalScopes))
  },
  // Authored in data/master/release-targets.json so that neither the checks nor
  // the tests carry a hand-written dish count.
  expected: releaseTargets.counts,
  notes: [
    '料理名と地域は公開資料を参照しています。',
    '味覚値と推薦用特徴量はEpsilonLabによる編集データです。',
    '定番スタイルは特定地域の一料理ではないため、都道府県と座標を持ちません。',
    '一部の料理は公開資料の確認を継続しています。',
    'アレルギーや食事制限を保証するデータではありません。'
  ]
};

const catalogIndex = dishes.map((dish) => ({
  id: dish.id,
  name: dish.name,
  localName: dish.localName,
  domain: dish.domain,
  noodleCategory: dish.noodleCategory,
  culturalScope: dish.culturalScope,
  country: dish.country,
  prefectureLabel: dish.prefectureLabel,
  regionCodes: dish.regionCodes,
  tags: dish.tags
}));

const relations = Object.fromEntries(dishes.map((dish) => [dish.id, {
  parentStyleIds: dish.parentStyleIds,
  regionalExampleIds: dish.regionalExampleIds,
  derivedStyleIds: dish.derivedStyleIds,
  relatedStyleIds: dish.relatedStyleIds,
  relatedIds: dish.relatedIds,
  bridgeIds: dish.bridgeIds
}]));

const write = (name, value) => fs.writeFileSync(path.join(outputDir, name), `${JSON.stringify(value, null, 2)}\n`);

fs.mkdirSync(outputDir, { recursive: true });
write('catalog.json', dishes);
write('catalog-index.json', catalogIndex);
write('japan-noodles.json', japanDishes);
write('world-noodles.json', worldDishes);
const standardOrder = new Map((taxonomy.standardStyleDisplayOrder ?? []).map((id, index) => [id, index]));
write(
  'standard-styles.json',
  dishes
    .filter((dish) => dish.culturalScope === 'standard')
    .sort((a, b) => (standardOrder.get(a.id) ?? 999) - (standardOrder.get(b.id) ?? 999))
);
write(
  'contemporary-styles.json',
  dishes.filter((dish) => dish.culturalScope === 'contemporary')
);
write('relations.json', relations);
write('sources.json', publicSources.map(({ visibility, ...source }) => source));
write('taxonomy.json', {
  noodleCategories: taxonomy.noodleCategories,
  culturalScopes: taxonomy.culturalScopes,
  forms: taxonomy.forms,
  contextualLabels,
  scoreMethods: scoreMethodLabels,
  relationTypes: taxonomy.relationTypes ?? {},
  tasteLabels: taxonomy.tasteLabels,
  noodleLabels: taxonomy.noodleLabels
});
write('regions.json', regionMaster);
write('feature-tags.json', featureTags);
const noodleProvenanceById = new Map(tasteRows.map((row) => [row.id, row.noodle_provenance || 'unknown']));
const facetIndex = buildFacetIndex(dishes, noodleProvenanceById);
write('facet-index.json', facetIndex);
write('manifest.json', manifest);

const withheld = allDishes.length - dishes.length;
console.log(`Generated ${dishes.length} published dishes (${manifest.counts.japan} Japan, ${manifest.counts.world} world), ${withheld} withheld.`);
console.log(`Categories: ${Object.entries(manifest.counts.byCategory).map(([key, value]) => `${key}=${value}`).join(' ')}`);
