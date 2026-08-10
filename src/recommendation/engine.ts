import {
  tasteKeys,
  tasteLabels,
  type Dish,
  type RecommendationResult,
  type TasteKey,
  type UserPreferences
} from '../types/catalog';

export { tasteLabels };

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export function matchesScope(dish: Dish, scope: UserPreferences['scope']): boolean {
  if (scope === 'all') return true;
  if (scope === 'japan') return dish.domain === 'japan';
  return dish.domain === 'world';
}

function textMatches(dish: Dish, terms: string[]): boolean {
  if (!terms.length) return false;
  const text = `${dish.searchText} ${dish.tags.join(' ')} ${dish.ingredients.join(' ')}`.toLowerCase();
  return terms.some((term) => text.includes(term.toLowerCase()));
}

function rangeDistance(value: number, min: number, max: number): number {
  if (value >= min && value <= max) return 0;
  return value < min ? min - value : value - max;
}

function singleScore(value: number, min: number, max: number): number {
  return clamp(1 - rangeDistance(value, min, max) / 5);
}

function reasonText(key: TasteKey, userValue: number, dishValue: number): string {
  const label = tasteLabels[key];
  if (key === 'heat' && userValue < 1.5) return `${label}が控えめで好みに近い`;
  if (key === 'richness') return dishValue >= 3.5 ? '濃厚さが好みに近い' : '軽やかさが好みに近い';
  if (key === 'oiliness') return dishValue >= 3.5 ? '油のコクが好みに近い' : '油分が控えめで好みに近い';
  if (key === 'seafoodIntensity') return dishValue >= 3 ? '魚介のうま味が好みに近い' : '魚介感が強すぎない';
  if (key === 'animalIntensity') return dishValue >= 3 ? '動物系スープの力強さが好みに近い' : '動物系の香りが穏やか';
  return `${label}が好みに近い`;
}

function differenceText(key: TasteKey, userValue: number, dishValue: number): string {
  const label = tasteLabels[key];
  return dishValue > userValue
    ? `${label}は好みより強めの可能性がある`
    : `${label}は好みより控えめの可能性がある`;
}

export function scoreDish(dish: Dish, preferences: UserPreferences): RecommendationResult | null {
  if (!matchesScope(dish, preferences.scope)) return null;
  if (textMatches(dish, preferences.hardAvoid)) return null;

  let weightedTotal = 0;
  let weightSum = 0;
  const details = tasteKeys.map((key) => {
    const weight = Math.max(0, preferences.weights[key]);
    const range = dish.taste[key];
    const value = preferences.values[key];
    const score = singleScore(value, range.min, range.max);
    weightedTotal += score * weight;
    weightSum += weight;
    return { key, weight, score, distance: Math.abs(value - range.typical), dishValue: range.typical, userValue: value };
  });

  const noodleWeight = Math.max(0, preferences.noodle.weight);
  const noodleScore = (
    clamp(1 - Math.abs(preferences.noodle.thickness - dish.noodle.thickness) / 5) +
    clamp(1 - Math.abs(preferences.noodle.firmness - dish.noodle.firmness) / 5) +
    clamp(1 - Math.abs(preferences.noodle.elasticity - dish.noodle.elasticity) / 5) +
    clamp(1 - Math.abs(preferences.noodle.chewiness - dish.noodle.chewiness) / 5) +
    clamp(1 - Math.abs(preferences.noodle.smoothness - dish.noodle.smoothness) / 5)
  ) / 5;
  weightedTotal += noodleScore * noodleWeight * 2.2;
  weightSum += noodleWeight * 2.2;

  let base = weightSum ? weightedTotal / weightSum : 0;
  if (textMatches(dish, preferences.softAvoid)) base -= 0.12;

  const novelty = clamp(dish.culture.adventure / 5);
  const adventureBlend = preferences.adventure / 100;
  const finalScore = clamp(base * (1 - adventureBlend * 0.16) + novelty * adventureBlend * 0.16);

  const reasons = details
    .filter((detail) => detail.weight >= 0.8 && detail.distance <= 0.8)
    .sort((a, b) => b.weight * b.score - a.weight * a.score)
    .slice(0, 3)
    .map((detail) => reasonText(detail.key, detail.userValue, detail.dishValue));
  if (noodleScore >= 0.86) reasons.push('麺の太さや食感が好みに近い');
  if (!reasons.length) reasons.push('複数の特徴を総合すると好みに近い');

  const differences = details
    .filter((detail) => detail.weight >= 0.8 && detail.distance >= 1.25)
    .sort((a, b) => b.distance * b.weight - a.distance * a.weight)
    .slice(0, 2)
    .map((detail) => differenceText(detail.key, detail.userValue, detail.dishValue));

  return {
    dish,
    score: Math.round(finalScore * 100),
    reasons: [...new Set(reasons)].slice(0, 4),
    differences,
    novelty
  };
}

