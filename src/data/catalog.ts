import { z } from 'zod';
import type { DataManifest, DataSource, Dish } from '../types/catalog';
import type { FacetIndex, FeatureTagTaxonomy } from '../features/tags/featureTagTypes';

const tasteRangeSchema = z.object({
  typical: z.number().min(0).max(5),
  min: z.number().min(0).max(5),
  max: z.number().min(0).max(5)
});

const regionCodeSchema = z.enum(['hokkaido', 'tohoku', 'kanto', 'chubu', 'kinki', 'chugoku', 'shikoku', 'kyushu_okinawa']);

const dishSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  localName: z.string().nullable(),
  aliases: z.array(z.string()),
  domain: z.enum(['japan', 'world']),
  noodleCategory: z.enum(['ramen', 'udon', 'soba', 'yakisoba', 'world_noodle', 'other']),
  culturalScope: z.enum(['regional', 'standard', 'international', 'contemporary']),
  publicationStatus: z.enum(['published', 'internal_pending', 'archived']),
  countryCode: z.string(),
  country: z.string(),
  prefectureCodes: z.array(z.string()),
  prefectureNames: z.array(z.string()),
  prefectureLabel: z.string().nullable(),
  regionCodes: z.array(regionCodeSchema),
  regionNames: z.array(z.string()),
  city: z.string().nullable(),
  coordinates: z.object({ lat: z.number(), lon: z.number() }).nullable(),
  form: z.enum(['soup', 'dry', 'dipping', 'cold', 'fried', 'instant', 'hybrid', 'stew', 'hot_pot', 'sauce']),
  formLabel: z.string(),
  categoryLabel: z.string(),
  noodle: z.object({
    materials: z.array(z.string()),
    shape: z.string(),
    thickness: z.number(),
    width: z.number(),
    firmness: z.number(),
    elasticity: z.number(),
    chewiness: z.number(),
    smoothness: z.number(),
    notes: z.array(z.string())
  }),
  broth: z.object({
    bases: z.array(z.string()),
    seasonings: z.array(z.string()),
    aromatics: z.array(z.string()),
    clarity: z.enum(['clear', 'opaque', 'varied'])
  }),
  ingredients: z.array(z.string()),
  tags: z.array(z.string()),
  keywords: z.array(z.string()),
  taste: z.record(z.string(), tasteRangeSchema),
  culture: z.object({
    summary: z.string(),
    background: z.string(),
    tradition: z.number(),
    uniqueness: z.number(),
    adventure: z.number()
  }),
  variation: z.string(),
  allergenNote: z.string(),
  scoreMethod: z.string(),
  publicSourceIds: z.array(z.string()),
  verificationLevel: z.enum(['basic', 'reviewed']),
  reviewedAt: z.string(),
  searchText: z.string(),
  parentStyleIds: z.array(z.string()),
  regionalExampleIds: z.array(z.string()),
  derivedStyleIds: z.array(z.string()),
  relatedStyleIds: z.array(z.string()),
  relatedIds: z.array(z.string()),
  bridgeIds: z.array(z.string())
});

const catalogSchema = z.array(dishSchema);
const sourceSchema = z.array(z.object({
  id: z.string(),
  title: z.string(),
  publisher: z.string(),
  url: z.string().nullable(),
  kind: z.string(),
  note: z.string()
}));
const manifestSchema = z.object({
  appVersion: z.string(),
  dataVersion: z.string(),
  catalogSchemaVersion: z.number(),
  featureTagVersion: z.string(),
  lastReviewed: z.string(),
  generatedAt: z.string(),
  counts: z.object({
    total: z.number(),
    japan: z.number(),
    world: z.number(),
    regionalExampleRelations: z.number(),
    byCategory: z.record(z.string(), z.number()),
    byCulturalScope: z.record(z.string(), z.number())
  }),
  notes: z.array(z.string())
});

