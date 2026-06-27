import type { AnalysisResult } from './types';

/**
 * The AI boundary. Phase 1 ships `MockAnalyzer` (canned results); Phase B
 * adds `EdgeFunctionAnalyzer` that POSTs a downscaled image to the
 * `analyze-image` Supabase Edge Function. Same interface either way.
 *
 * Per CLAUDE.md, the app NEVER calls the Claude API directly — only through
 * this boundary (which the real impl routes via the Edge Function).
 */
export interface Analyzer {
  /** @param uri local image URI (camera capture or picked photo). */
  analyzeImage(uri: string): Promise<AnalysisResult>;
}
