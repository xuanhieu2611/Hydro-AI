import type { BeverageType, NewLogEntry } from './data/types';
import { DEFAULT_HYDRATION_COEFFICIENT, type MaterialCommunityIconName } from './beverage';

/**
 * One-tap quick-log tiles for the home screen (PRD §4.3 Quick Log Bar) and the
 * manual-log fallback. Each tile logs a fixed beverage + volume with no photo,
 * so there's no AI confidence (ai_confidence_score stays null).
 */
export interface QuickLogTile {
  id: string;
  label: string;
  icon: MaterialCommunityIconName;
  beverage_type: BeverageType;
  volumeMl: number;
}

export const QUICK_LOG_TILES: QuickLogTile[] = [
  { id: 'glass-water', label: 'Glass', icon: 'cup-water', beverage_type: 'water', volumeMl: 250 },
  { id: 'bottle-water', label: 'Bottle', icon: 'bottle-soda-classic', beverage_type: 'water', volumeMl: 500 },
  { id: 'coffee', label: 'Coffee', icon: 'coffee', beverage_type: 'coffee', volumeMl: 240 },
  { id: 'tea', label: 'Tea', icon: 'tea', beverage_type: 'tea', volumeMl: 250 },
];

/** Build the `addLogEntry` payload for a quick tile (no photo, no AI). */
export function tileToLogEntry(tile: QuickLogTile): NewLogEntry {
  return {
    beverage_type: tile.beverage_type,
    estimated_volume_ml: tile.volumeMl,
    hydration_coefficient: DEFAULT_HYDRATION_COEFFICIENT[tile.beverage_type],
    thumbnail_url: null,
    ai_confidence_score: null,
  };
}
