import { useState } from 'react';
import type { Dish } from '../types/catalog';
import { prefectureTiles } from '../utils/japanTileMap';
import {
  projectWorldPoint,
  worldBorderPath,
  worldLandPath,
  worldMapHeight,
  worldMapPixelsPerDegree,
  worldMapTopLatitude,
  worldMapWidth
} from './worldMapGeometry';

export function JapanTileMap({ dishes, selected, onSelect }: { dishes: Dish[]; selected: string; onSelect: (prefecture: string) => void }) {
  const counts = new Map<string, number>();
  for (const dish of dishes) for (const prefecture of dish.prefectureNames) counts.set(prefecture, (counts.get(prefecture) ?? 0) + 1);
  return (
    <div className="map-shell">
      <div className="japan-tile-map" role="group" aria-label="都道府県から探す">
        {prefectureTiles.map((tile) => {
          const count = counts.get(tile.name) ?? 0;
          return (
            <button
              type="button"
              key={tile.name}
              className={`${count ? '' : 'is-empty'} ${selected === tile.name ? 'is-selected' : ''}`}
              style={{ gridRow: tile.row, gridColumn: tile.col }}
              disabled={!count}
              aria-pressed={selected === tile.name}
              onClick={() => onSelect(selected === tile.name ? '' : tile.name)}
            >
              <span>{tile.name.replace(/[都府県]$/, '')}</span>
              <small>{count}</small>
            </button>
          );
        })}
      </div>
      <p className="map-help">位置関係をそろえたタイル地図です。数字は収録件数です。地図を使わず、条件検索から都道府県を選ぶこともできます。</p>
    </div>
  );
}

const meridians = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150].map(
  (offset) => (offset + 180) * worldMapPixelsPerDegree
);
const parallels = [60, 30, 0, -30].map((latitude) => (worldMapTopLatitude - latitude) * worldMapPixelsPerDegree);

type WorldPoint = { country: string; items: Dish[]; x: number; y: number };

export function WorldPointMap({ dishes, selected, onSelect }: { dishes: Dish[]; selected: string; onSelect: (country: string) => void }) {
  // East and South-East Asia hold most of the points, so names are shown for the
  // highlighted region only; the button list below the map names them all.
  const [highlighted, setHighlighted] = useState('');

  const groups = new Map<string, Dish[]>();
  for (const dish of dishes) groups.set(dish.country, [...(groups.get(dish.country) ?? []), dish]);

  const points = [...groups.entries()]
    .map(([country, items]) => {
      const located = items.filter((dish) => dish.coordinates !== null);
      if (!located.length) return null;
      const lat = located.reduce((sum, dish) => sum + (dish.coordinates?.lat ?? 0), 0) / located.length;
      const lon = located.reduce((sum, dish) => sum + (dish.coordinates?.lon ?? 0), 0) / located.length;
      return { country, items, ...projectWorldPoint(lat, lon) };
    })
    .filter((point): point is WorldPoint => point !== null)
    .sort((a, b) => b.items.length - a.items.length || a.country.localeCompare(b.country, 'ja'));

  const named = highlighted || selected;
  // Smaller circles first, and the named one last so its label stays on top.
  const drawOrder = [...points]
    .reverse()
    .sort((a, b) => Number(a.country === named) - Number(b.country === named));

  return (
    <div className="map-shell world-map-shell">
      <svg
        className="world-point-map"
        viewBox={`0 0 ${worldMapWidth} ${worldMapHeight}`}
        role="img"
        aria-labelledby="world-map-title world-map-desc"
      >
        <title id="world-map-title">世界の麺料理の収録地域</title>
        <desc id="world-map-desc">日本を中心に描いた世界地図です。収録のある国と地域に点を表示しています。地図の下のボタンからも同じ絞り込みができます。</desc>
        <rect className="world-ocean" x="0" y="0" width={worldMapWidth} height={worldMapHeight} />
        <g className="world-graticule">
          {meridians.map((x) => <line key={`m${x}`} x1={x} y1={0} x2={x} y2={worldMapHeight} />)}
          {parallels.map((y) => <line key={`p${y}`} x1={0} y1={y} x2={worldMapWidth} y2={y} />)}
        </g>
        <path className="world-land" d={worldLandPath} />
        <path className="world-border" d={worldBorderPath} />
        {drawOrder.map((point) => {
          const isSelected = selected === point.country;
          const isNamed = named === point.country;
          const radius = 6.5 + 2.2 * (Math.sqrt(point.items.length) - 1) + (isSelected || isNamed ? 1.5 : 0);
          const toLeft = point.x > worldMapWidth - 190;
          return (
            <g
              key={point.country}
              className={`map-point${isSelected ? ' is-selected' : ''}${isNamed ? ' is-named' : ''}`}
              onClick={() => onSelect(isSelected ? '' : point.country)}
              onMouseEnter={() => setHighlighted(point.country)}
              onMouseLeave={() => setHighlighted('')}
            >
              <circle cx={point.x} cy={point.y} r={radius} />
              <text className="count" x={point.x} y={point.y + 3.5} textAnchor="middle">{point.items.length}</text>
              {isNamed && (
                <text
                  className="map-point-label"
                  x={point.x + (toLeft ? -(radius + 6) : radius + 6)}
                  y={point.y + 4}
                  textAnchor={toLeft ? 'end' : 'start'}
                >
                  {point.country}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <ul className="world-country-list">
        {points.map((point) => (
          <li key={point.country}>
            <button
              type="button"
              className={selected === point.country ? 'is-selected' : ''}
              aria-pressed={selected === point.country}
              onClick={() => onSelect(selected === point.country ? '' : point.country)}
              onMouseEnter={() => setHighlighted(point.country)}
              onMouseLeave={() => setHighlighted('')}
              onFocus={() => setHighlighted(point.country)}
              onBlur={() => setHighlighted('')}
            >
              {point.country}<small>{point.items.length}</small>
            </button>
          </li>
        ))}
      </ul>
      <p className="map-help">日本を中心に置いた地図です。点は料理の代表地域を示し、国境や発祥地を厳密に示すものではありません。</p>
    </div>
  );
}
