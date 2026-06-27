import type { Analyzer } from '../analyzer';
import type { AnalysisResult } from '../types';

/** ~1.5s to mimic the real Edge Function round-trip (PRD: < 2s target). */
const AI_DELAY_MS = 1500;
const delay = (ms = AI_DELAY_MS) => new Promise((r) => setTimeout(r, ms));

/**
 * Scripted cases so every result-card UI state is reachable during UI-first
 * development: a confident normal estimate, a low-confidence range (forces
 * confirmation per CLAUDE.md), and a non-drink. The analyzer cycles through
 * them on successive captures.
 */
const SCRIPT: AnalysisResult[] = [
  {
    is_drink: true,
    container_type: 'ceramic_mug',
    beverage_type: 'coffee',
    estimated_volume_ml: 240,
    volume_range_ml: null,
    fill_ratio: 0.8,
    confidence: 0.86,
    hydration_coefficient: 0.8,
    reasoning: 'Detected: ceramic mug, ~80% full.',
  },
  {
    is_drink: true,
    container_type: 'glass',
    beverage_type: 'water',
    estimated_volume_ml: 300,
    volume_range_ml: null,
    fill_ratio: 0.9,
    confidence: 0.93,
    hydration_coefficient: 1.0,
    reasoning: 'Detected: drinking glass, nearly full.',
  },
  {
    is_drink: true,
    container_type: 'tumbler',
    beverage_type: 'water',
    estimated_volume_ml: 240,
    // Low confidence → return a range and force confirmation.
    volume_range_ml: [200, 280],
    fill_ratio: 0.6,
    confidence: 0.58,
    hydration_coefficient: 1.0,
    reasoning: 'Unusual tumbler shape — volume is an estimate.',
  },
  {
    is_drink: false,
    container_type: null,
    beverage_type: null,
    estimated_volume_ml: null,
    volume_range_ml: null,
    fill_ratio: null,
    confidence: 0.12,
    hydration_coefficient: null,
    reasoning: "That doesn't look like a drink.",
  },
];

export class MockAnalyzer implements Analyzer {
  private cursor = 0;

  async analyzeImage(_uri: string): Promise<AnalysisResult> {
    await delay();
    const result = SCRIPT[this.cursor % SCRIPT.length];
    this.cursor += 1;
    return { ...result };
  }
}
