import { culturalScopeLabels, type CulturalScope } from '../types/catalog';

/**
 * 位置づけ is its own axis, separate from the noodle category. 現代スタイル is
 * marked by its Japanese label first and a teal outline second, never by a
 * category colour of its own — the colour repeats what the words already say.
 */
export function ScopeBadge({ scope }: { scope: CulturalScope }) {
  const modifier = scope === 'contemporary' ? ' is-contemporary' : scope === 'standard' ? ' is-standard' : '';
  return <span className={`scope-badge${modifier}`}>{culturalScopeLabels[scope]}</span>;
}
