# Payments Setup (RevenueCat hard paywall)

Hydro AI ships a **hard paywall**: once a user finishes onboarding and signs in,
the app is locked behind a subscription (7-day free trial → Yearly/Monthly).
Billing goes through **RevenueCat**, wrapped by the `lib/billing/` interface —
screens never touch `react-native-purchases` directly (same rule as the data
layer). This doc is the one-time setup to make real purchases work.

## How it fits together

- `EXPO_PUBLIC_DATA_SOURCE=mock` → `MockBilling`: **paywall bypassed** (always
  entitled) so UI iteration stays fast. Set `EXPO_PUBLIC_FORCE_PAYWALL=1` to
  preview the paywall — a "purchase" just flips an in-memory flag. You can also
  toggle lock/unlock from the **Dev screen** (`app/dev.tsx`).
- `EXPO_PUBLIC_DATA_SOURCE=supabase` → `RevenueCatBilling`: real store. The gate
  in `app/_layout.tsx` shows `app/paywall.tsx` until the `premium` entitlement is
  active. On sign-in we call `Purchases.logIn(<supabase uid>)` so entitlements
  follow the account across devices/reinstalls.

Native module → this needs a **fresh dev-client / EAS build** (it won't work in
Expo Go, same as the Google sign-in module already in the app).

## One-time checklist

### 1. App Store Connect — create the products
- App Store Connect → your app → **Subscriptions** → create a Subscription Group
  (e.g. "Hydro AI Premium").
- Add two auto-renewable subscriptions in that group:
  - **Yearly** (e.g. `hydroai_premium_yearly`, $39.99/yr)
  - **Monthly** (e.g. `hydroai_premium_monthly`, $6.99/mo)
- On **each**, add an **Introductory Offer → Free trial → 7 days** (new
  subscribers). This is what renders "7-day free trial" on the paywall.
- Fill each product's localization + review screenshot, and complete the
  **Paid Apps agreement** + banking/tax in Business — subs won't load otherwise.

### 2. RevenueCat — connect & configure
- Add your app under a RevenueCat **Project** → **Apple App Store** app; upload
  the **In-App Purchase Key** (.p8) so RC can validate receipts.
- **Products**: import the two App Store product IDs above.
- **Entitlements**: create one identifier `premium` and attach both products.
  (If you name it differently, set `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT`.)
- **Offerings**: create an offering, mark it **Current**, and add two packages:
  the **Annual** package → yearly product, **Monthly** package → monthly product.
  The paywall reads the current offering, so you can swap plans later without an
  app release.
- Copy the **Public SDK Key** (Project → API keys → *Apple* → starts `appl_`).

### 3. Fill in env (`.env`)
```
EXPO_PUBLIC_DATA_SOURCE=supabase
EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_xxxxxxxxxxxxxxxxxxxxxxxx
EXPO_PUBLIC_REVENUECAT_ENTITLEMENT=premium
EXPO_PUBLIC_REVENUECAT_OFFERING=            # empty = "current" offering
```
The public key is safe in the app bundle (it's scoped to the signed-in
customer). The **secret** RevenueCat API key must never be in the repo.

### 4. Build & test
- `eas build --profile development` (new native module → new build required).
- Create a **Sandbox tester** in App Store Connect → Users and Access → Sandbox,
  sign into it on a real device (Settings → App Store → Sandbox Account).
- Run the app → onboard → sign in → the paywall appears → buy with the sandbox
  account. On success the gate should drop you into the app. Test **Restore** and
  **Manage subscription** from Profile too.
- Sandbox trials are time-compressed (a 7-day trial ≈ minutes), which is handy
  for testing renewals.

## App Review notes (hard paywalls get extra scrutiny)
The paywall already includes everything Apple looks for — keep it that way:
- Both plans with **price + billing period** clearly shown.
- **Free-trial terms + auto-renew disclosure** (the fine print under the button).
- A working **Restore Purchases** button (paywall footer + Profile).
- **Terms (EULA)** and **Privacy Policy** links (paywall footer).
- Make sure the Privacy URL in `lib/billing/config.ts` (`legalUrls.privacy`) is
  live before submitting, and add the standard auto-renewable-subscription
  disclosure to your App Store description.

## Files
- `lib/billing/` — the `Billing` interface + RevenueCat/Mock impls, selector,
  config, `BillingProvider` (entitlement source of truth), offerings hook.
- `app/paywall.tsx` — the paywall UI.
- `app/_layout.tsx` — the gate (`entitled` decides tabs vs paywall).
- `app/(tabs)/profile.tsx` — Restore + Manage subscription rows.