const featureVisibilitySchema = z.enum(['filter', 'detail', 'internal']);
const featureGroupIdSchema = z.enum(['taste_aroma', 'broth_seasoning', 'noodle', 'serving', 'ingredient', 'culture']);
const facetSourceSchema = z.enum(['manual_review', 'structured_field', 'numeric_derived', 'legacy_tag']);
const completenessSchema = z.enum(['known', 'derived', 'unknown']);
const facetIndexSchema = z.object({
  schemaVersion: z.number(),
  dataVersion: z.string(),
  rulesVersion: z.string(),
  seededRecords: z.number(),
  records: z.array(z.object({
    dishId: z.string(),
    facets: z.array(z.object({
      id: z.string(),
      source: facetSourceSchema,
      confidence: z.number(),
      evidence: z.string(),
      displayEligible: z.boolean()
    })),
    completeness: z.object({
      taste: completenessSchema,
      brothSeasoning: completenessSchema,
      noodle: completenessSchema,
      servingForm: completenessSchema,
      ingredients: completenessSchema
    })
  }))
});

const featureTagsSchema = z.object({
  schemaVersion: z.number(),
  version: z.string(),
  locale: z.literal('ja'),
  groups: z.array(z.object({
    id: featureGroupIdSchema,
    labelJa: z.string(),
    descriptionJa: z.string(),
    sortOrder: z.number()
  })),
  filters: z.array(z.object({
    id: z.string(),
    labelJa: z.string(),
    descriptionJa: z.string(),
    groupId: featureGroupIdSchema,
    rawTagIds: z.array(z.string()),
    legacyJapaneseTags: z.array(z.string()),
    searchAliasesJa: z.array(z.string()),
    quick: z.boolean(),
    sortOrder: z.number()
  })),
  rawTags: z.array(z.object({
    id: z.string(),
    labelJa: z.string(),
    groupId: z.union([featureGroupIdSchema, z.literal('internal')]),
    visibility: featureVisibilitySchema,
    filterIds: z.array(z.string())
  })),
  legacyJapaneseTags: z.array(z.object({
    value: z.string(),
    labelJa: z.string(),
    visibility: featureVisibilitySchema,
    filterIds: z.array(z.string())
  })),
  quickFilterIds: z.array(z.string())
});

const taxonomySchema = z.object({
  noodleCategories: z.record(z.string(), z.string()),
  culturalScopes: z.record(z.string(), z.string()),
  forms: z.record(z.string(), z.string()),
  contextualLabels: z.record(z.string(), z.string()),
  scoreMethods: z.record(z.string(), z.string()),
  relationTypes: z.record(z.string(), z.string()),
  tasteLabels: z.record(z.string(), z.string()),
  noodleLabels: z.record(z.string(), z.string())
});

export type DataTaxonomy = z.infer<typeof taxonomySchema>;

let facetIndexPromise: Promise<FacetIndex> | null = null;
let featureTagsPromise: Promise<FeatureTagTaxonomy> | null = null;
let taxonomyPromise: Promise<DataTaxonomy> | null = null;
let catalogPromise: Promise<Dish[]> | null = null;
let sourcePromise: Promise<DataSource[]> | null = null;
let manifestPromise: Promise<DataManifest> | null = null;

async function fetchJson(relativePath: string): Promise<unknown> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/${relativePath}`);
  if (!response.ok) throw new Error(`データを読み込めませんでした: ${relativePath} (${response.status})`);
  return response.json();
}

export function loadCatalog(): Promise<Dish[]> {
  catalogPromise ??= fetchJson('catalog.json').then((data) => catalogSchema.parse(data) as Dish[]);
  return catalogPromise;
}

export function loadSources(): Promise<DataSource[]> {
  sourcePromise ??= fetchJson('sources.json').then((data) => sourceSchema.parse(data) as DataSource[]);
  return sourcePromise;
}

export function loadFeatureTags(): Promise<FeatureTagTaxonomy> {
  featureTagsPromise ??= fetchJson('feature-tags.json').then((data) => featureTagsSchema.parse(data) as FeatureTagTaxonomy);
  return featureTagsPromise;
}

export function loadFacetIndex(): Promise<FacetIndex> {
  facetIndexPromise ??= fetchJson('facet-index.json').then((data) => facetIndexSchema.parse(data) as FacetIndex);
  return facetIndexPromise;
}

export function loadTaxonomy(): Promise<DataTaxonomy> {
  taxonomyPromise ??= fetchJson('taxonomy.json').then((data) => taxonomySchema.parse(data));
  return taxonomyPromise;
}

export function loadManifest(): Promise<DataManifest> {
  manifestPromise ??= fetchJson('manifest.json').then((data) => manifestSchema.parse(data) as DataManifest);
  return manifestPromise;
}
