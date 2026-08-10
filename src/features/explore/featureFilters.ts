import type { Dish } from '../../types/catalog';
import { searchableFacetIds } from '../tags/facetLookup';
import type { FacetIndex, FeatureFilter, FeatureTagTaxonomy } from '../tags/featureTagTypes';

export interface FeatureSelection {
  /** Filter IDs the dish must satisfy: OR inside a group, AND across groups. */
  selected: string[];
  /** Filter IDs the dish must not satisfy. */
  excluded: string[];
}

export const emptyFeatureSelection: FeatureSelection = { selected: [], excluded: [] };

/**
 * The filter IDs one dish satisfies. This is the canonical facet index, not the
 * dish's own tag list: a dish can match a filter through a reviewed judgement, a
 * structured field or a cautious numeric threshold as well as an explicit tag.
 */
export function dishFilterIds(dish: Dish, facetIndex: FacetIndex | null): Set<string> {
  return searchableFacetIds(dish.id, facetIndex);
}

export function matchesFeatureSelection(
  dish: Dish,
  selection: FeatureSelection,
  taxonomy: FeatureTagTaxonomy | null,
  facetIndex: FacetIndex | null
): boolean {
  if (!selection.selected.length && !selection.excluded.length) return true;
  const owned = dishFilterIds(dish, facetIndex);
  if (selection.excluded.some((filterId) => owned.has(filterId))) return false;
  if (!selection.selected.length) return true;

  const byGroup = new Map<string, string[]>();
  for (const filterId of selection.selected) {
    const groupId = taxonomy?.filters.find((filter) => filter.id === filterId)?.groupId ?? 'unknown';
    byGroup.set(groupId, [...(byGroup.get(groupId) ?? []), filterId]);
  }
  // Within a group any one match is enough; every selected group must match.
  return [...byGroup.values()].every((filterIds) => filterIds.some((filterId) => owned.has(filterId)));
}

/** Ranked matches for the Japanese search box above the filter list. */
export function searchFeatureFilters(query: string, taxonomy: FeatureTagTaxonomy | null): FeatureFilter[] {
  const filters = taxonomy?.filters ?? [];
  const trimmed = query.trim().toLocaleLowerCase('ja');
  if (!trimmed) return [];
  const score = (filter: FeatureFilter): number => {
    const label = filter.labelJa.toLocaleLowerCase('ja');
    if (label === trimmed) return 0;
    if (label.includes(trimmed)) return 1;
    if (filter.searchAliasesJa.some((alias) => alias.toLocaleLowerCase('ja').includes(trimmed))) return 2;
    if (filter.legacyJapaneseTags.some((tag) => tag.toLocaleLowerCase('ja').includes(trimmed))) return 3;
    if (filter.rawTagIds.some((tagId) => tagId.toLocaleLowerCase('ja').includes(trimmed))) return 4;
    if (filter.descriptionJa.toLocaleLowerCase('ja').includes(trimmed)) return 5;
    if (filter.id.toLocaleLowerCase('ja').includes(trimmed)) return 6;
    return Number.POSITIVE_INFINITY;
  };
  return filters
    .map((filter) => ({ filter, value: score(filter) }))
    .filter((entry) => Number.isFinite(entry.value))
    .sort((a, b) => a.value - b.value || a.filter.sortOrder - b.filter.sortOrder)
    .map((entry) => entry.filter);
}

/**
 * Reads a feature selection out of URL parameters, and converts a v2.2.0
 * `tag=` link — a raw English identifier or a Japanese tag — into filter IDs so
 * that shared links keep working.
 */
export function normalizeFeatureFilters(
  params: { features?: string | null; exclude?: string | null; tag?: string | null },
  taxonomy: FeatureTagTaxonomy | null
): FeatureSelection {
  const known = new Set((taxonomy?.filters ?? []).map((filter) => filter.id));
  const split = (value: string | null | undefined) =>
    (value ?? '').split(',').map((item) => item.trim()).filter((item) => known.has(item));

  const selected = split(params.features);
  const excluded = split(params.exclude);

  const legacyTag = params.tag?.trim();
  if (legacyTag && !selected.length) {
    const rawTag = taxonomy?.rawTags.find((entry) => entry.id === legacyTag);
    const legacy = taxonomy?.legacyJapaneseTags.find((entry) => entry.value === legacyTag);
    for (const filterId of rawTag?.filterIds ?? legacy?.filterIds ?? []) {
      if (known.has(filterId) && !selected.includes(filterId)) selected.push(filterId);
    }
  }
  return { selected, excluded: excluded.filter((filterId) => !selected.includes(filterId)) };
}

export function featureSelectionParams(selection: FeatureSelection): { features?: string; exclude?: string } {
  const params: { features?: string; exclude?: string } = {};
  if (selection.selected.length) params.features = selection.selected.join(',');
  if (selection.excluded.length) params.exclude = selection.excluded.join(',');
  return params;
}

export function findFilter(filterId: string, taxonomy: FeatureTagTaxonomy | null): FeatureFilter | undefined {
  return taxonomy?.filters.find((filter) => filter.id === filterId);
}
