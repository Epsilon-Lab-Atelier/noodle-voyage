import { useMemo, useState } from 'react';
import Plot, { type PlotClickEvent } from 'react-plotly.js';
import { culturalScopeLabels, noodleLabels, tasteLabels, type Dish, type NoodleKey, type TasteKey } from '../types/catalog';
import {
  ALL_RANGES_LIMIT,
  AXIS_MAX,
  AXIS_MIN,
  INDIVIDUAL_MODE_LIMIT,
  bubbleDiameter,
  coordinateKey,
  fitRange,
  fullRange,
  groupIntoBubbles,
  zoomAroundPoint,
  type AxisKey,
  type AxisRange
} from '../utils/scatterLayout';

export type TasteMapMode = 'distribution' | 'individual';

const isNoodleKey = (key: AxisKey): key is NoodleKey =>
  key === 'thickness' || key === 'width' || key === 'firmness' || key === 'elasticity' || key === 'chewiness' || key === 'smoothness';

export const axisLabel = (key: AxisKey): string =>
  (isNoodleKey(key) ? `麺: ${noodleLabels[key]}` : tasteLabels[key as TasteKey]);

/** Reads an axis value without ever altering it for display purposes. */
export const axisValue = (dish: Dish, key: AxisKey): number =>
  (isNoodleKey(key) ? dish.noodle[key] : dish.taste[key as TasteKey].typical);

const axisSpread = (dish: Dish, key: AxisKey): { min: number; max: number } =>
  (isNoodleKey(key)
    ? { min: dish.noodle[key], max: dish.noodle[key] }
    : { min: dish.taste[key as TasteKey].min, max: dish.taste[key as TasteKey].max });

interface TasteMapProps {
  dishes: Dish[];
  xKey: AxisKey;
  yKey: AxisKey;
  mode: TasteMapMode;
  onSelectDish: (id: string) => void;
}

