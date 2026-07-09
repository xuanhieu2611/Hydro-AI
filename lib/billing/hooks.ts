import { useQuery } from '@tanstack/react-query';

import { billing } from './index';
import type { SubscriptionOption } from './types';

/**
 * The plans to render on the paywall. Cached briefly — offerings rarely change
 * within a session, and RevenueCat caches them natively too.
 */
export function useOfferings() {
  return useQuery<SubscriptionOption[]>({
    queryKey: ['billing', 'offerings'],
    queryFn: () => billing.getOfferings(),
    staleTime: 5 * 60 * 1000,
  });
}
