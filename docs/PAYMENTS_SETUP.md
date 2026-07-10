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
  in `app/_layout.tsx` shows `app/paywall.tsx` until the entitlement is active.
  On sign-in we call `Purchases.logIn(<supabase uid>)` so entitlements follow the
  account across devices/reinstalls.

Native module → this needs a **fresh dev-client / EAS build** (it won't work in
Expo Go, same as the Google sign-in module already in the app).

---

## ✅ Current state of YOUR RevenueCat project

Project **Hydro AI** (`proj88fdb565`) is fully wired to the real Apple App Store
and **verified working** (a sandbox annual purchase completed on device and shows
an active trial in RevenueCat). Snapshot:

| Thing       | Status                                                                                          |
| ----------- | ----------------------------------------------------------------------------------------------- |
| App         | ✅ **"Hydro AI (App Store)"** — bundle `com.xuanhieu2611.hydroai`, In-App Purchase Key linked.  |
| Entitlement | ✅ **"Hydro AI Premium"** (identifier `Hydro AI Premium` — mind the spaces) → Apple Yearly + Monthly. |
| Offering    | ✅ **"Hydro AI Offerings"** is current: `$rc_annual` → Apple Yearly, `$rc_monthly` → Apple Monthly. |
| Products    | ✅ `hydroai_premium_yearly` ($39.99/yr) + `hydroai_premium_monthly` ($6.99/mo), 7-day trial, `READY_TO_SUBMIT`. |
| Cleanup     | ✅ Old Test-Store `default` offering archived (removed the "no packages" warning).             |

The one thing that must match exactly in `.env`:
`EXPO_PUBLIC_REVENUECAT_ENTITLEMENT=Hydro AI Premium` (spaces included, unquoted).

> **Before submitting to App Review:** the products are `READY_TO_SUBMIT` — attach
> them to your first app version so they get reviewed alongside the binary, and
> make sure the paywall's Privacy URL (`lib/billing/config.ts` → `legalUrls.privacy`)
> is live.

---

## Step 1 — App Store Connect (you've done this)

You said your subscriptions are already set up. Sanity-check that each is
complete, or products won't load in RevenueCat:

- App Store Connect → your app → **Subscriptions**: a Subscription Group with the
  **Yearly** and **Monthly** auto-renewables, each in the **"Ready to Submit"**
  (or Approved) state with price + localization + a review screenshot.
- Each sub has an **Introductory Offer → Free trial → 7 days** (this is what
  renders "7-day free trial" on the paywall — RevenueCat reads it from the store).
- **Agreements, Tax, and Banking** → the **Paid Apps** agreement is **Active**.
  If it isn't, StoreKit returns zero products and the paywall shows the "couldn't
  load options" state.
- Note the exact **Product IDs** (e.g. `com.xuanhieu2611.hydroai.yearly`). You'll
  match these in RevenueCat.

## Step 2 — Create the Apple App Store app in RevenueCat & link it

This is the missing link. In the RevenueCat dashboard (Project **Hydro AI**):

**2a. Create the App Store app**

- **Project settings → Apps → + New** → choose **App Store**.
- Name it (e.g. "Hydro AI — App Store"), and set **Bundle ID** to
  `com.xuanhieu2611.hydroai` (must match `app.json` → `ios.bundleIdentifier`).
  - Save. This creates the app and, importantly, mints the `appl_` **public SDK
    key** you need for the app (Step 3).

> Shortcut: I can create this app for you via the RevenueCat MCP (it needs only
> the bundle ID). It still can't upload the private credentials below — those are
> dashboard-only — so you'll finish 2b–2d yourself. Just ask.

