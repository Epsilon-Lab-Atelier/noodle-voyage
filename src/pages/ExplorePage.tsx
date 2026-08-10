import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { TasteMap, axisLabel, type TasteMapMode } from '../components/TasteMap';
import { DishCard } from '../components/DishCard';
import { ErrorState, LoadingState } from '../components/LoadingState';
import { JapanTileMap, WorldPointMap } from '../components/Maps';
import { ScopeTabs } from '../components/ScopeTabs';
import { useCatalogData } from '../data/useCatalogData';
import { FeatureFilterPicker } from '../features/explore/FeatureFilterPicker';
import { SelectedFeatureChips } from '../features/explore/SelectedFeatureChips';
import { dishFilterIds, featureSelectionParams, matchesFeatureSelection, normalizeFeatureFilters, type FeatureSelection } from '../features/explore/featureFilters';
import { matchesScope, scoreDish, tasteLabels } from '../recommendation/engine';
import { useAppStore } from '../state/store';
import { culturalScopeLabels, isPlaceless, noodleCategoryLabels, noodleKeys, tasteKeys, type CulturalScope, type Dish, type DishForm, type NoodleCategory, type RegionCode, type SearchScope, type TasteKey } from '../types/catalog';
import { categoryPresets, tasteMapPresets, type AxisKey } from '../utils/scatterLayout';

type ViewMode = 'cards' | 'map' | 'scatter';
type SortMode = 'match' | 'name' | 'region' | 'richness' | 'adventure';

const formOptions: Array<{ value: DishForm | ''; label: string }> = [
  { value: '', label: 'すべての提供形式' },
  { value: 'soup', label: '汁あり' },
  { value: 'dry', label: '汁なし・まぜ麺' },
  { value: 'dipping', label: 'つけ麺' },
  { value: 'cold', label: '冷製' },
  { value: 'fried', label: '炒め・焼き' },
  { value: 'instant', label: '即席麺文化' },
  { value: 'hybrid', label: '複合形式' },
  { value: 'stew', label: '煮込み' },
  { value: 'hot_pot', label: '鍋仕立て' },
  { value: 'sauce', label: 'たれ・つゆだく' }
];

const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase('ja');
const regionOrder: { code: RegionCode; name: string }[] = [
  { code: 'hokkaido', name: '北海道' },
  { code: 'tohoku', name: '東北' },
  { code: 'kanto', name: '関東' },
  { code: 'chubu', name: '中部' },
  { code: 'kinki', name: '近畿' },
  { code: 'chugoku', name: '中国' },
  { code: 'shikoku', name: '四国' },
  { code: 'kyushu_okinawa', name: '九州・沖縄' }
];
const prefectureNamesInOrder = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県', '茨城県', '栃木県', '群馬県',
  '埼玉県', '千葉県', '東京都', '神奈川県', '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県',
  '岐阜県', '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県',
  '鳥取県', '島根県', '岡山県', '広島県', '山口県', '徳島県', '香川県', '愛媛県', '高知県', '福岡県',
  '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'
];
const prefectureOrder = prefectureNamesInOrder.map((name, index) => ({ code: String(index + 1).padStart(2, '0'), name }));
const scopeValues: SearchScope[] = ['japan', 'world', 'all'];
const formValues: DishForm[] = ['soup', 'dry', 'dipping', 'cold', 'fried', 'instant', 'hybrid', 'stew', 'hot_pot', 'sauce'];
const validScope = (value: string | null, fallback: SearchScope): SearchScope => scopeValues.includes(value as SearchScope) ? value as SearchScope : fallback;
const validForm = (value: string | null): DishForm | '' => formValues.includes(value as DishForm) ? value as DishForm : '';
const categoryValues: NoodleCategory[] = ['ramen', 'udon', 'soba', 'yakisoba', 'world_noodle', 'other'];
const validCategory = (value: string | null): NoodleCategory | '' =>
  categoryValues.includes(value as NoodleCategory) ? value as NoodleCategory : '';
