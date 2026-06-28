import * as FileSystem from 'expo-file-system/legacy';

import type { Analyzer } from '../analyzer';
import type { AnalysisResult } from '../types';
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
    if (error) throw error;
    if (!data) throw new Error('analyze-image returned no result.');
    return data;
  }
}
