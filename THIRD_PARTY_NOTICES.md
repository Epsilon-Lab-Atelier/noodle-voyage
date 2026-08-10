# Third-Party Notices

Noodle Voyage 2026は、主に次のオープンソースソフトウェアを利用します。正確なバージョンは`package.json`を参照してください。

| Package | License |
|---|---|
| React / React DOM | MIT |
| React Router | MIT |
| Vite | MIT |
| Vite Plugin PWA | MIT |
| Plotly.js | MIT |
| react-plotly.js | MIT |
| Zustand | MIT |
| idb-keyval | Apache-2.0 |
| Zod | MIT |
| SheetJS Community Edition (`xlsx`) | Apache-2.0 |
| Vitest | MIT |
| TypeScript | Apache-2.0 |

各パッケージの著作権表示とライセンス本文は、インストールされたパッケージまたは各公式リポジトリを確認してください。

## 地図データ

世界地図の海岸線と国境の形状は、Natural Earthの1:110m縮尺データ（パブリックドメイン）を簡略化して`src/components/worldMapGeometry.ts`へ書き出したものです。再生成に使う`d3-geo`、`topojson-client`、`topojson-simplify`、`world-atlas`（いずれもISCまたはBSD-3-Clause）は、`scripts/generate-world-map.mjs`を実行するときだけ必要で、アプリの依存関係には含めません。
