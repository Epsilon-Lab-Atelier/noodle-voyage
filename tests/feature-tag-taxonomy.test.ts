import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveDishFeatureTags, resolveFeatureTag } from '../src/features/tags/resolveFeatureTag';
import type { FeatureTagTaxonomy } from '../src/features/tags/featureTagTypes';
import type { Dish } from '../src/types/catalog';

const taxonomy = JSON.parse(
  fs.readFileSync(path.resolve('public/data/feature-tags.json'), 'utf8')
) as FeatureTagTaxonomy;
const catalog = JSON.parse(fs.readFileSync(path.resolve('public/data/catalog.json'), 'utf8')) as Dish[];

describe('feature tag dictionary', () => {
  it('is a Japanese dictionary with the six display groups', () => {
    expect(taxonomy.locale).toBe('ja');
    expect(taxonomy.groups.map((group) => group.id)).toEqual([
      'taste_aroma', 'broth_seasoning', 'noodle', 'serving', 'ingredient', 'culture'
    ]);
  });

  it('gives every entry a Japanese label and a known group', () => {
    const groupIds = new Set<string>([...taxonomy.groups.map((group) => group.id), 'internal']);
    for (const tag of taxonomy.rawTags) {
      expect(tag.labelJa.length).toBeGreaterThan(0);
      expect(groupIds.has(tag.groupId)).toBe(true);
      if (tag.visibility === 'filter') expect(tag.filterIds.length).toBeGreaterThan(0);
    }
    for (const tag of taxonomy.legacyJapaneseTags) expect(tag.labelJa.length).toBeGreaterThan(0);
  });

  it('has unique filter IDs and real quick filters', () => {
    const ids = taxonomy.filters.map((filter) => filter.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const filterId of taxonomy.quickFilterIds) expect(ids).toContain(filterId);
  });

  it('covers every tag a published dish carries', () => {
    const known = new Set([
      ...taxonomy.rawTags.map((tag) => tag.id),
      ...taxonomy.legacyJapaneseTags.map((tag) => tag.value)
    ]);
    const unknown = [...new Set(catalog.flatMap((dish) => dish.tags))].filter((tag) => !known.has(tag));
    expect(unknown).toEqual([]);
  });

  it('shows rich as 濃厚 and firm_noodle as コシが強い麺', () => {
    expect(resolveFeatureTag('rich', taxonomy)?.labelJa).toBe('濃厚');
    expect(resolveFeatureTag('firm_noodle', taxonomy)?.labelJa).toBe('コシが強い麺');
  });

  it('passes a legacy Japanese tag through unchanged', () => {
    expect(resolveFeatureTag('煮干し', taxonomy)?.labelJa).toBe('煮干し');
  });

  it('resolves an unknown English identifier to nothing', () => {
    expect(resolveFeatureTag('totally_unknown_tag', taxonomy)).toBeNull();
  });

  it('hides internal tags and never repeats the same wording', () => {
    const resolved = resolveDishFeatureTags(['udon', 'rich', 'creamy', 'soba'], taxonomy);
    expect(resolved.map((entry) => entry.raw)).not.toContain('udon');
    expect(resolved.map((entry) => entry.raw)).not.toContain('soba');
    expect(new Set(resolved.map((entry) => entry.labelJa)).size).toBe(resolved.length);
  });

  it('resolves every published tag to a Japanese label', () => {
    for (const dish of catalog) {
      for (const entry of resolveDishFeatureTags(dish.tags, taxonomy)) {
        expect(entry.labelJa).not.toMatch(/^[ -~]+$/);
      }
    }
  });
});
