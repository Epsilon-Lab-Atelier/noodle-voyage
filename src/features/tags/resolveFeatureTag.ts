import { displayableFacets } from './facetLookup';
import type {
  FacetIndex,
  FeatureGroupId,
  FeatureTagTaxonomy,
  ResolvedFeatureTag
} from './featureTagTypes';

const isAscii = (value: string) => /^[ -~]+$/.test(value);

/**
 * Resolves one stored tag into something the reader can understand.
 *
 * 1. A known English identifier resolves to its Japanese label.
 * 2. A tag written in Japanese passes through, whether the dictionary knows it
 *    or not, so v2.1.2 data keeps working.
 * 3. An unknown English identifier resolves to nothing and is never shown.
 *    `npm run check:data` fails if a published dish still carries one.
 */
export function resolveFeatureTag(tag: string, taxonomy: FeatureTagTaxonomy | null): ResolvedFeatureTag | null {
  if (!tag) return null;
  const rawTag = taxonomy?.rawTags.find((entry) => entry.id === tag);
  if (rawTag) {
    return {
      raw: tag,
      labelJa: rawTag.labelJa,
      groupId: rawTag.groupId,
      visibility: rawTag.visibility,
      filterIds: rawTag.filterIds
    };
  }
  const legacy = taxonomy?.legacyJapaneseTags.find((entry) => entry.value === tag);
  if (legacy) {
    const groupId = taxonomy?.filters.find((filter) => filter.id === legacy.filterIds[0])?.groupId ?? 'culture';
    return { raw: tag, labelJa: legacy.labelJa, groupId, visibility: legacy.visibility, filterIds: legacy.filterIds };
  }
  if (isAscii(tag)) return null;
  return { raw: tag, labelJa: tag, groupId: 'culture', visibility: 'detail', filterIds: [] };
}

/**
 * What a reader is shown for one dish: the facets whose evidence may be
 * displayed, plus any detail-only tag that belongs to no search filter. A facet
 * derived from a number is deliberately absent — it makes the dish findable
 * without asserting anything about it.
 */
export function resolveDishDisplayFeatures(
  dish: { id: string; tags: string[] },
  taxonomy: FeatureTagTaxonomy | null,
  facetIndex: FacetIndex | null
): ResolvedFeatureTag[] {
  const byLabel = new Map<string, ResolvedFeatureTag>();
  for (const facet of displayableFacets(dish.id, facetIndex)) {
    const filter = taxonomy?.filters.find((entry) => entry.id === facet.id);
    if (!filter || byLabel.has(filter.labelJa)) continue;
    byLabel.set(filter.labelJa, {
      raw: facet.id,
      labelJa: filter.labelJa,
      groupId: filter.groupId,
      visibility: 'filter',
      filterIds: [filter.id]
    });
  }
  // Detail-only wording (a local colour name, say) has no filter to carry it.
  for (const entry of resolveDishFeatureTags(dish.tags, taxonomy)) {
    if (entry.filterIds.length > 0 || byLabel.has(entry.labelJa)) continue;
    byLabel.set(entry.labelJa, entry);
  }
  const quick = new Set(taxonomy?.quickFilterIds ?? []);
  const groupOrder = new Map((taxonomy?.groups ?? []).map((group) => [group.id as string, group.sortOrder]));
  const rank = (entry: ResolvedFeatureTag) => {
    if (entry.filterIds.some((filterId) => quick.has(filterId))) return 0;
    if (entry.visibility === 'detail') return 1000;
    return groupOrder.get(entry.groupId) ?? 900;
  };
  return [...byLabel.values()].sort((a, b) => rank(a) - rank(b));
}

/** The same list, split into the six display groups for the dish page. */
export function groupDishDisplayFeatures(
  dish: { id: string; tags: string[] },
  taxonomy: FeatureTagTaxonomy | null,
  facetIndex: FacetIndex | null
): Array<{ id: FeatureGroupId; labelJa: string; tags: ResolvedFeatureTag[] }> {
  const resolved = resolveDishDisplayFeatures(dish, taxonomy, facetIndex);
  return (taxonomy?.groups ?? [])
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((group) => ({
      id: group.id,
      labelJa: group.labelJa,
      tags: resolved.filter((entry) => entry.groupId === group.id)
    }))
    .filter((group) => group.tags.length > 0);
}

/**
 * The tags of one dish, in display order, with anything internal removed and
 * labels that collapse to the same Japanese wording shown only once.
 */
export function resolveDishFeatureTags(tags: string[], taxonomy: FeatureTagTaxonomy | null): ResolvedFeatureTag[] {
  const groupOrder = new Map((taxonomy?.groups ?? []).map((group) => [group.id as string, group.sortOrder]));
  const quick = new Set(taxonomy?.quickFilterIds ?? []);
  const seen = new Set<string>();
  const resolved: ResolvedFeatureTag[] = [];
  for (const tag of tags) {
    const entry = resolveFeatureTag(tag, taxonomy);
    if (!entry || entry.visibility === 'internal') continue;
    if (seen.has(entry.labelJa)) continue;
    seen.add(entry.labelJa);
    resolved.push(entry);
  }
  const rank = (entry: ResolvedFeatureTag) => {
    if (entry.filterIds.some((filterId) => quick.has(filterId))) return 0;
    if (entry.visibility === 'detail') return 1000;
    return groupOrder.get(entry.groupId) ?? 900;
  };
  return resolved.sort((a, b) => rank(a) - rank(b));
}

/** The same list, split into the six display groups for the dish page. */
export function groupDishFeatureTags(
  tags: string[],
  taxonomy: FeatureTagTaxonomy | null
): Array<{ id: FeatureGroupId; labelJa: string; tags: ResolvedFeatureTag[] }> {
  const resolved = resolveDishFeatureTags(tags, taxonomy);
  return (taxonomy?.groups ?? [])
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((group) => ({
      id: group.id,
      labelJa: group.labelJa,
      tags: resolved.filter((entry) => entry.groupId === group.id)
    }))
    .filter((group) => group.tags.length > 0);
}
