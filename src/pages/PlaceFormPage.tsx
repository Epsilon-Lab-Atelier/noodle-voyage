import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCatalogData } from '../data/useCatalogData';
import { findDuplicatePlaces, type DuplicateMatch } from '../features/places/duplicateCheck';
import { checkUrl } from '../features/places/urlSafety';
import { useAppStore } from '../state/store';
import {
  menuAvailabilityLabels,
  placeStatusLabels,
  type MenuAvailability,
  type PlaceStatus
} from '../types/records';

type Step = 1 | 2 | 3;
type Destination = 'none' | 'wish' | 'meal';

const stepLabels: Record<Step, string> = { 1: 'お店', 2: '一杯', 3: '保存先' };

interface UrlField {
  key: 'googleMapsUrl' | 'tabelogUrl' | 'officialUrl';
  label: string;
  kind: 'googleMaps' | 'tabelog' | 'any';
  hint: string;
}

const urlFields: UrlField[] = [
  { key: 'googleMapsUrl', label: 'Google マップのURL', kind: 'googleMaps', hint: 'https から始まるGoogle マップのURLだけを保存します。' },
  { key: 'tabelogUrl', label: '食べログのURL', kind: 'tabelog', hint: '店舗ページのURLを貼り付けられます。点数や口コミは取得しません。' },
  { key: 'officialUrl', label: '公式サイトのURL', kind: 'any', hint: 'https から始まるURLのみ保存します。' }
];

