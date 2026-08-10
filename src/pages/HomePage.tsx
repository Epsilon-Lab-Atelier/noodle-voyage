import { useState } from 'react';
import { Link } from 'react-router-dom';
import { DishCard } from '../components/DishCard';
import { ErrorState, LoadingState } from '../components/LoadingState';
import { useCatalogData } from '../data/useCatalogData';
import { describeProfile, getDailyDish, getUnexpectedDish, recommendDishes } from '../recommendation/engine';
import { useAppStore } from '../state/store';

const routes = [
  { to: '/diagnosis', title: '好みから見つける', description: '直感で答える8つの質問から、相性のよい一杯を提案します。' },
  { to: '/explore?view=cards', title: '特徴で絞り込む', description: 'だし、麺、辛さ、食べ方などを日本語の特徴から選べます。' },
  { to: '/explore?view=map', title: '地図をめぐる', description: '旅行先や気になる地域から、土地に根付く麺料理を探します。' },
  { to: '/explore?view=scatter', title: '味で眺める', description: '2つの味覚を比べて、近い一杯と意外な一杯を見つけます。' }
];

export default function HomePage() {
  const { catalog, manifest, loading, error } = useCatalogData();
  const preferences = useAppStore((state) => state.preferences);
  const recentIds = useAppStore((state) => state.recent);
  const wishes = useAppStore((state) => state.wishes);
  const meals = useAppStore((state) => state.meals);
  const places = useAppStore((state) => state.places);
  const preferenceMode = useAppStore((state) => state.preferenceMeta.mode);
  const [showMore, setShowMore] = useState(false);

  if (loading) return <LoadingState />;
  if (error || !manifest) return <ErrorState message={error ?? 'データ情報がありません。'} />;

  const recommendations = recommendDishes(catalog, preferences, 4);
  const daily = getDailyDish(catalog, preferences);
  const unexpected = getUnexpectedDish(catalog, preferences);
  const recent = recentIds.map((id) => catalog.find((dish) => dish.id === id)).filter((dish) => dish !== undefined).slice(0, 4);
  const profile = describeProfile(preferences);
  // Someone who has already saved something is picking up where they left off;
  // someone new is still being introduced to the place.
  const returning = wishes.length > 0 || meals.length > 0 || places.length > 0 || preferenceMode !== 'unset';

  return (
    <>
      {/* Block 1: what this is, and the two ways in. */}
      <section className="home-first-view section-pad" aria-labelledby="home-title">
        <p className="eyebrow">NOODLES / PLACES / STORIES</p>
        <h1 id="home-title">一杯から、旅をはじめよう。</h1>
        <p className="hero-lead">料理のスタイルを知る。気になる店を残す。食べた一杯を、自分の言葉で記録する。</p>
        <div className="hero-actions">
          <Link className="button button-primary button-large" to="/diagnosis">好みから探す</Link>
          <Link className="button button-secondary button-large" to="/explore">自由にめぐる</Link>
        </div>
        <p className="home-catalog-badge">8問・約60秒　／　日本と世界の{manifest.counts.total}件を収録</p>
      </section>

      {/* Block 2: the four ways of looking. */}
      <section className="home-routes section-pad" aria-labelledby="home-routes-title">
        <div className="section-heading">
          <p className="eyebrow">Choose a route</p>
          <h2 id="home-routes-title">気分に合う探し方を選ぶ</h2>
        </div>
        <div className="route-grid">
          {routes.map((route) => (
            <Link className="route-card" key={route.to} to={route.to}>
              <h3>{route.title}</h3>
              <p>{route.description}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Block 3: one bowl to look at, or the way back into your own records. */}
      {returning ? (
        <section className="section-pad home-resume" aria-labelledby="home-resume-title">
          <div className="section-heading inline-heading">
            <div><p className="eyebrow">Pick up again</p><h2 id="home-resume-title">続きから</h2></div>
            <Link className="text-link" to="/records">マイ記録を開く</Link>
          </div>
          <dl className="home-resume-stats">
            <div><dt>食べたい</dt><dd>{wishes.length}</dd></div>
            <div><dt>ごちそうさま</dt><dd>{meals.length}</dd></div>
            <div><dt>自分のお店</dt><dd>{places.length}</dd></div>
          </dl>
          {daily ? <DishCard dish={daily.dish} recommendation={daily} /> : null}
        </section>
      ) : (
        <section className="section-pad" aria-labelledby="today-title">
          <div className="section-heading inline-heading">
            <div><p className="eyebrow">Today&apos;s destination</p><h2 id="today-title">今日の一杯</h2></div>
            <p>好みと冒険度をもとに、毎日ひとつ選びます。</p>
          </div>
          {daily ? <DishCard dish={daily.dish} recommendation={daily} /> : <p>候補がありません。</p>}
        </section>
      )}

      {/* Everything below waits until the reader asks for it, so the first
          screen stays short on a phone. */}
      {showMore ? (
        <>
          <section className="section-pad section-surface" aria-labelledby="recommend-title">
            <div className="section-heading inline-heading">
              <div><p className="eyebrow">For your taste</p><h2 id="recommend-title">好みに近い一杯</h2></div>
              <Link className="text-link" to="/diagnosis">好みを調整する</Link>
            </div>
            <div className="profile-strip">
              <strong>現在の味覚プロフィール</strong>
              {profile.map((item) => <span key={item}>{item}</span>)}
            </div>
            <div className="card-grid">{recommendations.map((result) => <DishCard key={result.dish.id} dish={result.dish} recommendation={result} compact />)}</div>
          </section>

          {unexpected ? (
            <section className="section-pad discovery-section" aria-labelledby="unexpected-title">
              <div className="section-heading"><p className="eyebrow">Take a detour</p><h2 id="unexpected-title">寄り道の一杯</h2><p>好みの一部は保ちながら、少し違う文化や味へ進む候補です。</p></div>
              <DishCard dish={unexpected.dish} recommendation={unexpected} />
            </section>
          ) : null}

          {recent.length > 0 ? (
            <section className="section-pad section-surface" aria-labelledby="recent-title">
              <div className="section-heading inline-heading"><h2 id="recent-title">最近見た一杯</h2><Link className="text-link" to="/records">マイ記録を見る</Link></div>
              <div className="card-grid">{recent.map((dish) => <DishCard key={dish.id} dish={dish} compact />)}</div>
            </section>
          ) : null}
        </>
      ) : (
        <p className="home-more">
          <button type="button" className="button button-secondary" onClick={() => setShowMore(true)}>
            おすすめや履歴をもっと見る
          </button>
        </p>
      )}
    </>
  );
}
