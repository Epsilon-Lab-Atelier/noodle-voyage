import { normalizeName } from '../features/places/duplicateCheck';
import { checkUrl } from '../features/places/urlSafety';
import {
  tasteKeys,
  type NoodleCategory,
  type PreferenceMeta,
  type ProfileMode,
  type SearchScope,
  type TasteKey,
  type UserPreferences
} from '../types/catalog';
import type {
  CustomConcept,
  MealEntry,
  MenuAvailability,
  MenuRecord,
  PlaceRecord,
  PlaceSourceType,
  PlaceStatus,
  RecordVisibility,
  WishEntry,
  WishTargetType
} from '../types/records';

export const storageKey = 'noodle-voyage-state-v4';
export const legacyStorageKeys = ['noodle-voyage-state-v3', 'noodle-voyage-state-v2', 'men-compass-state-v2'];

export interface DisplaySettings {
  fontScale: number;
  highContrast: boolean;
  reduceMotion: boolean;
}

export interface PersistedStateV4 {
  storageSchemaVersion: 4;
  places: PlaceRecord[];
  menus: MenuRecord[];
  customConcepts: CustomConcept[];
  wishes: WishEntry[];
  meals: MealEntry[];
  legacyFavoriteDishIds: string[];
  recent: string[];
  compare: string[];
  preferences: UserPreferences;
  preferenceMeta: PreferenceMeta;
  settings: DisplaySettings;
  migratedAt: string | null;
}

export const defaultPreferences: UserPreferences = {
  scope: 'japan',
  values: Object.fromEntries(tasteKeys.map((key) => [
    key,
    key === 'umami' ? 3.5 : key === 'sourness' || key === 'heat' ? 1.0 : 2.5
  ])) as Record<TasteKey, number>,
  weights: Object.fromEntries(tasteKeys.map((key) => [
    key,
    ['richness', 'oiliness', 'heat', 'seafoodIntensity', 'animalIntensity'].includes(key) ? 1.3 : 0.8
  ])) as Record<TasteKey, number>,
  noodle: { thickness: 2.5, firmness: 3.0, elasticity: 3.0, chewiness: 3.0, smoothness: 3.0, weight: 1.0 },
  adventure: 45,
  softAvoid: [],
  hardAvoid: []
};

export const initialPersisted: PersistedStateV4 = {
  storageSchemaVersion: 4,
  places: [],
  menus: [],
  customConcepts: [],
  wishes: [],
  meals: [],
  legacyFavoriteDishIds: [],
  recent: [],
  compare: [],
  preferences: defaultPreferences,
  preferenceMeta: { mode: 'unset', updatedAt: null },
  settings: { fontScale: 1, highContrast: false, reduceMotion: false },
  migratedAt: null
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const finiteNumber = (value: unknown, fallback: number, min: number, max: number) => {
  const number = typeof value === 'number' ? value : Number.NaN;
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

const stringArray = (value: unknown, maximum = 500) => (Array.isArray(value)
  ? [...new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0))].slice(0, maximum)
  : []);

const isoDate = (value: unknown, fallback: string) =>
  (typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : fallback);

const text = (value: unknown, maximum = 10_000) => (typeof value === 'string' ? value.slice(0, maximum) : '');

// Entry IDs are derived from the dish and a counter so that running the
// migration twice over the same legacy state produces the same IDs and never
// duplicates an entry.
const legacyEntryId = (prefix: string, dishId: string, index: number) => `${prefix}-legacy-${dishId}-${index}`;

