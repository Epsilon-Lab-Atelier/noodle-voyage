import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from './csv.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dataDir = path.join(root, 'public/data');
const masterDir = path.join(root, 'data/master');

const required = ['catalog.json', 'catalog-index.json', 'japan-noodles.json', 'world-noodles.json', 'standard-styles.json', 'contemporary-styles.json', 'relations.json', 'sources.json', 'regions.json', 'feature-tags.json', 'facet-index.json', 'manifest.json'];
for (const name of required) {
  if (!fs.existsSync(path.join(dataDir, name))) throw new Error(`Missing generated file: ${name}`);
}

const readData = (name) => JSON.parse(fs.readFileSync(path.join(dataDir, name), 'utf8'));
const catalog = readData('catalog.json');
const sources = readData('sources.json');
const manifest = readData('manifest.json');
const regions = readData('regions.json');
const taxonomy = JSON.parse(fs.readFileSync(path.join(masterDir, 'taxonomy.json'), 'utf8'));
const featureTags = readData('feature-tags.json');
const releaseTargets = JSON.parse(fs.readFileSync(path.join(masterDir, 'release-targets.json'), 'utf8'));

const errors = [];
const warnings = [];
const ids = new Set();
const slugs = new Set();
const sourceIds = new Set(sources.map((source) => source.id));
const prefectureCodes = new Set(regions.prefectures.map((pref) => pref.code));
const regionCodes = new Set(regions.regions.map((region) => region.code));
const { tasteKeys, noodleKeys } = taxonomy;

// The 215 dish IDs published in v2.1.2 must survive every future release so that
// saved wish lists and meal records keep resolving.
const legacyIds = JSON.parse(fs.readFileSync(path.join(masterDir, 'legacy-dish-ids.json'), 'utf8'));
for (const id of legacyIds) {
  if (!catalog.some((dish) => dish.id === id)) errors.push(`v2.1.2 dish ${id} is no longer published`);
}

if (regions.prefectures.length !== 47) errors.push(`Expected 47 prefectures, found ${regions.prefectures.length}`);
if (regions.regions.length !== 8) errors.push(`Expected 8 regions, found ${regions.regions.length}`);
const orderedPrefectures = regions.prefectures.map((pref) => pref.code).join(',');
const sortedPrefectures = [...regions.prefectures].map((pref) => pref.code).sort().join(',');
if (orderedPrefectures !== sortedPrefectures) errors.push('Prefecture master is not in prefecture-code order');

const internalPhrases = ['editorial_pending', '個別調査前', '編集用仮ID'];
const catalogText = JSON.stringify(catalog) + JSON.stringify(sources);
for (const phrase of internalPhrases) {
  if (catalogText.includes(phrase)) errors.push(`Internal editorial phrase leaked into public data: ${phrase}`);
}
for (const source of sources) {
  if (source.visibility === 'internal') errors.push(`Internal source ${source.id} leaked into public output`);
}

