# Hydro AI — Implementation Plan

**Stack:** Expo (React Native) · Supabase (Postgres + Auth + Storage + Edge Functions) · Claude Vision (cloud multimodal LLM)
**Strategy:** Build the **full UI and workflow on dummy data first** to finalize the UX, then wire the real backend behind an unchanged data-access interface. Ship the core MVP slice on one platform first, then harden and expand per the PRD's phased rollout.

**Data-layer contract (the thing that makes "just connect the backend" true):** every screen/hook talks to `lib/data/repository.ts` (an interface) — never to Supabase directly. We start with a `MockRepository` (in-memory dummy data) + `MockAnalyzer` (canned AI estimates), selected by `EXPO_PUBLIC_DATA_SOURCE=mock`. Wiring the backend later means writing `SupabaseRepository` + the real `analyze-image` function and flipping the flag to `supabase`. No screen changes.
**Companion doc:** `PRD_HydroAI_Water_Tracker.md`

---

## 0. Tech Stack Decisions

| Concern | Choice | Why |
| --- | --- | --- |
| App framework | **Expo (managed) + expo-router** | File-based navigation, OTA updates, fast iteration. Camera + notifications + image picker all have first-class Expo modules. |
| Backend | **Supabase** | Postgres (relational, matches PRD schema), Auth, Storage (thumbnails), and Edge Functions (Deno) for the Claude proxy — one platform, minimal infra. |
| AI engine | **Claude Vision** via a Supabase Edge Function | No model training; iterate via prompt. Server-side so the API key is never in the app. Returns structured JSON. |
| State/data | **TanStack Query** + Supabase JS client | Caching, optimistic updates for the "Log It" flow. |
| Auth (MVP) | Supabase Auth — **anonymous sign-in** first, upgrade to email/Apple/Google later | Lets users log on first launch with zero friction (matches "camera-first"). |
| Styling | NativeWind (Tailwind) or Tamagui | Pick one; NativeWind if the team knows Tailwind. |

> Model note: use the latest Claude vision-capable model (e.g. `claude-opus-4-8` or a Sonnet tier for cost). Confirm current model IDs against the Claude API docs before wiring.

---

## Phase 0 — Project Setup & Skeleton (Week 1)

**Goal:** A blank Expo app runs on a device, connected to a Supabase project, with auth and navigation scaffolding.

- [x] `npx create-expo-app` with expo-router (TypeScript template). *(Scaffolded from the blank-TS template, then converted to expo-router; SDK 56 / RN 0.85 / React 19. NativeWind chosen for styling.)*
- [x] Install core deps: `@tanstack/react-query`, `expo-camera`, `expo-image-picker`, `expo-notifications`, `expo-image-manipulator`. *(No `@supabase/supabase-js` yet — added in the wiring phase.)*
- [x] Tab/stack navigation shell: **Home**, **History**, **Profile**, plus a modal route for the camera/result card. *(`app/(tabs)/` + `app/camera.tsx` modal; plus a throwaway `app/dev.tsx` data-layer check.)*
- [x] EAS Build configured for a development client (needed for camera on a real device). *(`eas.json` with a `development` profile + `expo-dev-client`; build not yet run — needs an EAS account.)*

**Exit criteria:** App launches and navigates between empty screens.

---

## Phase 1 — Data Layer & Dummy Data (Week 1–2)

**Goal:** Define the contract the whole app codes against, and back it with mock data — so the UI can be built and finalized with zero backend.

### The interface (`lib/data/`)
```ts
// repository.ts — every screen/hook depends on THIS, never on Supabase
interface DataRepository {
  getProfile(): Promise<Profile>
  updateProfile(patch: Partial<Profile>): Promise<Profile>
  getLogEntries(date: string): Promise<LogEntry[]>
  addLogEntry(entry: NewLogEntry): Promise<LogEntry>
  updateLogEntry(id: string, patch: Partial<LogEntry>): Promise<LogEntry>
  deleteLogEntry(id: string): Promise<void>
  getDailySummary(date: string): Promise<DailySummary>
  getHistory(rangeDays: number): Promise<DailySummary[]>
}

interface Analyzer {            // the AI boundary
  analyzeImage(uri: string): Promise<AnalysisResult>
}
```
- [x] Define shared TypeScript **types** (`Profile`, `LogEntry`, `AnalysisResult`, ...) — these mirror the eventual DB schema (see Wiring phase) so the swap is type-clean. *(`lib/data/types.ts`.)*
- [x] `MockRepository`: in-memory dummy data (a seeded day of logs, a profile, a week of history). Mutations update the in-memory store so the UI feels real (optimistic-friendly). *(`lib/data/mock/MockRepository.ts` + `seed.ts`.)*
- [x] `MockAnalyzer`: returns canned `AnalysisResult`s, with a fake ~1.5s delay and a few scripted cases (normal, low-confidence range, non-drink) so every UI state is reachable. *(`lib/data/mock/MockAnalyzer.ts` — cycles 4 cases.)*
- [x] Provider/selector: `EXPO_PUBLIC_DATA_SOURCE=mock|supabase` picks the implementation; default `mock`. *(`lib/data/index.ts`; `.env` defaults to `mock`.)*
- [x] Wrap everything in TanStack Query hooks (`useLogEntries`, `useAddLog`, ...) so screens never touch the repo directly. *(`lib/query/hooks.ts` — reads + optimistic add/update/delete + `useAnalyzeImage`.)*