const culturalScopeValues: CulturalScope[] = ['regional', 'standard', 'contemporary', 'international'];
const validCulturalScope = (value: string | null): CulturalScope | '' =>
  culturalScopeValues.includes(value as CulturalScope) ? value as CulturalScope : '';
const validMatch = (value: string | null): number => {
  const parsed = Number(value ?? 0);
  return [60, 70, 80, 90].includes(parsed) ? parsed : 0;
};
const axisKeys: AxisKey[] = [...tasteKeys, ...noodleKeys];
const validAxisKey = (value: string | null, fallback: AxisKey): AxisKey =>
  axisKeys.includes(value as AxisKey) ? value as AxisKey : fallback;

export default function ExplorePage() {
  const { catalog, featureTags, facetIndex, loading, error } = useCatalogData();
  const preferences = useAppStore((state) => state.preferences);
  const preferenceMeta = useAppStore((state) => state.preferenceMeta);
  const hasProfile = preferenceMeta.mode !== 'unset';
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialView = searchParams.get('view');
  const [scope, setScope] = useState<SearchScope>(validScope(searchParams.get('scope'), preferences.scope));
  const [view, setView] = useState<ViewMode>(initialView === 'map' || initialView === 'scatter' ? initialView : 'cards');
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [region, setRegion] = useState(searchParams.get('region') ?? '');
  const [prefecture, setPrefecture] = useState(searchParams.get('prefecture') ?? '');
  const [country, setCountry] = useState(searchParams.get('country') ?? '');
  const [form, setForm] = useState<DishForm | ''>(validForm(searchParams.get('form')));
  const [features, setFeatures] = useState<FeatureSelection>({ selected: [], excluded: [] });
  const [category, setCategory] = useState<NoodleCategory | ''>(validCategory(searchParams.get('category')));
  const [culturalScope, setCulturalScope] = useState<CulturalScope | ''>(validCulturalScope(searchParams.get('culturalScope')));
  const [minimumMatch, setMinimumMatch] = useState(validMatch(searchParams.get('match')));
  const [sort, setSort] = useState<SortMode>(preferenceMeta.mode === 'unset' ? 'name' : 'match');
  const initialXKey = validAxisKey(searchParams.get('x'), 'richness');
  const initialYCandidate = validAxisKey(searchParams.get('y'), 'heat');
  const [xKey, setXKey] = useState<AxisKey>(initialXKey);
  const [yKey, setYKey] = useState<AxisKey>(
    initialYCandidate === initialXKey ? (initialXKey === 'heat' ? 'richness' : 'heat') : initialYCandidate
  );
  const [mapMode, setMapMode] = useState<TasteMapMode>('distribution');
  const [visibleCount, setVisibleCount] = useState(24);
  const [shareNotice, setShareNotice] = useState('');

  // The dictionary arrives with the catalog, so the URL is read into a feature
  // selection once it is available. A v2.2.0 `tag=` link converts here too.
  const featuresFromUrl = useMemo(
    () => normalizeFeatureFilters(
      { features: searchParams.get('features'), exclude: searchParams.get('exclude'), tag: searchParams.get('tag') },
      featureTags
    ),
    [featureTags, searchParams]
  );
  const [featuresRead, setFeaturesRead] = useState(false);
  useEffect(() => {
    if (featuresRead || !featureTags) return;
    setFeatures(featuresFromUrl);
    setFeaturesRead(true);
  }, [featureTags, featuresFromUrl, featuresRead]);

  const options = useMemo(() => ({
    regions: regionOrder.filter((entry) => catalog.some((dish) => dish.regionCodes.includes(entry.code))),
    prefectures: prefectureOrder.filter((entry) => catalog.some((dish) => dish.prefectureCodes.includes(entry.code))),
    countries: [...new Set(catalog.filter((dish) => dish.domain === 'world').map((dish) => dish.country))].sort((a, b) => a.localeCompare(b, 'ja'))
  }), [catalog]);

  // Everything except the feature selection, so the picker can show how many
  // dishes each feature would leave without counting itself out.
  const scopedDishes = useMemo(() => catalog.filter((dish) => {
    if (!matchesScope(dish, scope)) return false;
    if (form && dish.form !== form) return false;
    if (region && !dish.regionCodes.includes(region as RegionCode)) return false;
    if (category && dish.noodleCategory !== category) return false;
    if (culturalScope && dish.culturalScope !== culturalScope) return false;
    if (query) {
      const words = normalize(query).split(/\s+/).filter(Boolean);
      const searchable = normalize(`${dish.searchText} ${dish.categoryLabel} ${dish.formLabel} ${dish.culture.summary}`);
      if (!words.every((word) => searchable.includes(word))) return false;
    }
    return true;
  }), [catalog, scope, form, region, category, culturalScope, query]);

  const baseDishes = useMemo(
    () => scopedDishes.filter((dish) => matchesFeatureSelection(dish, features, featureTags, facetIndex)),
    [scopedDishes, features, featureTags, facetIndex]
  );

  const filtered = useMemo(() => {
    const values = baseDishes.filter((dish) => {
      if (prefecture && !dish.prefectureCodes.includes(prefecture)) return false;
      if (country && dish.country !== country) return false;
      return true;
    }).map((dish) => ({ dish, recommendation: hasProfile ? scoreDish(dish, { ...preferences, scope }) : null }))
      .filter((entry) => !minimumMatch || (entry.recommendation?.score ?? 0) >= minimumMatch);

    values.sort((a, b) => {
      if (sort === 'name') return a.dish.name.localeCompare(b.dish.name, 'ja');
      if (sort === 'region') return (a.dish.prefectureCodes[0] ?? '99').localeCompare(b.dish.prefectureCodes[0] ?? '99');
      if (sort === 'richness') return b.dish.taste.richness.typical - a.dish.taste.richness.typical;
      if (sort === 'adventure') return b.dish.culture.adventure - a.dish.culture.adventure;
      return (b.recommendation?.score ?? 0) - (a.recommendation?.score ?? 0);
    });
    return values;
  }, [baseDishes, prefecture, country, preferences, scope, sort]);

  // Standard styles carry no place, so they never appear on either map.
  const mappableDishes = baseDishes.filter((dish) => !isPlaceless(dish));

  // How many of the dishes that pass the other filters each feature would leave,
  // so an option that can only ever return nothing is shown as unavailable.
  const featureAvailability = useMemo(() => {
    const counts = new Map<string, number>();
    for (const dish of scopedDishes) {
      for (const filterId of dishFilterIds(dish, facetIndex)) {
        counts.set(filterId, (counts.get(filterId) ?? 0) + 1);
      }
    }
    return counts;
  }, [scopedDishes, facetIndex]);

  const toggleFeature = (filterId: string, mode: 'include' | 'exclude' | 'remove') => {
    setFeatures((current) => {
      const selected = current.selected.filter((id) => id !== filterId);
      const excluded = current.excluded.filter((id) => id !== filterId);
      if (mode === 'include' && !current.selected.includes(filterId)) selected.push(filterId);
      if (mode === 'exclude' && !current.excluded.includes(filterId)) excluded.push(filterId);
      return { selected, excluded };
    });
    setVisibleCount(24);
  };

  const allPresets = [...tasteMapPresets, ...categoryPresets];
  const activePresetId = allPresets.find((preset) => preset.xKey === xKey && preset.yKey === yKey)?.id ?? null;

  const changeXKey = (next: AxisKey) => {
    if (next === yKey) setYKey(xKey);
    setXKey(next);
  };

  const changeYKey = (next: AxisKey) => {
    if (next === xKey) setXKey(yKey);
    setYKey(next);
  };

  const setScopeAndReset = (nextScope: SearchScope) => {
    setScope(nextScope);
    setPrefecture('');
    setCountry('');
    setRegion('');
    setVisibleCount(24);
  };

  const resetFilters = () => {
    setQuery('');
    setRegion('');
    setPrefecture('');
    setCountry('');
    setForm('');
    setFeatures({ selected: [], excluded: [] });
    setCategory('');
    setCulturalScope('');
    setMinimumMatch(0);
    setVisibleCount(24);
  };

  const shareFilters = async () => {
    const params = new URLSearchParams();
    params.set('view', view);
    params.set('scope', scope);
    if (query) params.set('q', query);
    if (region) params.set('region', region);
    if (prefecture) params.set('prefecture', prefecture);
    if (country) params.set('country', country);
    if (form) params.set('form', form);
    const featureParams = featureSelectionParams(features);
    if (featureParams.features) params.set('features', featureParams.features);
    if (featureParams.exclude) params.set('exclude', featureParams.exclude);
    if (category) params.set('category', category);
    if (culturalScope) params.set('culturalScope', culturalScope);
    if (minimumMatch) params.set('match', String(minimumMatch));
    if (view === 'scatter') {
      params.set('x', xKey);
      params.set('y', yKey);
    }
    setSearchParams(params, { replace: true });
    const url = `${window.location.origin}${window.location.pathname}#/explore?${params.toString()}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareNotice('現在の検索条件をクリップボードへコピーしました。');
    } catch {
      window.history.replaceState(null, '', url);
      setShareNotice('URLへ検索条件を反映しました。アドレス欄から共有できます。');
    }
    window.setTimeout(() => setShareNotice(''), 3500);
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="page-container explore-page section-pad">
      <header className="page-heading">
        <p className="eyebrow">Explore</p>
        <h1>好みの一杯を探す</h1>
        <p>名前を知らなくても、地域、スープ、麺、味の特徴から絞り込めます。相性順は保存した味覚プロフィールを反映します。</p>
      </header>

      <section className="filter-panel" aria-labelledby="filter-title">
        <div className="filter-panel-top">
          <div>
            <h2 id="filter-title">検索条件</h2>
            <ScopeTabs value={scope} onChange={setScopeAndReset} />
          </div>
          <div className="filter-actions">
            <button type="button" className="button button-ghost" onClick={resetFilters}>条件をリセット</button>
            <button type="button" className="button button-secondary" onClick={() => void shareFilters()}>条件を共有</button>
          </div>
        </div>
        {shareNotice && <p className="success-notice" role="status">{shareNotice}</p>}
        <div className="filter-grid">
          <label className="wide-field">名称・特徴を検索
            <input type="search" value={query} onChange={(event: ChangeEvent<HTMLInputElement>) => { setQuery(event.target.value); setVisibleCount(24); }} placeholder="例: 煮干し 細麺、辛い 米麺" />
          </label>
          <label>麺の種類
            <select value={category} onChange={(event: ChangeEvent<HTMLSelectElement>) => { setCategory(event.target.value as NoodleCategory | ''); setVisibleCount(24); }}><option value="">すべての麺の種類</option>{(Object.keys(noodleCategoryLabels) as NoodleCategory[]).map((value) => <option key={value} value={value}>{noodleCategoryLabels[value]}</option>)}</select>
          </label>
          <label>位置づけ
            <select value={culturalScope} onChange={(event: ChangeEvent<HTMLSelectElement>) => { setCulturalScope(event.target.value as CulturalScope | ''); setVisibleCount(24); }}><option value="">すべての位置づけ</option>{culturalScopeValues.map((value) => <option key={value} value={value}>{culturalScopeLabels[value]}</option>)}</select>
          </label>
          {(scope === 'japan' || scope === 'all') && <label>地方
            <select value={region} onChange={(event: ChangeEvent<HTMLSelectElement>) => { const value = event.target.value; setRegion(value); if (value) setCountry(''); setVisibleCount(24); }}><option value="">すべての地方</option>{options.regions.map((entry) => <option key={entry.code} value={entry.code}>{entry.name}</option>)}</select>
          </label>}
          {(scope === 'japan' || scope === 'all') && <label>都道府県
            <select value={prefecture} onChange={(event: ChangeEvent<HTMLSelectElement>) => { const value = event.target.value; setPrefecture(value); if (value) setCountry(''); setVisibleCount(24); }}><option value="">すべての都道府県</option>{options.prefectures.map((entry) => <option key={entry.code} value={entry.code}>{entry.name}</option>)}</select>
          </label>}
          {(scope === 'world' || scope === 'all') && <label>国・地域
            <select value={country} onChange={(event: ChangeEvent<HTMLSelectElement>) => { const value = event.target.value; setCountry(value); if (value) { setRegion(''); setPrefecture(''); } setVisibleCount(24); }}><option value="">すべての国・地域</option>{options.countries.map((value) => <option key={value}>{value}</option>)}</select>
          </label>}
          <label>提供形式
            <select value={form} onChange={(event: ChangeEvent<HTMLSelectElement>) => { setForm(event.target.value as DishForm | ''); setVisibleCount(24); }}>{formOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
          </label>
          {hasProfile ? (
            <label>好みとの一致度
              <select value={minimumMatch} onChange={(event: ChangeEvent<HTMLSelectElement>) => { setMinimumMatch(Number(event.target.value)); setVisibleCount(24); }}><option value="0">指定なし</option><option value="60">60点以上</option><option value="70">70点以上</option><option value="80">80点以上</option><option value="90">90点以上</option></select>
            </label>
          ) : (
            <p className="filter-hint">好み診断を行うと、一致度で絞り込めます。</p>
          )}
          <label>並び順
            <select value={sort} onChange={(event: ChangeEvent<HTMLSelectElement>) => setSort(event.target.value as SortMode)}>{hasProfile ? <option value="match">好みとの一致度が高い順</option> : null}<option value="name">名称順</option><option value="region">地域順</option><option value="richness">濃厚な順</option><option value="adventure">冒険度順</option></select>
          </label>
        </div>

        <div className="feature-filter-section" aria-labelledby="feature-filter-title">
          <div className="section-heading inline-heading">
            <div>
              <h3 id="feature-filter-title">特徴から絞り込む</h3>
              <p>同じ枠の中はどれか一つ、枠をまたぐ場合はすべてに当てはまる料理を表示します。除外を選ぶと、その特徴を持つ料理を隠します。</p>
            </div>
          </div>
          <SelectedFeatureChips
            selection={features}
            taxonomy={featureTags}
            onRemove={(filterId) => { toggleFeature(filterId, 'remove'); }}
            onClear={() => { setFeatures({ selected: [], excluded: [] }); setVisibleCount(24); }}
          />
          <FeatureFilterPicker
            taxonomy={featureTags}
            selection={features}
            availability={featureAvailability}
            onToggle={toggleFeature}
          />
        </div>
      </section>

      <div className="results-toolbar">
        <p><strong>{filtered.length}</strong>件が見つかりました</p>
        <div className="segmented-control" role="group" aria-label="表示方法">
          {([['cards', 'カード'], ['map', '地図'], ['scatter', '味覚マップ']] as Array<[ViewMode, string]>).map(([value, label]) => <button type="button" key={value} className={view === value ? 'is-active' : ''} aria-pressed={view === value} onClick={() => setView(value)}>{label}</button>)}
        </div>
      </div>

      {view === 'cards' && (
        <section aria-label="検索結果">
          <div className="card-grid">
            {filtered.slice(0, visibleCount).map(({ dish, recommendation }) => <DishCard key={dish.id} dish={dish} recommendation={recommendation ?? undefined} compact />)}
          </div>
          {filtered.length === 0 && <p className="empty-state">条件に合う料理がありません。地域または特徴を少し広げてください。</p>}
          {filtered.length > visibleCount && <div className="center-actions"><button type="button" className="button button-secondary" onClick={() => setVisibleCount((count) => count + 24)}>さらに24件を見る</button></div>}
        </section>
      )}

      {view === 'map' && (
        <section className="visual-explorer" aria-labelledby="map-title">
          <div className="visual-heading"><div><h2 id="map-title">地域から探す</h2><p>収録料理のある地域だけを選べます。</p></div></div>
          {mappableDishes.length === 0 && baseDishes.length > 0 && (
            <p className="empty-state" role="status">定番スタイルと現代スタイルには特定の地域を割り当てていません。一覧または味覚マップからご覧ください。</p>
          )}
          {(scope === 'japan' || (scope === 'all' && !country)) && <JapanTileMap dishes={mappableDishes.filter((dish) => dish.domain === 'japan')} selected={prefecture} onSelect={(value) => { setPrefecture(value); setCountry(''); }} />}
          {(scope === 'world' || scope === 'all') && <WorldPointMap dishes={mappableDishes.filter((dish) => dish.domain === 'world')} selected={country} onSelect={(value) => { setCountry(value); if (value) setPrefecture(''); }} />}
          {(prefecture || country) && <div className="map-result-list"><h3>{prefecture || country}の料理</h3><div className="card-grid">{filtered.slice(0, 12).map(({ dish, recommendation }) => <DishCard key={dish.id} dish={dish} recommendation={recommendation ?? undefined} compact />)}</div></div>}
        </section>
      )}

      {view === 'scatter' && (
        <section className="visual-explorer taste-map-explorer" aria-labelledby="scatter-title">
          <div className="visual-heading scatter-heading">
            <div>
              <h2 id="scatter-title">味覚マップ</h2>
              <p>まずは見方を選び、気になった点から料理の詳細へ進めます。現在の検索条件に合う料理は、件数にかかわらずすべてプロットされます。</p>
            </div>
          </div>

          <div className="taste-map-controls">
            <section className="taste-preset-section" aria-labelledby="taste-preset-title">
              <div className="control-copy">
                <h3 id="taste-preset-title">おすすめの見方</h3>
                <p>比べたい特徴が決まっていないときは、次の組み合わせから選んでください。</p>
              </div>
              <div className="taste-preset-grid">
                {allPresets.map((preset) => (
                  <button
                    type="button"
                    key={preset.id}
                    className={`taste-preset-button${activePresetId === preset.id ? ' is-active' : ''}`}
                    aria-pressed={activePresetId === preset.id}
                    onClick={() => { setXKey(preset.xKey); setYKey(preset.yKey); }}
                  >
                    <strong>{preset.label}</strong>
                    <span>{preset.description}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="custom-axis-section" aria-labelledby="custom-axis-title">
              <div className="control-copy">
                <h3 id="custom-axis-title">自由に組み合わせる</h3>
                <p>17種類の味覚指標と6種類の麺指標から、横軸と縦軸を自由に選べます。同じ項目を選ぶと、もう一方の軸と自動で入れ替わります。</p>
              </div>
              <div className="axis-controls">
                <label>横軸
                  <select value={xKey} onChange={(event: ChangeEvent<HTMLSelectElement>) => changeXKey(event.target.value as AxisKey)}>
                    {axisKeys.map((key) => <option key={key} value={key}>{axisLabel(key)}</option>)}
                  </select>
                </label>
                <label>縦軸
                  <select value={yKey} onChange={(event: ChangeEvent<HTMLSelectElement>) => changeYKey(event.target.value as AxisKey)}>
                    {axisKeys.map((key) => <option key={key} value={key}>{axisLabel(key)}</option>)}
                  </select>
                </label>
                <fieldset className="map-mode-fieldset"><legend>表示モード</legend>
                  <label className="check-row"><input type="radio" name="map-mode" checked={mapMode === 'distribution'} onChange={() => setMapMode('distribution')} />分布を見る</label>
                  <label className="check-row"><input type="radio" name="map-mode" checked={mapMode === 'individual'} onChange={() => setMapMode('individual')} />料理を一件ずつ見る</label>
                </fieldset>
              </div>
            </section>
          </div>

          <TasteMap dishes={filtered.map((item) => item.dish)} xKey={xKey} yKey={yKey} mode={mapMode} onSelectDish={(id) => navigate(`/dish/${id}`)} />
          <p className="method-note">数値は0から5の独自分類です。味の幅は店舗や地域による一般的な違いを示し、測定誤差そのものではありません。</p>
        </section>
      )}
    </div>
  );
}
