import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { billing } from './index';
import type { EntitlementStatus } from './types';
import { dataSource } from '../data';
import { supabase } from '../supabase/client';
import { useSession } from '../query/hooks';

interface BillingContextValue {
  /** 'loading' until the first entitlement check resolves post-auth. */
  status: EntitlementStatus;
  entitled: boolean;
  /** Re-check entitlement on demand (e.g. after a restore). */
  refresh: () => Promise<void>;
}

const BillingContext = createContext<BillingContextValue | null>(null);

/**
 * Owns the single source of truth for "is this customer premium", so the gate
 * in `app/_layout` and the paywall read the same reactive value (like
 * `useSession` for auth). It:
 *   1. configures the SDK once at startup;
 *   2. on sign-in, identifies the RevenueCat customer by the Supabase uid so
 *      entitlements follow the account (this is why the paywall sits *after*
 *      sign-in), then reads the entitlement;
 *   3. subscribes to CustomerInfo updates, so a completed purchase/restore flips
 *      the gate to the app automatically;
 *   4. resets to anonymous on sign-out.
 *
 * Mock mode reports entitled immediately (paywall bypassed) unless
 * `EXPO_PUBLIC_FORCE_PAYWALL=1` — see MockBilling.
 */
export function BillingProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  const [entitled, setEntitled] = useState<boolean | null>(null);
  // Serialize async resolves so a stale check can't clobber a newer one.
  const runId = useRef(0);

  // One-time SDK configuration.
  useEffect(() => {
    billing.configure();
  }, []);

  useEffect(() => {
    // Not signed in yet → unknown; return to anonymous on the RevenueCat side.
    if (session !== 'authenticated') {
      setEntitled(null);
      billing.logOut().catch(() => {});
      return;
    }

    const myRun = ++runId.current;
    let active = true;

    (async () => {
      // Identify by Supabase uid (skipped in mock — there's no real session).
      if (dataSource === 'supabase') {
        const { data } = await supabase.auth.getUser();
        const uid = data.user?.id;
        if (uid) await billing.logIn(uid).catch(() => {});
      }
      const ent = await billing.getEntitlement().catch(() => false);
      if (active && myRun === runId.current) setEntitled(ent);
    })();

    // React to purchases/restores/renewals completing anywhere.
    const unsub = billing.addEntitlementListener((next) => {
      if (myRun === runId.current) setEntitled(next);
    });

    return () => {
      active = false;
      unsub();
    };
  }, [session]);

  const value = useMemo<BillingContextValue>(() => {
    const status: EntitlementStatus =
      entitled == null ? 'loading' : entitled ? 'entitled' : 'unentitled';
    return {
      status,
      entitled: entitled === true,
      refresh: async () => {
        const ent = await billing.getEntitlement().catch(() => false);
        setEntitled(ent);
      },
    };
  }, [entitled]);

  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>;
}

/** Reactive entitlement for the gate and paywall. */
export function useBilling(): BillingContextValue {
  const ctx = useContext(BillingContext);
  if (!ctx) throw new Error('useBilling must be used within a BillingProvider');
  return ctx;
}
