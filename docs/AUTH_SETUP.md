# Auth setup — Apple & Google sign-in

Hydro AI **requires** Sign in with Apple / Google (no anonymous auth). The app
code is wired; this guide covers the external prerequisites the code can't do.
The flow is **onboarding-first**: the user goes through onboarding (name → goal
→ units → reminders) and signs in as the **last step**; the answers are buffered
locally and written to the profile after sign-in.

Until these are done, run with `EXPO_PUBLIC_DATA_SOURCE=mock` (mock is always
"authenticated", so the sign-in step is skipped and the app stays fully usable
for UI work).

Both providers use the native OS dialog → an ID token → `supabase.auth.signInWithIdToken`
(`lib/auth.ts`). No web redirect is involved. New native modules were added, so
**a fresh dev-client build is required** — Expo Go won't work
(`eas build --profile development` or `npx expo run:ios`).

App identifiers (already set in `app.json`):
- iOS bundle id: `com.xuanhieu2611.hydroai`
- Android package: `com.xuanhieu2611.hydroai`

---

## 1. Supabase dashboard

Project: `cwxgvpdbaihlulkiuucd` → **Authentication → Sign In / Providers**.

1. **Disable Anonymous sign-ins** (we no longer use them).
2. **Enable Apple** — we use the **native** flow (`signInWithIdToken`), so this is minimal:
   - **Client IDs** → add the iOS bundle id `com.xuanhieu2611.hydroai`. Supabase validates the on-device ID token's `aud` against this, which *is* the bundle id.
   - **Secret Key (for OAuth)** → **leave blank.** The secret is only needed for the web OAuth redirect flow (`signInWithOAuth`), which this app doesn't use. (If you ever add web login: the secret is **not** the raw `.p8` — it's a signed ES256 JWT generated from the `.p8` + Team ID + Key ID + Services ID, and it expires ≤6 months. The Services ID / key from step 3 belong to that web path only.)
3. **Enable Google** — paste the **Web client ID** and **Web client secret** from step 2. Add the **iOS** and **Android** client IDs to the provider's "Authorized Client IDs" list so the native ID tokens validate.

---

## 2. Google Cloud console — OAuth client IDs

<https://console.cloud.google.com/apis/credentials>

1. Configure the **OAuth consent screen** (External; app name, support email, scopes `email`, `profile`).
2. Create **three** OAuth client IDs:
   - **Web application** → this client ID + secret go into the Supabase Google provider. The client ID is `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in `.env`.
   - **iOS** → bundle id `com.xuanhieu2611.hydroai`. The client ID is `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`. Its **reversed** form (`com.googleusercontent.apps.<id>`) goes into `app.json` → the `@react-native-google-signin/google-signin` plugin `iosUrlScheme` (replace `REPLACE_WITH_REVERSED_IOS_CLIENT_ID`).
   - **Android** → package `com.xuanhieu2611.hydroai` + the signing-cert SHA-1. **Deferred — iOS ships first.** See "Android SHA-1 (later)" below when you add Android.

Put the two client IDs in both `.env` and your EAS environment.

### Android SHA-1 (later — not needed for the iOS-only launch)

Google Sign-In on Android needs an **Android OAuth client** registered with the
package name + the SHA-1 of **the keystore that actually signs the APK the user
runs** (almost never your local debug keystore with Expo). Skip this entirely
until you build for Android.

- **EAS-built app (normal path):** run `eas credentials` → **Android** → build profile (e.g. `development`) → **Keystore** → copy the **SHA-1 Fingerprint**. If no keystore exists yet, let EAS generate one, then read the SHA-1 from the same menu. Add package `com.xuanhieu2611.hydroai` + that SHA-1 to the Android OAuth client.
- **Google Play App Signing:** Play re-signs with its own key, so **also** add the app-signing SHA-1 from Play Console → *Setup → App signing*.
- **Local debug build only** (`npx expo run:android` on your machine): `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android | grep SHA1`. This SHA-1 will **not** match an EAS-built app — a mismatch is the usual cause of Android Google sign-in silently failing.

No `EXPO_PUBLIC_*` var is needed for the Android client — the app authenticates
against the **Web** client id; the Android client just authorizes the native flow.

---

## 3. Apple Developer — Sign in with Apple

<https://developer.apple.com> (requires a paid Apple Developer account). Apple
sign-in is **iOS-only** in this app; Android shows Google only.

**For the native flow, only step 1 is required.** Steps 2–3 (Services ID + key) are
only needed if you later add **web** Apple login.

1. **Identifiers → App ID** `com.xuanhieu2611.hydroai` → enable the **Sign In with Apple** capability. (`app.json` already sets `ios.usesAppleSignIn: true`, which adds the entitlement at build time.) This is all Supabase needs — the bundle id in the provider's Client IDs list.
2. *(Web only)* Create a **Services ID** (Apple's "client id" for web) tied to the App ID.
3. *(Web only)* **Keys** → create a key with **Sign in with Apple** enabled; download the `.p8`. Use it to generate the ES256 JWT client secret for the web flow — the raw `.p8` is not the secret.

---

## 4. Fill env + rebuild

```bash
# .env (and EAS secrets for builds)
EXPO_PUBLIC_DATA_SOURCE=supabase
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<web-client-id>.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<ios-client-id>.apps.googleusercontent.com
```

Update `app.json` `iosUrlScheme` with the reversed iOS client id, then:

```bash
eas build --profile development   # or: npx expo run:ios
```

Reminder (still required from the existing Supabase setup): the `ANTHROPIC_API_KEY`
Edge Function secret must be set for photo analysis.

---

## 5. Verify

1. Cold-launch the dev client → **onboarding** (first run). Step through name → goal → units → reminders → the **sign-in step**. Tap **Apple** / **Google** → native dialog → signed in → a brief splash flushes your onboarding answers → tabs.
2. **Profile → Account** shows your email + provider; Google accounts show their photo avatar, Apple falls back to an initial-badge. **Sign out** returns to onboarding's sign-in step; signing back in goes straight to the tabs (already onboarded).
3. Cancelling the native dialog leaves you on the sign-in step with no error alert.

## Follow-up (not yet implemented)

True account deletion currently only signs the user out — the client can't
delete its own `auth.users` row. Add an admin **`delete-account` Edge Function**
(service-role) to hard-delete the user when GDPR erasure is required.