export default function PlaceFormPage() {
  const navigate = useNavigate();
  const { catalog } = useCatalogData();
  const places = useAppStore((state) => state.places);
  const addPlace = useAppStore((state) => state.addPlace);
  const addMenu = useAppStore((state) => state.addMenu);
  const addTargetWish = useAppStore((state) => state.addTargetWish);
  const addTargetMeal = useAppStore((state) => state.addTargetMeal);

  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState('');
  const [addressText, setAddressText] = useState('');
  const [urls, setUrls] = useState({ googleMapsUrl: '', tabelogUrl: '', officialUrl: '' });
  const [status, setStatus] = useState<PlaceStatus>('unknown');
  const [placeNote, setPlaceNote] = useState('');
  const [urlErrors, setUrlErrors] = useState<Record<string, string>>({});
  const [nameError, setNameError] = useState('');
  const [duplicates, setDuplicates] = useState<DuplicateMatch[] | null>(null);

  const [menuName, setMenuName] = useState('');
  const [conceptId, setConceptId] = useState('');
  const [priceText, setPriceText] = useState('');
  const [availability, setAvailability] = useState<MenuAvailability>('unknown');
  const [menuNote, setMenuNote] = useState('');

  const [destination, setDestination] = useState<Destination>('none');
  const [eatenAt, setEatenAt] = useState(new Date().toISOString().slice(0, 10));
  const [rating, setRating] = useState<number | null>(null);
  const [mealNote, setMealNote] = useState('');

  const conceptOptions = useMemo(
    () => catalog.map((dish) => ({ id: dish.id, label: `${dish.name}（${dish.prefectureLabel ?? dish.country}）` })),
    [catalog]
  );

  const validateUrls = (): boolean => {
    const errors: Record<string, string> = {};
    for (const field of urlFields) {
      const result = checkUrl(urls[field.key], field.kind);
      if (!result.ok) errors[field.key] = result.message;
    }
    setUrlErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const readyForStepTwo = (): boolean => {
    if (!name.trim()) {
      setNameError('店名を入力してください。');
      return false;
    }
    setNameError('');
    return validateUrls();
  };

  const goToStepTwo = () => {
    if (!readyForStepTwo()) return;
    // A look-alike is reported, never merged: the reader decides (spec 10.3).
    const matches = findDuplicatePlaces(
      { name, addressText, googleMapsUrl: urls.googleMapsUrl || null },
      places
    );
    if (matches.length > 0 && duplicates === null) {
      setDuplicates(matches);
      return;
    }
    setStep(2);
  };

  const savedUrl = (key: UrlField['key'], kind: UrlField['kind']): string | null => checkUrl(urls[key], kind).value;

  const save = (): void => {
    if (!readyForStepTwo()) {
      setStep(1);
      return;
    }
    const placeId = addPlace({
      name: name.trim(),
      addressText: addressText.trim() || null,
      latitude: null,
      longitude: null,
      googleMapsUrl: savedUrl('googleMapsUrl', 'googleMaps'),
      googlePlaceId: null,
      tabelogUrl: savedUrl('tabelogUrl', 'tabelog'),
      officialUrl: savedUrl('officialUrl', 'any'),
      status,
      sourceType: 'user_manual',
      note: placeNote.trim() || null
    });

    const menuId = menuName.trim()
      ? addMenu({
        placeId,
        name: menuName.trim(),
        conceptIds: conceptId ? [conceptId] : [],
        customConceptId: null,
        featureFilterIds: [],
        priceText: priceText.trim() || null,
        availability,
        note: menuNote.trim() || null,
        sourceLinks: []
      })
      : null;

    if (destination === 'wish') {
      addTargetWish(
        menuId ? 'menu' : 'place',
        menuId ?? placeId,
        { title: menuId ? menuName.trim() : name.trim(), subtitle: menuId ? name.trim() : addressText.trim() }
      );
    }
    if (destination === 'meal') {
      addTargetMeal(
        { conceptIds: conceptId ? [conceptId] : [], placeId, menuId },
        {
          eatenAt: new Date(`${eatenAt || new Date().toISOString().slice(0, 10)}T12:00:00`).toISOString(),
          rating,
          note: mealNote.trim(),
          isFavorite: false
        }
      );
    }
    navigate(`/places/${placeId}`, { replace: true });
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step === 1) goToStepTwo();
    else if (step === 2) setStep(3);
    else save();
  };

  return (
    <div className="page-container place-form-page section-pad">
      <nav className="breadcrumb" aria-label="パンくず">
        <Link to="/records?tab=places">自分のお店</Link><span>/</span><span aria-current="page">お店を追加</span>
      </nav>

      <header className="page-heading">
        <p className="eyebrow">Add a place</p>
        <h1>お店を追加</h1>
        <p>店名だけで保存できます。ほかは後から足せます。</p>
      </header>

      <ol className="step-indicator" aria-label="入力の進み方">
        {([1, 2, 3] as Step[]).map((value) => (
          <li key={value} aria-current={step === value ? 'step' : undefined} className={step === value ? 'is-current' : step > value ? 'is-done' : ''}>
            <span>{value}</span>{stepLabels[value]}
          </li>
        ))}
      </ol>

      <p className="privacy-notice" role="note">この情報は、この端末だけに保存されます。</p>

      <form className="place-form" onSubmit={onSubmit}>
        {step === 1 ? (
          <fieldset>
            <legend>Step 1 お店</legend>
            <label>
              <span>店名<span className="required-mark" aria-hidden="true"> *</span></span>
              <input
                type="text"
                value={name}
                required
                autoFocus
                aria-describedby="place-name-hint"
                aria-invalid={nameError ? true : undefined}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setName(event.target.value)}
                placeholder="例: 駅前の中華そば店"
              />
            </label>
            <p className="field-hint" id="place-name-hint">店名だけで保存できます。</p>
            {nameError ? <p className="field-error" role="alert">{nameError}</p> : null}

            <label>
              住所または地域
              <input type="text" value={addressText} onChange={(event: ChangeEvent<HTMLInputElement>) => setAddressText(event.target.value)} placeholder="例: 東京都新宿区" />
            </label>

            {urlFields.map((field) => (
              <div key={field.key}>
                <label>
                  {field.label}
                  <input
                    type="url"
                    inputMode="url"
                    value={urls[field.key]}
                    aria-invalid={urlErrors[field.key] ? true : undefined}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => setUrls((current) => ({ ...current, [field.key]: event.target.value }))}
                  />
                </label>
                {urlErrors[field.key]
                  ? <p className="field-error" role="alert">{urlErrors[field.key]}</p>
                  : <p className="field-hint">{field.hint}</p>}
              </div>
            ))}

            <label>
              営業の状態
              <select value={status} onChange={(event: ChangeEvent<HTMLSelectElement>) => setStatus(event.target.value as PlaceStatus)}>
                {Object.entries(placeStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>

            <label>
              メモ
              <textarea rows={3} value={placeNote} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setPlaceNote(event.target.value)} placeholder="行きたい理由、教えてもらった人など" />
            </label>

            {duplicates && duplicates.length > 0 ? (
              <div className="duplicate-warning" role="alert">
                <h2>同じお店かもしれません</h2>
                <ul>
                  {duplicates.map((match) => (
                    <li key={match.place.id}>
                      <strong>{match.place.name}</strong>
                      <span>{match.reason}</span>
                      <Link className="card-action" to={`/places/${match.place.id}`}>既存のお店を開く</Link>
                    </li>
                  ))}
                </ul>
                <p>まとめる場合は既存のお店を開いて情報を追記してください。別の店として残すこともできます。</p>
                <button type="button" className="button button-secondary" onClick={() => { setDuplicates([]); setStep(2); }}>
                  別のお店として保存する
                </button>
              </div>
            ) : null}
          </fieldset>
        ) : null}

        {step === 2 ? (
          <fieldset>
            <legend>Step 2 一杯</legend>
            <p className="field-hint">メニューは後から足せます。空のままでも保存できます。</p>
            <label>
              メニュー名
              <input type="text" value={menuName} autoFocus onChange={(event: ChangeEvent<HTMLInputElement>) => setMenuName(event.target.value)} placeholder="例: 中華そば" />
            </label>
            <label>
              近い料理・スタイル
              <select value={conceptId} onChange={(event: ChangeEvent<HTMLSelectElement>) => setConceptId(event.target.value)}>
                <option value="">選ばない</option>
                {conceptOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </label>
            <p className="field-hint">カタログの料理と結びつけると、記録が図鑑の集計にも入ります。</p>
            <label>
              価格のメモ
              <input type="text" value={priceText} onChange={(event: ChangeEvent<HTMLInputElement>) => setPriceText(event.target.value)} placeholder="例: 900円" />
            </label>
            <p className="field-hint">価格は自動で更新しません。訪れたときの目安として残ります。</p>
            <label>
              提供の状況
              <select value={availability} onChange={(event: ChangeEvent<HTMLSelectElement>) => setAvailability(event.target.value as MenuAvailability)}>
                {Object.entries(menuAvailabilityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>
              メモ
              <textarea rows={3} value={menuNote} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setMenuNote(event.target.value)} />
            </label>
          </fieldset>
        ) : null}

        {step === 3 ? (
          <fieldset>
            <legend>Step 3 保存先</legend>
            <div className="destination-choices">
              {([
                ['none', '保存するだけ', '自分のお店の一覧に入ります。'],
                ['wish', '食べたいに入れる', menuName.trim() ? 'このメニューを食べたいへ追加します。' : 'このお店を食べたいへ追加します。'],
                ['meal', 'ごちそうさまを記録する', 'もう食べたときは、日付と評価を残せます。']
              ] as [Destination, string, string][]).map(([value, label, description]) => (
                <label className="choice-row" key={value}>
                  <input type="radio" name="destination" value={value} checked={destination === value} onChange={() => setDestination(value)} />
                  <span><strong>{label}</strong><small>{description}</small></span>
                </label>
              ))}
            </div>

            {destination === 'meal' ? (
              <div className="meal-draft">
                <label>食べた日<input type="date" value={eatenAt} onChange={(event: ChangeEvent<HTMLInputElement>) => setEatenAt(event.target.value)} /></label>
                <label>
                  評価
                  <select value={rating ?? ''} onChange={(event: ChangeEvent<HTMLSelectElement>) => setRating(event.target.value === '' ? null : Number(event.target.value))}>
                    <option value="">評価しない</option>
                    {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} / 5</option>)}
                  </select>
                </label>
                <label>感想<textarea rows={3} value={mealNote} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setMealNote(event.target.value)} /></label>
              </div>
            ) : null}
          </fieldset>
        ) : null}

        <div className="place-form-actions">
          {step > 1 ? <button type="button" className="button button-secondary" onClick={() => setStep((current) => (current - 1) as Step)}>戻る</button> : null}
          <button type="submit" className="button button-primary">
            {step === 1 ? '次へ（一杯）' : step === 2 ? '次へ（保存先）' : 'このお店を保存する'}
          </button>
          {step < 3 ? <button type="button" className="button button-secondary" onClick={save}>店名だけで保存</button> : null}
        </div>
      </form>
    </div>
  );
}
