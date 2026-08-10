import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Dish } from '../src/types/catalog';

const catalog = JSON.parse(fs.readFileSync(path.resolve('public/data/catalog.json'), 'utf8')) as Dish[];
const manifest = JSON.parse(fs.readFileSync(path.resolve('public/data/manifest.json'), 'utf8')) as {
  counts: { total: number; regionalExampleRelations: number };
  expected: { publicCatalog: number };
};

const toyohashi = catalog.find((dish) => dish.id === 'jp-udon-toyohashi-curry');
const curryStyle = catalog.find((dish) => dish.id === 'jp-style-udon-curry');

describe('豊橋カレーうどん', () => {
  it('exists as a regional dish under its own ID', () => {
    expect(toyohashi).toBeDefined();
    expect(toyohashi?.culturalScope).toBe('regional');
    expect(toyohashi?.noodleCategory).toBe('udon');
    expect(toyohashi?.name).toBe('豊橋カレーうどん');
  });

  it('stays separate from the standard curry udon', () => {
    expect(curryStyle).toBeDefined();
    expect(curryStyle?.culturalScope).toBe('standard');
    expect(curryStyle?.id).not.toBe(toyohashi?.id);
  });

  it('is filed under 愛知県 豊橋市 with coordinates', () => {
    expect(toyohashi?.prefectureCodes).toEqual(['23']);
    expect(toyohashi?.prefectureNames).toEqual(['愛知県']);
    expect(toyohashi?.regionCodes).toEqual(['chubu']);
    expect(toyohashi?.city).toBe('豊橋市');
    expect(toyohashi?.coordinates).not.toBeNull();
  });

  it('links to the standard style in both directions', () => {
    expect(toyohashi?.parentStyleIds).toContain('jp-style-udon-curry');
    expect(curryStyle?.regionalExampleIds).toContain('jp-udon-toyohashi-curry');
  });

  it('carries the researched sourcing, ingredients and allergen note', () => {
    expect(toyohashi?.publicSourceIds).toEqual(['src-toyohashi-curry-city', 'src-toyohashi-curry-jpo']);
    expect(toyohashi?.verificationLevel).toBe('reviewed');
    expect(toyohashi?.ingredients).toContain('とろろ');
    expect(toyohashi?.ingredients).toContain('豊橋産うずら卵');
    expect(toyohashi?.allergenNote).toContain('やまいも');
  });

  it('takes the published catalog to the expected size', () => {
    expect(catalog).toHaveLength(manifest.expected.publicCatalog);
    expect(manifest.counts.total).toBe(manifest.expected.publicCatalog);
  });
});
