import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getDailyDish, recommendDishes, scoreDish } from '../src/recommendation/engine';
import { defaultPreferences } from '../src/state/store';
import type { Dish, UserPreferences } from '../src/types/catalog';

const catalog = JSON.parse(fs.readFileSync(path.resolve('public/data/catalog.json'), 'utf8')) as Dish[];
const clone = (): UserPreferences => structuredClone(defaultPreferences);

describe('recommendation engine', () => {
  it('returns scores in the expected range', () => {
    const results = recommendDishes(catalog, clone(), 8);
    expect(results).toHaveLength(8);
    expect(results.every((result) => result.score >= 0 && result.score <= 100)).toBe(true);
    expect(results.every((result) => result.reasons.length > 0)).toBe(true);
  });

  it('respects the selected collection scope', () => {
    const preferences = clone();
    preferences.scope = 'world';
    const results = recommendDishes(catalog, preferences, 12);
    expect(results.every((result) => result.dish.domain === 'world')).toBe(true);
  });

  it('removes hard-avoid matches', () => {
    const preferences = clone();
    preferences.scope = 'all';
    preferences.hardAvoid = ['豚骨'];
    const results = recommendDishes(catalog, preferences, 30);
    expect(results.every((result) => !`${result.dish.searchText} ${result.dish.tags.join(' ')}`.includes('豚骨'))).toBe(true);
  });

  it('keeps a daily selection deterministic for the same date', () => {
    const preferences = clone();
    const first = getDailyDish(catalog, preferences, new Date(2026, 7, 4, 1, 0, 0));
    const second = getDailyDish(catalog, preferences, new Date(2026, 7, 4, 23, 0, 0));
    expect(first?.dish.id).toBe(second?.dish.id);
  });

  it('can score a single dish with all-scope preferences', () => {
    const preferences = clone();
    preferences.scope = 'all';
    const firstDish = catalog[0];
    expect(firstDish).toBeDefined();
    if (!firstDish) throw new Error('Catalog is empty');
    const result = scoreDish(firstDish, preferences);
    expect(result).not.toBeNull();
    expect(result?.dish.id).toBe(firstDish.id);
  });
});
