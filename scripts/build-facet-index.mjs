// Builds public/data/facet-index.json: the canonical, evidence-backed view of
// which search filters each published dish satisfies.
//
// The 215 dishes carried over from v2.1.2 come from the researched seed and are
// never re-derived here. Everything researched since v2.2.0 is derived from its
// own tags, structured fields and reviewed numbers, following
// data/facets/facet-derivation-rules.v2.3.0.json.
//
// Two rules matter more than the rest:
//   * a numeric threshold never produces a display tag, only a search match;
//   * a noodle number that is only a v2.1.2 placeholder produces nothing at all.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));

const rules = readJson('data/facets/facet-derivation-rules.v2.3.0.json');
const seed = readJson('data/facets/facet-index.seed.json');
const featureTags = readJson('data/master/feature-tag-taxonomy.ja.json');

// rules.precedence ranks evidence for resolving a *conflict* — a reviewer's
// judgement outranks a number. When several kinds of evidence agree that a dish
// has a facet, the entry we keep should be the one that can be shown to a
// reader, so a numeric threshold is the weakest witness of the four.
const witnessRank = new Map([
  ['manual_review', 0],
  ['structured_field', 1],
  ['legacy_tag', 2],
  ['numeric_derived', 3]
]);
const filterIds = new Set(featureTags.filters.map((filter) => filter.id));
const rawTagById = new Map(featureTags.rawTags.map((tag) => [tag.id, tag]));
const legacyTagByValue = new Map(featureTags.legacyJapaneseTags.map((tag) => [tag.value, tag]));

// A number the v2.1.2 generator supplied uniformly, or none at all, is not
// evidence of anything (spec 4.5).
const placeholderProvenance = new Set(['default_placeholder', 'unknown']);

const formFacets = {
  soup: 'soup',
  dipping: 'dipping',
  dry: 'brothless',
  fried: 'fried_griddle',
  cold: 'cold',
  stew: 'stew',
  sauce: 'sauce',
  hot_pot: 'stew'
};

const valueAt = (dish, dottedPath) =>
  dottedPath.split('.').reduce((value, key) => (value === null || value === undefined ? value : value[key]), dish);

const compare = (value, op, threshold) => {
  if (!Number.isFinite(value)) return false;
  return op === '>=' ? value >= threshold : op === '<=' ? value <= threshold : false;
};

const testThreshold = (dish, rule) => {
  if (rule.all) return rule.all.every(([dottedPath, op, threshold]) => compare(valueAt(dish, dottedPath), op, threshold));
  if (rule.any) return rule.any.some(([dottedPath, op, threshold]) => compare(valueAt(dish, dottedPath), op, threshold));
  return compare(valueAt(dish, rule.path), rule.op, rule.value);
};

/** Collects facets for one dish, keeping the strongest evidence per filter. */
function collect() {
  const byFilter = new Map();
  return {
    add(id, source, confidence, evidence, displayEligible) {
      if (!filterIds.has(id)) return;
      const existing = byFilter.get(id);
      if (existing && witnessRank.get(existing.source) <= witnessRank.get(source)) return;
      byFilter.set(id, { id, source, confidence, evidence, displayEligible });
    },
    result: () => [...byFilter.values()]
  };
}

