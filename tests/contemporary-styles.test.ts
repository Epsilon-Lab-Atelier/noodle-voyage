import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isPlaceless } from '../src/types/catalog';
import type { Dish } from '../src/types/catalog';

const catalog = JSON.parse(fs.readFileSync(path.resolve('public/data/catalog.json'), 'utf8')) as Dish[];
const contemporaryFile = JSON.parse(fs.readFileSync(path.resolve('public/data/contemporary-styles.json'), 'utf8')) as Dish[];
const taxonomy = JSON.parse(fs.readFileSync(path.resolve('data/master/taxonomy.json'), 'utf8')) as {
  culturalScopes: Record<string, string>;
  contemporaryStyleDisplayOrder: string[];
};
const releaseTargets = JSON.parse(fs.readFileSync(path.resolve('data/master/release-targets.json'), 'utf8')) as {
  counts: { contemporaryStyles: number; publicCatalog: number };
};

const contemporary = catalog.filter((dish) => dish.culturalScope === 'contemporary');

describe('contemporary styles', () => {
  it('publishes the two researched styles under their fixed IDs', () => {
    expect(contemporary).toHaveLength(releaseTargets.counts.contemporaryStyles);
    expect(contemporary.map((dish) => dish.id).sort()).toEqual([...taxonomy.contemporaryStyleDisplayOrder].sort());
    expect(contemporaryFile.map((dish) => dish.id)).toEqual(taxonomy.contemporaryStyleDisplayOrder);
  });

  it('names the scope 現代スタイル and keeps the noodle category separate', () => {
    expect(taxonomy.culturalScopes.contemporary).toBe('現代スタイル');
    // 位置づけ and 麺の種類 are two axes: the category label still says which
    // noodle it is, and the placement is carried by its own badge.
    for (const dish of contemporary) {
      expect(dish.categoryLabel).toBe('現代のラーメン');
      expect(dish.noodleCategory).toBe('ramen');
    }
  });

  it('carries no geography and stays off the map', () => {
    for (const dish of contemporary) {
      expect(dish.prefectureCodes).toEqual([]);
      expect(dish.regionCodes).toEqual([]);
      expect(dish.city).toBeNull();
      expect(dish.coordinates).toBeNull();
      expect(isPlaceless(dish)).toBe(true);
    }
  });

  it('grows out of an existing standard style, in both directions', () => {
    for (const dish of contemporary) {
      expect(dish.parentStyleIds).toContain('jp-style-ramen-tsukemen');
      const parent = catalog.find((entry) => entry.id === 'jp-style-ramen-tsukemen');
      expect(parent?.derivedStyleIds).toContain(dish.id);
    }
  });

  it('cites at least two public sources each', () => {
    for (const dish of contemporary) {
      expect(dish.publicSourceIds.length).toBeGreaterThanOrEqual(2);
      expect(dish.verificationLevel).toBe('reviewed');
      expect(dish.allergenNote.length).toBeGreaterThan(0);
    }
  });

  it('takes the published catalog to the expected size', () => {
    expect(catalog).toHaveLength(releaseTargets.counts.publicCatalog);
  });

  it('adds none of the styles the release deliberately left out', () => {
    const excluded = ['二郎', 'ちゃん系', '泡系', '淡麗系', '担々麺'];
    for (const name of excluded) {
      expect(contemporary.some((dish) => dish.name.includes(name))).toBe(false);
    }
  });
});
