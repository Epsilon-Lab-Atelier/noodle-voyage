import { useMemo, useState, type ChangeEvent } from 'react';
import { DishCard } from '../components/DishCard';
import { ErrorState, LoadingState } from '../components/LoadingState';
import { ScopeTabs } from '../components/ScopeTabs';
import { useCatalogData } from '../data/useCatalogData';
import { describeProfile, recommendDishes, tasteLabels } from '../recommendation/engine';
import { defaultPreferences, useAppStore } from '../state/store';
import { tasteKeys, type SearchScope, type TasteKey, type UserPreferences } from '../types/catalog';

interface QuickChoice {
  label: string;
  help: string;
  apply: (preferences: UserPreferences) => UserPreferences;
}
interface QuickQuestion {
  title: string;
  description: string;
  choices: QuickChoice[];
}

const clone = (preferences: UserPreferences): UserPreferences => structuredClone(preferences);
const withTaste = (key: TasteKey, value: number, weight = 1.4) => (preferences: UserPreferences) => {
  const next = clone(preferences);
  next.values[key] = value;
  next.weights[key] = weight;
  return next;
};

const quickQuestions: QuickQuestion[] = [
  {
    title: 'あっさりと濃厚なら、どちらにひかれますか？',
    description: 'スープ全体の重さや余韻をイメージしてください。',
    choices: [
      { label: 'あっさり', help: '軽く、すっきりした一杯', apply: withTaste('richness', 1.1, 1.7) },
      { label: 'ほどよいコク', help: '軽さと満足感のバランス', apply: withTaste('richness', 2.7, 1.4) },
      { label: 'しっかり濃厚', help: '強いコクと長い余韻', apply: withTaste('richness', 4.4, 1.7) }
    ]
  },
  {
    title: '油の量は、どのくらいが好みですか？',
    description: '香味油や背脂も含めた印象です。',
    choices: [
      { label: '控えめ', help: '後味を軽くしたい', apply: withTaste('oiliness', 0.9, 1.6) },
      { label: 'ほどほど', help: 'コクは欲しいが重すぎない', apply: withTaste('oiliness', 2.5, 1.3) },
      { label: '多め', help: '油の甘味や力強さも楽しみたい', apply: withTaste('oiliness', 4.2, 1.6) }
    ]
  },
  {
    title: 'スープの中心は、どれが気になりますか？',
    description: 'ひとつに決められない場合は「バランス」を選べます。',
    choices: [
      { label: '動物系', help: '豚、鶏、牛などの力強いだし', apply: (preferences) => { const next = clone(preferences); next.values.animalIntensity = 4.2; next.values.seafoodIntensity = 1.5; next.weights.animalIntensity = 1.7; return next; } },
      { label: '魚介・貝', help: '煮干し、節、海老、貝などのうま味', apply: (preferences) => { const next = clone(preferences); next.values.seafoodIntensity = 4.2; next.values.animalIntensity = 1.8; next.weights.seafoodIntensity = 1.7; return next; } },
      { label: 'バランス', help: '合わせ出汁や穏やかなスープ', apply: (preferences) => { const next = clone(preferences); next.values.seafoodIntensity = 2.7; next.values.animalIntensity = 2.7; next.weights.seafoodIntensity = 1.0; next.weights.animalIntensity = 1.0; return next; } },
      { label: '香草・野菜', help: '植物の香りや軽やかさも楽しみたい', apply: (preferences) => { const next = clone(preferences); next.values.herbalIntensity = 3.8; next.values.animalIntensity = 1.4; next.weights.herbalIntensity = 1.5; return next; } }
    ]
  },
  {
    title: '辛い味は、どこまで大丈夫ですか？',
    description: '唐辛子だけでなく、花椒や辛い香味油も含みます。',
    choices: [
      { label: '苦手', help: 'ほぼ辛くないものを優先', apply: withTaste('heat', 0.2, 2.0) },
      { label: '少しなら', help: 'ほどよい刺激まで', apply: withTaste('heat', 1.8, 1.5) },
      { label: '辛いほど好き', help: 'しっかりした刺激も歓迎', apply: withTaste('heat', 4.4, 1.8) }
    ]
  },
  {
    title: '酸味や香草について、近いものは？',
    description: '世界の麺料理を含めると、選択の幅が大きく広がる項目です。',
    choices: [
      { label: 'どちらも控えめ', help: '慣れた味を中心に探したい', apply: (preferences) => { const next = clone(preferences); next.values.sourness = 0.7; next.values.herbalIntensity = 0.7; next.weights.sourness = 1.2; next.weights.herbalIntensity = 1.2; return next; } },
      { label: '酸味は好き', help: '酢、柑橘、タマリンドなど', apply: (preferences) => { const next = clone(preferences); next.values.sourness = 3.8; next.weights.sourness = 1.5; return next; } },
      { label: '香草は好き', help: 'ねぎ、香菜、バジルなど', apply: (preferences) => { const next = clone(preferences); next.values.herbalIntensity = 3.8; next.weights.herbalIntensity = 1.5; return next; } },
      { label: 'どちらも好き', help: '爽やかで複雑な味も歓迎', apply: (preferences) => { const next = clone(preferences); next.values.sourness = 3.6; next.values.herbalIntensity = 3.8; next.weights.sourness = 1.4; next.weights.herbalIntensity = 1.4; return next; } }
    ]
  },
  {
    title: '麺の太さは、どれが好みですか？',
    description: '世界の米麺などは、近い食感として比較します。',
    choices: [
      { label: '細め', help: '軽くすすれる麺', apply: (preferences) => ({ ...clone(preferences), noodle: { ...preferences.noodle, thickness: 1.0, weight: 1.5 } }) },
      { label: '中くらい', help: 'スープとのバランス重視', apply: (preferences) => ({ ...clone(preferences), noodle: { ...preferences.noodle, thickness: 2.7, weight: 1.2 } }) },
      { label: '太め', help: 'もちもち感や食べ応え重視', apply: (preferences) => ({ ...clone(preferences), noodle: { ...preferences.noodle, thickness: 4.4, weight: 1.5 } }) }
    ]
  },
  {
    title: '麺の歯ごたえは、どれが好きですか？',
    description: '硬さと弾力をまとめて選びます。',
    choices: [
      { label: 'やわらかめ', help: 'なめらかで優しい食感', apply: (preferences) => ({ ...clone(preferences), noodle: { ...preferences.noodle, firmness: 1.3, elasticity: 2.0, weight: 1.4 } }) },
      { label: 'ほどよい', help: '硬さとしなやかさの中間', apply: (preferences) => ({ ...clone(preferences), noodle: { ...preferences.noodle, firmness: 2.8, elasticity: 3.0, weight: 1.2 } }) },
      { label: 'しっかり', help: '硬さや強い弾力を楽しみたい', apply: (preferences) => ({ ...clone(preferences), noodle: { ...preferences.noodle, firmness: 4.4, elasticity: 4.2, weight: 1.5 } }) }
    ]
  },
  {
    title: '今日は、どのくらい冒険したいですか？',
    description: '冒険度を上げても、相性が低い料理を無理に上位へは出しません。',
    choices: [
      { label: '王道を優先', help: '好みに忠実な候補を中心に', apply: (preferences) => ({ ...clone(preferences), adventure: 12 }) },
      { label: '少し新しい一杯', help: '好みと発見を半分ずつ', apply: (preferences) => ({ ...clone(preferences), adventure: 52 }) },
      { label: '未知の味へ', help: '別地域や別文化も積極的に', apply: (preferences) => ({ ...clone(preferences), adventure: 88 }) }
    ]
  }
];

