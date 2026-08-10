import { del, get as idbGet, set as idbSet } from 'idb-keyval';
import { create } from 'zustand';
import { normalizeName } from '../features/places/duplicateCheck';
import type { PreferenceMeta, SearchScope, UserPreferences } from '../types/catalog';
import {
  isConceptWish,
  type CustomConcept,
  type MealEntry,
  type MenuRecord,
  type PlaceRecord,
  type WishEntry,
  type WishSnapshot,
  type WishTargetType
} from '../types/records';
import {
  createEntryId,
  defaultPreferences,
  importBackup,
  initialPersisted,
  legacyStorageKeys,
  migrateToV4,
  normalizePreferences,
  pruneOrphans,
  storageKey,
  type DisplaySettings,
  type PersistedStateV4
} from './migration';

export { defaultPreferences };
export type { PersistedStateV4 };

export interface MealDraft {
  eatenAt: string;
  rating: number | null;
  note: string;
  isFavorite: boolean;
}

/** What a meal was: any of a catalog dish, a saved place, and a saved menu. */
export interface MealTarget {
  conceptIds?: string[];
  placeId?: string | null;
  menuId?: string | null;
  customTitle?: string | null;
}

export type PlaceDraft = Omit<PlaceRecord, 'id' | 'nameNormalized' | 'createdAt' | 'updatedAt' | 'visibility'>
  & Partial<Pick<PlaceRecord, 'visibility'>>;
export type MenuDraft = Omit<MenuRecord, 'id' | 'nameNormalized' | 'createdAt' | 'updatedAt' | 'visibility'>
  & Partial<Pick<MenuRecord, 'visibility'>>;
export type CustomConceptDraft = Omit<CustomConcept, 'id' | 'nameNormalized' | 'createdAt' | 'updatedAt'>;

interface AppState extends PersistedStateV4 {
  hydrated: boolean;
  setPreferences: (preferences: UserPreferences, mode?: PreferenceMeta['mode']) => void;
  setScope: (scope: SearchScope) => void;

  addWish: (dishId: string) => void;
  removeWish: (dishId: string) => void;
  toggleWish: (dishId: string) => void;
  addTargetWish: (targetType: WishTargetType, targetId: string, snapshot: WishSnapshot) => void;
  removeWishEntry: (id: string) => void;
  updateWish: (id: string, patch: Partial<Pick<WishEntry, 'priority' | 'note'>>) => void;

  addMeal: (dishId: string, draft: MealDraft) => void;
  addTargetMeal: (target: MealTarget, draft: MealDraft) => void;
  updateMeal: (id: string, patch: Partial<MealDraft>) => void;
  removeMeal: (id: string) => void;
  toggleMealFavorite: (id: string) => void;

  addPlace: (draft: PlaceDraft) => string;
  updatePlace: (id: string, patch: Partial<PlaceDraft>) => void;
  removePlace: (id: string) => void;
  addMenu: (draft: MenuDraft) => string;
  updateMenu: (id: string, patch: Partial<MenuDraft>) => void;
  removeMenu: (id: string) => void;
  addCustomConcept: (draft: CustomConceptDraft) => string;
  removeCustomConcept: (id: string) => void;

  resolveLegacyFavorite: (dishId: string, action: 'wish' | 'discard') => void;
  addRecent: (dishId: string) => void;
  toggleCompare: (dishId: string) => void;
  clearCompare: () => void;
  setSettings: (settings: Partial<DisplaySettings>) => void;
  importState: (state: unknown) => void;
  resetAll: () => Promise<void>;
}

const snapshot = (state: AppState): PersistedStateV4 => ({
  storageSchemaVersion: 4,
  places: state.places,
  menus: state.menus,
  customConcepts: state.customConcepts,
  wishes: state.wishes,
  meals: state.meals,
  legacyFavoriteDishIds: state.legacyFavoriteDishIds,
  recent: state.recent,
  compare: state.compare,
  preferences: state.preferences,
  preferenceMeta: state.preferenceMeta,
  settings: state.settings,
  migratedAt: state.migratedAt
});

const now = () => new Date().toISOString();

const conceptWish = (dishId: string): WishEntry => {
  const timestamp = now();
  return {
    id: createEntryId('wish'),
    targetType: 'concept',
    targetId: dishId,
    snapshot: { title: '', subtitle: '' },
    createdAt: timestamp,
    updatedAt: timestamp,
    priority: 'normal',
    note: ''
  };
};