**Exit criteria:** A throwaway test screen can read dummy logs and add/edit/delete them through the hooks — all in memory.

---

## Phase 2 — Core Capture → Log Loop (Week 2–4) — *the MVP slice (still on dummy data)*

**Goal:** The headline experience works end to end: snap a photo → see estimate → confirm → dashboard updates. (US-01–US-04)

### Camera capture (US-01)
- [x] Full-screen `expo-camera` modal with a prominent shutter button. *(`app/camera.tsx` — `CameraView` + `useCameraPermissions`, permission-gate fallback.)*
- [x] On capture: downscale/compress with `expo-image-manipulator` (keeps the eventual upload cheap; harmless now). *(New context API `ImageManipulator.manipulate().resize({width:1024}).renderAsync().saveAsync()` — legacy `manipulateAsync` is deprecated in SDK 56.)*
- [x] Loading state; call `analyzer.analyzeImage(uri)` — backed by `MockAnalyzer` for now. *(Capturing/Estimating overlay via `useAnalyzeImage`.)*

### Result card (US-02, US-03)
- [x] Slide-up card: beverage type, container, estimated volume, hydration class (hydrating / partial / non-hydrating). *(`components/ResultCard.tsx`; class buckets in `lib/beverage.ts`.)*
- [x] **Default action = "Log It"** (one tap, safe to accept — PRD design principle). *(Downgrades to "Confirm & Log" when confidence < 0.70.)*
- [x] +/- buttons for quick adjustment; show confidence/reasoning ("Detected: ceramic mug, ~80% full"). *(`components/VolumeAdjuster.tsx`; reasoning + low-confidence range surfaced. Slider deferred — needs a native slider module / dev-client rebuild.)*
- [x] Edge cases: non-drink, low-confidence range. *(Blurry/dark retake awaits a real signal from the Edge Function — MockAnalyzer only scripts non-drink.)*

### Logging (US-04)
- [x] On confirm: call `repository.addLogEntry(...)` (optimistic update via TanStack Query). For now the thumbnail is just the local image URI; real Storage upload comes in the wiring phase. *(`useAddLog`; thumbnail = downscaled local URI.)*
- [x] Compute `effective_hydration_ml = volume × hydration_coefficient`. *(Done in repo + optimistic hook.)*

