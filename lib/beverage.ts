import type { BeverageType, ContainerType } from './data/types';

/**
 * Presentation helpers for beverages, containers, and hydration class.
 * Pure display concerns — the canonical data lives in ml on LogEntry.
 */

export const BEVERAGE_LABELS: Record<BeverageType, string> = {
  water: 'Water',
  coffee: 'Coffee',
  tea: 'Tea',
  juice: 'Juice',
  soda: 'Soda',
  smoothie: 'Smoothie',
  other: 'Drink',
};

/** Emoji glyphs read more clearly than the limited Ionicons drink set. */
export const BEVERAGE_EMOJI: Record<BeverageType, string> = {
  water: '💧',
  coffee: '☕️',
  tea: '🍵',
  juice: '🧃',
  soda: '🥤',
  smoothie: '🥤',
  other: '🥛',
};

export const CONTAINER_LABELS: Record<ContainerType, string> = {
  glass: 'glass',
  mug: 'mug',
  ceramic_mug: 'ceramic mug',
  disposable_cup: 'disposable cup',
  water_bottle: 'water bottle',
  tumbler: 'tumbler',
  can: 'can',
  pint_glass: 'pint glass',
  other: 'container',
};

/** Sensible default hydration coefficient per beverage (PRD §12 Q1). */
export const DEFAULT_HYDRATION_COEFFICIENT: Record<BeverageType, number> = {
  water: 1.0,
  tea: 0.9,
  juice: 0.85,
  smoothie: 0.8,
  coffee: 0.8,
  soda: 0.7,
  other: 0.9,
};

export type HydrationClass = 'hydrating' | 'partial' | 'non-hydrating';

/** Bucket a coefficient into the three result-card hydration classes. */
export function hydrationClass(coefficient: number): HydrationClass {
  if (coefficient >= 0.9) return 'hydrating';
  if (coefficient >= 0.5) return 'partial';
  return 'non-hydrating';
}

export const HYDRATION_CLASS_META: Record<
  HydrationClass,
  { label: string; tint: string; bg: string }
> = {
  hydrating: { label: 'Hydrating', tint: '#0284C7', bg: '#E6F4FE' },
  partial: { label: 'Partially hydrating', tint: '#B45309', bg: '#FEF3C7' },
  'non-hydrating': { label: 'Low hydration', tint: '#9F1239', bg: '#FFE4E6' },
};

export function beverageLabel(type: BeverageType | null): string {
  return type ? BEVERAGE_LABELS[type] : 'Drink';
}

export function beverageEmoji(type: BeverageType | null): string {
  return type ? BEVERAGE_EMOJI[type] : '🥛';
}

export function containerLabel(type: ContainerType | null): string {
  return type ? CONTAINER_LABELS[type] : 'container';
}
