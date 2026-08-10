/**
 * @vitest-environment jsdom
 */
import fs from 'node:fs';
import path from 'node:path';
import { MemoryRouter } from 'react-router-dom';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FacetIndex, FeatureTagTaxonomy } from '../src/features/tags/featureTagTypes';
import type { Dish } from '../src/types/catalog';

const taxonomy = JSON.parse(
  fs.readFileSync(path.resolve('public/data/feature-tags.json'), 'utf8')
) as FeatureTagTaxonomy;
const catalog = JSON.parse(fs.readFileSync(path.resolve('public/data/catalog.json'), 'utf8')) as Dish[];
const facetIndex = JSON.parse(fs.readFileSync(path.resolve('public/data/facet-index.json'), 'utf8')) as FacetIndex;

// The card reads the dictionary and the facet index through the shared loader;
// serve it the real published files instead of a network request.
vi.mock('../src/data/catalog', () => ({
  loadFeatureTags: () => Promise.resolve(taxonomy),
  loadFacetIndex: () => Promise.resolve(facetIndex)
}));

const { DishCard } = await import('../src/components/DishCard');
const { useFeatureTags } = await import('../src/features/tags/useFeatureTags');
const { groupDishDisplayFeatures } = await import('../src/features/tags/resolveFeatureTag');

const rawTagIds = new Set(taxonomy.rawTags.map((tag) => tag.id));

function renderCard(dish: Dish) {
  return render(<MemoryRouter><DishCard dish={dish} /></MemoryRouter>);
}

/** Primes the module-level dictionary cache the card reads from. */
function Primer() {
  useFeatureTags();
  return null;
}

describe('raw English tags never reach the screen', () => {
  beforeAll(async () => {
    render(<Primer />);
    await Promise.resolve();
    cleanup();
  });

  afterEach(() => cleanup());

  it('shows Japanese labels on a dish card, not the stored identifiers', () => {
    const dish = catalog.find((entry) => entry.tags.includes('rich'));
    expect(dish).toBeDefined();
    renderCard(dish as Dish);
    const tags = screen.getByLabelText('主な特徴');
    expect(tags.textContent ?? '').not.toBe('');
    for (const word of (tags.textContent ?? '').split(/\s+/).filter(Boolean)) {
      expect(rawTagIds.has(word)).toBe(false);
    }
  });

  it('renders no raw identifier anywhere in a card, including its labels', () => {
    for (const dish of catalog.filter((entry) => entry.tags.length > 0).slice(0, 40)) {
      const { container } = renderCard(dish);
      const text = container.textContent ?? '';
      const labels = [...container.querySelectorAll('[aria-label]')]
        .map((node) => node.getAttribute('aria-label') ?? '')
        .join(' ');
      for (const tag of dish.tags) {
        if (!rawTagIds.has(tag)) continue;
        expect(text).not.toContain(tag);
        expect(labels).not.toContain(tag);
      }
      cleanup();
    }
  });

  it('caps the card at three features and counts the rest', () => {
    const dish = catalog.find((entry) => entry.tags.length >= 5);
    expect(dish).toBeDefined();
    const { container } = renderCard(dish as Dish);
    const chips = container.querySelectorAll('.tag-row .tag');
    expect(chips.length).toBeLessThanOrEqual(4);
    expect(container.querySelector('.tag.is-more')?.textContent).toMatch(/^\+\d+$/);
  });

  it('groups the dish page features in Japanese', () => {
    const dish = catalog.find((entry) => entry.id === 'jp-udon-toyohashi-curry') as Dish;
    const groups = groupDishDisplayFeatures(dish, taxonomy, facetIndex);
    expect(groups.length).toBeGreaterThan(0);
    for (const group of groups) {
      expect(group.labelJa).not.toMatch(/^[ -~]+$/);
      for (const feature of group.tags) expect(feature.labelJa).not.toMatch(/^[ -~]+$/);
    }
  });
});