### Home dashboard (US-10)
- [x] **Progress ring** (today's intake vs goal) animating on each log — `react-native-svg` + Reanimated. *(`components/ProgressRing.tsx` — `useAnimatedProps` on an `AnimatedCircle` strokeDashoffset.)*
- [x] **Daily log feed**: today's entries (time, type, thumbnail, volume); tap to edit/delete (PATCH/DELETE). *(`components/LogFeed.tsx` + edit/delete `Modal` sheet.)*

**Exit criteria:** A user can photograph 3 drinks and watch the ring fill toward their goal. **This is the demoable MVP.**

---

## Phase 3 — Goals, Onboarding & Fallback Logging (Week 4–5)

**Goal:** Make it a real first-run product. (US-05, US-06, US-07)

- [x] Onboarding flow: Welcome → Set Goal (recommend-from-weight/activity *or* custom) → unit preference → notifications opt-in → first-log CTA. *(`app/onboarding.tsx` — single screen, stepped local state; gated in `app/_layout.tsx` via `Stack.Protected` on a new `Profile.onboarding_completed` flag. Goal recommendation in `lib/hydration.ts` (~35 ml/kg + activity bonus). Notifications step calls `requestPermissionsAsync` now; scheduling is Phase 4. Skip + "Replay onboarding" (Profile) for fast iteration.)*
- [x] Custom daily goal + ml/oz unit toggle in Profile (US-07); unit conversion handled at display layer (store canonical ml). *(`app/(tabs)/profile.tsx` — goal stepper + Save, unit segmented control via `useUpdateProfile`.)*
- [x] **Add from camera roll** via `expo-image-picker` → same `analyze-image` path (US-05). *(Gallery button on the camera modal; shares the `analyzeUri` downscale→analyze flow.)*
- [x] **Manual log** (type + volume, no photo) (US-06). *(`app/manual-log.tsx` modal + `components/BeveragePicker.tsx`; logs via the same optimistic `useAddLog`.)*
- [x] Quick-log tiles on home for one-tap common drinks (Glass +250ml, Coffee +240ml). *(`components/QuickLogBar.tsx` + `lib/quicklog.ts`; tiles + "Log manually" link on Home.)*

**Exit criteria:** First-time user completes onboarding and can log via photo, camera roll, manual entry, or quick tile. ✅

---

## Phase 4 — Reminders & Polish (Week 5–6)

**Goal:** Retention mechanics + production readiness. (US-13, US-14, US-15)

- [ ] Local notifications via `expo-notifications`: schedulable reminders (e.g., every 2h, 8am–8pm), user-customizable frequency/window.
- [ ] "Haven't logged in a while" nudge + goal-met celebration.
- [ ] Empty/loading/error states everywhere; offline-tolerant logging (queue + retry).
- [ ] Privacy copy: "photos are processed and discarded."
- [ ] Account/data deletion (delete entry, delete account) — GDPR/CCPA basics.
- [ ] Analytics for the success metrics (retention, logs/day, onboarding completion).

**Exit criteria:** Feature-complete Phase-1 UI/UX, fully usable on dummy data. **This is where the UI is finalized — the gate before touching the backend.**

---

## Phase B — Wire the Backend (after the UI is signed off)

**Goal:** Implement the real backend behind the *unchanged* `DataRepository` / `Analyzer` interfaces and flip the flag. No screen logic changes — if a screen needs editing here, the abstraction leaked and should be fixed.

### Supabase setup
- [ ] Create Supabase project; put URL + anon key in env (EAS secrets — never commit). Add `@supabase/supabase-js`.
- [ ] Supabase client singleton with AsyncStorage session persistence.
- [ ] Anonymous auth on first launch; create a `profiles` row.

### Schema + security (migrations)
```sql
profiles(
  id uuid pk references auth.users,
  display_name text,
  daily_goal_ml int default 2000,
  unit_preference text default 'ml',     -- 'ml' | 'oz'
  created_at timestamptz default now()
)
log_entries(
  id uuid pk default gen_random_uuid(),
  user_id uuid references auth.users,
  logged_at timestamptz default now(),
  beverage_type text,                     -- water|coffee|tea|juice|soda|smoothie|other
  estimated_volume_ml int,
  user_adjusted_volume_ml int,
  hydration_coefficient numeric default 1.0,
  effective_hydration_ml int,
  thumbnail_url text,
  ai_confidence_score numeric
)
```
- [ ] **RLS on every table** — users only access their own rows.
- [ ] `daily_summary` as a SQL **view** (sum per day, goal_met).
- [ ] Private Storage bucket `thumbnails` (RLS by user folder).

### Real AI — Edge Function `analyze-image`
- [ ] Accepts a downscaled image, calls Claude Vision with a strict **JSON-only** prompt:
  ```json
  { "is_drink": true, "container_type": "ceramic_mug", "beverage_type": "coffee",
    "estimated_volume_ml": 240, "volume_range_ml": [200, 280],
    "fill_ratio": 0.8, "confidence": 0.86, "hydration_coefficient": 0.8 }
  ```
- [ ] Validate/parse JSON; confidence < 0.70 → flag low-confidence + return range. `is_drink:false` → "That doesn't look like a drink."
- [ ] **Image processed ephemerally** — never persist full-res server-side (PRD privacy). App uploads only a small thumbnail.

### The swap
- [ ] Implement `SupabaseRepository` (same interface as `MockRepository`) and `EdgeFunctionAnalyzer` (same interface as `MockAnalyzer`).
- [ ] Real thumbnail upload to Storage on log confirm.
- [ ] Flip `EXPO_PUBLIC_DATA_SOURCE=supabase`. Smoke-test every screen against live data.

**Exit criteria:** App runs end-to-end on real Supabase + Claude Vision with no UI changes from Phase 4. Keep `mock` working for fast UI iteration.

---

## Phase 5 — Hardening, 2nd Platform & Integrations (Week 6–8)

- [ ] Test the second platform (Expo gives you both; verify camera/notification quirks on Android/iOS).
- [ ] **Apple Health / Google Fit** write integration (PRD Phase 1) — requires a config plugin / dev client; HealthKit via `expo-health` or a native module.
- [ ] AI accuracy pass: collect user corrections (estimated vs adjusted) as a signal to refine the prompt; measure against the ≥85% within ±50ml target.
- [ ] Cost guardrails on the Edge Function (rate limits, image size caps).
- [ ] App Store / Play Store submission prep.

---

## Beyond MVP (maps to PRD Phases 2 & 3)
- **Phase 2 (Growth):** 30-day history + calendar heatmap, beverage breakdown donut, streak/badges, Pro subscription (RevenueCat), onboarding A/B tests.
- **Phase 3 (Expansion):** Apple Watch/Wear OS, AI goal recommendations, social sharing, Siri/Assistant voice logging, nutrition-app exports.

---

## Open Questions to Resolve Early (from PRD §12)
1. Hydration coefficients per beverage — fixed table or user preference? (Affects schema defaults + result card.)
2. Min AI accuracy before forcing confirmation on every estimate? (Affects "one-tap Log It" default.)
3. Is Health sync free or Pro? (Affects Phase 5 gating.)
4. How to handle smoothies/protein shakes/sports drinks (water-as-component)?
5. Thumbnail retention policy.

## Key Risks (engineering)
- **AI latency/cost** — mitigate with aggressive client-side downscaling + a cheaper Claude tier; consider on-device fallback later.
- **Volume accuracy on unusual containers** — lean on the correction UX; flag low confidence loudly.
- **Camera on Expo Go** — requires a **dev client**; set this up in Phase 0 to avoid surprises.