const avoidOptions = ['辛味', '酸味', '香草', 'にんにく', '魚介', '豚骨', '牛', 'もつ', 'ココナッツ', '発酵', '即席', '汁なし', '冷製'];

export default function DiagnosisPage() {
  const { catalog, loading, error } = useCatalogData();
  const savedPreferences = useAppStore((state) => state.preferences);
  const savePreferences = useAppStore((state) => state.setPreferences);
  const [mode, setMode] = useState<'quick' | 'detail'>('quick');
  const [working, setWorking] = useState<UserPreferences>(() => clone(savedPreferences));
  const [step, setStep] = useState(0);
  const [complete, setComplete] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [history, setHistory] = useState<UserPreferences[]>([]);

  const results = useMemo(() => complete || mode === 'detail' ? recommendDishes(catalog, working, 8) : [], [catalog, working, complete, mode]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  const resetQuick = () => {
    setWorking(clone(defaultPreferences));
    setStep(0);
    setComplete(false);
    setSavedNotice(false);
    setHistory([]);
  };

  const choose = (choice: QuickChoice) => {
    setWorking((current) => {
      setHistory((items) => [...items, clone(current)]);
      return choice.apply(current);
    });
    setSavedNotice(false);
    if (step === quickQuestions.length - 1) setComplete(true);
    else setStep((current) => current + 1);
  };

  const goBack = () => {
    const previous = history.at(-1);
    if (!previous) return;
    setWorking(clone(previous));
    setHistory((items) => items.slice(0, -1));
    setStep((current) => Math.max(0, current - 1));
    setSavedNotice(false);
  };

  const save = () => {
    savePreferences(working);
    setSavedNotice(true);
  };

  const updateTaste = (key: TasteKey, field: 'value' | 'weight', value: number) => {
    setWorking((current) => {
      const next = clone(current);
      if (field === 'value') next.values[key] = value;
      else next.weights[key] = value;
      return next;
    });
    setSavedNotice(false);
  };

  const setAvoid = (term: string, value: 'none' | 'soft' | 'hard') => {
    setWorking((current) => {
      const next = clone(current);
      next.softAvoid = next.softAvoid.filter((item) => item !== term);
      next.hardAvoid = next.hardAvoid.filter((item) => item !== term);
      if (value === 'soft') next.softAvoid.push(term);
      if (value === 'hard') next.hardAvoid.push(term);
      return next;
    });
  };

  return (
    <div className="page-shell section-pad">
      <header className="page-header">
        <p className="eyebrow">Taste diagnosis</p>
        <h1>あなたの好みから探す</h1>
        <p>点数だけではなく、合いそうな理由と少し違う点も表示します。相性は確率ではなく、登録された特徴と好みの近さです。</p>
      </header>

      <div className="mode-tabs" role="tablist" aria-label="診断方法">
        <button type="button" role="tab" aria-selected={mode === 'quick'} className={mode === 'quick' ? 'is-active' : ''} onClick={() => { setMode('quick'); setComplete(false); setSavedNotice(false); }}>60秒診断</button>
        <button type="button" role="tab" aria-selected={mode === 'detail'} className={mode === 'detail' ? 'is-active' : ''} onClick={() => { setMode('detail'); setComplete(true); }}>詳細診断</button>
      </div>

      {mode === 'quick' && !complete && (
        <section className="diagnosis-card" aria-labelledby="question-title">
          <div className="progress-row"><span>{step + 1} / {quickQuestions.length}</span><progress value={step + 1} max={quickQuestions.length}>{step + 1}</progress></div>
          <div className="scope-question">
            <span>検索する範囲</span>
            <ScopeTabs value={working.scope} onChange={(scope: SearchScope) => setWorking((current) => ({ ...clone(current), scope }))} />
          </div>
          <h2 id="question-title">{quickQuestions[step]?.title}</h2>
          <p>{quickQuestions[step]?.description}</p>
          <div className="choice-grid">
            {quickQuestions[step]?.choices.map((choice) => (
              <button type="button" className="choice-card" key={choice.label} onClick={() => choose(choice)}>
                <strong>{choice.label}</strong><span>{choice.help}</span>
              </button>
            ))}
          </div>
          <div className="diagnosis-controls">
            <button type="button" className="button button-ghost" disabled={step === 0} onClick={goBack}>ひとつ戻る</button>
            <button type="button" className="button button-ghost" onClick={resetQuick}>最初から</button>
          </div>
        </section>
      )}

      {mode === 'detail' && (
        <section className="detail-diagnosis" aria-labelledby="detail-title">
          <div className="detail-intro"><div><h2 id="detail-title">詳細な好み</h2><p>0は控えめ、5は強めです。「重要度0」にすると、その項目は推薦計算へほとんど影響しません。</p></div><ScopeTabs value={working.scope} onChange={(scope) => setWorking((current) => ({ ...clone(current), scope }))} /></div>
          <div className="slider-grid">
            {tasteKeys.map((key) => (
              <div className="preference-slider" key={key}>
                <div><label htmlFor={`taste-${key}`}>{tasteLabels[key]}</label><output>{working.values[key].toFixed(1)}</output></div>
                <input id={`taste-${key}`} type="range" min="0" max="5" step="0.1" value={working.values[key]} onChange={(event: ChangeEvent<HTMLInputElement>) => updateTaste(key, 'value', Number(event.target.value))} />
                <label className="weight-select">重要度
                  <select value={working.weights[key]} onChange={(event: ChangeEvent<HTMLSelectElement>) => updateTaste(key, 'weight', Number(event.target.value))}>
                    <option value="0">重視しない</option><option value="0.7">少し重視</option><option value="1.2">重視</option><option value="2">とても重視</option>
                  </select>
                </label>
              </div>
            ))}
          </div>
          <div className="subpanel-grid">
            <fieldset className="settings-panel"><legend>麺の好み</legend>
              {([['thickness','太さ'],['firmness','硬さ'],['elasticity','弾力']] as const).map(([key, label]) => <label key={key}>{label}<span>{working.noodle[key].toFixed(1)}</span><input type="range" min="0" max="5" step="0.1" value={working.noodle[key]} onChange={(event: ChangeEvent<HTMLInputElement>) => setWorking((current) => ({ ...clone(current), noodle: { ...current.noodle, [key]: Number(event.target.value) } }))} /></label>)}
              <label>麺の重要度<select value={working.noodle.weight} onChange={(event: ChangeEvent<HTMLSelectElement>) => setWorking((current) => ({ ...clone(current), noodle: { ...current.noodle, weight: Number(event.target.value) } }))}><option value="0">重視しない</option><option value="0.7">少し重視</option><option value="1.2">重視</option><option value="2">とても重視</option></select></label>
            </fieldset>
            <fieldset className="settings-panel"><legend>冒険度</legend><label>王道を優先 <span>{working.adventure}</span> 未知の味へ<input type="range" min="0" max="100" step="1" value={working.adventure} onChange={(event: ChangeEvent<HTMLInputElement>) => setWorking((current) => ({ ...clone(current), adventure: Number(event.target.value) }))} /></label><p>高くしても、相性が極端に低い候補は上位にしません。</p></fieldset>
          </div>
          <fieldset className="avoid-panel"><legend>避けたい特徴</legend><div className="avoid-grid">{avoidOptions.map((term) => { const value = working.hardAvoid.includes(term) ? 'hard' : working.softAvoid.includes(term) ? 'soft' : 'none'; return <label key={term}>{term}<select value={value} onChange={(event: ChangeEvent<HTMLSelectElement>) => setAvoid(term, event.target.value as 'none' | 'soft' | 'hard')}><option value="none">指定なし</option><option value="soft">できれば避ける</option><option value="hard">除外する</option></select></label>; })}</div></fieldset>
        </section>
      )}

      {(complete || mode === 'detail') && (
        <section className="diagnosis-results" aria-labelledby="result-title">
          <div className="result-heading">
            <div><p className="eyebrow">Your match</p><h2 id="result-title">診断結果</h2><p>{describeProfile(working).join(' / ')}</p></div>
            <div className="result-actions"><button type="button" className="button button-primary" onClick={save}>この好みを保存</button>{mode === 'quick' && <button type="button" className="button button-secondary" onClick={resetQuick}>診断をやり直す</button>}</div>
          </div>
          {savedNotice && <p className="success-notice" role="status">好みを端末内へ保存しました。今日の一杯やおすすめにも反映されます。</p>}
          <div className="ranking-list">
            {results.slice(0, 5).map((result, index) => <div className="ranked-card" key={result.dish.id}><span className="rank-number">{index + 1}</span><DishCard dish={result.dish} recommendation={result} /></div>)}
          </div>
          {results.length === 0 && <p className="empty-state">除外条件により候補がありません。検索範囲か除外条件を少し広げてください。</p>}
        </section>
      )}
    </div>
  );
}
