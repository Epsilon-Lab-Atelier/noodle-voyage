import { beforeEach, describe, expect, it } from 'vitest';
import { placeLocationLabel, summarizePlace } from '../src/features/places/placeSummary';
import { exportAppState, useAppStore } from '../src/state/store';
import type { PlaceRecord } from '../src/types/records';

const initial = useAppStore.getState();

const addShop = (name: string) => useAppStore.getState().addPlace({
  name,
  addressText: '東京都新宿区',
  latitude: null,
  longitude: null,
  googleMapsUrl: null,
  googlePlaceId: null,
  tabelogUrl: null,
  officialUrl: null,
  status: 'unknown',
  sourceType: 'user_manual',
  note: null
});

const addBowl = (placeId: string, name: string, conceptIds: string[] = []) =>
  useAppStore.getState().addMenu({
    placeId,
    name,
    conceptIds,
    customConceptId: null,
    featureFilterIds: [],
    priceText: null,
    availability: 'regular',
    note: null,
    sourceLinks: []
  });

beforeEach(() => {
  useAppStore.setState({ ...initial, places: [], menus: [], customConcepts: [], wishes: [], meals: [] });
});

describe('saving a place and its menus', () => {
  it('saves a shop from a name alone and marks it private', () => {
    const id = addShop('駅前の一杯');
    const place = useAppStore.getState().places.find((entry) => entry.id === id);
    expect(place?.visibility).toBe('private');
    expect(place?.nameNormalized).toBe('駅前の一杯');
  });

  it('records the same menu twice as two separate meals', () => {
    const placeId = addShop('駅前の一杯');
    const menuId = addBowl(placeId, '中華そば', ['jp-001']);
    const { addTargetMeal } = useAppStore.getState();
    addTargetMeal({ conceptIds: ['jp-001'], placeId, menuId }, { eatenAt: '2026-08-01T12:00:00.000Z', rating: 4, note: '', isFavorite: false });
    addTargetMeal({ conceptIds: ['jp-001'], placeId, menuId }, { eatenAt: '2026-08-09T12:00:00.000Z', rating: 5, note: '', isFavorite: true });

    const meals = useAppStore.getState().meals;
    expect(meals).toHaveLength(2);
    expect(new Set(meals.map((meal) => meal.id)).size).toBe(2);
    // The name is copied at the time of the meal so the record still reads
    // clearly after a rename or a delete.
    expect(meals.every((meal) => meal.menuSnapshot?.name === '中華そば')).toBe(true);
    expect(meals.every((meal) => meal.placeSnapshot?.name === '駅前の一杯')).toBe(true);
  });

  it('counts menus, wishes and meals for one shop only', () => {
    const placeId = addShop('駅前の一杯');
    const other = addShop('別の店');
    const menuId = addBowl(placeId, '中華そば');
    addBowl(placeId, 'つけそば');
    addBowl(other, '塩そば');

    const { addTargetWish, addTargetMeal } = useAppStore.getState();
    addTargetWish('place', placeId, { title: '駅前の一杯', subtitle: '' });
    addTargetWish('menu', menuId, { title: '中華そば', subtitle: '駅前の一杯' });
    addTargetMeal({ placeId, menuId }, { eatenAt: '2026-08-01T12:00:00.000Z', rating: null, note: '', isFavorite: false });
    addTargetMeal({ placeId }, { eatenAt: '2026-08-07T12:00:00.000Z', rating: null, note: '', isFavorite: false });

    const state = useAppStore.getState();
    const summary = summarizePlace(placeId, state);
    expect(summary).toEqual({ menuCount: 2, wishCount: 2, mealCount: 2, lastEatenAt: '2026-08-07T12:00:00.000Z' });
    expect(summarizePlace(other, state)).toMatchObject({ menuCount: 1, wishCount: 0, mealCount: 0, lastEatenAt: null });
  });

  it('says so plainly when a shop has no address', () => {
    expect(placeLocationLabel({ addressText: null } as PlaceRecord)).toBe('地域は未登録');
    expect(placeLocationLabel({ addressText: '   ' } as PlaceRecord)).toBe('地域は未登録');
    expect(placeLocationLabel({ addressText: '東京都新宿区' } as PlaceRecord)).toBe('東京都新宿区');
  });
});

describe('writing a backup and reading it back', () => {
  it('produces the same JSON both times, field order included', () => {
    const placeId = addShop('駅前の一杯');
    const menuId = addBowl(placeId, '中華そば', ['jp-001']);
    const { addTargetWish, addTargetMeal } = useAppStore.getState();
    addTargetWish('menu', menuId, { title: '中華そば', subtitle: '駅前の一杯' });
    addTargetMeal({ conceptIds: ['jp-001'], placeId, menuId }, { eatenAt: '2026-08-01T12:00:00.000Z', rating: 4, note: 'メモ', isFavorite: true });

    const exported = exportAppState();
    useAppStore.getState().importState(JSON.parse(exported));
    expect(exportAppState().replace(/"exportedAt":\s*"[^"]*"/, '')).toBe(exported.replace(/"exportedAt":\s*"[^"]*"/, ''));
  });
});

describe('deleting a place from the screen', () => {
  it('takes its menus and wishes with it but keeps the meals already eaten', () => {
    const placeId = addShop('駅前の一杯');
    const menuId = addBowl(placeId, '中華そば');
    const { addTargetWish, addTargetMeal } = useAppStore.getState();
    addTargetWish('menu', menuId, { title: '中華そば', subtitle: '駅前の一杯' });
    addTargetMeal({ placeId, menuId }, { eatenAt: '2026-08-01T12:00:00.000Z', rating: 5, note: 'おいしかった', isFavorite: true });

    useAppStore.getState().removePlace(placeId);

    const state = useAppStore.getState();
    expect(state.places).toEqual([]);
    expect(state.menus).toEqual([]);
    expect(state.wishes).toEqual([]);
    expect(state.meals).toHaveLength(1);
    expect(state.meals[0]?.placeId).toBeNull();
    expect(state.meals[0]?.menuId).toBeNull();
    expect(state.meals[0]?.placeSnapshot?.name).toBe('駅前の一杯');
    expect(state.meals[0]?.isFavorite).toBe(true);
  });

  it('removes only the deleted menu when the shop stays', () => {
    const placeId = addShop('駅前の一杯');
    const keep = addBowl(placeId, '中華そば');
    const drop = addBowl(placeId, 'つけそば');
    useAppStore.getState().addTargetWish('menu', drop, { title: 'つけそば', subtitle: '駅前の一杯' });

    useAppStore.getState().removeMenu(drop);

    const state = useAppStore.getState();
    expect(state.menus.map((menu) => menu.id)).toEqual([keep]);
    expect(state.wishes).toEqual([]);
    expect(state.places).toHaveLength(1);
  });
});

describe('the food wish list', () => {
  it('keeps one entry per target and lets each kind sit side by side', () => {
    const placeId = addShop('駅前の一杯');
    const menuId = addBowl(placeId, '中華そば');
    const { addTargetWish, toggleWish } = useAppStore.getState();
    toggleWish('jp-001');
    addTargetWish('place', placeId, { title: '駅前の一杯', subtitle: '東京都新宿区' });
    addTargetWish('place', placeId, { title: '駅前の一杯', subtitle: '東京都新宿区' });
    addTargetWish('menu', menuId, { title: '中華そば', subtitle: '駅前の一杯' });

    const wishes = useAppStore.getState().wishes;
    expect(wishes).toHaveLength(3);
    expect(wishes.map((wish) => wish.targetType)).toEqual(['concept', 'place', 'menu']);
  });
});
