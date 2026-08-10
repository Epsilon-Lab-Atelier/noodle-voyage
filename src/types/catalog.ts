export const tasteKeys = [
  'richness',
  'oiliness',
  'saltiness',
  'sweetness',
  'sourness',
  'heat',
  'umami',
  'animalIntensity',
  'seafoodIntensity',
  'spiceIntensity',
  'herbalIntensity',
  'fermentation',
  'roastedAroma',
  'garlicIntensity',
  'dashiIntensity',
  'sauceIntensity',
  'noodleAroma'
] as const;

export const noodleKeys = ['thickness', 'width', 'firmness', 'elasticity', 'chewiness', 'smoothness'] as const;

export type TasteKey = (typeof tasteKeys)[number];
export type NoodleKey = (typeof noodleKeys)[number];

export type Domain = 'japan' | 'world';
export type NoodleCategory = 'ramen' | 'udon' | 'soba' | 'yakisoba' | 'world_noodle' | 'other';
export type CulturalScope = 'regional' | 'standard' | 'international' | 'contemporary';
export type PublicationStatus = 'published' | 'internal_pending' | 'archived';
export type RegionCode =
  | 'hokkaido'
  | 'tohoku'
  | 'kanto'
  | 'chubu'
  | 'kinki'
  | 'chugoku'
  | 'shikoku'
  | 'kyushu_okinawa';

export type SearchScope = 'japan' | 'world' | 'all';
export type DishForm = 'soup' | 'dry' | 'dipping' | 'cold' | 'fried' | 'instant' | 'hybrid' | 'stew' | 'hot_pot' | 'sauce';

export const tasteLabels: Record<TasteKey, string> = {
  richness: '濃厚さ',
  oiliness: '油分',
  saltiness: '塩味',
  sweetness: '甘味',
  sourness: '酸味',
  heat: '辛味',
  umami: 'うま味',
  animalIntensity: '動物系の強さ',
  seafoodIntensity: '魚介感',
  spiceIntensity: '香辛料',
  herbalIntensity: '香草',
  fermentation: '発酵感',
  roastedAroma: '香ばしさ',
  garlicIntensity: 'にんにく',
  dashiIntensity: 'だしの強さ',
  sauceIntensity: 'ソース・たれの強さ',
  noodleAroma: '麺そのものの香り'
};

export const noodleLabels: Record<NoodleKey, string> = {
  thickness: '太さ',
  width: '平打ち度',
  firmness: '硬さ',
  elasticity: '弾力',
  chewiness: 'もちもち感・噛みごたえ',
  smoothness: 'なめらかさ'
};

export const noodleCategoryLabels: Record<NoodleCategory, string> = {
  ramen: 'ラーメン',
  udon: 'うどん',
  soba: 'そば',
  yakisoba: '焼きそば',
  world_noodle: '世界の麺料理',
  other: 'その他'
};

export const culturalScopeLabels: Record<CulturalScope, string> = {
  regional: 'ご当地',
  standard: '定番スタイル',
  international: '世界の地域料理',
  contemporary: '現代スタイル'
};

/** Scopes that belong to no single place, so they never reach a map or a passport. */
export const placelessScopes: CulturalScope[] = ['standard', 'contemporary'];
export const isPlaceless = (dish: Pick<Dish, 'culturalScope'>) => placelessScopes.includes(dish.culturalScope);

export interface TasteRange {
  typical: number;
  min: number;
  max: number;
}

export interface NoodleProfile {
  materials: string[];
  shape: string;
  thickness: number;
  width: number;
  firmness: number;
  elasticity: number;
  chewiness: number;
  smoothness: number;
  notes: string[];
}

export interface RegionMaster {
  code: RegionCode;
  name: string;
  displayOrder: number;
}

export interface PrefectureMaster {
  code: string;
  name: string;
  regionCode: RegionCode;
  displayOrder: number;
}

export interface Dish {
  id: string;
  slug: string;
  name: string;
  localName: string | null;
  aliases: string[];

  domain: Domain;
  noodleCategory: NoodleCategory;
  culturalScope: CulturalScope;
  publicationStatus: PublicationStatus;

  countryCode: string;
  country: string;
  prefectureCodes: string[];
  prefectureNames: string[];
  prefectureLabel: string | null;
  regionCodes: RegionCode[];
  regionNames: string[];
  city: string | null;
  coordinates: { lat: number; lon: number } | null;

  form: DishForm;
  formLabel: string;
  categoryLabel: string;
  noodle: NoodleProfile;
  broth: {
    bases: string[];
    seasonings: string[];
    aromatics: string[];
    clarity: 'clear' | 'opaque' | 'varied';
  };
  ingredients: string[];
  tags: string[];
  keywords: string[];
  taste: Record<TasteKey, TasteRange>;

  culture: {
    summary: string;
    background: string;
    tradition: number;
    uniqueness: number;
    adventure: number;
  };

  variation: string;
  /** General allergen guidance. Never a substitute for asking the shop. */
  allergenNote: string;
  /** How the taste values were produced; resolved to a label from taxonomy.json. */
  scoreMethod: string;
  publicSourceIds: string[];
  verificationLevel: 'basic' | 'reviewed';
  reviewedAt: string;

  /** Curated: the standard styles a regional dish belongs to. */
  parentStyleIds: string[];
  /** Curated: the regional dishes that illustrate a standard style. */
  regionalExampleIds: string[];
  /** Contemporary styles that grew out of this one. */
  derivedStyleIds: string[];
  /** Curated: neighbouring standard styles, including cross-category ones. */
  relatedStyleIds: string[];
  /** Computed from the taste and noodle values, not from history. */
  relatedIds: string[];
  bridgeIds: string[];
  searchText: string;
}

export interface DataSource {
  id: string;
  title: string;
  publisher: string;
  url: string | null;
  kind: string;
  note: string;
}

export interface DataManifest {
  appVersion: string;
  dataVersion: string;
  catalogSchemaVersion: number;
  lastReviewed: string;
  generatedAt: string;
  counts: {
    total: number;
    japan: number;
    world: number;
    byCategory: Record<NoodleCategory, number>;
    byCulturalScope: Record<CulturalScope, number>;
  };
  notes: string[];
}

export type ProfileMode = 'unset' | 'quick' | 'detailed' | 'legacy';

export interface PreferenceMeta {
  mode: ProfileMode;
  updatedAt: string | null;
}

export interface UserPreferences {
  scope: SearchScope;
  values: Record<TasteKey, number>;
  weights: Record<TasteKey, number>;
  noodle: {
    thickness: number;
    firmness: number;
    elasticity: number;
    chewiness: number;
    smoothness: number;
    weight: number;
  };
  adventure: number;
  softAvoid: string[];
  hardAvoid: string[];
}

export interface RecommendationResult {
  dish: Dish;
  score: number;
  reasons: string[];
  differences: string[];
  novelty: number;
}
