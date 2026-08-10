import type { MealEntry, MenuRecord, PlaceRecord, WishEntry } from '../../types/records';

export interface PlaceSummary {
  menuCount: number;
  /** Wishes pointing at the place itself or at any of its menus. */
  wishCount: number;
  mealCount: number;
  /** The most recent meal at this place, or null when there is none yet. */
  lastEatenAt: string | null;
}

export interface RecordCollections {
  menus: MenuRecord[];
  wishes: WishEntry[];
  meals: MealEntry[];
}

export function summarizePlace(placeId: string, { menus, wishes, meals }: RecordCollections): PlaceSummary {
  const menuIds = new Set(menus.filter((menu) => menu.placeId === placeId).map((menu) => menu.id));
  const placeMeals = meals.filter((meal) => meal.placeId === placeId);
  return {
    menuCount: menuIds.size,
    wishCount: wishes.filter((wish) => (wish.targetType === 'place' && wish.targetId === placeId)
      || (wish.targetType === 'menu' && menuIds.has(wish.targetId))).length,
    mealCount: placeMeals.length,
    lastEatenAt: placeMeals.reduce<string | null>(
      (latest, meal) => (latest === null || meal.eatenAt > latest ? meal.eatenAt : latest),
      null
    )
  };
}

/** What the card shows under the name: the address, or an honest stand-in. */
export function placeLocationLabel(place: PlaceRecord): string {
  return place.addressText?.trim() || '地域は未登録';
}
