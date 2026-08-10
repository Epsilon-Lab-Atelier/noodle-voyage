import { useEffect, useState } from 'react';
import { loadFacetIndex, loadFeatureTags } from '../../data/catalog';
import type { FacetIndex, FeatureTagTaxonomy } from './featureTagTypes';

// The dictionary and the facet index are small, immutable and needed by cards
// deep in the tree, so they are cached once here instead of being threaded
// through every component.
let cached: { taxonomy: FeatureTagTaxonomy; facetIndex: FacetIndex } | null = null;

export function useFeatureTags(): { taxonomy: FeatureTagTaxonomy | null; facetIndex: FacetIndex | null } {
  const [value, setValue] = useState(cached);

  useEffect(() => {
    if (cached) return;
    let active = true;
    void Promise.all([loadFeatureTags(), loadFacetIndex()])
      .then(([taxonomy, facetIndex]) => {
        cached = { taxonomy, facetIndex };
        if (active) setValue(cached);
      })
      .catch(() => {
        // Features are description around the dish itself; a failed load hides
        // them rather than breaking the page.
      });
    return () => { active = false; };
  }, []);

  return { taxonomy: value?.taxonomy ?? null, facetIndex: value?.facetIndex ?? null };
}
