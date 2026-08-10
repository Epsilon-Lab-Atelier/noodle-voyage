import { useEffect, useState } from 'react';
import { loadCatalog, loadFacetIndex, loadFeatureTags, loadManifest, loadSources, loadTaxonomy, type DataTaxonomy } from './catalog';
import type { FacetIndex, FeatureTagTaxonomy } from '../features/tags/featureTagTypes';
import type { DataManifest, DataSource, Dish } from '../types/catalog';

interface CatalogState {
  catalog: Dish[];
  sources: DataSource[];
  manifest: DataManifest | null;
  taxonomy: DataTaxonomy | null;
  featureTags: FeatureTagTaxonomy | null;
  facetIndex: FacetIndex | null;
  loading: boolean;
  error: string | null;
}

const initialState: CatalogState = {
  catalog: [],
  sources: [],
  manifest: null,
  taxonomy: null,
  featureTags: null,
  facetIndex: null,
  loading: true,
  error: null
};

export function useCatalogData(): CatalogState {
  const [state, setState] = useState<CatalogState>(initialState);

  useEffect(() => {
    let active = true;
    Promise.all([loadCatalog(), loadSources(), loadManifest(), loadTaxonomy(), loadFeatureTags(), loadFacetIndex()])
      .then(([catalog, sources, manifest, taxonomy, featureTags, facetIndex]) => {
        if (active) setState({ catalog, sources, manifest, taxonomy, featureTags, facetIndex, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (active) setState((previous) => ({ ...previous, loading: false, error: error instanceof Error ? error.message : 'データの読み込みに失敗しました。' }));
      });
    return () => { active = false; };
  }, []);

  return state;
}
