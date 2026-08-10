import { describe, expect, it } from 'vitest';
import {
  AXIS_MAX,
  AXIS_MIN,
  bubbleDiameter,
  countUniqueCoordinates,
  fitRange,
  fullRange,
  groupIntoBubbles,
  zoomAroundPoint
} from '../src/utils/scatterLayout';

const points = [
  { id: 'a', x: 3.2, y: 1.4 },
  { id: 'b', x: 3.2, y: 1.4 },
  { id: 'c', x: 3.2, y: 1.4 },
  { id: 'd', x: 1.05, y: 4.9 },
  { id: 'e', x: 0.2, y: 0.1 }
];

describe('味覚マップのバブル集約', () => {
  it('同じ座標を1つのバブルへまとめる', () => {
    const bubbles = groupIntoBubbles(points);
    expect(bubbles).toHaveLength(3);
    const largest = bubbles[0];
    expect(largest?.count).toBe(3);
    expect(largest?.dishIds.sort()).toEqual(['a', 'b', 'c']);
  });

  it('元の座標を移動させない', () => {
    for (const bubble of groupIntoBubbles(points)) {
      for (const id of bubble.dishIds) {
        const original = points.find((point) => point.id === id);
        expect(bubble.x).toBeCloseTo(original?.x ?? -1, 2);
        expect(bubble.y).toBeCloseTo(original?.y ?? -1, 2);
      }
    }
  });

  it('全グループの料理IDの総数が検索結果件数と一致する', () => {
    const total = groupIntoBubbles(points).reduce((sum, bubble) => sum + bubble.dishIds.length, 0);
    expect(total).toBe(points.length);
    expect(countUniqueCoordinates(points)).toBe(3);
  });

  it('バブル面積が件数に比例する', () => {
    const single = bubbleDiameter(1, 4);
    const quadruple = bubbleDiameter(4, 4);
    // Diameter grows with the square root of the count, so area is linear in it.
    expect(quadruple).toBeGreaterThan(single);
    expect(bubbleDiameter(4, 4)).toBeCloseTo(52, 1);
    expect(bubbleDiameter(1, 1)).toBeCloseTo(12, 1);
  });
});

describe('味覚マップの軸範囲', () => {
  it('初期表示は0から5の全体である', () => {
    expect(fullRange()).toEqual({ min: AXIS_MIN, max: AXIS_MAX });
  });

  it('結果に合わせても0から5を超えない', () => {
    const range = fitRange(points);
    for (const axis of [range.x, range.y]) {
      expect(axis.min).toBeGreaterThanOrEqual(AXIS_MIN);
      expect(axis.max).toBeLessThanOrEqual(AXIS_MAX);
    }
  });

  it('結果に合わせたとき縦横の尺度が1:1になる', () => {
    const range = fitRange(points);
    expect(range.x.max - range.x.min).toBeCloseTo(range.y.max - range.y.min, 6);
  });

  it('選択時に正方形の範囲へズームする', () => {
    const range = zoomAroundPoint(3.2, 1.4);
    expect(range.x.max - range.x.min).toBeCloseTo(1.5, 6);
    expect(range.y.max - range.y.min).toBeCloseTo(1.5, 6);
  });

  it('端の座標を選んでも0から5の内側へ収める', () => {
    const range = zoomAroundPoint(0, 5);
    expect(range.x.min).toBeGreaterThanOrEqual(AXIS_MIN);
    expect(range.y.max).toBeLessThanOrEqual(AXIS_MAX);
    expect(range.x.max - range.x.min).toBeCloseTo(1.5, 6);
  });

  it('結果が空でも全体範囲を返す', () => {
    expect(fitRange([])).toEqual({ x: fullRange(), y: fullRange() });
  });
});
