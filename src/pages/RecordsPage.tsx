import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { DishCard } from '../components/DishCard';
import { ErrorState, LoadingState } from '../components/LoadingState';
import { PlaceCard } from '../components/PlaceCard';
import { TabStrip } from '../components/TabStrip';
import { ActionRow } from '../components/ActionRow';
import { useCatalogData } from '../data/useCatalogData';
import { describeProfile } from '../recommendation/engine';
import { exportAppState, useAppStore } from '../state/store';
import { type Dish } from '../types/catalog';
import { wishConceptId, wishTargetLabels, type MealEntry, type WishEntry } from '../types/records';

type RecordTab = 'wishlist' | 'meals' | 'favorites' | 'places';

const tabs: { id: RecordTab; label: string }[] = [
  { id: 'wishlist', label: '食べたい' },
  { id: 'meals', label: 'ごちそうさま' },
  { id: 'favorites', label: 'お気に入り' },
  { id: 'places', label: 'お店' }
];

const isTab = (value: string | null): value is RecordTab => tabs.some((tab) => tab.id === value);

export default function RecordsPage() {
  const { catalog, loading, error } = useCatalogData();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const wishes = useAppStore((state) => state.wishes);
  const meals = useAppStore((state) => state.meals);
  const places = useAppStore((state) => state.places);
  const menus = useAppStore((state) => state.menus);
  const customConcepts = useAppStore((state) => state.customConcepts);
  const removeWishEntry = useAppStore((state) => state.removeWishEntry);
  const legacyFavoriteDishIds = useAppStore((state) => state.legacyFavoriteDishIds);
  const preferences = useAppStore((state) => state.preferences);
  const preferenceMeta = useAppStore((state) => state.preferenceMeta);
  const updateMeal = useAppStore((state) => state.updateMeal);
  const removeMeal = useAppStore((state) => state.removeMeal);
  const toggleMealFavorite = useAppStore((state) => state.toggleMealFavorite);
  const resolveLegacyFavorite = useAppStore((state) => state.resolveLegacyFavorite);
  const importState = useAppStore((state) => state.importState);
  const resetAll = useAppStore((state) => state.resetAll);
  const [notice, setNotice] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const tabParam = searchParams.get('tab');
  const tab: RecordTab = isTab(tabParam) ? tabParam : 'wishlist';
  const setTab = (next: RecordTab) => setSearchParams({ tab: next }, { replace: true });

  const dishById = useMemo(() => new Map(catalog.map((dish) => [dish.id, dish])), [catalog]);
  const favoriteMeals = useMemo(() => meals.filter((meal) => meal.isFavorite), [meals]);

  const stats = useMemo(() => {
    const eatenDishIds = new Set(meals.flatMap((meal) => meal.conceptIds));
    const eatenDishes = [...eatenDishIds].map((id) => dishById.get(id)).filter((dish): dish is Dish => dish !== undefined);
    // Regional Japanese dishes are the only ones that map onto a prefecture,
    // so standard styles never inflate the travel counters (spec 18.2).
    const regional = eatenDishes.filter((dish) => dish.domain === 'japan' && dish.culturalScope === 'regional');
    const byCategory = (category: string) => regional.filter((dish) => dish.noodleCategory === category).length;
    return {
      mealCount: meals.length,
      dishCount: eatenDishIds.size,
      favoriteCount: favoriteMeals.length,
      wishCount: wishes.length,
      prefectures: new Set(regional.flatMap((dish) => dish.prefectureCodes)).size,
      regions: new Set(regional.flatMap((dish) => dish.regionCodes)).size,
      ramen: byCategory('ramen'),
      udon: byCategory('udon'),
      soba: byCategory('soba'),
      yakisoba: byCategory('yakisoba'),
      standard: eatenDishes.filter((dish) => dish.culturalScope === 'standard').length,
      contemporary: eatenDishes.filter((dish) => dish.culturalScope === 'contemporary').length,
      countries: new Set(eatenDishes.filter((dish) => dish.domain === 'world').map((dish) => dish.country)).size,
      worldDishes: eatenDishes.filter((dish) => dish.domain === 'world').length
    };
  }, [meals, favoriteMeals, wishes, dishById]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  const profile = describeProfile(preferences);
  const scopeLabel = preferences.scope === 'japan' ? '日本' : preferences.scope === 'world' ? '世界' : 'すべて';

  const downloadBackup = () => {
    const blob = new Blob([exportAppState()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `noodle-voyage-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice('バックアップを書き出しました。');
  };

  const readBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      importState(JSON.parse(await file.text()));
      setNotice('バックアップを読み込みました。');
    } catch {
      setNotice('読み込めませんでした。Noodle Voyageで書き出したJSONか確認してください。');
    } finally {
      event.target.value = '';
    }
  };

  const reset = async () => {
    if (!window.confirm('食べたい、ごちそうさま、お気に入り、好み設定をすべて削除します。元に戻せません。')) return;
    await resetAll();
    setNotice('端末内の記録を削除しました。');
  };

  const renderMealCard = (meal: MealEntry) => {
    const dish = dishById.get(meal.conceptIds[0] ?? '');
    const isEditing = editingId === meal.id;
    // A meal may name a place or a title of its own instead of a catalog dish.
    const heading = dish?.name ?? meal.customTitle ?? meal.menuSnapshot?.name ?? meal.placeSnapshot?.name ?? '記録した一杯';
    return (
      <article className="meal-card" key={meal.id}>
        <div className="meal-card-head">
          <h3>{dish ? <Link to={`/dish/${dish.id}`}>{dish.name}</Link> : heading}</h3>
          <span className="meal-date">{meal.eatenAt.slice(0, 10)}</span>
        </div>
        {dish ? <p className="eyebrow">{dish.prefectureLabel ?? dish.country} / {dish.categoryLabel}</p> : null}
        <p className="meal-rating">{meal.rating ? `評価 ${meal.rating} / 5` : '評価なし'}</p>
        {meal.note ? <p className="meal-note">{meal.note.slice(0, 120)}{meal.note.length > 120 ? '…' : ''}</p> : null}
        <ActionRow
          label={heading}
          primary={{
            key: 'favorite',
            label: meal.isFavorite ? 'お気に入り済み' : 'お気に入りにする',
            pressed: meal.isFavorite,
            onSelect: () => toggleMealFavorite(meal.id)
          }}
          secondary={[
            { key: 'edit', label: isEditing ? '編集を閉じる' : '編集', onSelect: () => setEditingId(isEditing ? null : meal.id) },
            { key: 'remove', label: '削除', danger: true, onSelect: () => removeMeal(meal.id) }
          ]}
        />
        {isEditing ? (
          <div className="meal-edit">
            <label>食べた日<input type="date" value={meal.eatenAt.slice(0, 10)} onChange={(event: ChangeEvent<HTMLInputElement>) => updateMeal(meal.id, { eatenAt: new Date(`${event.target.value || meal.eatenAt.slice(0, 10)}T12:00:00`).toISOString() })} /></label>
            <label>評価<select value={meal.rating ?? ''} onChange={(event: ChangeEvent<HTMLSelectElement>) => updateMeal(meal.id, { rating: event.target.value === '' ? null : Number(event.target.value) })}><option value="">評価しない</option>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} / 5</option>)}</select></label>
            <label>感想<textarea rows={4} value={meal.note} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => updateMeal(meal.id, { note: event.target.value })} /></label>
          </div>
        ) : null}
      </article>
    );
  };

  // A wish can point at a catalog dish, a saved place, a saved menu or a dish
  // the reader named. Each keeps its own badge so the mixed list stays readable.
  const wishDish = (wish: WishEntry): Dish | undefined => dishById.get(wishConceptId(wish) ?? '');

  const renderWishRow = (wish: WishEntry) => {
    const place = wish.targetType === 'place' ? places.find((entry) => entry.id === wish.targetId) : undefined;
    const menu = wish.targetType === 'menu' ? menus.find((entry) => entry.id === wish.targetId) : undefined;
    const custom = wish.targetType === 'customConcept' ? customConcepts.find((entry) => entry.id === wish.targetId) : undefined;
    const menuPlace = menu ? places.find((entry) => entry.id === menu.placeId) : undefined;
    const title = place?.name ?? menu?.name ?? custom?.name ?? (wish.snapshot.title || '保存した一杯');
    const subtitle = place?.addressText ?? menuPlace?.name ?? custom?.note ?? wish.snapshot.subtitle;
    const href = place ? `/places/${place.id}` : menuPlace ? `/places/${menuPlace.id}` : null;
    return (
      <article className="wish-row" key={wish.id}>
        <div className="wish-row-head">
          <span className="record-kind-badge">{wishTargetLabels[wish.targetType]}</span>
          <h3>{href ? <Link to={href}>{title}</Link> : title}</h3>
        </div>
        {subtitle ? <p className="wish-row-sub">{subtitle}</p> : null}
        {wish.note ? <p className="wish-row-note">{wish.note}</p> : null}
        <ActionRow
          label={title}
          primary={href
            ? { key: 'open', label: '詳しく見る', onSelect: () => navigate(href) }
            : { key: 'remove', label: '食べたいから外す', onSelect: () => removeWishEntry(wish.id) }}
          secondary={href ? [{ key: 'remove', label: '食べたいから外す', danger: true, onSelect: () => removeWishEntry(wish.id) }] : []}
        />
      </article>
    );
  };

  return (
    <div className="page-container my-page section-pad">
      <header className="page-heading"><p className="eyebrow">Your records</p><h1>マイ記録</h1><p>食べたい一杯、食べた記録、お気に入り、自分で見つけたお店を、この端末だけに保存しています。</p></header>

      {notice ? <p className="success-notice" role="status">{notice}</p> : null}

      {legacyFavoriteDishIds.length > 0 ? (
        <section className="legacy-favorites" aria-labelledby="legacy-title">
          <h2 id="legacy-title">旧お気に入りの整理</h2>
          <p>以前のバージョンでお気に入りにしていた料理のうち、食べた記録がないものです。「食べたい」へ移すか、削除を選べます。</p>
          <ul>
            {legacyFavoriteDishIds.map((dishId) => {
              const dish = dishById.get(dishId);
              return (
                <li key={dishId}>
                  <span>{dish ? dish.name : dishId}</span>
                  <button type="button" className="card-action" onClick={() => resolveLegacyFavorite(dishId, 'wish')}>食べたいへ移す</button>
                  <button type="button" className="card-action" onClick={() => resolveLegacyFavorite(dishId, 'discard')}>削除</button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {preferenceMeta.mode !== 'unset' ? (
        <section className="profile-card" aria-labelledby="profile-title">
          <div className="profile-card-copy"><p className="eyebrow">Taste profile</p><h2 id="profile-title">あなたの味覚プロフィール</h2><div className="dna-tags">{profile.map((item) => <span key={item}>{item}</span>)}</div><Link className="button button-secondary" to="/diagnosis">プロフィールを調整する</Link></div>
          <dl className="profile-facts"><div><dt>冒険度</dt><dd>{preferences.adventure}<small>/100</small></dd></div><div><dt>検索対象</dt><dd className="profile-text-value">{scopeLabel}</dd></div><div><dt>避けたい特徴</dt><dd>{preferences.softAvoid.length + preferences.hardAvoid.length}<small>件</small></dd></div></dl>
        </section>
      ) : (
        <section className="profile-card" aria-labelledby="profile-title">
          <div className="profile-card-copy"><h2 id="profile-title">好み診断はまだ行っていません</h2><p>診断すると、好みとの一致度で料理を絞り込めます。</p><Link className="button button-primary" to="/diagnosis">好み診断を始める</Link></div>
        </section>
      )}

      <section className="passport-section" aria-labelledby="summary-title">
        <div className="section-heading"><p className="eyebrow">Summary</p><h2 id="summary-title">基本集計</h2></div>
        <div className="passport-grid">
          <article><span>ごちそうさま回数</span><strong>{stats.mealCount}</strong><small>回</small></article>
          <article><span>食べた料理数</span><strong>{stats.dishCount}</strong><small>種類</small></article>
          <article><span>お気に入り</span><strong>{stats.favoriteCount}</strong><small>件</small></article>
          <article><span>食べたい</span><strong>{stats.wishCount}</strong><small>件</small></article>
          <article><span>自分のお店</span><strong>{places.length}</strong><small>店</small></article>
          <article><span>自分のメニュー</span><strong>{menus.length}</strong><small>件</small></article>
        </div>
      </section>

      <section className="passport-section" aria-labelledby="japan-title">
        <div className="section-heading"><p className="eyebrow">Japan</p><h2 id="japan-title">日本麺めぐり</h2><p>ご当地料理の記録だけを集計します。定番スタイルは含みません。</p></div>
        <div className="passport-grid">
          <article><span>訪れた都道府県</span><strong>{stats.prefectures}</strong><small>/ 47</small><progress max="47" value={stats.prefectures} /></article>
          <article><span>訪れた地方</span><strong>{stats.regions}</strong><small>/ 8</small><progress max="8" value={stats.regions} /></article>
          <article><span>ご当地ラーメン</span><strong>{stats.ramen}</strong><small>件</small></article>
          <article><span>ご当地うどん</span><strong>{stats.udon}</strong><small>件</small></article>
          <article><span>ご当地そば</span><strong>{stats.soba}</strong><small>件</small></article>
          <article><span>ご当地焼きそば</span><strong>{stats.yakisoba}</strong><small>件</small></article>
        </div>
      </section>

      <section className="passport-section" aria-labelledby="world-title">
        <div className="section-heading"><p className="eyebrow">Styles and world</p><h2 id="world-title">スタイル図鑑と世界麺めぐり</h2></div>
        <div className="passport-grid">
          <article><span>定番スタイル</span><strong>{stats.standard}</strong><small>種類</small></article><article><span>現代スタイル</span><strong>{stats.contemporary}</strong><small>種類</small></article>
          <article><span>世界の国・地域</span><strong>{stats.countries}</strong><small>地域</small></article>
          <article><span>世界の料理</span><strong>{stats.worldDishes}</strong><small>種類</small></article>
        </div>
      </section>

      <section className="saved-section" aria-labelledby="saved-title">
        <div className="section-heading inline-heading">
          <div><p className="eyebrow">Records</p><h2 id="saved-title">保存した記録</h2></div>
          <TabStrip
            label="記録の種類"
            current={tab}
            onSelect={setTab}
            tabs={tabs.map((item) => ({
              ...item,
              count: item.id === 'wishlist' ? wishes.length
                : item.id === 'meals' ? meals.length
                  : item.id === 'favorites' ? favoriteMeals.length : places.length
            }))}
          />
        </div>

        {tab === 'wishlist' ? (
          wishes.length > 0
            ? (
              <div className="wish-mixed-grid">
                {wishes.map((wish) => {
                  const dish = wishDish(wish);
                  return dish ? <DishCard key={wish.id} dish={dish} compact /> : renderWishRow(wish);
                })}
              </div>
            )
            : <div className="empty-state"><h3>まだ「食べたい」がありません</h3><p>気になる料理を探して、カードのボタンから追加できます。お店やメニューも同じ一覧に並びます。</p><Link className="button button-primary" to="/explore">料理を探す</Link><Link className="button button-secondary" to="/places/new">お店・一杯を追加</Link></div>
        ) : null}

        {tab === 'meals' ? (
          meals.length > 0
            ? <div className="meal-grid">{[...meals].sort((a, b) => b.eatenAt.localeCompare(a.eatenAt)).map(renderMealCard)}</div>
            : <div className="empty-state"><h3>まだ「ごちそうさま」がありません</h3><p>食べた一杯を、料理詳細画面から記録できます。</p><Link className="button button-primary" to="/explore">料理を探す</Link></div>
        ) : null}

        {tab === 'favorites' ? (
          favoriteMeals.length > 0
            ? <div className="meal-grid">{[...favoriteMeals].sort((a, b) => b.eatenAt.localeCompare(a.eatenAt)).map(renderMealCard)}</div>
            : <div className="empty-state"><h3>まだお気に入りがありません</h3><p>お気に入りは「ごちそうさま」の記録から選びます。記録カードの「お気に入りにする」で追加できます。</p></div>
        ) : null}

        {tab === 'places' ? (
          <>
            <p className="privacy-notice" role="note">この情報は、この端末だけに保存されます。</p>
            {places.length > 0 ? (
              <>
                <div className="card-grid">
                  {[...places].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((place) => (
                    <PlaceCard key={place.id} place={place} records={{ menus, wishes, meals }} />
                  ))}
                </div>
                <p className="place-list-footer"><Link className="button button-primary" to="/places/new">お店・一杯を追加</Link></p>
              </>
            ) : (
              <div className="empty-state">
                <h3>気になる店を、自分のリストへ。</h3>
                <p>店名、メニュー名、地図や食べログのリンクを、自分の端末だけに保存できます。全国の店を網羅する必要はありません。</p>
                <Link className="button button-primary" to="/places/new">最初のお店を追加</Link>
                <a className="button button-secondary" href="https://www.google.com/maps/search/?api=1&amp;query=%E3%83%A9%E3%83%BC%E3%83%A1%E3%83%B3" target="_blank" rel="noopener noreferrer">Google マップで探す</a>
              </div>
            )}
          </>
        ) : null}
      </section>

      <section className="backup-section" aria-labelledby="backup-title"><div><h2 id="backup-title">記録のバックアップ</h2><p>アカウントやクラウドを使わないため、機種変更の前にJSONを書き出してください。感想を含むため、共有時は内容をご確認ください。</p></div><div className="backup-actions"><button type="button" className="button button-secondary" onClick={downloadBackup}>JSONを書き出す</button><button type="button" className="button button-secondary" onClick={() => fileInput.current?.click()}>JSONを読み込む</button><input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(event: ChangeEvent<HTMLInputElement>) => void readBackup(event)} /><button type="button" className="button button-danger" onClick={() => void reset()}>端末内データを削除</button></div></section>
    </div>
  );
}
