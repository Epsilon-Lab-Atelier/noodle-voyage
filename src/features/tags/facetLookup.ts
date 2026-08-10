import { noodleLabels, tasteLabels, type NoodleKey, type TasteKey } from '../../types/catalog';
import type { DishFacetIndex, FacetEvidence, FacetIndex } from './featureTagTypes';

/** Empty stand-in used until the index has loaded, so callers never branch on null. */
const emptyRecord: DishFacetIndex = {
  dishId: '',
  facets: [],
  completeness: {
    taste: 'unknown',
    brothSeasoning: 'unknown',
    noodle: 'unknown',
    servingForm: 'unknown',
    ingredients: 'unknown'
  }
};

export function facetRecordFor(dishId: string, index: FacetIndex | null): DishFacetIndex {
  return index?.records.find((record) => record.dishId === dishId) ?? emptyRecord;
}

/** Every filter the dish matches, whether or not the reason may be shown. */
export function searchableFacetIds(dishId: string, index: FacetIndex | null): Set<string> {
  return new Set(facetRecordFor(dishId, index).facets.map((facet) => facet.id));
}

/** Only the facets a reader may be shown as a characteristic of the dish. */
export function displayableFacets(dishId: string, index: FacetIndex | null): FacetEvidence[] {
  return facetRecordFor(dishId, index).facets.filter((facet) => facet.displayEligible);
}

/** `taste.umami.typical` → うま味, `noodle.thickness` → 麺の太さ. */
function measuredLabel(dottedPath: string): string {
  const [group, key] = dottedPath.split('.');
  if (group === 'taste' && key && key in tasteLabels) return tasteLabels[key as TasteKey];
  if (group === 'noodle' && key && key in noodleLabels) return `麺の${noodleLabels[key as NoodleKey]}`;
  return '数値';
}

/**
 * Why a dish came up in a search, in the reader's words. A numeric threshold is
 * phrased as a resemblance and shows the number behind it, never as a claim
 * that the dish is officially classified that way.
 */
export function matchReason(facet: FacetEvidence, labelJa: string): string {
  if (facet.source === 'numeric_derived') {
    const measured = /^numeric:([\w.]+)=([\d.]+)$/.exec(facet.evidence);
    if (measured) {
      const [, dottedPath, value] = measured;
      return `${labelJa}に近い: ${measuredLabel(dottedPath ?? '')} ${value} / 5`;
    }
    return `${labelJa}に近い数値です`;
  }
  if (facet.source === 'manual_review') return `${labelJa}: 資料で確認済み`;
  if (facet.source === 'structured_field') return `${labelJa}: 料理の構成から`;
  return `${labelJa}: 登録された特徴から`;
}