function deriveFacets(dish, noodleProvenance) {
  const facets = collect();
  const structured = rules.evidencePolicy.structured_field;
  const structuredConfidence = (structured.confidenceRange[0] + structured.confidenceRange[1]) / 2;

  // Explicit tags carry the strongest non-reviewed evidence: a person wrote them.
  for (const tag of dish.tags) {
    const rawTag = rawTagById.get(tag);
    for (const id of rawTag?.filterIds ?? []) {
      facets.add(id, 'legacy_tag', rules.evidencePolicy.legacy_tag.confidence, `tag:${tag}`, true);
    }
    const legacy = legacyTagByValue.get(tag);
    for (const id of legacy?.filterIds ?? []) {
      facets.add(id, 'legacy_tag', rules.evidencePolicy.legacy_tag.confidence, `tag:${tag}`, true);
    }
  }

  // Structured fields: the serving form, and features stated in the name itself.
  const formFacet = formFacets[dish.form];
  if (formFacet) facets.add(formFacet, 'structured_field', structuredConfidence, `form:${dish.form}`, true);
  const nameText = [dish.name, dish.localName ?? '', ...dish.aliases].join(' ');
  for (const rule of rules.nameExplicitRules) {
    if (!new RegExp(rule.pattern).test(nameText)) continue;
    for (const id of rule.facetIds) {
      facets.add(id, 'structured_field', structuredConfidence, rule.evidence, true);
    }
  }

  // Numeric thresholds: search-only, and blind to placeholder noodle numbers.
  const numeric = rules.evidencePolicy.numeric_derived;
  for (const [id, rule] of Object.entries(rules.numericThresholds)) {
    if (rule.requiresEvidenceNot === 'default_only' && placeholderProvenance.has(noodleProvenance)) continue;
    if (!testThreshold(dish, rule)) continue;
    const measured = rule.path ?? rule.all?.[0]?.[0] ?? rule.any?.[0]?.[0];
    const value = measured ? valueAt(dish, measured) : null;
    const evidence = measured ? `numeric:${measured}=${value}` : `numeric:${id}`;
    facets.add(id, 'numeric_derived', numeric.confidence, evidence, false);
  }

  return facets.result();
}

function completenessOf(dish, facets, noodleProvenance) {
  const has = (group) => facets.some((facet) => groupOf(facet.id) === group);
  const known = (group) => facets.some((facet) => groupOf(facet.id) === group && facet.source !== 'numeric_derived');
  const state = (group) => (known(group) ? 'known' : has(group) ? 'derived' : 'unknown');
  return {
    taste: state('taste_aroma'),
    brothSeasoning: state('broth_seasoning'),
    noodle: placeholderProvenance.has(noodleProvenance) ? (has('noodle') ? 'derived' : 'unknown') : state('noodle'),
    servingForm: state('serving'),
    ingredients: state('ingredient')
  };
}

const filterGroups = new Map(featureTags.filters.map((filter) => [filter.id, filter.groupId]));
const groupOf = (facetId) => filterGroups.get(facetId);

export function buildFacetIndex(dishes, noodleProvenanceById) {
  const seedById = new Map(seed.records.map((record) => [record.dishId, record]));
  const records = dishes.map((dish) => {
    const noodleProvenance = noodleProvenanceById.get(dish.id) ?? 'unknown';
    const seedRecord = seedById.get(dish.id);
    const facets = seedRecord ? seedRecord.facets : deriveFacets(dish, noodleProvenance);
    const unresolved = facets.filter((facet) => !filterIds.has(facet.id));
    if (unresolved.length) {
      throw new Error(`${dish.id}: facet ids not in the dictionary: ${unresolved.map((f) => f.id).join(', ')}`);
    }
    return {
      dishId: dish.id,
      facets,
      completeness: seedRecord?.completeness ?? completenessOf(dish, facets, noodleProvenance)
    };
  });

  const missingSeed = seed.records.filter((record) => !dishes.some((dish) => dish.id === record.dishId));
  if (missingSeed.length) {
    throw new Error(`Seeded dishes are no longer published: ${missingSeed.map((r) => r.dishId).join(', ')}`);
  }
  const empty = records.filter((record) => record.facets.length === 0);
  if (empty.length) {
    throw new Error(`No canonical facet for: ${empty.map((r) => r.dishId).join(', ')}`);
  }

  return {
    schemaVersion: 1,
    dataVersion: seed.dataVersion,
    rulesVersion: rules.version,
    seededRecords: seed.records.length,
    records
  };
}