for (const dish of catalog) {
  if (!dish.id || ids.has(dish.id)) errors.push(`Missing or duplicate id: ${dish.id}`);
  ids.add(dish.id);
  if (!dish.slug || slugs.has(dish.slug)) errors.push(`Missing or duplicate slug: ${dish.slug}`);
  slugs.add(dish.slug);

  if (dish.publicationStatus !== 'published') errors.push(`${dish.id}: only published dishes may appear in public data`);
  if (!['japan', 'world'].includes(dish.domain)) errors.push(`${dish.id}: invalid domain`);
  if (!Object.keys(taxonomy.noodleCategories).includes(dish.noodleCategory)) errors.push(`${dish.id}: invalid noodleCategory`);
  if (!Object.keys(taxonomy.culturalScopes).includes(dish.culturalScope)) errors.push(`${dish.id}: invalid culturalScope`);
  if (!Object.keys(taxonomy.forms).includes(dish.form)) errors.push(`${dish.id}: invalid form`);
  if (!dish.name) errors.push(`${dish.id}: missing name`);

  for (const code of dish.prefectureCodes ?? []) {
    if (!prefectureCodes.has(code)) errors.push(`${dish.id}: unknown prefecture code ${code}`);
  }
  for (const code of dish.regionCodes ?? []) {
    if (!regionCodes.has(code)) errors.push(`${dish.id}: unknown region code ${code}`);
  }
  const derivedRegions = new Set((dish.prefectureCodes ?? [])
    .map((code) => regions.prefectures.find((pref) => pref.code === code)?.regionCode));
  for (const code of dish.regionCodes ?? []) {
    if (!derivedRegions.has(code)) errors.push(`${dish.id}: region ${code} does not match its prefecture codes`);
  }

  // Standard and contemporary styles are explanatory entry points, not places.
  if (dish.culturalScope === 'standard' || dish.culturalScope === 'contemporary') {
    if ((dish.prefectureCodes ?? []).length > 0) errors.push(`${dish.id}: placeless style must not carry a prefecture`);
    if (dish.coordinates) errors.push(`${dish.id}: placeless style must not carry coordinates`);
    if (dish.city) errors.push(`${dish.id}: placeless style must not carry a city`);
  }
  if (dish.domain === 'japan' && dish.culturalScope === 'regional') {
    if ((dish.prefectureCodes ?? []).length === 0) errors.push(`${dish.id}: regional dish has no prefecture`);
    if (!dish.coordinates) errors.push(`${dish.id}: regional dish has no coordinates`);
  }

  for (const key of tasteKeys) {
    const score = dish.taste?.[key];
    if (!score) {
      errors.push(`${dish.id}: missing taste key ${key}`);
      continue;
    }
    for (const field of ['typical', 'min', 'max']) {
      if (!Number.isFinite(score[field]) || score[field] < 0 || score[field] > 5) errors.push(`${dish.id}: ${key}.${field} out of range`);
    }
    if (score.min > score.typical || score.typical > score.max) errors.push(`${dish.id}: invalid range for ${key}`);
    if ('confidence' in score) errors.push(`${dish.id}: taste confidence must not be published`);
  }
  for (const key of noodleKeys) {
    const value = dish.noodle?.[key];
    if (!Number.isFinite(value) || value < 0 || value > 5) errors.push(`${dish.id}: noodle.${key} out of range`);
  }

  for (const sourceId of dish.publicSourceIds ?? []) {
    if (!sourceIds.has(sourceId)) errors.push(`${dish.id}: unknown source ${sourceId}`);
  }
  const citable = (dish.publicSourceIds ?? []).filter((sourceId) => sourceId !== 'epsilon-method');
  if (citable.length === 0) warnings.push(`${dish.id} (${dish.name}): no public source yet`);
  if (!dish.reviewedAt) errors.push(`${dish.id}: missing reviewedAt`);
  if (dish.scoreMethod && !(dish.scoreMethod in (taxonomy.scoreMethods ?? {}))) {
    errors.push(`${dish.id}: unknown scoreMethod ${dish.scoreMethod}`);
  }
  if (!dish.categoryLabel) errors.push(`${dish.id}: missing categoryLabel`);

  if (!Array.isArray(dish.relatedIds) || dish.relatedIds.length < 3) errors.push(`${dish.id}: relatedIds missing`);
  if (!Array.isArray(dish.bridgeIds) || dish.bridgeIds.length < 1) errors.push(`${dish.id}: bridgeIds missing`);
}

// Counts are authored in release-targets.json, never written into this file.
const regional = catalog.filter((dish) => dish.culturalScope !== 'standard');
const standard = catalog.filter((dish) => dish.culturalScope === 'standard');
if (catalog.length !== releaseTargets.counts.publicCatalog) {
  errors.push(`Public catalog: expected ${releaseTargets.counts.publicCatalog}, found ${catalog.length}`);
}
for (const [category, expected] of Object.entries(releaseTargets.catalogTotals.regionalByCategory)) {
  const actual = regional.filter((dish) => dish.noodleCategory === category).length;
  if (actual !== expected) errors.push(`Regional category ${category}: expected ${expected}, found ${actual}`);
}
for (const [category, expected] of Object.entries(releaseTargets.counts.standardByCategory)) {
  const actual = standard.filter((dish) => dish.noodleCategory === category).length;
  if (actual !== expected) errors.push(`Standard category ${category}: expected ${expected}, found ${actual}`);
}
if (standard.length !== releaseTargets.counts.standardStyles) {
  errors.push(`Standard styles: expected ${releaseTargets.counts.standardStyles}, found ${standard.length}`);
}