export const useAppStore = create<AppState>((set, get) => ({
  ...initialPersisted,
  hydrated: false,

  setPreferences: (preferences, mode = 'detailed') => set({
    preferences: normalizePreferences(preferences),
    preferenceMeta: { mode, updatedAt: now() }
  }),
  setScope: (scope) => set((state) => ({ preferences: { ...state.preferences, scope } })),

  addWish: (dishId) => set((state) => {
    if (state.wishes.some((wish) => isConceptWish(wish, dishId))) return {};
    return { wishes: [...state.wishes, conceptWish(dishId)] };
  }),
  removeWish: (dishId) => set((state) => ({
    wishes: state.wishes.filter((wish) => !isConceptWish(wish, dishId))
  })),
  toggleWish: (dishId) => set((state) => {
    if (state.wishes.some((wish) => isConceptWish(wish, dishId))) {
      return { wishes: state.wishes.filter((wish) => !isConceptWish(wish, dishId)) };
    }
    return { wishes: [...state.wishes, conceptWish(dishId)] };
  }),
  addTargetWish: (targetType, targetId, wishSnapshot) => set((state) => {
    if (state.wishes.some((wish) => wish.targetType === targetType && wish.targetId === targetId)) return {};
    const timestamp = now();
    return {
      wishes: [...state.wishes, {
        id: createEntryId('wish'),
        targetType,
        targetId,
        snapshot: wishSnapshot,
        createdAt: timestamp,
        updatedAt: timestamp,
        priority: 'normal',
        note: ''
      }]
    };
  }),
  removeWishEntry: (id) => set((state) => ({ wishes: state.wishes.filter((wish) => wish.id !== id) })),
  updateWish: (id, patch) => set((state) => ({
    wishes: state.wishes.map((wish) => (wish.id === id ? { ...wish, ...patch, updatedAt: now() } : wish))
  })),

  addMeal: (dishId, draft) => get().addTargetMeal({ conceptIds: [dishId] }, draft),
  addTargetMeal: (target, draft) => set((state) => {
    const timestamp = now();
    const place = target.placeId ? state.places.find((entry) => entry.id === target.placeId) : undefined;
    const menu = target.menuId ? state.menus.find((entry) => entry.id === target.menuId) : undefined;
    const entry: MealEntry = {
      id: createEntryId('meal'),
      conceptIds: target.conceptIds ?? [],
      placeId: target.placeId ?? null,
      menuId: target.menuId ?? null,
      customTitle: target.customTitle ?? null,
      // The name is copied so the record still reads clearly if the place is
      // later deleted or renamed.
      placeSnapshot: place ? { name: place.name } : null,
      menuSnapshot: menu ? { name: menu.name } : null,
      eatenAt: draft.eatenAt,
      rating: draft.rating,
      note: draft.note,
      isFavorite: draft.isFavorite,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    return { meals: [...state.meals, entry] };
  }),
  updateMeal: (id, patch) => set((state) => ({
    meals: state.meals.map((meal) => (meal.id === id ? { ...meal, ...patch, updatedAt: now() } : meal))
  })),
  removeMeal: (id) => set((state) => ({ meals: state.meals.filter((meal) => meal.id !== id) })),
  toggleMealFavorite: (id) => set((state) => ({
    meals: state.meals.map((meal) => (meal.id === id ? { ...meal, isFavorite: !meal.isFavorite, updatedAt: now() } : meal))
  })),

  addPlace: (draft) => {
    const timestamp = now();
    // Written field by field, in the order the migration normalizer uses, so
    // two backups of the same records come out byte for byte the same.
    const place: PlaceRecord = {
      id: createEntryId('place'),
      visibility: draft.visibility ?? 'private',
      name: draft.name,
      nameNormalized: normalizeName(draft.name),
      addressText: draft.addressText,
      latitude: draft.latitude,
      longitude: draft.longitude,
      googleMapsUrl: draft.googleMapsUrl,
      googlePlaceId: draft.googlePlaceId,
      tabelogUrl: draft.tabelogUrl,
      officialUrl: draft.officialUrl,
      status: draft.status,
      sourceType: draft.sourceType,
      note: draft.note,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    set((state) => ({ places: [...state.places, place] }));
    return place.id;
  },
  updatePlace: (id, patch) => set((state) => ({
    places: state.places.map((place) => (place.id === id
      ? {
        ...place,
        ...patch,
        nameNormalized: patch.name ? normalizeName(patch.name) : place.nameNormalized,
        updatedAt: now()
      }
      : place))
  })),
  removePlace: (id) => set((state) => pruneOrphans({
    ...snapshot(state as AppState),
    places: state.places.filter((place) => place.id !== id)
  })),

  addMenu: (draft) => {
    const timestamp = now();
    const menu: MenuRecord = {
      id: createEntryId('menu'),
      placeId: draft.placeId,
      visibility: draft.visibility ?? 'private',
      name: draft.name,
      nameNormalized: normalizeName(draft.name),
      conceptIds: draft.conceptIds,
      customConceptId: draft.customConceptId,
      featureFilterIds: draft.featureFilterIds,
      priceText: draft.priceText,
      availability: draft.availability,
      note: draft.note,
      sourceLinks: draft.sourceLinks,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    set((state) => ({ menus: [...state.menus, menu] }));
    return menu.id;
  },
  updateMenu: (id, patch) => set((state) => ({
    menus: state.menus.map((menu) => (menu.id === id
      ? {
        ...menu,
        ...patch,
        nameNormalized: patch.name ? normalizeName(patch.name) : menu.nameNormalized,
        updatedAt: now()
      }
      : menu))
  })),
  removeMenu: (id) => set((state) => pruneOrphans({
    ...snapshot(state as AppState),
    menus: state.menus.filter((menu) => menu.id !== id)
  })),

  addCustomConcept: (draft) => {
    const timestamp = now();
    const concept: CustomConcept = {
      id: createEntryId('concept'),
      name: draft.name,
      nameNormalized: normalizeName(draft.name),
      noodleCategory: draft.noodleCategory,
      featureFilterIds: draft.featureFilterIds,
      note: draft.note,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    set((state) => ({ customConcepts: [...state.customConcepts, concept] }));
    return concept.id;
  },
  removeCustomConcept: (id) => set((state) => pruneOrphans({
    ...snapshot(state as AppState),
    customConcepts: state.customConcepts.filter((concept) => concept.id !== id)
  })),

  resolveLegacyFavorite: (dishId, action) => set((state) => {
    const legacyFavoriteDishIds = state.legacyFavoriteDishIds.filter((id) => id !== dishId);
    if (action === 'discard' || state.wishes.some((wish) => isConceptWish(wish, dishId))) {
      return { legacyFavoriteDishIds };
    }
    return { legacyFavoriteDishIds, wishes: [...state.wishes, conceptWish(dishId)] };
  }),

  addRecent: (dishId) => set((state) => ({
    recent: [dishId, ...state.recent.filter((item) => item !== dishId)].slice(0, 20)
  })),
  toggleCompare: (dishId) => set((state) => {
    if (state.compare.includes(dishId)) return { compare: state.compare.filter((item) => item !== dishId) };
    if (state.compare.length >= 3) return { compare: [...state.compare.slice(1), dishId] };
    return { compare: [...state.compare, dishId] };
  }),
  clearCompare: () => set({ compare: [] }),
  setSettings: (settings) => set((state) => ({ settings: { ...state.settings, ...settings } })),
  importState: (incoming) => set((state) => importBackup(incoming, snapshot(state))),

  resetAll: async () => {
    try {
      await del(storageKey);
      await Promise.all(legacyStorageKeys.map((key) => del(key)));
    } catch { /* The in-memory reset still remains available. */ }
    set({ ...initialPersisted, hydrated: true });
  }
}));

let saveTimer: ReturnType<typeof setTimeout> | null = null;
useAppStore.subscribe((state) => {
  if (!state.hydrated) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { void idbSet(storageKey, snapshot(state)).catch(() => undefined); }, 120);
});

export async function hydrateAppStore(): Promise<void> {
  try {
    const current = await idbGet<unknown>(storageKey);
    if (current !== undefined) {
      useAppStore.setState({ ...migrateToV4(current), hydrated: true });
      return;
    }
    // Legacy keys are only read here. They stay in place until the v4 write
    // below succeeds, so a failed migration never loses the original records.
    for (const legacyKey of legacyStorageKeys) {
      const legacyState = await idbGet<unknown>(legacyKey);
      if (legacyState === undefined) continue;
      const migrated = migrateToV4(legacyState);
      await idbSet(storageKey, migrated);
      useAppStore.setState({ ...migrated, hydrated: true });
      return;
    }
    useAppStore.setState({ ...initialPersisted, hydrated: true });
  } catch {
    useAppStore.setState({ hydrated: true });
  }
}

export function exportAppState(): string {
  return JSON.stringify({
    appVersion: '2.3.0',
    storageSchemaVersion: 4,
    exportedAt: new Date().toISOString(),
    data: snapshot(useAppStore.getState())
  }, null, 2);
}

export const selectWishDishIds = (state: AppState) => state.wishes
  .filter((wish) => wish.targetType === 'concept')
  .map((wish) => wish.targetId);
export const selectFavoriteMeals = (state: AppState) => state.meals.filter((meal) => meal.isFavorite);
export const selectMealsByDish = (state: AppState, dishId: string) =>
  state.meals.filter((meal) => meal.conceptIds.includes(dishId));
export const selectMenusForPlace = (state: AppState, placeId: string) =>
  state.menus.filter((menu) => menu.placeId === placeId);
