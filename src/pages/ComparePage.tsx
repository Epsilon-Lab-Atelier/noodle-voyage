import { useMemo, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { TasteRadar } from '../components/Charts';
import { ErrorState, LoadingState } from '../components/LoadingState';
import { useCatalogData } from '../data/useCatalogData';
import { scoreDish, tasteLabels } from '../recommendation/engine';
import { useAppStore } from '../state/store';
import { tasteKeys } from '../types/catalog';
import { googleImageSearchUrl } from '../utils/externalSearch';

export default function ComparePage() {
  const { catalog, loading, error } = useCatalogData();
  const compare = useAppStore((state) => state.compare);
  const toggleCompare = useAppStore((state) => state.toggleCompare);
  const clearCompare = useAppStore((state) => state.clearCompare);
  const preferences = useAppStore((state) => state.preferences);
  const [query, setQuery] = useState('');

  const selected = compare.map((id) => catalog.find((dish) => dish.id === id)).filter((dish) => dish !== undefined);
  const candidates = useMemo(() => {
    const normalized = query.normalize('NFKC').toLocaleLowerCase('ja');
    return catalog.filter((dish) => !compare.includes(dish.id) && (!normalized || dish.searchText.normalize('NFKC').toLocaleLowerCase('ja').includes(normalized))).slice(0, 12);
  }, [catalog, compare, query]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="page-container compare-page section-pad">
      <header className="page-heading"><p className="eyebrow">Compare routes</p><h1>最大3つを見比べる</h1><p>日本同士、世界同士、日本と世界の組み合わせも比較できます。味覚値だけでなく、麺の原料や文化の違いも確認できます。</p></header>

      <section className="compare-picker" aria-labelledby="picker-title">
        <div className="section-heading inline-heading"><div><h2 id="picker-title">比較対象 {selected.length} / 3</h2><p>検索結果や詳細画面の「比較する」からも追加できます。</p></div>{selected.length > 0 ? <button type="button" className="button button-ghost" onClick={clearCompare}>すべて外す</button> : null}</div>
        <div className="selected-compare-grid">
          {selected.map((dish) => <article className="compare-mini-card" key={dish.id}><div><span className="eyebrow">{dish.prefectureLabel ?? dish.country}</span><h3><Link to={`/dish/${dish.id}`}>{dish.name}</Link></h3>{dish.localName && dish.localName !== dish.name ? <p className="local-name" lang="und">{dish.localName}</p> : null}<div className="compare-mini-actions"><a className="text-link" href={googleImageSearchUrl(dish)} target="_blank" rel="noopener noreferrer">Google画像検索</a><button type="button" className="text-button" onClick={() => toggleCompare(dish.id)}>比較対象から外す</button></div></div></article>)}
          {Array.from({ length: 3 - selected.length }).map((_, index) => <div className="compare-placeholder" key={index}><p>料理を追加</p><small>{index + selected.length + 1}つ目の候補</small></div>)}
        </div>
        {selected.length < 3 ? <div className="compare-search"><label>追加する料理を検索<input type="search" value={query} onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)} placeholder="名称、地域、特徴" /></label><div className="candidate-list">{candidates.map((dish) => <button type="button" key={dish.id} onClick={() => { toggleCompare(dish.id); setQuery(''); }}><span>{dish.name}</span><small>{dish.prefectureLabel ?? dish.country}</small></button>)}</div></div> : null}
      </section>

      {selected.length === 0 ? <section className="empty-state"><h2>まだ比較対象がありません</h2><p>探す画面で気になる料理を選ぶか、上の検索から追加してください。</p><Link className="button button-primary" to="/explore">料理を探す</Link></section> : null}

      {selected.length > 0 ? <>
        <section className="content-section"><TasteRadar dishes={selected} title="味覚プロファイルの比較" /></section>
        <section className="content-section" aria-labelledby="table-title"><h2 id="table-title">特徴を横並びで確認</h2><div className="table-scroll"><table className="comparison-table"><thead><tr><th>項目</th>{selected.map((dish) => <th key={dish.id}><Link to={`/dish/${dish.id}`}>{dish.name}</Link></th>)}</tr></thead><tbody>
          <tr><th>地域</th>{selected.map((dish) => <td key={dish.id}>{dish.prefectureLabel ?? dish.country}</td>)}</tr>
          <tr><th>分類</th>{selected.map((dish) => <td key={dish.id}>{dish.categoryLabel}</td>)}</tr>
          <tr><th>提供形式</th>{selected.map((dish) => <td key={dish.id}>{dish.formLabel}</td>)}</tr>
          <tr><th>麺の原料</th>{selected.map((dish) => <td key={dish.id}>{dish.noodle.materials.join('、')}</td>)}</tr>
          <tr><th>麺の太さ</th>{selected.map((dish) => <td key={dish.id}>{dish.noodle.thickness.toFixed(1)} / 5</td>)}</tr>
          <tr><th>麺の硬さ</th>{selected.map((dish) => <td key={dish.id}>{dish.noodle.firmness.toFixed(1)} / 5</td>)}</tr>
          <tr><th>スープ</th>{selected.map((dish) => <td key={dish.id}>{dish.broth.bases.join('、') || '多様'}</td>)}</tr>
          <tr><th>味付け</th>{selected.map((dish) => <td key={dish.id}>{dish.broth.seasonings.join('、') || '多様'}</td>)}</tr>
          <tr><th>主な具材</th>{selected.map((dish) => <td key={dish.id}>{dish.ingredients.join('、') || '店舗により異なる'}</td>)}</tr>
          <tr><th>好みとの一致度</th>{selected.map((dish) => <td key={dish.id}><strong>{scoreDish(dish, { ...preferences, scope: 'all' })?.score ?? '-'}</strong> / 100</td>)}</tr>
          {tasteKeys.map((key) => <tr key={key}><th>{tasteLabels[key]}</th>{selected.map((dish) => <td key={dish.id}>{dish.taste[key].typical.toFixed(1)} <small>({dish.taste[key].min.toFixed(1)}-{dish.taste[key].max.toFixed(1)})</small></td>)}</tr>)}
        </tbody></table></div><p className="method-note">原料や製法が異なる料理では、数値が同じでも実際の食感は同一ではありません。比較の入口としてご利用ください。</p></section>
      </> : null}
    </div>
  );
}