// The 20 standard style IDs are fixed by the specification and never change.
const requiredStandardIds = taxonomy.standardStyleDisplayOrder ?? [];
if (requiredStandardIds.length !== 20) errors.push(`Expected 20 standard style ids in taxonomy, found ${requiredStandardIds.length}`);
for (const id of requiredStandardIds) {
  const dish = catalog.find((candidate) => candidate.id === id);
  if (!dish) errors.push(`Standard style ${id} is missing from the published catalog`);
  else if (dish.culturalScope !== 'standard') errors.push(`${id}: expected culturalScope=standard`);
}
for (const dish of standard) {
  if (!requiredStandardIds.includes(dish.id)) errors.push(`${dish.id}: unexpected standard style`);
}

// Every relation a published dish carries has to point at another published
// dish; the release must not ship a link that resolves to nothing.
const relationFields = ['parentStyleIds', 'regionalExampleIds', 'derivedStyleIds', 'relatedStyleIds', 'relatedIds', 'bridgeIds'];
let unresolvedRelations = 0;
for (const dish of catalog) {
  for (const field of relationFields) {
    const values = dish[field];
    if (!Array.isArray(values)) {
      errors.push(`${dish.id}: ${field} is missing`);
      continue;
    }
    for (const relationId of values) {
      if (!ids.has(relationId)) {
        unresolvedRelations += 1;
        errors.push(`${dish.id}: unresolved ${field} ${relationId}`);
      }
      if (relationId === dish.id) errors.push(`${dish.id}: self relation is not allowed`);
    }
  }
  for (const parentId of dish.parentStyleIds ?? []) {
    const parent = catalog.find((candidate) => candidate.id === parentId);
    if (parent && parent.culturalScope !== 'standard') errors.push(`${dish.id}: parentStyleId ${parentId} is not a standard style`);
  }
  for (const exampleId of dish.regionalExampleIds ?? []) {
    if (dish.culturalScope !== 'standard') errors.push(`${dish.id}: only standard styles may list regional examples`);
    const example = catalog.find((candidate) => candidate.id === exampleId);
    if (example && example.culturalScope === 'standard') errors.push(`${dish.id}: regional example ${exampleId} is a standard style`);
  }
}

// A standard style may have no regional example, but a *regional* dish that
// names a parent style must appear in that style's example list (spec 5.2).
// A contemporary style is listed back through derivedStyleIds instead.
for (const dish of catalog) {
  for (const parentId of dish.parentStyleIds ?? []) {
    const parent = catalog.find((candidate) => candidate.id === parentId);
    if (!parent) continue;
    if (dish.culturalScope === 'regional' && !(parent.regionalExampleIds ?? []).includes(dish.id)) {
      errors.push(`${parentId}: missing regional_example back-link to ${dish.id}`);
    }
    if (dish.culturalScope === 'contemporary' && !(parent.derivedStyleIds ?? []).includes(dish.id)) {
      errors.push(`${parentId}: missing derived-style back-link to ${dish.id}`);
    }
  }
}
const actualExampleRelations = catalog.reduce((sum, dish) => sum + (dish.regionalExampleIds ?? []).length, 0);
if (actualExampleRelations !== releaseTargets.counts.regionalExampleRelations) {
  errors.push(`regional_example relations: expected ${releaseTargets.counts.regionalExampleRelations}, found ${actualExampleRelations}`);
}
if (manifest.counts.regionalExampleRelations !== actualExampleRelations) {
  errors.push('Manifest regionalExampleRelations does not match the catalog');
}
for (const id of releaseTargets.relationRules.stylesAllowedWithoutRegionalExample) {
  if (!ids.has(id)) errors.push(`${id}: listed as allowed without regional examples but is not published`);
}

