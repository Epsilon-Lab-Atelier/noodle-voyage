import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  dishFilterIds,
  featureSelectionParams,
  matchesFeatureSelection,
  normalizeFeatureFilters,
  searchFeatureFilters
} from '../src/features/explore/featureFilters';
import type { FacetIndex, FeatureTagTaxonomy } from '../src/features/tags/featureTagTypes';
import type { Dish } from '../src/types/catalog';

const taxonomy = JSON.parse(
  fs.readFileSync(path.resolve('public/data/feature-tags.json'), 'utf8')
) as FeatureTagTaxonomy;
const catalog = JSON.parse(fs.readFileSync(path.resolve('public/data/catalog.json'), 'utf8')) as Dish[];
const facetIndex = JSON.parse(fs.readFileSync(path.resolve('public/data/facet-index.json'), 'utf8')) as FacetIndex;

// A dish satisfies a filter through the facet index, so a synthetic dish needs a
// synthetic index entry alongside it.
let syntheticId = 0;
const indexWith = (records: Array<{ dishId: string; filterIds: string[] }>): FacetIndex => ({
  ...facetIndex,
  records: records.map((record) => ({
    dishId: record.dishId,
    facets: record.filterIds.map((id) => ({
      id,
      source: 'legacy_tag' as const,
      confidence: 0.88,
      evidence: `tag:${id}`,
      displayEligible: true
    })),
    completeness: { taste: 'known', brothSeasoning: 'known', noodle: 'known', servingForm: 'known', ingredients: 'known' } as const
  }))
});
const dishWith = (filterIds: string[]) => {
  const id = `synthetic-${(syntheticId += 1)}`;
  return { dish: { id, tags: [] } as unknown as Dish, index: indexWith([{ dishId: id, filterIds }]) };
};

describe('feature filter logic', () => {
  it('matches any one filter inside the same group', () => {
    const rich = dishWith(['rich']);
    const spicy = dishWith(['spicy']);
    const selection = { selected: ['rich', 'spicy'], excluded: [] };
    expect(matchesFeatureSelection(rich.dish, selection, taxonomy, rich.index)).toBe(true);
    expect(matchesFeatureSelection(spicy.dish, selection, taxonomy, spicy.index)).toBe(true);
  });

  it('requires every group to match when filters span groups', () => {
    const selection = { selected: ['rich', 'thick_noodle'], excluded: [] };
    const richOnly = dishWith(['rich']);
    const thickOnly = dishWith(['thick_noodle']);
    const both = dishWith(['rich', 'thick_noodle']);
    expect(matchesFeatureSelection(richOnly.dish, selection, taxonomy, richOnly.index)).toBe(false);
    expect(matchesFeatureSelection(thickOnly.dish, selection, taxonomy, thickOnly.index)).toBe(false);
    expect(matchesFeatureSelection(both.dish, selection, taxonomy, both.index)).toBe(true);
  });

  it('drops a dish that carries an excluded feature', () => {
    const selection = { selected: ['rich'], excluded: ['spicy'] };
    const plain = dishWith(['rich']);
    const spicy = dishWith(['rich', 'spicy']);
    expect(matchesFeatureSelection(plain.dish, selection, taxonomy, plain.index)).toBe(true);
    expect(matchesFeatureSelection(spicy.dish, selection, taxonomy, spicy.index)).toBe(false);
  });

  it('keeps everything when nothing is selected', () => {
    const empty = dishWith([]);
    expect(matchesFeatureSelection(empty.dish, { selected: [], excluded: [] }, taxonomy, empty.index)).toBe(true);
  });

  it('matches a legacy Japanese tag through the facet index', () => {
    // 喜多方ラーメン carries 煮干し in its v2.1.2 tags.
    const dish = catalog.find((entry) => entry.tags.includes('煮干し'));
    expect(dish).toBeDefined();
    expect(dishFilterIds(dish as Dish, facetIndex).has('niboshi')).toBe(true);
    expect(matchesFeatureSelection(dish as Dish, { selected: ['niboshi'], excluded: [] }, taxonomy, facetIndex)).toBe(true);
  });

  it('finds 濃厚 when searching for こってり', () => {
    expect(searchFeatureFilters('こってり', taxonomy)[0]?.labelJa).toBe('濃厚');
    expect(searchFeatureFilters('硬め', taxonomy)[0]?.labelJa).toBe('コシが強い');
    expect(searchFeatureFilters('冷やし', taxonomy)[0]?.labelJa).toBe('冷たい');
  });

  it('shares filter IDs rather than Japanese labels in the URL', () => {
    const params = featureSelectionParams({ selected: ['rich', 'firm_noodle'], excluded: ['spicy'] });
    expect(params).toEqual({ features: 'rich,firm_noodle', exclude: 'spicy' });
  });

  it('reads a selection back out of URL parameters', () => {
    const selection = normalizeFeatureFilters({ features: 'rich,firm_noodle', exclude: 'spicy' }, taxonomy);
    expect(selection).toEqual({ selected: ['rich', 'firm_noodle'], excluded: ['spicy'] });
  });

  it('ignores filter IDs it does not know', () => {
    expect(normalizeFeatureFilters({ features: 'rich,not_a_filter' }, taxonomy).selected).toEqual(['rich']);
  });

  it('converts a v2.2.0 tag= link into filter IDs', () => {
    expect(normalizeFeatureFilters({ tag: 'firm_noodle' }, taxonomy).selected).toContain('firm_noodle');
    expect(normalizeFeatureFilters({ tag: '煮干し' }, taxonomy).selected).toContain('niboshi');
  });

  it('leaves at least one dish for every filter in the catalog', () => {
    const counts = new Map<string, number>();
    for (const dish of catalog) {
      for (const filterId of dishFilterIds(dish, facetIndex)) counts.set(filterId, (counts.get(filterId) ?? 0) + 1);
    }
    const empty = taxonomy.filters.filter((filter) => !counts.get(filter.id)).map((filter) => filter.id);
    expect(empty).toEqual([]);
  });
});
