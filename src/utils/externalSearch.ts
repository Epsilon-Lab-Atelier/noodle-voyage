import { noodleCategoryLabels, type Dish } from '../types/catalog';

function locationLabel(dish: Dish): string {
  return dish.prefectureLabel ?? dish.country;
}

export function googleImageSearchUrl(dish: Dish): string {
  const terms = dish.domain === 'japan'
    ? [dish.name, locationLabel(dish), noodleCategoryLabels[dish.noodleCategory]]
    : [dish.name, dish.localName, locationLabel(dish), '麺料理'];
  const query = terms.filter(Boolean).join(' ');
  const params = new URLSearchParams({ tbm: 'isch', q: query, hl: 'ja' });
  return `https://www.google.com/search?${params.toString()}`;
}