// 「全国各地」is neither a place nor a dish; standard styles express their
// nationwide scope through culturalScope, not through an invented record.
for (const dish of catalog) {
  for (const value of [dish.name, dish.city ?? '', dish.prefectureLabel ?? '', ...dish.tags, ...dish.regionCodes]) {
    if (typeof value === 'string' && value.includes('全国各地')) {
      errors.push(`${dish.id}: 「全国各地」must not be stored as a place, dish name or tag`);
    }
  }
}
for (const region of regions.regions) {
  if (region.code === 'all_japan' || region.name.includes('全国各地')) errors.push('Region master must not contain a 全国各地 record');
}

// Every ASCII tag a published dish carries must have a Japanese label, because
// the UI never renders the raw identifier.
const rawTagById = new Map(featureTags.rawTags.map((tag) => [tag.id, tag]));
const legacyTagByValue = new Map(featureTags.legacyJapaneseTags.map((tag) => [tag.value, tag]));
const filterById = new Map(featureTags.filters.map((filter) => [filter.id, filter]));
// 'internal' is a bucket for tags that are never displayed, so it has no
// display group entry of its own.
const groupIds = new Set([...featureTags.groups.map((group) => group.id), 'internal']);
const isAsciiTag = (value) => /^[\u0020-\u007E]+$/.test(value);
const unknownAsciiTags = new Set();
for (const dish of catalog) {
  for (const tag of dish.tags) {
    if (rawTagById.has(tag) || legacyTagByValue.has(tag)) continue;
    if (isAsciiTag(tag)) unknownAsciiTags.add(`${tag} (${dish.id})`);
  }
}
if (unknownAsciiTags.size > 0) {
  errors.push(`辞書に未登録の英語タグが${unknownAsciiTags.size}件あります: ${[...unknownAsciiTags].slice(0, 10).join(', ')}`);
}
if (featureTags.locale !== 'ja') errors.push('feature-tags.json: locale must be ja');
for (const tag of featureTags.rawTags) {
  if (!tag.labelJa) errors.push(`feature tag ${tag.id}: labelJa is empty`);
  if (!groupIds.has(tag.groupId)) errors.push(`feature tag ${tag.id}: unknown group ${tag.groupId}`);
  if (tag.visibility === 'filter' && (tag.filterIds ?? []).length === 0) {
    errors.push(`feature tag ${tag.id}: filter-visible tags need at least one filterId`);
  }
  for (const filterId of tag.filterIds ?? []) {
    if (!filterById.has(filterId)) errors.push(`feature tag ${tag.id}: unknown filter ${filterId}`);
  }
}
for (const tag of featureTags.legacyJapaneseTags) {
  if (!tag.labelJa) errors.push(`legacy tag ${tag.value}: labelJa is empty`);
  for (const filterId of tag.filterIds ?? []) {
    if (!filterById.has(filterId)) errors.push(`legacy tag ${tag.value}: unknown filter ${filterId}`);
  }
}
if (filterById.size !== featureTags.filters.length) errors.push('feature-tags.json: duplicate filter id');
for (const filter of featureTags.filters) {
  if (!filter.labelJa) errors.push(`filter ${filter.id}: labelJa is empty`);
  if (!groupIds.has(filter.groupId)) errors.push(`filter ${filter.id}: unknown group ${filter.groupId}`);
  for (const tagId of filter.rawTagIds ?? []) {
    if (!rawTagById.has(tagId)) errors.push(`filter ${filter.id}: unknown raw tag ${tagId}`);
  }
}
for (const filterId of featureTags.quickFilterIds) {
  if (!filterById.has(filterId)) errors.push(`quickFilterIds: unknown filter ${filterId}`);
}

