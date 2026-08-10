import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { TasteRadar } from '../components/Charts';
import { DishCard } from '../components/DishCard';
import { ErrorState, LoadingState } from '../components/LoadingState';
import { ExternalLink, ExternalLinkNote } from '../components/ExternalLink';
import { ScopeBadge } from '../components/ScopeBadge';
import { StyleShopSearch } from '../components/StyleShopSearch';
import { useCatalogData } from '../data/useCatalogData';
import { areaSearchLink } from '../features/places/nearby';
import { facetRecordFor, matchReason } from '../features/tags/facetLookup';
import { groupDishDisplayFeatures, resolveDishDisplayFeatures } from '../features/tags/resolveFeatureTag';
import { scoreDish, tasteLabels } from '../recommendation/engine';
import { useAppStore } from '../state/store';
import { tasteKeys } from '../types/catalog';
import { isConceptWish, mealMatchesConcept } from '../types/records';
import { googleImageSearchUrl } from '../utils/externalSearch';

export default function DishPage() {
  const { dishId = '' } = useParams();
  const { catalog, sources, taxonomy, featureTags, facetIndex, loading, error } = useCatalogData();
  const preferences = useAppStore((state) => state.preferences);
  const wishes = useAppStore((state) => state.wishes);
  const meals = useAppStore((state) => state.meals);
  const compare = useAppStore((state) => state.compare);
  const preferenceMeta = useAppStore((state) => state.preferenceMeta);
  const toggleWish = useAppStore((state) => state.toggleWish);
  const toggleCompare = useAppStore((state) => state.toggleCompare);
  const addRecent = useAppStore((state) => state.addRecent);
  const addMeal = useAppStore((state) => state.addMeal);
  const removeMeal = useAppStore((state) => state.removeMeal);
  const [rating, setRating] = useState<number | null>(4);
  const [note, setNote] = useState('');
  const [eatenAt, setEatenAt] = useState(new Date().toISOString().slice(0, 10));
  const [isFavoriteDraft, setIsFavoriteDraft] = useState(false);
  const [saved, setSaved] = useState(false);

  const dish = catalog.find((item) => item.id === dishId);
  const dishMeals = meals.filter((meal) => mealMatchesConcept(meal, dishId));

  useEffect(() => {
    if (dishId) addRecent(dishId);
  }, [dishId, addRecent]);

  useEffect(() => {
    setRating(4);
    setNote('');
    setEatenAt(new Date().toISOString().slice(0, 10));
    setIsFavoriteDraft(false);
    setSaved(false);
  }, [dishId]);

  // Curated links are authored in the master data; the similar-dish list below
  // is computed from taste and noodle values only.
  const closeStyles = useMemo(() => {
    if (!dish) return [];
    const ids = dish.relatedStyleIds.length ? dish.relatedStyleIds : dish.parentStyleIds;
    return ids.map((id) => catalog.find((item) => item.id === id)).filter((item) => item !== undefined);
  }, [catalog, dish]);

  const regionalExamples = useMemo(() => {
    if (!dish) return [];
    return dish.regionalExampleIds.map((id) => catalog.find((item) => item.id === id)).filter((item) => item !== undefined);
  }, [catalog, dish]);

  const derivedStyles = useMemo(() => {
    if (!dish) return [];
    return dish.derivedStyleIds.map((id) => catalog.find((item) => item.id === id)).filter((item) => item !== undefined);
  }, [catalog, dish]);

  const related = useMemo(() => {
    if (!dish) return [];
    const curated = new Set([...dish.parentStyleIds, ...dish.regionalExampleIds, ...dish.relatedStyleIds, ...dish.derivedStyleIds]);
    const ids = [...new Set([...dish.bridgeIds, ...dish.relatedIds])].filter((id) => !curated.has(id));
    const found = ids.map((id) => catalog.find((item) => item.id === id)).filter((item) => item !== undefined);
    if (found.length >= 4) return found.slice(0, 6);
    const remaining = catalog
      .filter((item) => item.id !== dish.id && !curated.has(item.id) && !found.some((entry) => entry.id === item.id))
      .sort((a, b) => Math.abs(a.taste.richness.typical - dish.taste.richness.typical) + Math.abs(a.taste.heat.typical - dish.taste.heat.typical) - (Math.abs(b.taste.richness.typical - dish.taste.richness.typical) + Math.abs(b.taste.heat.typical - dish.taste.heat.typical)))
      .slice(0, 6 - found.length);
    return [...found, ...remaining];
  }, [catalog, dish]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!dish) return <ErrorState message="指定された料理が見つかりませんでした。" />;

  const isStandard = dish.culturalScope === 'standard';
  const isContemporary = dish.culturalScope === 'contemporary';
  const headlineFeatures = resolveDishDisplayFeatures(dish, featureTags, facetIndex).slice(0, 6);
  const featureGroups = groupDishDisplayFeatures(dish, featureTags, facetIndex);
  // Numeric thresholds make a dish findable without asserting a classification,
  // so they are explained here rather than shown as characteristics.
  const searchOnlyReasons = facetRecordFor(dish.id, facetIndex).facets
    .filter((facet) => !facet.displayEligible)
    .map((facet) => matchReason(facet, featureTags?.filters.find((filter) => filter.id === facet.id)?.labelJa ?? facet.id));
  const recommendation = preferenceMeta.mode === 'unset' ? null : scoreDish(dish, { ...preferences, scope: 'all' });
  const scoreMethodLabel = dish.scoreMethod ? taxonomy?.scoreMethods?.[dish.scoreMethod] : undefined;
  const dishSources = dish.publicSourceIds.map((id) => sources.find((source) => source.id === id)).filter((source) => source !== undefined);
  // The placement already has its own badge, so this line says where the dish
  // is from rather than repeating the badge.
  const locationText = dish.prefectureLabel
    ? `${dish.prefectureLabel} ${dish.city ?? ''}`.trim()
    : isStandard || isContemporary ? '地域を限定しないスタイル' : dish.country;
  const isWish = wishes.some((wish) => isConceptWish(wish, dish.id));
  const isCompared = compare.includes(dish.id);
  // Styles with no region search on the name alone; regional dishes carry
  // their prefecture into the query.
  const searchArea = dish.prefectureLabel ?? (isStandard || isContemporary ? '' : dish.country);
  const mapsSearchUrl = areaSearchLink(dish.name, searchArea);

  const saveRecord = () => {
    const safeDate = eatenAt || new Date().toISOString().slice(0, 10);
    addMeal(dish.id, {
      eatenAt: new Date(`${safeDate}T12:00:00`).toISOString(),
      rating,
      note: note.trim(),
      isFavorite: isFavoriteDraft
    });
    setNote('');
    setIsFavoriteDraft(false);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="page-container dish-page section-pad">
      <nav className="breadcrumb" aria-label="パンくず"><Link to="/explore">探す</Link><span>/</span><span aria-current="page">{dish.name}</span></nav>

      <p className="allergy-notice" role="note">
        {dish.allergenNote ? <><strong>一般的に含まれる可能性のある原材料:</strong> {dish.allergenNote}<br /></> : null}
        原材料、アレルギー対応、宗教上の食事対応は店舗ごとに異なります。上記は一般的な目安であり、健康や安全に関わる確認は、必ず利用する店舗へ直接お問い合わせください。
      </p>

      <section className="dish-hero">
        <div className="dish-hero-copy">
          <p className="eyebrow">{dish.categoryLabel}<ScopeBadge scope={dish.culturalScope} /></p>
          <h1>{dish.name}</h1>
          {dish.localName && dish.localName !== dish.name ? <p className="dish-local-name" lang="und">{dish.localName}</p> : null}
          <p className="dish-location">{locationText} / {dish.formLabel}</p>
          <p className="dish-lead">{dish.culture.summary}</p>
          {(isStandard || isContemporary) && (
            <dl className="dish-placement">
              <div><dt>位置づけ</dt><dd>{isStandard ? '全国で広く親しまれる定番スタイル' : '複数の店へ広がった現代のスタイル'}</dd></div>
              <div><dt>地域</dt><dd>特定の地域には属しません</dd></div>
            </dl>
          )}
          {headlineFeatures.length > 0 && (
            <div className="tag-row" aria-label="主な特徴">
              {headlineFeatures.map((feature) => <span className="tag" key={feature.raw}>{feature.labelJa}</span>)}
            </div>
          )}
          <div className="dish-primary-actions">
            <button type="button" className={isWish ? 'button button-primary is-selected' : 'button button-primary'} aria-pressed={isWish} onClick={() => toggleWish(dish.id)}>{isWish ? '食べたいに登録済み' : '食べたい'}</button>
            <ExternalLink href={mapsSearchUrl}>このスタイルのお店を地図で探す</ExternalLink>
            <Link className="button button-secondary" to="/places/new">自分のお店を追加</Link>
            <button type="button" className={isCompared ? 'button button-secondary is-selected' : 'button button-secondary'} aria-pressed={isCompared} onClick={() => toggleCompare(dish.id)}>{isCompared ? '比較対象から外す' : '比較する'}</button>
            <ExternalLink href={googleImageSearchUrl(dish)} className="button button-ghost">Google画像検索</ExternalLink>
          </div>
        </div>
        {recommendation ? <aside className="match-panel" aria-label="好みとの一致度">
          <p className="eyebrow">Taste match</p>
          <span>好みとの一致度</span><strong>{recommendation.score}</strong><small>/ 100</small>
          <h2>合いそうな理由</h2><ul>{recommendation.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
          {recommendation.differences.length > 0 ? <><h2>少し違う点</h2><ul>{recommendation.differences.map((difference) => <li key={difference}>{difference}</li>)}</ul></> : null}
          <Link className="text-link" to="/diagnosis">好みを調整する</Link>
        </aside> : null}
      </section>

      <div className="dish-content-grid">
        <div className="dish-main-column">
          <section className="content-section" aria-labelledby="taste-title"><h2 id="taste-title">味と香り</h2><TasteRadar dishes={[dish]} title={`${dish.name}の味覚プロファイル`} /></section>

          <section className="content-section" aria-labelledby="range-title">
            <div className="section-heading inline-heading"><div><h2 id="range-title">味の幅</h2><p>代表値と、店舗や地域による一般的な範囲です。</p></div></div>
            <div className="taste-range-list">
              {tasteKeys.map((key) => {
                const value = dish.taste[key];
                return <div className="taste-range-row" key={key}><span>{tasteLabels[key]}</span><div className="range-track" aria-label={`${tasteLabels[key]} 代表値${value.typical.toFixed(1)} 範囲${value.min.toFixed(1)}から${value.max.toFixed(1)}`}><span className="range-band" style={{ left: `${value.min * 20}%`, width: `${(value.max - value.min) * 20}%` }} /><span className="range-point" style={{ left: `${value.typical * 20}%` }} /></div><strong>{value.typical.toFixed(1)}</strong><small>{value.min.toFixed(1)}-{value.max.toFixed(1)}</small></div>;
              })}
            </div>
          </section>

          <section className="content-section two-column-facts" aria-labelledby="structure-title">
            <div><h2 id="structure-title">麺</h2><dl className="fact-list"><div><dt>原料</dt><dd>{dish.noodle.materials.join('、') || '情報整理中'}</dd></div><div><dt>形状</dt><dd>{dish.noodle.shape}</dd></div><div><dt>太さ</dt><dd>{dish.noodle.thickness.toFixed(1)} / 5</dd></div><div><dt>硬さ</dt><dd>{dish.noodle.firmness.toFixed(1)} / 5</dd></div><div><dt>もちもち感</dt><dd>{dish.noodle.chewiness.toFixed(1)} / 5</dd></div><div><dt>なめらかさ</dt><dd>{dish.noodle.smoothness.toFixed(1)} / 5</dd></div><div><dt>特徴</dt><dd>{dish.noodle.notes.join('、') || '店舗ごとの差があります'}</dd></div></dl></div>
            <div><h2>スープと味付け</h2><dl className="fact-list"><div><dt>主なベース</dt><dd>{dish.broth.bases.join('、') || '多様'}</dd></div><div><dt>主な味付け</dt><dd>{dish.broth.seasonings.join('、') || '多様'}</dd></div><div><dt>香り</dt><dd>{dish.broth.aromatics.join('、') || '店舗により異なる'}</dd></div><div><dt>具材</dt><dd>{dish.ingredients.join('、') || '店舗により異なる'}</dd></div></dl></div>
          </section>

          <section className="content-section" aria-labelledby="culture-title"><h2 id="culture-title">地域と文化</h2><p>{dish.culture.background}</p><div className="culture-meters"><span>伝統度 <strong>{dish.culture.tradition.toFixed(1)}</strong></span><span>地域独自性 <strong>{dish.culture.uniqueness.toFixed(1)}</strong></span><span>冒険度 <strong>{dish.culture.adventure.toFixed(1)}</strong></span></div><h3>店舗や地域による違い</h3><p>{dish.variation}</p></section>

          {featureGroups.length > 0 && (
            <section className="content-section" aria-labelledby="features-title">
              <div className="section-heading inline-heading"><div><h2 id="features-title">この料理の特徴</h2><p>探すページの「特徴から絞り込む」と同じ言葉で表しています。</p></div></div>
              <div className="feature-group-list">
                {featureGroups.map((group) => (
                  <div key={group.id}>
                    <h3>{group.labelJa}</h3>
                    <div className="tag-row">{group.tags.map((feature) => <span className="tag" key={feature.raw}>{feature.labelJa}</span>)}</div>
                  </div>
                ))}
              </div>
              {searchOnlyReasons.length > 0 && (
                <details className="facet-reasons">
                  <summary>数値から検索に使っている特徴（{searchOnlyReasons.length}件）</summary>
                  <ul>{searchOnlyReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
                  <p className="method-note">これらは味覚値と麺の指標からの推定です。公式にそう分類されているという意味ではありません。</p>
                </details>
              )}
            </section>
          )}

          {closeStyles.length > 0 && (
            <section className="content-section" aria-labelledby="close-styles-title">
              <div className="section-heading inline-heading"><div><h2 id="close-styles-title">近いスタイル</h2><p>{dish.relatedStyleIds.length ? '味や提供形式が近いスタイルです。麺の種類をまたぐものも含みます。' : 'この料理に近い、全国的な定番スタイルです。'}</p></div></div>
              <div className="card-grid">{closeStyles.map((item) => <DishCard key={item.id} dish={item} compact />)}</div>
            </section>
          )}

          {derivedStyles.length > 0 && (
            <section className="content-section" aria-labelledby="derived-title">
              <div className="section-heading inline-heading"><div><h2 id="derived-title">現代の派生スタイル</h2><p>このスタイルから広がった、比較的新しい技法や様式です。</p></div></div>
              <div className="card-grid">{derivedStyles.map((item) => <DishCard key={item.id} dish={item} compact />)}</div>
            </section>
          )}

          {regionalExamples.length > 0 && (
            <section className="content-section" aria-labelledby="examples-title">
              <div className="section-heading inline-heading"><div><h2 id="examples-title">代表例</h2><p>このスタイルを知るための、代表的なご当地・地域料理です。</p></div></div>
              <div className="card-grid">{regionalExamples.map((item) => <DishCard key={item.id} dish={item} compact />)}</div>
            </section>
          )}

          <section className="content-section" aria-labelledby="related-title"><div className="section-heading inline-heading"><div><h2 id="related-title">味・構造が近い料理</h2><p>味覚値と麺の指標から算出した近さです。歴史的な影響関係を意味するものではありません。</p></div></div><div className="card-grid">{related.map((item) => <DishCard key={item.id} dish={item} compact />)}</div></section>
        </div>

        <aside className="dish-side-column">
          <section className="side-card"><h2>ごちそうさまを記録</h2><p className="side-card-note">1回の食事ごとに記録します。同じ料理を何度でも残せます。</p><label>食べた日<input type="date" value={eatenAt} onChange={(event: ChangeEvent<HTMLInputElement>) => setEatenAt(event.target.value)} /></label><label>評価<select value={rating ?? ''} onChange={(event: ChangeEvent<HTMLSelectElement>) => setRating(event.target.value === '' ? null : Number(event.target.value))}><option value="">評価しない</option>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} / 5</option>)}</select></label><label>感想<textarea rows={5} value={note} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setNote(event.target.value)} placeholder="店名、印象、次に試したいことなど" /></label><label className="checkbox-label"><input type="checkbox" checked={isFavoriteDraft} onChange={(event: ChangeEvent<HTMLInputElement>) => setIsFavoriteDraft(event.target.checked)} />お気に入りにする</label><button type="button" className="button button-primary" onClick={saveRecord}>この一杯を記録する</button>{saved ? <p className="success-notice" role="status">記録を保存しました。</p> : null}{dishMeals.length > 0 ? <div className="meal-history"><h3>この料理の記録 ({dishMeals.length})</h3><ul>{dishMeals.map((meal) => <li key={meal.id}><span>{meal.eatenAt.slice(0, 10)}</span>{meal.rating ? <span>{meal.rating} / 5</span> : null}{meal.isFavorite ? <span aria-label="お気に入り">★</span> : null}<button type="button" className="link-button" onClick={() => removeMeal(meal.id)}>削除</button></li>)}</ul></div> : null}</section>

          <section className="side-card"><h2>お店を探す</h2><StyleShopSearch term={dish.name} defaultArea={searchArea} />{isStandard || isContemporary ? <p>このスタイルには特定の地域を割り当てていません。地域を入力すると、その周辺のお店を探せます。</p> : null}<p>営業時間、価格、点数は取得していません。見つけたお店は<Link to="/places/new">自分のお店</Link>として端末内に保存できます。</p></section>

          <section className="side-card"><h2>外部で探す</h2><ExternalLink href={googleImageSearchUrl(dish)}>Google画像検索</ExternalLink><ExternalLinkNote /></section>

          <section className="side-card sources-card"><h2>情報源</h2><ul>{dishSources.map((source) => <li key={source.id}>{source.url ? <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a> : <span>{source.title}</span>}<small>{source.publisher} / {source.note}</small></li>)}</ul><p className="method-note">{scoreMethodLabel ?? '味覚値と紹介文にはEpsilonLabによる編集データを含みます。'} 情報の確認状況: {dish.verificationLevel === 'reviewed' ? 'レビュー済み' : '基本確認'}。</p></section>
        </aside>
      </div>
    </div>
  );
}
