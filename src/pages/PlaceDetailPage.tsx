import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ActionRow } from '../components/ActionRow';
import { ExternalLink, ExternalLinkNote } from '../components/ExternalLink';
import { ErrorState } from '../components/LoadingState';
import { useCatalogData } from '../data/useCatalogData';
import { placeLocationLabel, summarizePlace } from '../features/places/placeSummary';
import { checkUrl, googleMapsDirectionsLink, googleMapsSearchLink } from '../features/places/urlSafety';
import { useAppStore } from '../state/store';
import {
  menuAvailabilityLabels,
  placeStatusLabels,
  type MenuAvailability,
  type MenuRecord,
  type PlaceStatus
} from '../types/records';

export default function PlaceDetailPage() {
  const { placeId = '' } = useParams();
  const navigate = useNavigate();
  const { catalog } = useCatalogData();
  const places = useAppStore((state) => state.places);
  const menus = useAppStore((state) => state.menus);
  const wishes = useAppStore((state) => state.wishes);
  const meals = useAppStore((state) => state.meals);
  const updatePlace = useAppStore((state) => state.updatePlace);
  const removePlace = useAppStore((state) => state.removePlace);
  const addMenu = useAppStore((state) => state.addMenu);
  const removeMenu = useAppStore((state) => state.removeMenu);
  const addTargetWish = useAppStore((state) => state.addTargetWish);
  const removeWishEntry = useAppStore((state) => state.removeWishEntry);
  const addTargetMeal = useAppStore((state) => state.addTargetMeal);

  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState('');
  const [menuName, setMenuName] = useState('');
  const [menuConceptId, setMenuConceptId] = useState('');
  const [menuPrice, setMenuPrice] = useState('');
  const [menuAvailability, setMenuAvailability] = useState<MenuAvailability>('unknown');
  const [urlError, setUrlError] = useState('');

  const place = places.find((entry) => entry.id === placeId);
  const placeMenus = useMemo(() => menus.filter((menu) => menu.placeId === placeId), [menus, placeId]);
  const placeMeals = useMemo(
    () => meals.filter((meal) => meal.placeId === placeId).sort((a, b) => b.eatenAt.localeCompare(a.eatenAt)),
    [meals, placeId]
  );
  const dishById = useMemo(() => new Map(catalog.map((dish) => [dish.id, dish])), [catalog]);

  if (!place) return <ErrorState message="このお店は見つかりませんでした。削除された可能性があります。" />;

  const summary = summarizePlace(place.id, { menus, wishes, meals });
  const placeWish = wishes.find((wish) => wish.targetType === 'place' && wish.targetId === place.id);
  const mapsUrl = place.googleMapsUrl
    ?? googleMapsSearchLink([place.name, place.addressText ?? ''].filter(Boolean).join(' '), place.googlePlaceId);
  const directionsUrl = googleMapsDirectionsLink(
    [place.name, place.addressText ?? ''].filter(Boolean).join(' '),
    place.googlePlaceId
  );

  const externalLinks = [
    { label: '地図で開く', href: mapsUrl },
    { label: '経路を調べる', href: directionsUrl },
    place.tabelogUrl ? { label: '食べログを開く', href: place.tabelogUrl } : null,
    place.officialUrl ? { label: '公式サイトを開く', href: place.officialUrl } : null
  ].filter((link) => link !== null);

  const saveField = (key: 'name' | 'addressText' | 'note', value: string) => {
    updatePlace(place.id, { [key]: key === 'name' ? value.trim() : value.trim() || null });
  };

  const saveUrl = (key: 'googleMapsUrl' | 'tabelogUrl' | 'officialUrl', value: string) => {
    const kind = key === 'googleMapsUrl' ? 'googleMaps' : key === 'tabelogUrl' ? 'tabelog' : 'any';
    const result = checkUrl(value, kind);
    if (!result.ok) {
      setUrlError(result.message);
      return;
    }
    setUrlError('');
    updatePlace(place.id, { [key]: result.value });
  };

  const submitMenu = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!menuName.trim()) return;
    addMenu({
      placeId: place.id,
      name: menuName.trim(),
      conceptIds: menuConceptId ? [menuConceptId] : [],
      customConceptId: null,
      featureFilterIds: [],
      priceText: menuPrice.trim() || null,
      availability: menuAvailability,
      note: null,
      sourceLinks: []
    });
    setMenuName('');
    setMenuConceptId('');
    setMenuPrice('');
    setMenuAvailability('unknown');
    setNotice('メニューを追加しました。');
  };

  const recordMeal = (menu: MenuRecord | null) => {
    addTargetMeal(
      { conceptIds: menu?.conceptIds ?? [], placeId: place.id, menuId: menu?.id ?? null },
      { eatenAt: new Date().toISOString(), rating: null, note: '', isFavorite: false }
    );
    setNotice(menu ? `「${menu.name}」のごちそうさまを記録しました。` : 'ごちそうさまを記録しました。');
  };

  const deletePlace = () => {
    if (!window.confirm(`「${place.name}」と、そのメニューを削除します。食べた記録は残ります。`)) return;
    removePlace(place.id);
    navigate('/records?tab=places', { replace: true });
  };

  return (
    <div className="page-container place-detail-page section-pad">
      <nav className="breadcrumb" aria-label="パンくず">
        <Link to="/records?tab=places">自分のお店</Link><span>/</span><span aria-current="page">{place.name}</span>
      </nav>

      {notice ? <p className="success-notice" role="status">{notice}</p> : null}

      <header className="page-heading">
        <p className="eyebrow">自分のお店{place.status !== 'unknown' ? ` / ${placeStatusLabels[place.status]}` : ''}</p>
        <h1>{place.name}</h1>
        <p>{placeLocationLabel(place)}</p>
      </header>

      <p className="privacy-notice" role="note">この情報は、この端末だけに保存されます。</p>

      <ActionRow
        label={place.name}
        primary={{ key: 'meal', label: 'ごちそうさまを記録', onSelect: () => recordMeal(null) }}
        secondary={[
          {
            key: 'wish',
            label: placeWish ? '食べたいから外す' : '食べたい',
            pressed: placeWish !== undefined,
            onSelect: () => (placeWish
              ? removeWishEntry(placeWish.id)
              : addTargetWish('place', place.id, { title: place.name, subtitle: placeLocationLabel(place) }))
          },
          { key: 'maps', label: 'Google マップで見る', href: mapsUrl },
          { key: 'edit', label: editing ? '編集を閉じる' : 'この店の情報を編集', onSelect: () => setEditing((open) => !open) },
          { key: 'delete', label: 'このお店を削除', danger: true, onSelect: deletePlace }
        ]}
      />

      <section className="content-section" aria-labelledby="links-title">
        <h2 id="links-title">外部で開く</h2>
        <div className="external-link-row">
          {externalLinks.map((link) => (
            <ExternalLink key={link.label} href={link.href}>{link.label}</ExternalLink>
          ))}
        </div>
        <ExternalLinkNote />
        <p className="method-note">営業時間、価格、点数は取得していません。</p>
      </section>

      {editing ? (
        <section className="content-section place-edit" aria-labelledby="edit-title">
          <h2 id="edit-title">お店の情報</h2>
          <label>店名<input type="text" defaultValue={place.name} onBlur={(event: ChangeEvent<HTMLInputElement>) => saveField('name', event.target.value)} /></label>
          <label>住所または地域<input type="text" defaultValue={place.addressText ?? ''} onBlur={(event: ChangeEvent<HTMLInputElement>) => saveField('addressText', event.target.value)} /></label>
          <label>Google マップのURL<input type="url" defaultValue={place.googleMapsUrl ?? ''} onBlur={(event: ChangeEvent<HTMLInputElement>) => saveUrl('googleMapsUrl', event.target.value)} /></label>
          <label>食べログのURL<input type="url" defaultValue={place.tabelogUrl ?? ''} onBlur={(event: ChangeEvent<HTMLInputElement>) => saveUrl('tabelogUrl', event.target.value)} /></label>
          <label>公式サイトのURL<input type="url" defaultValue={place.officialUrl ?? ''} onBlur={(event: ChangeEvent<HTMLInputElement>) => saveUrl('officialUrl', event.target.value)} /></label>
          {urlError ? <p className="field-error" role="alert">{urlError}</p> : null}
          <label>
            営業の状態
            <select value={place.status} onChange={(event: ChangeEvent<HTMLSelectElement>) => updatePlace(place.id, { status: event.target.value as PlaceStatus })}>
              {Object.entries(placeStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>メモ<textarea rows={3} defaultValue={place.note ?? ''} onBlur={(event: ChangeEvent<HTMLTextAreaElement>) => saveField('note', event.target.value)} /></label>
          <p className="field-hint">入力欄から離れると保存されます。</p>
        </section>
      ) : null}

      <section className="content-section" aria-labelledby="menus-title">
        <div className="section-heading inline-heading">
          <div><h2 id="menus-title">メニュー</h2><p>この店で気になる一杯、食べた一杯を残せます。</p></div>
          <p className="place-summary-line">メニュー {summary.menuCount} / 食べたい {summary.wishCount} / ごちそうさま {summary.mealCount}</p>
        </div>

        {placeMenus.length > 0 ? (
          <ul className="menu-list">
            {placeMenus.map((menu) => {
              const menuWish = wishes.find((wish) => wish.targetType === 'menu' && wish.targetId === menu.id);
              const concept = dishById.get(menu.conceptIds[0] ?? '');
              return (
                <li key={menu.id} className="menu-row">
                  <div>
                    <h3>{menu.name}</h3>
                    <p className="menu-meta">
                      {concept ? <Link to={`/dish/${concept.id}`}>{concept.name}</Link> : <span>料理と未接続</span>}
                      {menu.priceText ? <span>{menu.priceText}</span> : null}
                      <span>{menuAvailabilityLabels[menu.availability]}</span>
                    </p>
                    {menu.note ? <p className="menu-note">{menu.note}</p> : null}
                  </div>
                  <ActionRow
                    label={menu.name}
                    primary={{ key: 'meal', label: 'ごちそうさまを記録', onSelect: () => recordMeal(menu) }}
                    secondary={[
                      {
                        key: 'wish',
                        label: menuWish ? '食べたいから外す' : '食べたい',
                        pressed: menuWish !== undefined,
                        onSelect: () => (menuWish
                          ? removeWishEntry(menuWish.id)
                          : addTargetWish('menu', menu.id, { title: menu.name, subtitle: place.name }))
                      },
                      { key: 'remove', label: 'このメニューを削除', danger: true, onSelect: () => removeMenu(menu.id) }
                    ]}
                  />
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="empty-state"><h3>まだメニューがありません</h3><p>気になる一杯の名前だけでも残せます。</p></div>
        )}

        <form className="menu-form" onSubmit={submitMenu}>
          <h3>メニューを追加</h3>
          <label>メニュー名<input type="text" value={menuName} required onChange={(event: ChangeEvent<HTMLInputElement>) => setMenuName(event.target.value)} placeholder="例: 中華そば" /></label>
          <label>
            近い料理・スタイル
            <select value={menuConceptId} onChange={(event: ChangeEvent<HTMLSelectElement>) => setMenuConceptId(event.target.value)}>
              <option value="">選ばない</option>
              {catalog.map((dish) => <option key={dish.id} value={dish.id}>{dish.name}（{dish.prefectureLabel ?? dish.country}）</option>)}
            </select>
          </label>
          <label>価格のメモ<input type="text" value={menuPrice} onChange={(event: ChangeEvent<HTMLInputElement>) => setMenuPrice(event.target.value)} placeholder="例: 900円" /></label>
          <label>
            提供の状況
            <select value={menuAvailability} onChange={(event: ChangeEvent<HTMLSelectElement>) => setMenuAvailability(event.target.value as MenuAvailability)}>
              {Object.entries(menuAvailabilityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <button type="submit" className="button button-primary">メニューを追加</button>
        </form>
      </section>

      {placeMeals.length > 0 ? (
        <section className="content-section" aria-labelledby="place-meals-title">
          <h2 id="place-meals-title">このお店の記録（{placeMeals.length}）</h2>
          <ul className="place-meal-list">
            {placeMeals.map((meal) => (
              <li key={meal.id}>
                <span className="meal-date">{meal.eatenAt.slice(0, 10)}</span>
                <span>{meal.menuSnapshot?.name ?? meal.customTitle ?? dishById.get(meal.conceptIds[0] ?? '')?.name ?? 'この店の一杯'}</span>
                {meal.rating ? <span>{meal.rating} / 5</span> : null}
                {meal.isFavorite ? <span aria-label="お気に入り">★</span> : null}
              </li>
            ))}
          </ul>
          <p className="method-note">記録の編集と削除は<Link to="/records?tab=meals">保存</Link>のごちそうさまタブから行えます。</p>
        </section>
      ) : null}
    </div>
  );
}
