/**
 * Feature tags are stored as stable English identifiers and never shown to the
 * reader in that form. `feature-tags.json` maps each identifier to a Japanese
 * label, the group it belongs to, and the filters it satisfies.
 */
export type FeatureGroupId = 'taste_aroma' | 'broth_seasoning' | 'noodle' | 'serving' | 'ingredient' | 'culture';
export type FeatureVisibility = 'filter' | 'detail' | 'internal';

export interface FeatureGroup {
  id: FeatureGroupId;
  labelJa: string;
  descriptionJa: string;
  sortOrder: number;
}

export interface RawTagDefinition {
  id: string;
  labelJa: string;
  /** 'internal' marks a tag that duplicates the category or is bookkeeping. */
  groupId: FeatureGroupId | 'internal';
  visibility: FeatureVisibility;
  filterIds: string[];
}

export interface LegacyTagDefinition {
  value: string;
  labelJa: string;
  visibility: FeatureVisibility;
  filterIds: string[];
}

export interface FeatureFilter {
  id: string;
  labelJa: string;
  descriptionJa: string;
  groupId: FeatureGroupId;
  rawTagIds: string[];
  legacyJapaneseTags: string[];
  searchAliasesJa: string[];
  quick: boolean;
  sortOrder: number;
}

export interface FeatureTagTaxonomy {
  schemaVersion: number;
  version: string;
  locale: 'ja';
  groups: FeatureGroup[];
  filters: FeatureFilter[];
  rawTags: RawTagDefinition[];
  legacyJapaneseTags: LegacyTagDefinition[];
  quickFilterIds: string[];
}

export type FacetSource = 'manual_review' | 'structured_field' | 'numeric_derived' | 'legacy_tag';

/**
 * One reason a dish satisfies a search filter. `displayEligible` separates what
 * a reader may be shown from what merely makes the dish findable: a facet
 * derived from a number is a search match, not a claim about the dish.
 */
export interface FacetEvidence {
  id: string;
  source: FacetSource;
  confidence: number;
  evidence: string;
  displayEligible: boolean;
}

export type CompletenessState = 'known' | 'derived' | 'unknown';

export interface DishFacetIndex {
  dishId: string;
  facets: FacetEvidence[];
  completeness: {
    taste: CompletenessState;
    brothSeasoning: CompletenessState;
    noodle: CompletenessState;
    servingForm: CompletenessState;
    ingredients: CompletenessState;
  };
}

export interface FacetIndex {
  schemaVersion: number;
  dataVersion: string;
  rulesVersion: string;
  seededRecords: number;
  records: DishFacetIndex[];
}

/** A dish tag resolved for display: always Japanese, never the raw identifier. */
export interface ResolvedFeatureTag {
  /** The stored tag, kept for keys and share URLs only. */
  raw: string;
  labelJa: string;
  groupId: FeatureGroupId | 'internal';
  visibility: FeatureVisibility;
  filterIds: string[];
}