export function TasteMap({ dishes, xKey, yKey, mode, onSelectDish }: TasteMapProps) {
  const [range, setRange] = useState<{ x: AxisRange; y: AxisRange }>({ x: fullRange(), y: fullRange() });
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [showAllRanges, setShowAllRanges] = useState(false);

  const points = useMemo(
    () => dishes.map((dish) => ({ id: dish.id, x: axisValue(dish, xKey), y: axisValue(dish, yKey) })),
    [dishes, xKey, yKey]
  );
  const bubbles = useMemo(() => groupIntoBubbles(points), [points]);
  const dishById = useMemo(() => new Map(dishes.map((dish) => [dish.id, dish])), [dishes]);
  const maxCount = bubbles.reduce((max, bubble) => Math.max(max, bubble.count), 1);

  const individualAvailable = dishes.length <= INDIVIDUAL_MODE_LIMIT;
  const effectiveMode: TasteMapMode = mode === 'individual' && individualAvailable ? 'individual' : 'distribution';
  const selectedBubble = bubbles.find((bubble) => bubble.key === selectedKey) ?? null;
  const selectedDishes = selectedBubble
    ? selectedBubble.dishIds.map((id) => dishById.get(id)).filter((dish): dish is Dish => dish !== undefined)
    : [];

  const resetView = () => { setRange({ x: fullRange(), y: fullRange() }); };
  const fitToResults = () => { setRange(fitRange(points)); };
  const clearSelection = () => { setSelectedKey(null); setRange({ x: fullRange(), y: fullRange() }); };

  const handleClick = (event: PlotClickEvent) => {
    const custom = event.points[0]?.customdata;
    const key = Array.isArray(custom) ? String(custom[0]) : typeof custom === 'string' ? custom : null;
    if (!key) return;
    const bubble = bubbles.find((item) => item.key === key);
    if (!bubble) return;
    setSelectedKey(key);
    setRange(zoomAroundPoint(bubble.x, bubble.y));
  };

  const summarise = (ids: string[], pick: (dish: Dish) => string) => {
    const counts = new Map<string, number>();
    for (const id of ids) {
      const dish = dishById.get(id);
      if (!dish) continue;
      const value = pick(dish);
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([value]) => value).join('、') || '—';
  };

  const bubbleTrace = {
    type: 'scatter' as const,
    mode: 'markers+text' as const,
    name: '料理の分布',
    x: bubbles.map((bubble) => bubble.x),
    y: bubbles.map((bubble) => bubble.y),
    text: bubbles.map((bubble) => (bubble.count > 1 ? String(bubble.count) : '')),
    textposition: 'middle center' as const,
    textfont: { size: 11 },
    customdata: bubbles.map((bubble) => [
      bubble.key,
      bubble.count,
      summarise(bubble.dishIds, (dish) => dish.formLabel),
      summarise(bubble.dishIds, (dish) => dish.prefectureLabel ?? dish.country)
    ]),
    marker: {
      // Area scales with the dish count, so a bubble's size reads as a count.
      sizemode: 'area' as const,
      sizeref: (2 * maxCount) / 52 ** 2,
      size: bubbles.map((bubble) => bubbleDiameter(bubble.count, maxCount) ** 2 / 4),
      color: bubbles.map((bubble) => bubble.count),
      colorscale: 'YlOrBr' as const,
      showscale: bubbles.length > 1,
      colorbar: { title: { text: '件数' }, thickness: 12 },
      line: { width: bubbles.map((bubble) => (bubble.key === selectedKey ? 2.5 : 0.8)) },
      opacity: 0.88
    },
    hovertemplate: `${axisLabel(xKey)}: %{x:.1f}<br>${axisLabel(yKey)}: %{y:.1f}<br>件数: %{customdata[1]}<br>主な提供形式: %{customdata[2]}<br>主な地域: %{customdata[3]}<extra></extra>`
  };

  const individualTrace = {
    type: 'scatter' as const,
    mode: 'markers' as const,
    name: '料理',
    x: dishes.map((dish) => axisValue(dish, xKey)),
    y: dishes.map((dish) => axisValue(dish, yKey)),
    text: dishes.map((dish) => dish.name),
    customdata: dishes.map((dish) => [coordinateKey(axisValue(dish, xKey), axisValue(dish, yKey)), dish.id, culturalScopeLabels[dish.culturalScope]]),
    marker: {
      size: 11,
      opacity: 0.85,
      // 位置づけ is a separate axis from the noodle category, so it is drawn as
      // a shape rather than a colour, and the hover text names it as well.
      symbol: dishes.map((dish) => (dish.culturalScope === 'contemporary'
        ? 'diamond'
        : dish.culturalScope === 'standard' ? 'square' : 'circle')),
      line: { width: 0.8, color: '#111820' }
    },
    hovertemplate: `<b>%{text}</b><br>位置づけ: %{customdata[2]}<br>${axisLabel(xKey)}: %{x:.1f}<br>${axisLabel(yKey)}: %{y:.1f}<extra></extra>`
  };

  const rangesVisible = effectiveMode === 'individual' && (showAllRanges ? dishes.length <= ALL_RANGES_LIMIT : selectedDishes.length > 0);
  const rangeSource = showAllRanges && dishes.length <= ALL_RANGES_LIMIT ? dishes : selectedDishes;
  const rangeTrace = rangesVisible && rangeSource.length > 0 ? [{
    type: 'scatter' as const,
    mode: 'markers' as const,
    name: '味の幅',
    x: rangeSource.map((dish) => axisValue(dish, xKey)),
    y: rangeSource.map((dish) => axisValue(dish, yKey)),
    error_x: {
      type: 'data' as const,
      symmetric: false,
      array: rangeSource.map((dish) => axisSpread(dish, xKey).max - axisValue(dish, xKey)),
      arrayminus: rangeSource.map((dish) => axisValue(dish, xKey) - axisSpread(dish, xKey).min),
      visible: true,
      thickness: 1
    },
    error_y: {
      type: 'data' as const,
      symmetric: false,
      array: rangeSource.map((dish) => axisSpread(dish, yKey).max - axisValue(dish, yKey)),
      arrayminus: rangeSource.map((dish) => axisValue(dish, yKey) - axisSpread(dish, yKey).min),
      visible: true,
      thickness: 1
    },
    marker: { size: 1, opacity: 0 },
    hoverinfo: 'skip' as const,
    showlegend: false
  }] : [];

  return (
    <figure className="taste-scatter-figure">
      <div className="taste-map-toolbar" role="group" aria-label="味覚マップの表示操作">
        <button type="button" className="button button-ghost" onClick={resetView}>0-5全体に戻す</button>
        <button type="button" className="button button-ghost" onClick={fitToResults}>結果に合わせる</button>
        <button type="button" className="button button-ghost" onClick={clearSelection} disabled={!selectedKey}>選択を解除</button>
        {effectiveMode === 'individual' ? (
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={showAllRanges}
              disabled={dishes.length > ALL_RANGES_LIMIT}
              onChange={(event) => setShowAllRanges(event.target.checked)}
            />
            全件の味の幅を表示
          </label>
        ) : null}
      </div>

      {effectiveMode === 'individual' && dishes.length > ALL_RANGES_LIMIT ? (
        <p className="chart-note">全件の味の幅は{ALL_RANGES_LIMIT}件以下のときに表示できます。バブルを選ぶと、その料理の味の幅を確認できます。</p>
      ) : null}
      {mode === 'individual' && !individualAvailable ? (
        <p className="chart-note">1件ずつの表示は検索結果{INDIVIDUAL_MODE_LIMIT}件以下で利用できます。条件で絞ってからお試しください。</p>
      ) : null}

      <div className="taste-scatter-frame">
        <Plot
          data={effectiveMode === 'individual' ? [...rangeTrace, individualTrace] : [bubbleTrace]}
          layout={{
            autosize: true,
            dragmode: 'pan',
            hovermode: 'closest',
            margin: { l: 62, r: 24, t: 24, b: 62 },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            xaxis: {
              title: { text: axisLabel(xKey) },
              range: [range.x.min, range.x.max],
              gridcolor: 'rgba(80,55,40,0.12)',
              zeroline: false,
              constrain: 'domain'
            },
            yaxis: {
              title: { text: axisLabel(yKey) },
              range: [range.y.min, range.y.max],
              gridcolor: 'rgba(80,55,40,0.12)',
              zeroline: false,
              scaleanchor: 'x',
              scaleratio: 1,
              constrain: 'domain'
            },
            showlegend: false,
            uirevision: `${xKey}-${yKey}-${effectiveMode}`
          }}
          config={{
            responsive: true,
            displaylogo: false,
            scrollZoom: true,
            modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d']
          }}
          onClick={handleClick}
          useResizeHandler
          style={{ width: '100%', height: '100%' }}
        />
      </div>

      <figcaption className="chart-caption">
        検索結果<strong>{dishes.length}件</strong>を、<strong>{bubbles.length}個</strong>の座標に集約して表示しています。
        {AXIS_MIN}から{AXIS_MAX}の正方形で、縦横の尺度は1:1です。料理の味覚値は表示のために移動していません。
      </figcaption>

      {selectedBubble ? (
        <section className="bubble-panel" aria-label="選択した座標の料理">
          <h3>{axisLabel(xKey)} {selectedBubble.x.toFixed(1)} / {axisLabel(yKey)} {selectedBubble.y.toFixed(1)}</h3>
          <p>この座標に{selectedBubble.count}件の料理があります。</p>
          <ul className="bubble-dish-list">
            {selectedDishes.map((dish) => (
              <li key={dish.id}>
                <button type="button" className="text-button" onClick={() => onSelectDish(dish.id)}>{dish.name}</button>
                <small>{dish.prefectureLabel ?? dish.country}</small>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <details className="chart-data-table">
        <summary>味覚マップの数値を表で見る</summary>
        <div className="table-scroll">
          {effectiveMode === 'individual' ? (
            <table>
              <thead><tr><th>料理</th><th>地域</th><th>麺の種類</th><th>{axisLabel(xKey)}</th><th>{axisLabel(yKey)}</th></tr></thead>
              <tbody>
                {dishes.map((dish) => (
                  <tr key={dish.id}>
                    <th><button type="button" className="text-button" onClick={() => onSelectDish(dish.id)}>{dish.name}</button></th>
                    <td>{dish.prefectureLabel ?? dish.country}</td>
                    <td>{dish.noodleCategory}</td>
                    <td>{axisValue(dish, xKey).toFixed(1)}</td>
                    <td>{axisValue(dish, yKey).toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table>
              <thead><tr><th>{axisLabel(xKey)}</th><th>{axisLabel(yKey)}</th><th>件数</th><th>主な提供形式</th><th>料理</th></tr></thead>
              <tbody>
                {bubbles.map((bubble) => (
                  <tr key={bubble.key}>
                    <td>{bubble.x.toFixed(1)}</td>
                    <td>{bubble.y.toFixed(1)}</td>
                    <td>{bubble.count}</td>
                    <td>{summarise(bubble.dishIds, (dish) => dish.formLabel)}</td>
                    <td><button type="button" className="text-button" onClick={() => { setSelectedKey(bubble.key); setRange(zoomAroundPoint(bubble.x, bubble.y)); }}>一覧を開く</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </details>
    </figure>
  );
}
