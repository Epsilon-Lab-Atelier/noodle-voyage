import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { tasteKeys, type Dish } from '../src/types/catalog';

const catalog = JSON.parse(fs.readFileSync(path.resolve('public/data/catalog.json'), 'utf8')) as Dish[];
// Expected counts live in the release manifest, never in this file.
const manifest = JSON.parse(fs.readFileSync(path.resolve('public/data/manifest.json'), 'utf8')) as {
  expected: { publicCatalog: number; standardStyles: number; researchedRegionalAdditions: number; regionalExampleRelations: number };
};
const releaseTargets = JSON.parse(fs.readFileSync(path.resolve('data/master/release-targets.json'), 'utf8')) as {
  catalogTotals: { regionalByCategory: Record<string, number> };
};

describe('generated catalog', () => {
  it('contains the agreed number of records', () => {
    expect(catalog).toHaveLength(manifest.expected.publicCatalog);
    expect(catalog.filter((dish) => dish.domain === 'world')).toHaveLength(30);
    expect(catalog.filter((dish) => dish.domain === 'japan')).toHaveLength(manifest.expected.publicCatalog - 30);
  });

  it('has unique IDs and valid taste ranges', () => {
    expect(new Set(catalog.map((dish) => dish.id)).size).toBe(catalog.length);
    for (const dish of catalog) {
      for (const key of tasteKeys) {
        const range = dish.taste[key];
        expect(range.min).toBeLessThanOrEqual(range.typical);
        expect(range.typical).toBeLessThanOrEqual(range.max);
        expect(range.min).toBeGreaterThanOrEqual(0);
        expect(range.max).toBeLessThanOrEqual(5);
      }
    }
  });

  it('keeps world dishes out of the Japan domain', () => {
    const world = catalog.filter((dish) => dish.domain === 'world');
    expect(world.every((dish) => dish.country !== '日本')).toBe(true);
    expect(world.every((dish) => dish.prefectureCodes.length === 0)).toBe(true);
  });

  it('never publishes a taste confidence value', () => {
    for (const dish of catalog) {
      for (const key of tasteKeys) {
        expect(dish.taste[key]).not.toHaveProperty('confidence');
      }
    }
  });

  it('keeps every v2.1.2 dish ID published', () => {
    const legacyIds = JSON.parse(fs.readFileSync(path.resolve('data/master/legacy-dish-ids.json'), 'utf8')) as string[];
    expect(legacyIds).toHaveLength(215);
    const published = new Set(catalog.map((dish) => dish.id));
    for (const id of legacyIds) expect(published.has(id)).toBe(true);
  });

  it('keeps standard styles off the map', () => {
    for (const dish of catalog.filter((dish) => dish.culturalScope === 'standard')) {
      expect(dish.prefectureCodes).toHaveLength(0);
      expect(dish.coordinates).toBeNull();
    }
  });

  it('gives every regional Japanese dish a prefecture in code order', () => {
    for (const dish of catalog.filter((dish) => dish.domain === 'japan' && dish.culturalScope === 'regional')) {
      expect(dish.prefectureCodes.length).toBeGreaterThan(0);
      expect([...dish.prefectureCodes]).toEqual([...dish.prefectureCodes].sort());
    }
  });

  it('publishes no internal editorial source', () => {
    const sources = JSON.parse(fs.readFileSync(path.resolve('public/data/sources.json'), 'utf8')) as { kind: string }[];
    expect(sources.every((source) => source.kind !== 'editorial_pending')).toBe(true);
    expect(JSON.stringify(catalog)).not.toContain('editorial_pending');
  });
});

describe('v2.2.0 regional noodle additions', () => {
  it('publishes the researched dish counts', () => {
    const regional = catalog.filter((dish) => dish.culturalScope !== 'standard');
    expect(regional).toHaveLength(manifest.expected.publicCatalog - manifest.expected.standardStyles);
    for (const [category, expected] of Object.entries(releaseTargets.catalogTotals.regionalByCategory)) {
      expect(regional.filter((dish) => dish.noodleCategory === category)).toHaveLength(expected);
    }
  });

  it('covers every Japanese noodle category the release targets', () => {
    for (const category of ['ramen', 'udon', 'soba', 'yakisoba'] as const) {
      const regional = catalog.filter((dish) => dish.domain === 'japan' && dish.culturalScope === 'regional' && dish.noodleCategory === category);
      expect(regional.length).toBeGreaterThan(0);
    }
  });

  it('gives every added dish at least two public sources', () => {
    // v2.3.0 re-reviewed 19 of the v2.1.2 anchors, so the researched additions
    // are identified by not being in the v2.1.2 catalog.
    const legacyIds = new Set(JSON.parse(fs.readFileSync(path.resolve('data/master/legacy-dish-ids.json'), 'utf8')) as string[]);
    const added = catalog.filter((dish) => !legacyIds.has(dish.id) && dish.culturalScope === 'regional');
    expect(added).toHaveLength(manifest.expected.researchedRegionalAdditions);
    for (const dish of added) {
      expect(dish.publicSourceIds.length).toBeGreaterThanOrEqual(2);
      expect(dish.verificationLevel).toBe('reviewed');
    }
  });

  it('labels japan/regional/other as その他のご当地麺類', () => {
    const contextual = catalog.filter((dish) => dish.domain === 'japan' && dish.culturalScope === 'regional' && dish.noodleCategory === 'other');
    expect(contextual.length).toBeGreaterThan(0);
    for (const dish of contextual) expect(dish.categoryLabel).toBe('その他のご当地麺類');
  });

  it('states that taste values are editorial rather than measured', () => {
    const taxonomy = JSON.parse(fs.readFileSync(path.resolve('public/data/taxonomy.json'), 'utf8')) as { scoreMethods: Record<string, string> };
    const scored = catalog.filter((dish) => dish.scoreMethod);
    expect(scored.length).toBeGreaterThan(0);
    for (const dish of scored) {
      const label = taxonomy.scoreMethods[dish.scoreMethod];
      expect(label).toBeDefined();
      expect(label).toContain('測定値ではありません');
    }
  });

  it('carries allergen guidance on every dish researched since v2.2.0', () => {
    const legacyIds = new Set(JSON.parse(fs.readFileSync(path.resolve('data/master/legacy-dish-ids.json'), 'utf8')) as string[]);
    const researched = catalog.filter((dish) => !legacyIds.has(dish.id));
    expect(researched.length).toBeGreaterThan(0);
    for (const dish of researched) expect(dish.allergenNote.length).toBeGreaterThan(0);
  });

  it('never links a dish to a standard style that is not published', () => {
    const published = new Set(catalog.map((dish) => dish.id));
    for (const dish of catalog) {
      for (const parentId of dish.parentStyleIds) expect(published.has(parentId)).toBe(true);
    }
  });
});

