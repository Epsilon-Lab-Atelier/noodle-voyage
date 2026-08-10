import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Dish } from '../src/types/catalog';

const catalog = JSON.parse(fs.readFileSync(path.resolve('public/data/catalog.json'), 'utf8')) as Dish[];
const manifest = JSON.parse(fs.readFileSync(path.resolve('public/data/manifest.json'), 'utf8')) as {
  counts: { regionalExampleRelations: number };
  expected: { regionalExampleRelations: number };
};
const releaseTargets = JSON.parse(fs.readFileSync(path.resolve('data/master/release-targets.json'), 'utf8')) as {
  relationRules: { stylesAllowedWithoutRegionalExample: string[] };
};

const standardStyles = catalog.filter((dish) => dish.culturalScope === 'standard');

describe('regional_example cardinality', () => {
  it('counts the relations the release manifest expects', () => {
    const actual = catalog.reduce((sum, dish) => sum + dish.regionalExampleIds.length, 0);
    expect(actual).toBe(manifest.expected.regionalExampleRelations);
    expect(manifest.counts.regionalExampleRelations).toBe(actual);
  });

  it('allows a standard style to have no regional example', () => {
    for (const id of releaseTargets.relationRules.stylesAllowedWithoutRegionalExample) {
      const dish = catalog.find((entry) => entry.id === id);
      expect(dish).toBeDefined();
      expect(dish?.regionalExampleIds).toEqual([]);
    }
  });

  it('never invents an example for 天ぷらそば or 鴨南蛮そば', () => {
    expect(catalog.find((dish) => dish.id === 'jp-style-soba-tempura')?.regionalExampleIds).toEqual([]);
    expect(catalog.find((dish) => dish.id === 'jp-style-soba-kamo-nanban')?.regionalExampleIds).toEqual([]);
  });

  it('gives every parent_style_ids link a matching back-reference', () => {
    for (const dish of catalog) {
      for (const parentId of dish.parentStyleIds) {
        const parent = catalog.find((entry) => entry.id === parentId);
        // A regional dish is listed as an example; a contemporary style is
        // listed as a derivation of the style it grew out of.
        const backLink = dish.culturalScope === 'contemporary' ? parent?.derivedStyleIds : parent?.regionalExampleIds;
        expect(backLink).toContain(dish.id);
      }
    }
  });

  it('only lets standard styles hold regional examples', () => {
    for (const dish of catalog.filter((entry) => entry.culturalScope !== 'standard')) {
      expect(dish.regionalExampleIds).toEqual([]);
    }
    for (const dish of standardStyles) {
      for (const id of dish.regionalExampleIds) {
        expect(catalog.find((entry) => entry.id === id)?.culturalScope).not.toBe('standard');
      }
    }
  });

  it('never stores 全国各地 as a place, dish or tag', () => {
    const regions = JSON.parse(fs.readFileSync(path.resolve('public/data/regions.json'), 'utf8')) as {
      regions: Array<{ code: string; name: string }>;
    };
    expect(regions.regions.some((region) => region.code === 'all_japan')).toBe(false);
    for (const dish of catalog) {
      expect(dish.name).not.toContain('全国各地');
      expect(dish.city ?? '').not.toContain('全国各地');
      expect(dish.tags.join(' ')).not.toContain('全国各地');
    }
  });

  it('keeps standard styles free of geography', () => {
    for (const dish of standardStyles) {
      expect(dish.prefectureCodes).toEqual([]);
      expect(dish.regionCodes).toEqual([]);
      expect(dish.city).toBeNull();
      expect(dish.coordinates).toBeNull();
    }
  });
});
