import { Link } from 'react-router-dom';
import type { Dish, RecommendationResult } from '../types/catalog';
import { isConceptWish, mealMatchesConcept } from '../types/records';
import { ScopeBadge } from './ScopeBadge';
import { resolveDishDisplayFeatures } from '../features/tags/resolveFeatureTag';
import { useFeatureTags } from '../features/tags/useFeatureTags';
import { useAppStore } from '../state/store';
import { googleImageSearchUrl } from '../utils/externalSearch';

interface DishCardProps {
  dish: Dish;
  recommendation?: RecommendationResult;
  compact?: boolean;
}

export function DishCard({ dish, recommendation, compact = false }: DishCardProps) {
  const wishes = useAppStore((state) => state.wishes);
  const meals = useAppStore((state) => state.meals);
  const compare = useAppStore((state) => state.compare);
  const toggleWish = useAppStore((state) => state.toggleWish);
  const addMeal = useAppStore((state) => state.addMeal);
  const toggleCompare = useAppStore((state) => state.toggleCompare);
  const { taxonomy, facetIndex } = useFeatureTags();
  const features = resolveDishDisplayFeatures(dish, taxonomy, facetIndex);
  const isWish = wishes.some((wish) => isConceptWish(wish, dish.id));
  const isCompared = compare.includes(dish.id);
  const mealCount = meals.filter((meal) => mealMatchesConcept(meal, dish.id)).length;

  return (
    <article className={`dish-card ${compact ? 'is-compact' : ''}`}>
      <div className="dish-card-body">
        <div className="dish-card-topline">
          <p className="eyebrow"><ScopeBadge scope={dish.culturalScope} />{dish.prefectureLabel ?? dish.country} / {dish.formLabel}</p>
          {recommendation ? <span className="score-badge" aria-label={`好みとの一致度 ${recommendation.score}点`}><strong>{recommendation.score}</strong><small>/100</small></span> : null}
        </div>
        <h3><Link to={`/dish/${dish.id}`}>{dish.name}</Link></h3>
        {dish.localName && dish.localName !== dish.name ? <p className="local-name" lang="und">{dish.localName}</p> : null}
        <p className="card-summary">{dish.culture.summary}</p>
        {features.length > 0 && (
          <div className="tag-row" aria-label="主な特徴">
            {features.slice(0, 3).map((feature) => <span className="tag" key={feature.raw}>{feature.labelJa}</span>)}
            {features.length > 3 ? <span className="tag is-more" aria-label={`ほか${features.length - 3}件の特徴`}>+{features.length - 3}</span> : null}
          </div>
        )}
        {recommendation ? (
          <div className="recommendation-note">
            <strong>合いそうな理由</strong>
            <ul>{recommendation.reasons.slice(0, 2).map((reason) => <li key={reason}>{reason}</li>)}</ul>
          </div>
        ) : null}
      </div>
      <div className="card-actions" aria-label={`${dish.name}の操作`}>
        <button type="button" className={isWish ? 'card-action is-active' : 'card-action'} aria-pressed={isWish} onClick={() => toggleWish(dish.id)}>
          {isWish ? '食べたいに登録済み' : '食べたい'}
        </button>
        <button type="button" className="card-action" onClick={() => addMeal(dish.id, { eatenAt: new Date().toISOString().slice(0, 10), rating: null, note: '', isFavorite: false })}>
          {mealCount > 0 ? `ごちそうさま (${mealCount})` : 'ごちそうさま'}
        </button>
        <button type="button" className={isCompared ? 'card-action is-active' : 'card-action'} aria-pressed={isCompared} onClick={() => toggleCompare(dish.id)}>
          {isCompared ? '比較中' : '比較する'}
        </button>
        <a className="card-action external-action" href={googleImageSearchUrl(dish)} target="_blank" rel="noopener noreferrer">
          Google画像検索
        </a>
      </div>
    </article>
  );
}