// 豊橋カレーうどん stays a separate regional dish from the standard curry udon.
const toyohashi = catalog.find((dish) => dish.id === 'jp-udon-toyohashi-curry');
const curryStyle = catalog.find((dish) => dish.id === 'jp-style-udon-curry');
if (!toyohashi) errors.push('jp-udon-toyohashi-curry is missing from the published catalog');
else {
  if (toyohashi.culturalScope !== 'regional') errors.push('jp-udon-toyohashi-curry must stay a regional dish');
  if (!toyohashi.parentStyleIds.includes('jp-style-udon-curry')) errors.push('jp-udon-toyohashi-curry must name jp-style-udon-curry as its parent style');
  if (!toyohashi.prefectureCodes.includes('23')) errors.push('jp-udon-toyohashi-curry must be filed under 愛知県');
}
if (curryStyle && !curryStyle.regionalExampleIds.includes('jp-udon-toyohashi-curry')) {
  errors.push('jp-style-udon-curry must list 豊橋カレーうどん as a regional example');
}

const relations = readData('relations.json');
for (const [dishId, entry] of Object.entries(relations)) {
  if (!ids.has(dishId)) {
    unresolvedRelations += 1;
    errors.push(`relations.json: unknown source ${dishId}`);
  }
  for (const field of relationFields) {
    for (const targetId of entry[field] ?? []) {
      if (!ids.has(targetId)) {
        unresolvedRelations += 1;
        errors.push(`relations.json: ${dishId} points at unknown ${targetId}`);
      }
    }
  }
}
if (unresolvedRelations > 0) errors.push(`未解決の公開関連IDが${unresolvedRelations}件あります`);

// The nine parent styles the researched regional dishes depend on.
const requiredParentStyleIds = [
  'jp-style-udon-kake', 'jp-style-udon-bukkake', 'jp-style-udon-kamaage', 'jp-style-udon-zaru',
  'jp-style-soba-kake', 'jp-style-soba-mori-zaru',
  'jp-style-yakisoba-sauce', 'jp-style-yakisoba-salt', 'jp-style-yakisoba-ankake'
];
for (const id of requiredParentStyleIds) {
  if (!ids.has(id)) errors.push(`Regional dishes reference parent style ${id}, which is not published`);
}

const japanCount = catalog.filter((dish) => dish.domain === 'japan').length;
const worldCount = catalog.length - japanCount;
if (manifest.counts.total !== catalog.length || manifest.counts.japan !== japanCount || manifest.counts.world !== worldCount) {
  errors.push('Manifest counts do not match catalog');
}
for (const [category, count] of Object.entries(manifest.counts.byCategory)) {
  const actual = catalog.filter((dish) => dish.noodleCategory === category).length;
  if (actual !== count) errors.push(`Manifest category count mismatch for ${category}: ${count} vs ${actual}`);
}

// --- v2.3.0: the canonical facet index --------------------------------------
const facetIndex = readData('facet-index.json');
const facetById = new Map(facetIndex.records.map((record) => [record.dishId, record]));
const knownFilterIds = new Set(featureTags.filters.map((filter) => filter.id));
const derivationRules = JSON.parse(fs.readFileSync(path.join(root, 'data/facets/facet-derivation-rules.v2.3.0.json'), 'utf8'));
const seededIds = new Set(
  JSON.parse(fs.readFileSync(path.join(root, 'data/facets/facet-index.seed.json'), 'utf8')).records.map((record) => record.dishId)
);

if (facetIndex.seededRecords !== seededIds.size) {
  errors.push(`Facet index: expected ${seededIds.size} seeded records, found ${facetIndex.seededRecords}`);
}
for (const id of legacyIds) {
  if (!seededIds.has(id)) errors.push(`Facet seed is missing the v2.1.2 dish ${id}`);
}
for (const dish of catalog) {
  const record = facetById.get(dish.id);
  if (!record) {
    errors.push(`${dish.id}: no canonical facet record`);
    continue;
  }
  if (record.facets.length === 0) errors.push(`${dish.id}: canonical facet record is empty`);
  for (const facet of record.facets) {
    if (!knownFilterIds.has(facet.id)) errors.push(`${dish.id}: facet ${facet.id} is not a known filter`);
    if (!facet.source || !facet.evidence || !Number.isFinite(facet.confidence)) {
      errors.push(`${dish.id}: facet ${facet.id} is missing source, evidence or confidence`);
    }
    // A number can make a dish findable, never assert a characteristic (spec 4.6).
    if (facet.source === 'numeric_derived' && facet.displayEligible) {
      errors.push(`${dish.id}: numeric facet ${facet.id} must not be display-eligible`);
    }
  }
}
for (const record of facetIndex.records) {
  if (!ids.has(record.dishId)) errors.push(`Facet index references the unpublished dish ${record.dishId}`);
}

