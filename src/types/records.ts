import type { NoodleCategory } from './catalog';

/**
 * Records the reader creates themselves. Every one of them stays on this
 * device: nothing here is uploaded, published or shared.
 *
 * The shapes follow data/additions/v2.3.0/private-place-menu-schema.json.
 */
export type RecordVisibility = 'private' | 'public_editorial';
export type PlaceStatus = 'unknown' | 'open' | 'temporarily_closed' | 'closed';
export type PlaceSourceType = 'user_manual' | 'external_link' | 'public_editorial';
export type MenuAvailability = 'unknown' | 'regular' | 'limited' | 'seasonal' | 'ended';
export type WishTargetType = 'concept' | 'place' | 'menu' | 'customConcept';

export const placeStatusLabels: Record<PlaceStatus, string> = {
  unknown: '不明',
  open: '営業中',
  temporarily_closed: '休業中',
  closed: '閉店'
};

export const menuAvailabilityLabels: Record<MenuAvailability, string> = {
  unknown: '不明',
  regular: '通常',
  limited: '限定',
  seasonal: '季節',
  ended: '提供終了'
};

export const wishTargetLabels: Record<WishTargetType, string> = {
  concept: '料理',
  place: 'お店',
  menu: 'メニュー',
  customConcept: '自分の料理'
};

export interface PlaceRecord {
  id: string;
  visibility: RecordVisibility;
  name: string;
  /** Lower-cased, whitespace-folded name used for duplicate detection. */
  nameNormalized: string;
  addressText: string | null;
  latitude: number | null;
  longitude: number | null;
  googleMapsUrl: string | null;
  googlePlaceId: string | null;
  tabelogUrl: string | null;
  officialUrl: string | null;
  status: PlaceStatus;
  sourceType: PlaceSourceType;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MenuRecord {
  id: string;
  placeId: string;
  visibility: RecordVisibility;
  name: string;
  nameNormalized: string;
  /** Catalog dish IDs this one bowl corresponds to. */
  conceptIds: string[];
  customConceptId: string | null;
  featureFilterIds: string[];
  priceText: string | null;
  availability: MenuAvailability;
  note: string | null;
  sourceLinks: string[];
  createdAt: string;
  updatedAt: string;
}

/** A dish the reader names themselves; never added to the public catalog. */
export interface CustomConcept {
  id: string;
  name: string;
  nameNormalized: string;
  noodleCategory: NoodleCategory;
  featureFilterIds: string[];
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Kept so a wish still reads sensibly after its target has been deleted. */
export interface WishSnapshot {
  title: string;
  subtitle: string;
}

export interface WishEntry {
  id: string;
  targetType: WishTargetType;
  targetId: string;
  snapshot: WishSnapshot;
  createdAt: string;
  updatedAt: string;
  priority: 'normal' | 'high';
  note: string;
}

export interface MealEntry {
  id: string;
  conceptIds: string[];
  placeId: string | null;
  menuId: string | null;
  customTitle: string | null;
  placeSnapshot: { name: string } | null;
  menuSnapshot: { name: string } | null;
  eatenAt: string;
  rating: number | null;
  note: string;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

/** The catalog dish a concept wish points at, or null for a place or menu. */
export const wishConceptId = (wish: WishEntry): string | null =>
  (wish.targetType === 'concept' ? wish.targetId : null);

export const isConceptWish = (wish: WishEntry, dishId: string): boolean =>
  wish.targetType === 'concept' && wish.targetId === dishId;

export const mealMatchesConcept = (meal: MealEntry, dishId: string): boolean =>
  meal.conceptIds.includes(dishId);
