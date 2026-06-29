import * as FileSystem from 'expo-file-system/legacy';
import { FunctionsHttpError } from '@supabase/supabase-js';

import type { Analyzer } from '../analyzer';
import type { AnalysisResult } from '../types';
import { RateLimitError } from '../errors';
import { supabase, ensureSession } from '../../supabase/client';

/**
 * Real AI boundary: POSTs a downscaled image to the `analyze-image` Edge
 * Function, which calls Claude Vision server-side (CLAUDE.md: the app NEVER
 * calls the AI API directly, and full-res images are never persisted — the
 * function processes the image ephemerally). Same interface as MockAnalyzer.
 */
export class EdgeFunctionAnalyzer implements Analyzer {
  async analyzeImage(uri: string): Promise<AnalysisResult> {
    await ensureSession(); // functions.invoke attaches the user's JWT

    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const { data, error } = await supabase.functions.invoke<AnalysisResult>(
      'analyze-image',
      { body: { image_base64: base64, media_type: 'image/jpeg' } },
    );
    if (error) {
      // Non-2xx responses arrive as FunctionsHttpError with the body still on
      // `context`; surface the rate limit (429) as a typed error the UI can act
      // on, and unwrap other errors to the server's message.
      if (error instanceof FunctionsHttpError) {
        const payload = await error.context.json().catch(() => null);
        if (error.context.status === 429) {
          throw new RateLimitError(
            payload?.error ?? 'You’re going a bit fast — try again shortly.',
            payload?.limit_kind ?? null,
            payload?.retry_after_seconds ?? null,
          );
        }
        if (payload?.error) throw new Error(payload.error);
      }
      throw error;
    }
    if (!data) throw new Error('analyze-image returned no result.');
    return data;
  }
}