describe('v2.2.0 standard styles', () => {
  const standardStyles = catalog.filter((dish) => dish.culturalScope === 'standard');
  const taxonomy = JSON.parse(fs.readFileSync(path.resolve('data/master/taxonomy.json'), 'utf8')) as {
    standardStyleDisplayOrder: string[];
  };

  it('publishes the twenty fixed style IDs', () => {
    expect(taxonomy.standardStyleDisplayOrder).toHaveLength(20);
    expect(standardStyles.map((dish) => dish.id).sort()).toEqual([...taxonomy.standardStyleDisplayOrder].sort());
  });

  it('splits them across the four Japanese noodle categories', () => {
    const counts = { ramen: 8, udon: 5, soba: 4, yakisoba: 3 } as const;
    for (const [category, expected] of Object.entries(counts)) {
      expect(standardStyles.filter((dish) => dish.noodleCategory === category)).toHaveLength(expected);
    }
  });

  it('gives them no geography and keeps them out of the map files', () => {
    const japanFile = JSON.parse(fs.readFileSync(path.resolve('public/data/japan-noodles.json'), 'utf8')) as Dish[];
    for (const dish of standardStyles) {
      expect(dish.prefectureCodes).toHaveLength(0);
      expect(dish.regionCodes).toHaveLength(0);
      expect(dish.city).toBeNull();
      expect(dish.coordinates).toBeNull();
      expect(japanFile.some((entry) => entry.id === dish.id)).toBe(true);
      expect(dish.categoryLabel.startsWith('定番')).toBe(true);
    }
  });

  it('writes standard-styles.json in the specified display order', () => {
    const file = JSON.parse(fs.readFileSync(path.resolve('public/data/standard-styles.json'), 'utf8')) as Dish[];
    expect(file.map((dish) => dish.id)).toEqual(taxonomy.standardStyleDisplayOrder);
  });

  it('resolves the nine parent styles the regional dishes depend on', () => {
    const required = [
      'jp-style-udon-kake', 'jp-style-udon-bukkake', 'jp-style-udon-kamaage', 'jp-style-udon-zaru',
      'jp-style-soba-kake', 'jp-style-soba-mori-zaru',
      'jp-style-yakisoba-sauce', 'jp-style-yakisoba-salt', 'jp-style-yakisoba-ankake'
    ];
    const referenced = new Set(catalog.flatMap((dish) => dish.parentStyleIds));
    const published = new Set(standardStyles.map((dish) => dish.id));
    for (const id of required) {
      expect(referenced.has(id)).toBe(true);
      expect(published.has(id)).toBe(true);
    }
  });

  it('leaves no unresolved relation in the published data', () => {
    const published = new Set(catalog.map((dish) => dish.id));
    const relations = JSON.parse(fs.readFileSync(path.resolve('public/data/relations.json'), 'utf8')) as Record<
      string,
      Record<string, string[]>
    >;
    const fields = ['parentStyleIds', 'regionalExampleIds', 'relatedStyleIds', 'relatedIds', 'bridgeIds'] as const;
    for (const dish of catalog) {
      for (const field of fields) {
        for (const id of dish[field]) expect(published.has(id)).toBe(true);
      }
    }
    for (const [dishId, entry] of Object.entries(relations)) {
      expect(published.has(dishId)).toBe(true);
      for (const field of fields) {
        for (const id of entry[field] ?? []) expect(published.has(id)).toBe(true);
      }
    }
  });

  it('points every regional example at a dish that has a place', () => {
    expect(standardStyles.reduce((sum, dish) => sum + dish.regionalExampleIds.length, 0))
      .toBe(manifest.expected.regionalExampleRelations);
    for (const dish of standardStyles) {
      for (const id of dish.regionalExampleIds) {
        const example = catalog.find((entry) => entry.id === id);
        expect(example?.culturalScope).not.toBe('standard');
      }
    }
    for (const dish of catalog.filter((entry) => entry.culturalScope !== 'standard')) {
      expect(dish.regionalExampleIds).toHaveLength(0);
    }
  });

  it('carries reviewed sourcing and allergen guidance', () => {
    for (const dish of standardStyles) {
      expect(dish.publicSourceIds.length).toBeGreaterThanOrEqual(2);
      expect(dish.verificationLevel).toBe('reviewed');
      expect(dish.allergenNote.length).toBeGreaterThan(0);
      expect(dish.scoreMethod).toBe('editorial_source_review_v1');
    }
  });
});
