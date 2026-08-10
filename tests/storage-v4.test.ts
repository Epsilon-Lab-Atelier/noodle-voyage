import { describe, expect, it } from 'vitest';
import { importBackup, initialPersisted, migrateToV4, pruneOrphans, storageKey, legacyStorageKeys } from '../src/state/migration';
import type { PersistedStateV4 } from '../src/state/migration';

const v3State = {
  storageSchemaVersion: 3,
  wishes: [
    { id: 'wish-keep-me', dishId: 'jp-001', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', priority: 'high', note: 'メモ' }
  ],
  meals: [
    { id: 'meal-keep-me', dishId: 'jp-002', eatenAt: '2026-02-01T00:00:00.000Z', rating: 4, note: '記録', isFavorite: true, createdAt: '2026-02-01T00:00:00.000Z', updatedAt: '2026-02-01T00:00:00.000Z' }
  ],
  legacyFavoriteDishIds: ['jp-003'],
  recent: ['jp-001'],
  compare: ['jp-001'],
  preferences: { scope: 'japan' },
  preferenceMeta: { mode: 'quick', updatedAt: '2026-01-01T00:00:00.000Z' },
  settings: { fontScale: 1.1, highContrast: false, reduceMotion: false },
  migratedAt: '2026-01-01T00:00:00.000Z'
};

const placeInput = {
  id: 'place-1',
  visibility: 'private',
  name: 'らーめん たろう',
  addressText: '東京都新宿区1-2-3',
  googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=%E3%82%89%E3%83%BC%E3%82%81%E3%82%93',
  googlePlaceId: 'ChIJexample',
  tabelogUrl: 'https://tabelog.com/tokyo/A1304/A130401/13000000/',
  officialUrl: 'https://example.com/shop',
  status: 'open',
  note: '行きたい',
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z'
};

describe('storage schema v4', () => {
  it('reads the v3 key before the older ones', () => {
    expect(storageKey).toBe('noodle-voyage-state-v4');
    expect(legacyStorageKeys[0]).toBe('noodle-voyage-state-v3');
  });

  it('turns a v3 wish into a concept wish without changing its ID', () => {
    const state = migrateToV4(v3State);
    expect(state.storageSchemaVersion).toBe(4);
    expect(state.wishes).toHaveLength(1);
    expect(state.wishes[0]).toMatchObject({ id: 'wish-keep-me', targetType: 'concept', targetId: 'jp-001', priority: 'high', note: 'メモ' });
  });

  it('gives a v3 meal one concept and no place or menu', () => {
    const state = migrateToV4(v3State);
    expect(state.meals[0]).toMatchObject({ id: 'meal-keep-me', conceptIds: ['jp-002'], placeId: null, menuId: null, isFavorite: true });
  });

  it('carries the rest of the v3 state across untouched', () => {
    const state = migrateToV4(v3State);
    expect(state.legacyFavoriteDishIds).toEqual(['jp-003']);
    expect(state.recent).toEqual(['jp-001']);
    expect(state.compare).toEqual(['jp-001']);
    expect(state.preferenceMeta.mode).toBe('quick');
    expect(state.settings.fontScale).toBeCloseTo(1.1);
  });

  it('starts empty for places, menus and custom concepts', () => {
    const state = migrateToV4(v3State);
    expect(state.places).toEqual([]);
    expect(state.menus).toEqual([]);
    expect(state.customConcepts).toEqual([]);
    expect(initialPersisted.places).toEqual([]);
  });

  it('is idempotent over its own output', () => {
    const once = migrateToV4(v3State);
    const twice = migrateToV4(once);
    expect(twice.wishes.map((wish) => wish.id)).toEqual(once.wishes.map((wish) => wish.id));
    expect(twice.meals.map((meal) => meal.id)).toEqual(once.meals.map((meal) => meal.id));
  });

  it('keeps a place with all of its optional links', () => {
    const state = migrateToV4({ ...v3State, storageSchemaVersion: 4, places: [placeInput] });
    expect(state.places).toHaveLength(1);
    expect(state.places[0]).toMatchObject({
      id: 'place-1',
      visibility: 'private',
      name: 'らーめん たろう',
      googlePlaceId: 'ChIJexample',
      status: 'open'
    });
    expect(state.places[0]?.nameNormalized).toBe('らーめん たろう');
  });

  it('drops a link that is not safe or not the expected service', () => {
    const state = migrateToV4({
      ...v3State,
      storageSchemaVersion: 4,
      places: [{
        ...placeInput,
        googleMapsUrl: 'javascript:alert(1)',
        tabelogUrl: 'https://example.com/not-tabelog',
        officialUrl: 'http://example.com/insecure'
      }]
    });
    expect(state.places[0]?.googleMapsUrl).toBeNull();
    expect(state.places[0]?.tabelogUrl).toBeNull();
    expect(state.places[0]?.officialUrl).toBeNull();
  });

  it('refuses a menu with no place and a place with no name', () => {
    const state = migrateToV4({
      ...v3State,
      storageSchemaVersion: 4,
      places: [{ ...placeInput, name: '   ' }],
      menus: [{ id: 'menu-1', name: '醤油', createdAt: '2026-03-01T00:00:00.000Z', updatedAt: '2026-03-01T00:00:00.000Z' }]
    });
    expect(state.places).toEqual([]);
    expect(state.menus).toEqual([]);
  });

  it('defaults every reader-created record to private', () => {
    const state = migrateToV4({
      ...v3State,
      storageSchemaVersion: 4,
      places: [{ ...placeInput, visibility: undefined }],
      menus: [{ id: 'menu-1', placeId: 'place-1', name: '醤油ラーメン', createdAt: '2026-03-01T00:00:00.000Z', updatedAt: '2026-03-01T00:00:00.000Z' }]
    });
    expect(state.places[0]?.visibility).toBe('private');
    expect(state.menus[0]?.visibility).toBe('private');
  });
});

describe('pruning after a delete', () => {
  const withRecords: PersistedStateV4 = {
    ...migrateToV4(v3State),
    places: [{
      id: 'place-1', visibility: 'private', name: '店', nameNormalized: '店', addressText: null,
      latitude: null, longitude: null, googleMapsUrl: null, googlePlaceId: null, tabelogUrl: null,
      officialUrl: null, status: 'unknown', sourceType: 'user_manual', note: null,
      createdAt: '2026-03-01T00:00:00.000Z', updatedAt: '2026-03-01T00:00:00.000Z'
    }],
    menus: [{
      id: 'menu-1', placeId: 'place-1', visibility: 'private', name: '醤油', nameNormalized: '醤油',
      conceptIds: ['jp-001'], customConceptId: null, featureFilterIds: [], priceText: null,
      availability: 'regular', note: null, sourceLinks: [],
      createdAt: '2026-03-01T00:00:00.000Z', updatedAt: '2026-03-01T00:00:00.000Z'
    }],
    wishes: [
      { id: 'wish-place', targetType: 'place', targetId: 'place-1', snapshot: { title: '店', subtitle: '' }, createdAt: '2026-03-01T00:00:00.000Z', updatedAt: '2026-03-01T00:00:00.000Z', priority: 'normal', note: '' }
    ],
    meals: [
      { id: 'meal-1', conceptIds: ['jp-001'], placeId: 'place-1', menuId: 'menu-1', customTitle: null, placeSnapshot: { name: '店' }, menuSnapshot: { name: '醤油' }, eatenAt: '2026-03-02T00:00:00.000Z', rating: 5, note: '', isFavorite: false, createdAt: '2026-03-02T00:00:00.000Z', updatedAt: '2026-03-02T00:00:00.000Z' }
    ]
  };

  it('removes the menus and wishes that pointed at a deleted place', () => {
    const pruned = pruneOrphans({ ...withRecords, places: [] });
    expect(pruned.menus).toEqual([]);
    expect(pruned.wishes).toEqual([]);
  });

  it('keeps the meal that already happened, with its snapshot', () => {
    const pruned = pruneOrphans({ ...withRecords, places: [] });
    expect(pruned.meals).toHaveLength(1);
    expect(pruned.meals[0]?.placeId).toBeNull();
    expect(pruned.meals[0]?.menuId).toBeNull();
    expect(pruned.meals[0]?.placeSnapshot?.name).toBe('店');
  });
});

describe('backup round trip', () => {
  it('restores a v4 backup exactly', () => {
    const state = migrateToV4({ ...v3State, storageSchemaVersion: 4, places: [placeInput] });
    const backup = { appVersion: '2.3.0', storageSchemaVersion: 4, exportedAt: '2026-08-10T00:00:00.000Z', data: state };
    const restored = importBackup(backup);
    expect(restored.places).toEqual(state.places);
    expect(restored.menus).toEqual(state.menus);
    expect(restored.customConcepts).toEqual(state.customConcepts);
    expect(restored.wishes).toEqual(state.wishes);
    expect(restored.meals).toEqual(state.meals);
  });

  it('still reads a v2 and a v3 backup', () => {
    const v2 = importBackup({ data: { wishlist: ['jp-010'], eaten: { 'jp-001': { rating: 4 } }, favorites: [] } });
    expect(v2.wishes).toHaveLength(1);
    expect(v2.meals).toHaveLength(1);

    const v3 = importBackup({ appVersion: '2.2.1', storageSchemaVersion: 3, data: v3State });
    expect(v3.wishes[0]?.id).toBe('wish-keep-me');
    expect(v3.meals[0]?.conceptIds).toEqual(['jp-002']);
  });
});
