import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { displayableFacets, facetRecordFor, matchReason, searchableFacetIds } from '../src/features/tags/facetLookup';
import type { FacetIndex, FeatureTagTaxonomy } from '../src/features/tags/featureTagTypes';
import type { Dish } from '../src/types/catalog';

const catalog = JSON.parse(fs.readFileSync(path.resolve('public/data/catalog.json'), 'utf8')) as Dish[];
const facetIndex = JSON.parse(fs.readFileSync(path.resolve('public/data/facet-index.json'), 'utf8')) as FacetIndex;
const taxonomy = JSON.parse(fs.readFileSync(path.resolve('public/data/feature-tags.json'), 'utf8')) as FeatureTagTaxonomy;
const seed = JSON.parse(fs.readFileSync(path.resolve('data/facets/facet-index.seed.json'), 'utf8')) as FacetIndex;
const legacyIds = JSON.parse(fs.readFileSync(path.resolve('data/master/legacy-dish-ids.json'), 'utf8')) as string[];
const audit = fs.readFileSync(path.resolve('data/facets/base-215-density-audit.csv'), 'utf8').trim().split('\n');
const releaseTargets = JSON.parse(fs.readFileSync(path.resolve('data/master/release-targets.json'), 'utf8')) as {
  regressions: { richAndThick: { minimumMatches: number; mustInclude: string[]; base215Matches: string[] } };
};

describe('canonical facet index', () => {
  it('reproduces the 215-record density audit', () => {
    expect(audit).toHaveLength(legacyIds.length + 1);
    expect(seed.records).toHaveLength(legacyIds.length);
    expect(seed.records.map((record) => record.dishId).sort()).toEqual([...legacyIds].sort());
  });

  it('covers every published dish with at least one facet', () => {
    expect(facetIndex.records).toHaveLength(catalog.length);
    for (const dish of catalog) {
      expect(facetRecordFor(dish.id, facetIndex).facets.length).toBeGreaterThan(0);
    }
  });

  it('gives every facet a source, a confidence and its evidence', () => {
    for (const record of facetIndex.records) {
      for (const facet of record.facets) {
        expect(['manual_review', 'structured_field', 'numeric_derived', 'legacy_tag']).toContain(facet.source);
        expect(facet.confidence).toBeGreaterThan(0);
        expect(facet.evidence.length).toBeGreaterThan(0);
      }
    }
  });

  it('resolves every facet to a filter in the Japanese dictionary', () => {
    const filterIds = new Set(taxonomy.filters.map((filter) => filter.id));
    for (const record of facetIndex.records) {
      for (const facet of record.facets) expect(filterIds.has(facet.id)).toBe(true);
    }
  });

  it('never lets a numeric threshold become a display tag', () => {
    for (const record of facetIndex.records) {
      for (const facet of record.facets) {
        if (facet.source === 'numeric_derived') expect(facet.displayEligible).toBe(false);
      }
    }
    const numericOnly = facetIndex.records.find((record) => record.facets.some((facet) => facet.source === 'numeric_derived'));
    expect(numericOnly).toBeDefined();
    expect(displayableFacets(numericOnly!.dishId, facetIndex).every((facet) => facet.source !== 'numeric_derived')).toBe(true);
  });

  it('builds no noodle facet from a v2.1.2 placeholder value', () => {
    const placeholderIds = new Set(
      fs.readFileSync(path.resolve('data/master/taste-scores.csv'), 'utf8')
        .trim()
        .split('\n')
        .slice(1)
        .filter((line) => line.endsWith(',default_placeholder'))
        .map((line) => line.split(',')[0])
    );
    expect(placeholderIds.size).toBe(157);
    const noodleFilters = new Set(
      taxonomy.filters.filter((filter) => filter.groupId === 'noodle').map((filter) => filter.id)
    );
    for (const record of facetIndex.records) {
      if (!placeholderIds.has(record.dishId)) continue;
      for (const facet of record.facets) {
        if (facet.source === 'numeric_derived') expect(noodleFilters.has(facet.id)).toBe(false);
      }
    }
  });

  it('lets a reviewer outrank a number', () => {
    // 家系ラーメン is one of the nineteen reviewed anchors.
    const record = facetRecordFor('jp-075', facetIndex);
    const thick = record.facets.find((facet) => facet.id === 'thick_noodle');
    expect(thick?.source).toBe('manual_review');
    expect(thick?.displayEligible).toBe(true);
  });

  it('finds a dish through a facet its own tags never mention', () => {
    // つけ麺 has no rich/thick tag, but its structured values place it there.
    const dish = catalog.find((entry) => entry.id === 'jp-072');
    expect(dish?.tags).not.toContain('rich');
    expect(searchableFacetIds('jp-072', facetIndex).has('rich')).toBe(true);
  });

  it('explains a numeric match as a resemblance, never as a classification', () => {
    const reason = matchReason(
      { id: 'thick_noodle', source: 'numeric_derived', confidence: 0.62, evidence: 'numeric:noodle.thickness=3.7', displayEligible: false },
      '太麺'
    );
    expect(reason).toBe('太麺に近い: 麺の太さ 3.7 / 5');
    expect(reason).not.toContain('分類');
  });
});

describe('濃厚 × 太麺', () => {
  const richAndThick = catalog.filter((dish) => {
    const facets = searchableFacetIds(dish.id, facetIndex);
    return facets.has('rich') && facets.has('thick_noodle');
  });

  it('is no longer empty', () => {
    expect(richAndThick.length).toBeGreaterThanOrEqual(releaseTargets.regressions.richAndThick.minimumMatches);
  });

  it('includes the dishes the release names', () => {
    for (const id of releaseTargets.regressions.richAndThick.mustInclude) {
      expect(richAndThick.map((dish) => dish.id)).toContain(id);
    }
  });

  it('matches exactly the four base-215 candidates the audit found', () => {
    const legacy = new Set(legacyIds);
    const fromBase = richAndThick.filter((dish) => legacy.has(dish.id)).map((dish) => dish.id).sort();
    expect(fromBase).toEqual([...releaseTargets.regressions.richAndThick.base215Matches].sort());
  });
});