**2b. In-App Purchase Key (required — you're on StoreKit 2)**

`react-native-purchases` v10 uses **StoreKit 2**, so RevenueCat needs an **In-App
Purchase Key** (the App-Specific Shared Secret is the legacy StoreKit-1 path).

- App Store Connect → **Users and Access → Integrations → In-App Purchase** →
  **Generate In-App Purchase Key**. Give it a name.
- **Download the** `.p8` **file** — you only get one chance; save it securely.
- Copy the **Issuer ID** shown at the top of that page. (If there's no Issuer ID,
  first create any **App Store Connect API key** to make one appear.)
- Back in RevenueCat → your **App Store app → "In-app purchase key configuration"**
  tab → upload the `.p8` and paste the **Issuer ID** → **Save**. RevenueCat shows
  **"Valid credentials"** when it's linked correctly.

**2c. App-Specific Shared Secret (recommended, still used for some validation)**

- App Store Connect → your app → **App Information** (under General) → **Manage**
  next to **App-Specific Shared Secret** → generate/copy it.
- Paste it into RevenueCat → your App Store app settings.

**2d. App Store Server Notifications (recommended — keeps status fresh)**

- RevenueCat → App Store app → **App Store Server Notifications** section: copy
  the **Production** (and **Sandbox**) notification URL it gives you.
- App Store Connect → your app → **App Information → App Store Server
  Notifications** → set **Version 2**, paste the Production URL (and Sandbox URL),
  and save.

## Step 3 — Point products, entitlement & offering at the Apple app

Your entitlement/offering currently reference **Test Store** products. Re-wire
them to the real Apple products:

- **Import products**: In RevenueCat → **Products → + New / Import**, import the
  App Store products. Their **Store Identifier must exactly equal the App Store
  Connect Product IDs** from Step 1 (StoreKit fetches the localized price on-device
  by this ID — a mismatch = no price / no purchase).
- **Entitlement**: open **"Hydro AI Premium"** → attach the imported **Apple**
  Yearly and Monthly products.
- **Offering**: on the current offering's `$rc_annual` package attach the Apple
  Yearly product; on `$rc_monthly` attach the Apple Monthly product.
- Keep that offering marked **Current** — the app reads the current offering, so
  you can change plans later without an app release.

> ✅ **Done for this project.** App Store app `Hydro AI (App Store)` is linked
> (bundle `com.xuanhieu2611.hydroai`), entitlement **`Hydro AI Premium`** holds
> the Apple Yearly + Monthly products, and offering **"Hydro AI Offerings"**
> (`$rc_annual` → Apple Yearly, `$rc_monthly` → Apple Monthly) is current. The old
> Test-Store `default` offering was **archived** (it caused a harmless "no packages
> found for offering `default`" warning on device builds).

## Step 4 — Get the key & fill in `.env`

- **Where the public SDK key lives:** RevenueCat → **Project settings → API keys**
  (or the App Store app's settings). Use the key for the **App Store** app — it
  **starts** `appl_`. Do **not** use the `test_…` Test Store key for a real build.
- The public key is safe to ship in the app bundle (it's scoped to the signed-in
  customer). The RevenueCat **secret** API key must never be in the repo.

```
EXPO_PUBLIC_DATA_SOURCE=supabase
EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_xxxxxxxxxxxxxxxxxxxxxxxx   # the appl_ key, NOT test_
EXPO_PUBLIC_REVENUECAT_ENTITLEMENT=Hydro AI Premium           # your entitlement id (has spaces — leave unquoted)
EXPO_PUBLIC_REVENUECAT_OFFERING=                              # empty = "current" offering
```

## Step 5 — Build & test

The native `react-native-purchases` module means a **fresh native build** (not
Expo Go). Two ways to test, in decreasing fidelity:

### 5a. Real device + Sandbox (recommended — closest to production) ✅ verified

This is the true end-to-end test and the one that counts before shipping.

1. **Create a Sandbox tester**: App Store Connect → Users and Access → **Sandbox**
   → add a tester (an email that is *not* a real Apple ID).
2. **Fix code signing once (via Xcode)** — the CLI can't register a new device:
   - `open ios/HydroAI.xcworkspace` → select the **HydroAI** target →
     **Signing & Capabilities** → check **Automatically manage signing**, Team =
     `ADFVYC63T5`. Sign into your Apple ID under Xcode → Settings → Accounts.
   - Plug in the iPhone, pick it as the destination, press **▶ Run** once so Xcode
     registers the device + generates the profile. On the phone, trust the cert at
     Settings → General → VPN & Device Management.
3. From then on the terminal works: **`npx expo run:ios --device`**.
4. On the phone: Settings → **App Store → Sandbox Account** → sign in as the tester.
5. Onboard → sign in → paywall shows real prices ($39.99/yr, $6.99/mo, 7-day
   trial) → purchase → entitlement flips and the app unlocks. Verify the customer
   + active trial appear in RevenueCat → **Customers**. Test **Restore** and
   **Manage subscription** from the Profile tab too.
6. Sandbox trials/renewals are time-compressed (a 7-day trial ≈ minutes).

### 5b. Simulator + StoreKit Configuration file (faster iteration, lower fidelity)

Optional convenience only — it never replaces a device/sandbox pass before
release. StoreKit testing **must be launched from Xcode's Run button**, not the
terminal:

1. `npx expo run:ios` once to generate `ios/` and build for the simulator
   (simulator builds need no provisioning profile).
2. `open ios/HydroAI.xcworkspace` → File → New → File → **StoreKit Configuration
   File** → **Sync with App Store Connect** → pick the app (pulls in the products
   + trial automatically).
3. Product → Scheme → Edit Scheme → **Run → Options → StoreKit Configuration** →
   select the file.
4. Editor → **Save Public Certificate**, then upload it in RevenueCat → your App
   Store app settings, so these purchases validate and appear in the dashboard.
5. Press **▶ Run** in Xcode targeting the simulator.

Caveats: no cancel/refund events in the receipt, must run through Xcode, macOS
not supported (iOS simulator is fine).

**If the paywall shows "couldn't load options":** check the Paid Apps agreement is
Active, the product IDs match exactly, and you're using the `appl_` key (not
`test_`).

## Troubleshooting quick reference

| Symptom                                  | Likely cause                                                                                                                |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Paywall stuck on "couldn't load options" | Paid Apps agreement not Active; product IDs don't match; wrong (`test_`) key.                                               |
| Bought in sandbox but app stays locked   | Entitlement id in `.env` ≠ RevenueCat entitlement (`Hydro AI Premium`); or the Apple product isn't attached to the entitlement. |
| "Valid credentials" never appears in RC  | In-App Purchase Key `.p8` / Issuer ID wrong, or bundle ID mismatch.                                                         |
| "No packages found for offering `default`" warning | The old Test-Store `default` offering — archive it (already done for this project). |
| `LogOut … current user is anonymous` on cold start | Harmless; already guarded in `RevenueCatBilling.logOut()` via `isAnonymous()`. |

---

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
