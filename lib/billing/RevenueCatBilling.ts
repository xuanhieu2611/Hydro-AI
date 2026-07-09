import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  PACKAGE_TYPE,
  type CustomerInfo,
  type PurchasesIntroPrice,
  type PurchasesPackage,
} from 'react-native-purchases';

import { billingConfig } from './config';
import type { Billing, EntitlementListener } from './billing';
import type { BillingPeriod, SubscriptionOption } from './types';
import { PurchaseCancelledError } from './errors';

/**
 * Real billing via RevenueCat (used in `supabase` data-source mode). All store
 * access is funneled through here so the rest of the app only ever sees the
 * `Billing` interface + our own types.
 *
 * `configure()` is a no-op without a key, so a build that hasn't had the
 * RevenueCat key added yet won't crash — `getEntitlement()` just reports
 * unentitled (the paywall shows but purchases can't complete until keyed).
 */
export class RevenueCatBilling implements Billing {
  private ready = false;

  configure(): void {
    if (this.ready) return;
    const apiKey =
      Platform.OS === 'ios' ? billingConfig.iosApiKey : billingConfig.androidApiKey;
    if (!apiKey) {
      // eslint-disable-next-line no-console
      console.warn(
        '[billing] No RevenueCat SDK key set for this platform — the paywall ' +
          'will show but purchases are disabled. See docs/PAYMENTS_SETUP.md.',
      );
      return;
    }
    if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.WARN);
    Purchases.configure({ apiKey });
    this.ready = true;
  }

  async logIn(userId: string): Promise<void> {
    if (!this.ready) return;
    await Purchases.logIn(userId);
  }

  async logOut(): Promise<void> {
    if (!this.ready) return;
    // Throws if already anonymous — harmless, and not worth surfacing.
    try {
      await Purchases.logOut();
    } catch {
      /* already anonymous */
    }
  }

  async getEntitlement(): Promise<boolean> {
    if (!this.ready) return false;
    const info = await Purchases.getCustomerInfo();
    return this.isEntitled(info);
  }

  async getOfferings(): Promise<SubscriptionOption[]> {
    if (!this.ready) return [];
    const offerings = await Purchases.getOfferings();
    const offering = billingConfig.offeringId
      ? offerings.all[billingConfig.offeringId] ?? offerings.current
      : offerings.current;
    if (!offering) return [];
    // Yearly first (highest-converting), then the rest as configured.
    return offering.availablePackages
      .map(toOption)
      .sort((a, b) => periodRank(a.period) - periodRank(b.period));
  }

  async purchase(option: SubscriptionOption): Promise<boolean> {
    if (!this.ready) return false;
    try {
      const { customerInfo } = await Purchases.purchasePackage(
        option.raw as PurchasesPackage,
      );
      return this.isEntitled(customerInfo);
    } catch (e) {
      if (e != null && typeof e === 'object' && (e as { userCancelled?: boolean }).userCancelled) {
        throw new PurchaseCancelledError();
      }
      throw e;
    }
  }

  async restore(): Promise<boolean> {
    if (!this.ready) return false;
    const info = await Purchases.restorePurchases();
    return this.isEntitled(info);
  }

  addEntitlementListener(listener: EntitlementListener): () => void {
    if (!this.ready) return () => {};
    const handler = (info: CustomerInfo) => listener(this.isEntitled(info));
    Purchases.addCustomerInfoUpdateListener(handler);
    return () => Purchases.removeCustomerInfoUpdateListener(handler);
  }

  private isEntitled(info: CustomerInfo): boolean {
    return billingConfig.entitlementId in info.entitlements.active;
  }
}

/* --------------------------------- mapping -------------------------------- */

function toOption(pkg: PurchasesPackage): SubscriptionOption {
  const product = pkg.product;
  const period = periodFromPackageType(pkg.packageType);
  return {
    id: pkg.identifier,
    title: titleFor(period),
    priceString: product.priceString,
    period,
    perWeekString: product.pricePerWeekString,
    perWeek: product.pricePerWeek,
    trialDays: freeTrialDays(product.introPrice),
    raw: pkg,
  };
}

function periodFromPackageType(type: PACKAGE_TYPE): BillingPeriod {
  switch (type) {
    case PACKAGE_TYPE.ANNUAL:
      return 'year';
    case PACKAGE_TYPE.MONTHLY:
      return 'month';
    case PACKAGE_TYPE.WEEKLY:
      return 'week';
    default:
      return 'unknown';
  }
}

function titleFor(period: BillingPeriod): string {
  switch (period) {
    case 'year':
      return 'Yearly';
    case 'month':
      return 'Monthly';
    case 'week':
      return 'Weekly';
    default:
      return 'Subscription';
  }
}

/** Rank so yearly sorts first, then monthly, then weekly, then anything else. */
function periodRank(period: BillingPeriod): number {
  return { year: 0, month: 1, week: 2, unknown: 3 }[period];
}

/** Free-trial length in days iff the intro offer is zero-price. */
function freeTrialDays(intro: PurchasesIntroPrice | null): number | null {
  if (!intro || intro.price !== 0) return null;
  const units = intro.periodNumberOfUnits;
  switch (intro.periodUnit) {
    case 'DAY':
      return units;
    case 'WEEK':
      return units * 7;
    case 'MONTH':
      return units * 30;
    case 'YEAR':
      return units * 365;
    default:
      return null;
  }
}