function dishSimilarity(a: Dish, b: Dish): number {
  const tasteDistance = tasteKeys.reduce((sum, key) => {
    const diff = a.taste[key].typical - b.taste[key].typical;
    return sum + diff * diff;
  }, 0) / tasteKeys.length;
  const sharedTags = a.tags.filter((tag) => b.tags.includes(tag)).length;
  return clamp(1 - Math.sqrt(tasteDistance) / 5 + sharedTags * 0.06);
}

export function recommendDishes(catalog: Dish[], preferences: UserPreferences, limit = 8): RecommendationResult[] {
  const candidates = catalog
    .map((dish) => scoreDish(dish, preferences))
    .filter((result): result is RecommendationResult => result !== null)
    .sort((a, b) => b.score - a.score);

  if (candidates.length <= limit) return candidates;
  const selected: RecommendationResult[] = [];
  const pool = candidates.slice(0, Math.max(60, limit * 10));
  while (selected.length < limit && pool.length) {
    const next = pool
      .map((candidate) => {
        const maxSimilarity = selected.length
          ? Math.max(...selected.map((item) => dishSimilarity(item.dish, candidate.dish)))
          : 0;
        const relevance = candidate.score / 100;
        const diversityWeight = 0.12 + preferences.adventure / 100 * 0.18;
        return { candidate, value: relevance - maxSimilarity * diversityWeight };
      })
      .sort((a, b) => b.value - a.value)[0];
    if (!next) break;
    selected.push(next.candidate);
    pool.splice(pool.indexOf(next.candidate), 1);
  }
  return selected;
}

export function getDailyDish(catalog: Dish[], preferences: UserPreferences, date = new Date()): RecommendationResult | null {
  const recommendations = recommendDishes(catalog, preferences, 30);
  if (!recommendations.length) return null;
  const key = Number(`${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`);
  const preferenceSeed = Math.round(preferences.adventure + preferences.values.richness * 7 + preferences.values.heat * 11);
  return recommendations[(key + preferenceSeed) % recommendations.length] ?? recommendations[0] ?? null;
}

export function getUnexpectedDish(catalog: Dish[], preferences: UserPreferences): RecommendationResult | null {
  const results = catalog
    .map((dish) => scoreDish(dish, preferences))
    .filter((result): result is RecommendationResult => result !== null && result.score >= 62)
    .sort((a, b) => (b.novelty * 35 + b.score) - (a.novelty * 35 + a.score));
  return results[0] ?? null;
}

export function describeProfile(preferences: UserPreferences): string[] {
  const ranked = tasteKeys
    .map((key) => ({ key, value: preferences.values[key], weight: preferences.weights[key] }))
    .filter((item) => item.weight >= 0.8)
    .sort((a, b) => Math.abs(b.value - 2.5) * b.weight - Math.abs(a.value - 2.5) * a.weight)
    .slice(0, 5);
  return ranked.map(({ key, value }) => {
    const label = tasteLabels[key];
    if (value >= 3.7) return `${label}: 強めが好き`;
    if (value <= 1.3) return `${label}: 控えめが好き`;
    return `${label}: 中程度が好き`;
  });
}