let entryCounter = 0;
export function createEntryId(prefix: string): string {
  entryCounter += 1;
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${entryCounter.toString(36)}-${random}`;
}

export function normalizePreferences(value: unknown, fallback = defaultPreferences): UserPreferences {
  const input = isRecord(value) ? value : {};
  const inputValues = isRecord(input.values) ? input.values : {};
  const inputWeights = isRecord(input.weights) ? input.weights : {};
  const inputNoodle = isRecord(input.noodle) ? input.noodle : {};
  const scope: SearchScope = input.scope === 'world' || input.scope === 'all' || input.scope === 'japan'
    ? input.scope
    : fallback.scope;
  return {
    scope,
    values: Object.fromEntries(tasteKeys.map((key) => [key, finiteNumber(inputValues[key], fallback.values[key], 0, 5)])) as Record<TasteKey, number>,
    weights: Object.fromEntries(tasteKeys.map((key) => [key, finiteNumber(inputWeights[key], fallback.weights[key], 0, 2)])) as Record<TasteKey, number>,
    noodle: {
      thickness: finiteNumber(inputNoodle.thickness, fallback.noodle.thickness, 0, 5),
      firmness: finiteNumber(inputNoodle.firmness, fallback.noodle.firmness, 0, 5),
      elasticity: finiteNumber(inputNoodle.elasticity, fallback.noodle.elasticity, 0, 5),
      chewiness: finiteNumber(inputNoodle.chewiness, fallback.noodle.chewiness, 0, 5),
      smoothness: finiteNumber(inputNoodle.smoothness, fallback.noodle.smoothness, 0, 5),
      weight: finiteNumber(inputNoodle.weight, fallback.noodle.weight, 0, 2)
    },
    adventure: finiteNumber(input.adventure, fallback.adventure, 0, 100),
    softAvoid: stringArray(input.softAvoid, 100),
    hardAvoid: stringArray(input.hardAvoid, 100)
  };
}

const enumValue = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  (allowed.includes(value as T) ? (value as T) : fallback);

const nullableText = (value: unknown, maximum: number): string | null => {
  const trimmed = typeof value === 'string' ? value.slice(0, maximum) : '';
  return trimmed ? trimmed : null;
};

const nullableUrl = (value: unknown, kind: Parameters<typeof checkUrl>[1]): string | null => {
  if (typeof value !== 'string' || !value) return null;
  const checked = checkUrl(value, kind);
  return checked.ok ? checked.value : null;
};

const nullableCoordinate = (value: unknown, limit: number): number | null => {
  const number = typeof value === 'number' ? value : Number.NaN;
  return Number.isFinite(number) && Math.abs(number) <= limit ? number : null;
};

const visibility = (value: unknown): RecordVisibility =>
  enumValue(value, ['private', 'public_editorial'] as const, 'private');

function normalizePlace(value: unknown, fallbackDate: string): PlaceRecord | null {
  if (!isRecord(value)) return null;
  const name = text(value.name, 120).trim();
  if (!name) return null;
  const createdAt = isoDate(value.createdAt, fallbackDate);
  return {
    id: typeof value.id === 'string' && value.id ? value.id : createEntryId('place'),
    visibility: visibility(value.visibility),
    name,
    nameNormalized: normalizeName(name),
    addressText: nullableText(value.addressText, 300),
    latitude: nullableCoordinate(value.latitude, 90),
    longitude: nullableCoordinate(value.longitude, 180),
    googleMapsUrl: nullableUrl(value.googleMapsUrl, 'googleMaps'),
    googlePlaceId: nullableText(value.googlePlaceId, 256),
    tabelogUrl: nullableUrl(value.tabelogUrl, 'tabelog'),
    officialUrl: nullableUrl(value.officialUrl, 'official'),
    status: enumValue(value.status, ['unknown', 'open', 'temporarily_closed', 'closed'] as const, 'unknown') as PlaceStatus,
    sourceType: enumValue(value.sourceType, ['user_manual', 'external_link', 'public_editorial'] as const, 'user_manual') as PlaceSourceType,
    note: nullableText(value.note, 2000),
    createdAt,
    updatedAt: isoDate(value.updatedAt, createdAt)
  };
}

function normalizeMenu(value: unknown, fallbackDate: string): MenuRecord | null {
  if (!isRecord(value)) return null;
  const name = text(value.name, 160).trim();
  const placeId = typeof value.placeId === 'string' ? value.placeId : '';
  if (!name || !placeId) return null;
  const createdAt = isoDate(value.createdAt, fallbackDate);
  return {
    id: typeof value.id === 'string' && value.id ? value.id : createEntryId('menu'),
    placeId,
    visibility: visibility(value.visibility),
    name,
    nameNormalized: normalizeName(name),
    conceptIds: stringArray(value.conceptIds, 5),
    customConceptId: nullableText(value.customConceptId, 120),
    featureFilterIds: stringArray(value.featureFilterIds, 20),
    priceText: nullableText(value.priceText, 50),
    availability: enumValue(value.availability, ['unknown', 'regular', 'limited', 'seasonal', 'ended'] as const, 'unknown') as MenuAvailability,
    note: nullableText(value.note, 3000),
    sourceLinks: stringArray(value.sourceLinks, 5)
      .map((link) => nullableUrl(link, 'any'))
      .filter((link): link is string => link !== null),
    createdAt,
    updatedAt: isoDate(value.updatedAt, createdAt)
  };
}

function normalizeCustomConcept(value: unknown, fallbackDate: string): CustomConcept | null {
  if (!isRecord(value)) return null;
  const name = text(value.name, 120).trim();
  if (!name) return null;
  const createdAt = isoDate(value.createdAt, fallbackDate);
  return {
    id: typeof value.id === 'string' && value.id ? value.id : createEntryId('concept'),
    name,
    nameNormalized: normalizeName(name),
    noodleCategory: enumValue(
      value.noodleCategory,
      ['ramen', 'udon', 'soba', 'yakisoba', 'world_noodle', 'other'] as const,
      'other'
    ) as NoodleCategory,
    featureFilterIds: stringArray(value.featureFilterIds, 20),
    note: nullableText(value.note, 2000),
    createdAt,
    updatedAt: isoDate(value.updatedAt, createdAt)
  };
}

function normalizeWish(value: unknown, fallbackDate: string): WishEntry | null {
  if (!isRecord(value)) return null;
  // A v3 wish pointed at a dish and nothing else; it becomes a concept wish
  // with the same id, so a saved list survives the upgrade untouched.
  const legacyDishId = typeof value.dishId === 'string' ? value.dishId : '';
  const targetType = enumValue(value.targetType, ['concept', 'place', 'menu', 'customConcept'] as const, 'concept') as WishTargetType;
  const targetId = typeof value.targetId === 'string' && value.targetId ? value.targetId : legacyDishId;
  if (!targetId) return null;
  const createdAt = isoDate(value.createdAt, fallbackDate);
  const snapshot = isRecord(value.snapshot) ? value.snapshot : {};
  return {
    id: typeof value.id === 'string' && value.id ? value.id : createEntryId('wish'),
    targetType,
    targetId,
    snapshot: { title: text(snapshot.title, 160), subtitle: text(snapshot.subtitle, 160) },
    createdAt,
    updatedAt: isoDate(value.updatedAt, createdAt),
    priority: value.priority === 'high' ? 'high' : 'normal',
    note: text(value.note)
  };
}

function normalizeMeal(value: unknown, fallbackDate: string): MealEntry | null {
  if (!isRecord(value)) return null;
  // A v3 meal named one dish; it becomes a meal with that one concept and no
  // place or menu attached, keeping its id.
  const legacyDishId = typeof value.dishId === 'string' ? value.dishId : '';
  const conceptIds = stringArray(value.conceptIds, 5);
  if (!conceptIds.length && legacyDishId) conceptIds.push(legacyDishId);
  const customTitle = nullableText(value.customTitle, 160);
  const placeId = nullableText(value.placeId, 120);
  if (!conceptIds.length && !customTitle && !placeId) return null;
  const eatenAt = isoDate(value.eatenAt, fallbackDate);
  const createdAt = isoDate(value.createdAt, eatenAt);
  const rating = value.rating === null || value.rating === undefined
    ? null
    : Math.round(finiteNumber(value.rating, 3, 1, 5));
  const placeSnapshot = isRecord(value.placeSnapshot) ? { name: text(value.placeSnapshot.name, 120) } : null;
  const menuSnapshot = isRecord(value.menuSnapshot) ? { name: text(value.menuSnapshot.name, 160) } : null;
  return {
    id: typeof value.id === 'string' && value.id ? value.id : createEntryId('meal'),
    conceptIds,
    placeId,
    menuId: nullableText(value.menuId, 120),
    customTitle,
    placeSnapshot,
    menuSnapshot,
    eatenAt,
    rating,
    note: text(value.note),
    isFavorite: value.isFavorite === true,
    createdAt,
    updatedAt: isoDate(value.updatedAt, createdAt)
  };
}

function normalizeSettings(value: unknown, fallback: DisplaySettings): DisplaySettings {
  const settings = isRecord(value) ? value : {};
  return {
    fontScale: finiteNumber(settings.fontScale, fallback.fontScale, 0.9, 1.25),
    highContrast: typeof settings.highContrast === 'boolean' ? settings.highContrast : fallback.highContrast,
    reduceMotion: typeof settings.reduceMotion === 'boolean' ? settings.reduceMotion : fallback.reduceMotion
  };
}

function normalizePreferenceMeta(value: unknown, hasLegacyPreferences: boolean): PreferenceMeta {
  const input = isRecord(value) ? value : {};
  const modes: ProfileMode[] = ['unset', 'quick', 'detailed', 'legacy'];
  const mode = modes.includes(input.mode as ProfileMode) ? (input.mode as ProfileMode) : undefined;
  if (mode) {
    return { mode, updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : null };
  }
  // A v2 state that carried preferences was a completed diagnosis under the old
  // model, so it keeps a personalised match score as 'legacy'.
  return { mode: hasLegacyPreferences ? 'legacy' : 'unset', updatedAt: null };
}

/**
 * Converts any stored shape (v2.0.0 through v2.3.0) into PersistedStateV4.
 * Running it repeatedly over the same input is idempotent: legacy wish and meal
 * entries get deterministic IDs, so a second pass replaces rather than appends.
 * A v3 state keeps every entry ID it already had.
 */
export function migrateToV4(value: unknown, fallback: PersistedStateV4 = initialPersisted): PersistedStateV4 {
  const input = isRecord(value) ? value : {};
  const now = new Date().toISOString();

  if (input.storageSchemaVersion === 3 || input.storageSchemaVersion === 4) {
    const wishes = (Array.isArray(input.wishes) ? input.wishes : [])
      .map((entry) => normalizeWish(entry, now))
      .filter((entry): entry is WishEntry => entry !== null)
      .slice(0, 2000);
    const meals = (Array.isArray(input.meals) ? input.meals : [])
      .map((entry) => normalizeMeal(entry, now))
      .filter((entry): entry is MealEntry => entry !== null)
      .slice(0, 5000);
    return {
      storageSchemaVersion: 4,
      places: (Array.isArray(input.places) ? input.places : [])
        .map((entry) => normalizePlace(entry, now))
        .filter((entry): entry is PlaceRecord => entry !== null)
        .slice(0, 2000),
      menus: (Array.isArray(input.menus) ? input.menus : [])
        .map((entry) => normalizeMenu(entry, now))
        .filter((entry): entry is MenuRecord => entry !== null)
        .slice(0, 5000),
      customConcepts: (Array.isArray(input.customConcepts) ? input.customConcepts : [])
        .map((entry) => normalizeCustomConcept(entry, now))
        .filter((entry): entry is CustomConcept => entry !== null)
        .slice(0, 1000),
      wishes,
      meals,
      legacyFavoriteDishIds: stringArray(input.legacyFavoriteDishIds),
      recent: stringArray(input.recent, 20),
      compare: stringArray(input.compare, 3),
      preferences: normalizePreferences(input.preferences, fallback.preferences),
      preferenceMeta: normalizePreferenceMeta(input.preferenceMeta, false),
      settings: normalizeSettings(input.settings, fallback.settings),
      migratedAt: typeof input.migratedAt === 'string' ? input.migratedAt : fallback.migratedAt
    };
  }

  // Legacy v2 shape: wishlist[], eaten{dishId: record}, favorites[].
  const legacyWishlist = stringArray(input.wishlist);
  const legacyFavorites = stringArray(input.favorites);
  const legacyEaten = isRecord(input.eaten) ? input.eaten : {};

  const wishes: WishEntry[] = legacyWishlist.map((dishId, index) => ({
    id: legacyEntryId('wish', dishId, index),
    targetType: 'concept',
    targetId: dishId,
    snapshot: { title: '', subtitle: '' },
    createdAt: now,
    updatedAt: now,
    priority: 'normal',
    note: ''
  }));

  const favoriteSet = new Set(legacyFavorites);
  const meals: MealEntry[] = [];
  const migratedDishIds = new Set<string>();
  let mealIndex = 0;
  for (const [dishId, record] of Object.entries(legacyEaten).slice(0, 1000)) {
    if (!dishId || ['__proto__', 'prototype', 'constructor'].includes(dishId) || !isRecord(record)) continue;
    const eatenAt = isoDate(record.eatenAt, now);
    meals.push({
      id: legacyEntryId('meal', dishId, mealIndex),
      conceptIds: [dishId],
      placeId: null,
      menuId: null,
      customTitle: null,
      placeSnapshot: null,
      menuSnapshot: null,
      eatenAt,
      rating: record.rating === null || record.rating === undefined ? null : Math.round(finiteNumber(record.rating, 3, 1, 5)),
      note: text(record.note),
      isFavorite: favoriteSet.has(dishId),
      createdAt: eatenAt,
      updatedAt: eatenAt
    });
    migratedDishIds.add(dishId);
    mealIndex += 1;
  }

  // A favourite without a meal record is not silently turned into anything else;
  // the user decides what to do with it on the records screen.
  const legacyFavoriteDishIds = legacyFavorites.filter((dishId) => !migratedDishIds.has(dishId));

  const hasLegacyPreferences = isRecord(input.preferences);
  return {
    storageSchemaVersion: 4,
    places: [],
    menus: [],
    customConcepts: [],
    wishes,
    meals,
    legacyFavoriteDishIds,
    recent: stringArray(input.recent, 20),
    compare: stringArray(input.compare, 3),
    preferences: normalizePreferences(input.preferences, fallback.preferences),
    preferenceMeta: normalizePreferenceMeta(input.preferenceMeta, hasLegacyPreferences),
    settings: normalizeSettings(input.settings, fallback.settings),
    migratedAt: now
  };
}

/** Accepts a backup envelope from v2.0.0 onwards and returns the v4 state. */
export function importBackup(value: unknown, fallback: PersistedStateV4 = initialPersisted): PersistedStateV4 {
  const input = isRecord(value) ? value : {};
  const payload = isRecord(input.data) ? input.data : input;
  return migrateToV4(payload, fallback);
}

/**
 * A menu belongs to a place and a wish points at something; dropping a place
 * must not leave either dangling. Called after any delete.
 */
export function pruneOrphans(state: PersistedStateV4): PersistedStateV4 {
  const placeIds = new Set(state.places.map((place) => place.id));
  const menus = state.menus.filter((menu) => placeIds.has(menu.placeId));
  const menuIds = new Set(menus.map((menu) => menu.id));
  const conceptIds = new Set(state.customConcepts.map((concept) => concept.id));
  const stillExists = (wish: WishEntry) => {
    if (wish.targetType === 'place') return placeIds.has(wish.targetId);
    if (wish.targetType === 'menu') return menuIds.has(wish.targetId);
    if (wish.targetType === 'customConcept') return conceptIds.has(wish.targetId);
    return true;
  };
  return {
    ...state,
    menus,
    wishes: state.wishes.filter(stillExists),
    // A meal already happened, so it keeps its snapshot and simply forgets the
    // link rather than disappearing with the place.
    meals: state.meals.map((meal) => ({
      ...meal,
      placeId: meal.placeId && placeIds.has(meal.placeId) ? meal.placeId : null,
      menuId: meal.menuId && menuIds.has(meal.menuId) ? meal.menuId : null
    }))
  };
}
