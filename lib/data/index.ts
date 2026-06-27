import type { DataRepository } from './repository';
import type { Analyzer } from './analyzer';
import { MockRepository } from './mock/MockRepository';
import { MockAnalyzer } from './mock/MockAnalyzer';

/**
 * Provider selector. `EXPO_PUBLIC_DATA_SOURCE` picks the implementation
 * (default 'mock'). Phase B adds the 'supabase' branch — SupabaseRepository
 * + EdgeFunctionAnalyzer — and nothing else in the app changes.
 *
 * Singletons so the in-memory mock store is shared across the app session.
 */
type DataSource = 'mock' | 'supabase';

const source = (process.env.EXPO_PUBLIC_DATA_SOURCE ?? 'mock') as DataSource;

function createRepository(): DataRepository {
  switch (source) {
    case 'supabase':
      // TODO(Phase B): return new SupabaseRepository();
      throw new Error(
        'SupabaseRepository not implemented yet. Set EXPO_PUBLIC_DATA_SOURCE=mock.',
      );
    case 'mock':
    default:
      return new MockRepository();
  }
}

function createAnalyzer(): Analyzer {
  switch (source) {
    case 'supabase':
      // TODO(Phase B): return new EdgeFunctionAnalyzer();
      throw new Error(
        'EdgeFunctionAnalyzer not implemented yet. Set EXPO_PUBLIC_DATA_SOURCE=mock.',
      );
    case 'mock':
    default:
      return new MockAnalyzer();
  }
}

export const repository: DataRepository = createRepository();
export const analyzer: Analyzer = createAnalyzer();
export const dataSource: DataSource = source;
