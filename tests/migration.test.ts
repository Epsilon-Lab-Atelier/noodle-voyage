import { describe, expect, it } from 'vitest';
import { importBackup, migrateToV4 } from '../src/state/migration';

const legacyState = {
  favorites: ['jp-001', 'jp-002', 'jp-003'],
  wishlist: ['jp-010', 'jp-011'],
  eaten: {
    'jp-001': { eatenAt: '2026-01-05T00:00:00.000Z', rating: 5, note: '濃厚でおいしい' },
    'jp-002': { eatenAt: '2026-02-10T00:00:00.000Z', rating: 4, note: '' }
  },
  recent: ['jp-001'],
  compare: ['jp-001', 'jp-002'],
  preferences: { scope: 'japan', adventure: 60 },
  settings: { fontScale: 1.1, highContrast: true, reduceMotion: false }
};

describe('v2.1.2 / v2.2.x からの保存データ移行', () => {
  it('wishlist を WishEntry へ移行する', () => {
    const state = migrateToV4(legacyState);
    expect(state.wishes).toHaveLength(2);
    expect(state.wishes.map((wish) => wish.targetId)).toEqual(['jp-010', 'jp-011']);
    expect(state.wishes.every((wish) => wish.targetType === 'concept')).toBe(true);
    expect(state.wishes[0]?.priority).toBe('normal');
    expect(state.wishes[0]?.note).toBe('');
  });

  it('eaten を MealEntry へ移行する', () => {
    const state = migrateToV4(legacyState);
    expect(state.meals).toHaveLength(2);
    const first = state.meals.find((meal) => meal.conceptIds.includes('jp-001'));
    expect(first?.eatenAt).toBe('2026-01-05T00:00:00.000Z');
    expect(first?.rating).toBe(5);
    expect(first?.note).toBe('濃厚でおいしい');
  });

  it('食べた記録がある旧お気に入りは MealEntry のお気に入りになる', () => {
    const state = migrateToV4(legacyState);
    const favorites = state.meals.filter((meal) => meal.isFavorite).flatMap((meal) => meal.conceptIds);
    expect(favorites.sort()).toEqual(['jp-001', 'jp-002']);
  });

  it('食べた記録がない旧お気に入りは legacyFavoriteDishIds へ残る', () => {
    const state = migrateToV4(legacyState);
    expect(state.legacyFavoriteDishIds).toEqual(['jp-003']);
    expect(state.wishes.some((wish) => wish.targetId === 'jp-003')).toBe(false);
  });

  it('移行を複数回実行しても重複しない', () => {
    const once = migrateToV4(legacyState);
    const twice = migrateToV4(legacyState);
    expect(twice.wishes.map((wish) => wish.id)).toEqual(once.wishes.map((wish) => wish.id));
    expect(twice.meals.map((meal) => meal.id)).toEqual(once.meals.map((meal) => meal.id));

    const reapplied = migrateToV4(once);
    expect(reapplied.wishes).toHaveLength(once.wishes.length);
    expect(reapplied.meals).toHaveLength(once.meals.length);
    expect(reapplied.meals.map((meal) => meal.id)).toEqual(once.meals.map((meal) => meal.id));
  });

  it('旧IDを維持する', () => {
    const state = migrateToV4(legacyState);
    expect(state.meals.flatMap((meal) => meal.conceptIds).sort()).toEqual(['jp-001', 'jp-002']);
    expect(state.recent).toEqual(['jp-001']);
    expect(state.compare).toEqual(['jp-001', 'jp-002']);
  });

  it('有効な旧設定を legacy 診断状態として扱う', () => {
    expect(migrateToV4(legacyState).preferenceMeta.mode).toBe('legacy');
    expect(migrateToV4({ wishlist: [] }).preferenceMeta.mode).toBe('unset');
  });

  it('同じ料理を複数回ごちそうさまへ記録できる', () => {
    const state = migrateToV4({
      storageSchemaVersion: 3,
      meals: [
        { id: 'meal-1', dishId: 'jp-001', eatenAt: '2026-01-01T00:00:00.000Z', rating: 4, note: '1杯目', isFavorite: false },
        { id: 'meal-2', dishId: 'jp-001', eatenAt: '2026-03-01T00:00:00.000Z', rating: 5, note: '2杯目', isFavorite: true }
      ]
    });
    expect(state.meals.filter((meal) => meal.conceptIds.includes('jp-001'))).toHaveLength(2);
  });

  it('お気に入りは MealEntry の部分集合である', () => {
    const state = migrateToV4(legacyState);
    const favorites = state.meals.filter((meal) => meal.isFavorite);
    for (const favorite of favorites) {
      expect(state.meals).toContain(favorite);
    }
    expect(favorites.length).toBeLessThanOrEqual(state.meals.length);
  });

  it('壊れた入力でも既定値へ落ちる', () => {
    const state = migrateToV4(null);
    expect(state.storageSchemaVersion).toBe(4);
    expect(state.wishes).toEqual([]);
    expect(state.meals).toEqual([]);
    expect(state.preferenceMeta.mode).toBe('unset');
  });

  it('プロトタイプ汚染を試みるキーを取り込まない', () => {
    const state = migrateToV4({ eaten: { __proto__: { eatenAt: '2026-01-01T00:00:00.000Z' }, 'jp-001': { rating: 3 } } });
    expect(state.meals.every((meal) => !meal.conceptIds.includes('__proto__'))).toBe(true);
  });
});

describe('バックアップの読み込み', () => {
  it('v2.1.2 形式のバックアップを読み込める', () => {
    const backup = { schemaVersion: '2.1.2', exportedAt: '2026-05-01T00:00:00.000Z', data: legacyState };
    const state = importBackup(backup);
    expect(state.wishes).toHaveLength(2);
    expect(state.meals).toHaveLength(2);
  });

  it('v2.2.0 形式のバックアップを読み込める', () => {
    const state = migrateToV4(legacyState);
    const backup = { appVersion: '2.2.0', storageSchemaVersion: 3, exportedAt: '2026-08-09T00:00:00.000Z', data: state };
    const restored = importBackup(backup);
    expect(restored.wishes.map((wish) => wish.targetId)).toEqual(state.wishes.map((wish) => wish.targetId));
    expect(restored.meals.map((meal) => meal.id)).toEqual(state.meals.map((meal) => meal.id));
    expect(restored.legacyFavoriteDishIds).toEqual(state.legacyFavoriteDishIds);
  });

  it('data を持たない裸の状態も受け付ける', () => {
    const state = importBackup(legacyState);
    expect(state.meals).toHaveLength(2);
  });
});
