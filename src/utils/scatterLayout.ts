import type { NoodleCategory, NoodleKey, TasteKey } from '../types/catalog';

/** A taste-map axis is either a taste value or a noodle texture metric. */
export type AxisKey = TasteKey | NoodleKey;

export interface TasteMapPreset {
  id: string;
  label: string;
  description: string;
  xKey: AxisKey;
  yKey: AxisKey;
  category?: NoodleCategory;
}

export const tasteMapPresets: TasteMapPreset[] = [
  { id: 'richness-heat', label: 'コクと刺激', description: '濃厚さ x 辛味', xKey: 'richness', yKey: 'heat' },
  { id: 'richness-oiliness', label: '重さの違い', description: '濃厚さ x 油分', xKey: 'richness', yKey: 'oiliness' },
  { id: 'dashi-sauce', label: 'だしとソース', description: 'だしの強さ x ソース・たれの強さ', xKey: 'dashiIntensity', yKey: 'sauceIntensity' },
  { id: 'seafood-animal', label: 'だしの方向性', description: '魚介感 x 動物系の強さ', xKey: 'seafoodIntensity', yKey: 'animalIntensity' },
  { id: 'saltiness-umami', label: '味の輪郭', description: '塩味 x うま味', xKey: 'saltiness', yKey: 'umami' },
  { id: 'sourness-herbal', label: '爽やかさ', description: '酸味 x 香草', xKey: 'sourness', yKey: 'herbalIntensity' },
  { id: 'noodle-character', label: '麺の個性', description: '麺そのものの香り x もちもち感・噛みごたえ', xKey: 'noodleAroma', yKey: 'chewiness' }
];

export const categoryPresets: TasteMapPreset[] = [
  { id: 'ramen-focus', label: 'ラーメン向け', description: '濃厚さ x 動物系の強さ', xKey: 'richness', yKey: 'animalIntensity', category: 'ramen' },
  { id: 'udon-soba-focus', label: 'うどん・そば向け', description: 'だしの強さ x 麺そのものの香り', xKey: 'dashiIntensity', yKey: 'noodleAroma', category: 'udon' },
  { id: 'yakisoba-focus', label: '焼きそば向け', description: 'ソース・たれの強さ x 香ばしさ', xKey: 'sauceIntensity', yKey: 'roastedAroma', category: 'yakisoba' }
];

export const AXIS_MIN = 0;
export const AXIS_MAX = 5;
/** Individual markers stop being readable past this many results. */
export const INDIVIDUAL_MODE_LIMIT = 60;
/** Error bars for every result stop being readable past this many results. */
export const ALL_RANGES_LIMIT = 20;

export interface ScatterPointInput {
  id: string;
  x: number;
  y: number;
}

export interface BubbleGroup {
  key: string;
  x: number;
  y: number;
  count: number;
  dishIds: string[];
}

/** Groups on the real coordinates, rounded to two decimals for exact matching. */
export const coordinateKey = (x: number, y: number) => `${x.toFixed(2)}|${y.toFixed(2)}`;

/**
 * Collapses dishes that share a taste coordinate into a single bubble. Unlike
 * the v2.1.2 sunflower layout this never moves a dish away from its real
 * values: the coordinate reported for a bubble is the coordinate of its dishes.
 */
export function groupIntoBubbles(points: ScatterPointInput[]): BubbleGroup[] {
  const groups = new Map<string, BubbleGroup>();
  for (const point of points) {
    const key = coordinateKey(point.x, point.y);
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      existing.dishIds.push(point.id);
    } else {
      groups.set(key, {
        key,
        x: Number(point.x.toFixed(2)),
        y: Number(point.y.toFixed(2)),
        count: 1,
        dishIds: [point.id]
      });
    }
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

export function countUniqueCoordinates(points: ScatterPointInput[]): number {
  return new Set(points.map((point) => coordinateKey(point.x, point.y))).size;
}

/**
 * Bubble diameters for Plotly's `sizemode: 'area'`, so the drawn area is
 * proportional to the dish count while staying inside a legible size band.
 */
export function bubbleDiameter(count: number, maxCount: number, minimum = 12, maximum = 52): number {
  if (maxCount <= 1) return minimum;
  const ratio = Math.sqrt(count) / Math.sqrt(maxCount);
  return Number((minimum + (maximum - minimum) * ratio).toFixed(2));
}

export interface AxisRange {
  min: number;
  max: number;
}

const clampToAxis = (value: number) => Math.min(AXIS_MAX, Math.max(AXIS_MIN, value));

/** The full 0-5 square, which is also the initial view. */
export const fullRange = (): AxisRange => ({ min: AXIS_MIN, max: AXIS_MAX });

/**
 * Fits the axes to the results with a margin, keeping the plot square and
 * never showing anything outside 0-5.
 */
export function fitRange(points: ScatterPointInput[], margin = 0.35): { x: AxisRange; y: AxisRange } {
  if (points.length === 0) return { x: fullRange(), y: fullRange() };

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const rawMinX = Math.min(...xs) - margin;
  const rawMaxX = Math.max(...xs) + margin;
  const rawMinY = Math.min(...ys) - margin;
  const rawMaxY = Math.max(...ys) + margin;

  // A shared span keeps one axis unit the same physical length on both axes.
  const span = Math.min(AXIS_MAX - AXIS_MIN, Math.max(rawMaxX - rawMinX, rawMaxY - rawMinY, 0.5));
  const centre = (min: number, max: number) => (min + max) / 2;

  const build = (min: number, max: number): AxisRange => {
    const half = span / 2;
    let low = centre(min, max) - half;
    let high = centre(min, max) + half;
    if (low < AXIS_MIN) { high += AXIS_MIN - low; low = AXIS_MIN; }
    if (high > AXIS_MAX) { low -= high - AXIS_MAX; high = AXIS_MAX; }
    return { min: clampToAxis(low), max: clampToAxis(high) };
  };

  return { x: build(rawMinX, rawMaxX), y: build(rawMinY, rawMaxY) };
}

/** Zoom applied when a bubble is selected: a square window around the point. */
export function zoomAroundPoint(x: number, y: number, width = 1.5): { x: AxisRange; y: AxisRange } {
  const build = (value: number): AxisRange => {
    let low = value - width / 2;
    let high = value + width / 2;
    if (low < AXIS_MIN) { high += AXIS_MIN - low; low = AXIS_MIN; }
    if (high > AXIS_MAX) { low -= high - AXIS_MAX; high = AXIS_MAX; }
    return { min: clampToAxis(low), max: clampToAxis(high) };
  };
  return { x: build(x), y: build(y) };
}
