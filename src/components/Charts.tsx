import Plot from 'react-plotly.js';
import { tasteLabels, type Dish, type TasteKey } from '../types/catalog';

const radarKeys: TasteKey[] = ['richness', 'oiliness', 'saltiness', 'sweetness', 'sourness', 'heat', 'umami', 'seafoodIntensity', 'animalIntensity'];

export function TasteRadar({ dishes, title = '味覚の比較' }: { dishes: Dish[]; title?: string }) {
  const labels = radarKeys.map((key) => tasteLabels[key]);
  const traces = dishes.map((dish) => ({
    type: 'scatterpolar' as const,
    r: [...radarKeys.map((key) => dish.taste[key].typical), dish.taste.richness.typical],
    theta: [...labels, labels[0]],
    fill: dishes.length === 1 ? 'toself' as const : 'none' as const,
    name: dish.name,
    hovertemplate: '%{theta}: %{r:.1f}<extra>%{fullData.name}</extra>'
  }));
  return (
    <div className="chart-shell" aria-label={title}>
      <Plot
        data={traces}
        layout={{
          title: { text: title, font: { size: 16 } },
          autosize: true,
          margin: { l: 42, r: 42, t: 56, b: 36 },
          paper_bgcolor: 'rgba(0,0,0,0)',
          plot_bgcolor: 'rgba(0,0,0,0)',
          polar: { radialaxis: { visible: true, range: [0, 5], tickvals: [1, 2, 3, 4, 5] } },
          showlegend: dishes.length > 1,
          legend: { orientation: 'h', y: -0.15 }
        }}
        config={{ responsive: true, displaylogo: false, modeBarButtonsToRemove: ['lasso2d', 'select2d'] }}
        useResizeHandler
        style={{ width: '100%', height: '430px' }}
      />
      <details className="chart-data-table">
        <summary>グラフの数値を表で見る</summary>
        <div className="table-scroll">
          <table>
            <thead><tr><th>項目</th>{dishes.map((dish) => <th key={dish.id}>{dish.name}</th>)}</tr></thead>
            <tbody>{radarKeys.map((key) => <tr key={key}><th>{tasteLabels[key]}</th>{dishes.map((dish) => <td key={dish.id}>{dish.taste[key].typical.toFixed(1)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