// A v2.1.2 placeholder noodle number is not evidence of anything (spec 4.5).
const noodleFilters = new Set(
  Object.entries(derivationRules.numericThresholds)
    .filter(([, rule]) => rule.requiresEvidenceNot === 'default_only')
    .map(([id]) => id)
);
const placeholderNoodleIds = new Set(
  parseCsv(fs.readFileSync(path.join(masterDir, 'taste-scores.csv'), 'utf8'))
    .filter((row) => ['default_placeholder', 'unknown'].includes(row.noodle_provenance))
    .map((row) => row.id)
);
for (const record of facetIndex.records) {
  if (!placeholderNoodleIds.has(record.dishId)) continue;
  for (const facet of record.facets) {
    if (facet.source === 'numeric_derived' && noodleFilters.has(facet.id)) {
      errors.push(`${record.dishId}: noodle facet ${facet.id} derived from a placeholder value`);
    }
  }
}

// The combination the release is measured by (spec 5.4).
const facetIdsOf = (dishId) => new Set((facetById.get(dishId)?.facets ?? []).map((facet) => facet.id));
const richAndThick = catalog.filter((dish) => {
  const facets = facetIdsOf(dish.id);
  return facets.has('rich') && facets.has('thick_noodle');
});
const regression = releaseTargets.regressions?.richAndThick;
if (regression) {
  if (richAndThick.length < regression.minimumMatches) {
    errors.push(`濃厚 × 太麺: expected at least ${regression.minimumMatches} matches, found ${richAndThick.length}`);
  }
  for (const id of regression.mustInclude) {
    if (!richAndThick.some((dish) => dish.id === id)) errors.push(`濃厚 × 太麺 must include ${id}`);
  }
}

// --- v2.3.0: contemporary styles --------------------------------------------
const contemporary = catalog.filter((dish) => dish.culturalScope === 'contemporary');
const requiredContemporaryIds = taxonomy.contemporaryStyleDisplayOrder ?? [];
if (contemporary.length !== releaseTargets.counts.contemporaryStyles) {
  errors.push(`Contemporary styles: expected ${releaseTargets.counts.contemporaryStyles}, found ${contemporary.length}`);
}
for (const id of requiredContemporaryIds) {
  const dish = catalog.find((candidate) => candidate.id === id);
  if (!dish) errors.push(`Contemporary style ${id} is missing from the published catalog`);
  else if (dish.culturalScope !== 'contemporary') errors.push(`${id}: expected culturalScope=contemporary`);
}
for (const dish of contemporary) {
  if (!requiredContemporaryIds.includes(dish.id)) errors.push(`${dish.id}: unexpected contemporary style`);
  if (dish.publicSourceIds.length < 2) errors.push(`${dish.id}: a contemporary style needs at least two public sources`);
  if (dish.parentStyleIds.length === 0) errors.push(`${dish.id}: a contemporary style must name the style it grew out of`);
}

if (warnings.length) {
  console.warn(`Data validation warnings (${warnings.length}):`);
  for (const warning of warnings.slice(0, 100)) console.warn(`- ${warning}`);
}

if (errors.length) {
  console.error(`Data validation failed with ${errors.length} issue(s):`);
  for (const error of errors.slice(0, 100)) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Data validation passed: ${catalog.length} dishes, ${sources.length} public sources, ${warnings.length} warning(s).`);
