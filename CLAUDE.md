# CLAUDE.md

Guidance for working in the Hydro AI repo. Read this before making changes.

## What this is
Hydro AI is a mobile app that tracks water/fluid intake by photographing drinks — the AI estimates volume and logs it. See `PRD_HydroAI_Water_Tracker.md` for the product spec and `IMPLEMENTATION_PLAN.md` for the phased build plan. **These two docs are the source of truth; keep them in sync when scope changes.**

Current status: planning → Phase 0 scaffolding. Most of the structure below is the intended target, not yet built.

## Stack (decided — do not swap without asking)
- **App:** Expo (managed workflow) + expo-router (file-based routing), TypeScript.
- **Backend:** Supabase — Postgres, Auth, Storage, Edge Functions (Deno). No separate API server.
- **AI:** Claude Vision, called **only** from a Supabase Edge Function (`analyze-image`). Never call the AI API directly from the app.
- **Data layer:** TanStack Query + `@supabase/supabase-js`.
- **Auth:** Supabase anonymous sign-in on first launch; upgrade to email/Apple/Google later.

When you need library docs (Expo, Supabase, TanStack, Claude API), prefer the context7 MCP / Claude API skill over memory — these move fast.

## Build approach: UI-first with dummy data
We build the **full UI and workflow against dummy/mock data first**, finalize the UX, then wire the real backend. To make that final swap trivial:
- All screens/hooks depend on a **data-access interface** (`lib/data/repository.ts`), never on Supabase directly.
- Ship a `MockRepository` (in-memory dummy data) and later a `SupabaseRepository` implementing the same interface.
- Select the implementation via an env flag (e.g. `EXPO_PUBLIC_DATA_SOURCE=mock|supabase`).
- The AI call goes through the same pattern: a `MockAnalyzer` returns canned estimates until the real Edge Function is wired.
- **Net rule:** if a UI component imports `@supabase/supabase-js`, that's a bug. Backend swap = change the provider, not the screens.

## Hard rules
- **Never commit secrets.** Supabase keys and the Anthropic API key live in EAS secrets / Edge Function env vars, not in the repo. The app only ever holds the Supabase URL + anon key.
- **Privacy: full-resolution images are never persisted server-side.** The Edge Function processes the image ephemerally. Only the app generates a small thumbnail and uploads it. Only result metadata (type, volume, timestamp, confidence) is stored.
- **RLS on every table.** Users can only read/write their own rows. No table ships without a Row Level Security policy.
- **Store volumes canonically in ml.** Convert to oz only at the display layer based on `unit_preference`.
- **Camera needs a dev client**, not Expo Go. Don't assume Expo Go works for capture flows.

## Conventions
- TypeScript everywhere; no `any` without a comment justifying it.
- Routes live under `app/` (expo-router). Shared UI in `components/`, data hooks in `lib/` or `hooks/`.
- Supabase access goes through a single client singleton + typed query hooks — no ad-hoc `fetch` to Supabase.
- Mutations that affect the dashboard (logging a drink) use **optimistic updates** so the progress ring reacts instantly.
- The result card's default action is **"Log It" (one tap)**; only force confirmation when AI confidence < 0.70.
- Match the surrounding code's style; keep comments at the density of nearby code.

## Intended project layout (target)
```
app/                 # expo-router routes (tabs: home, history, profile; camera modal)
components/           # reusable UI (ProgressRing, ResultCard, LogFeed, ...)
lib/                  # supabase client, query hooks, units, types
supabase/
  migrations/         # SQL schema + RLS
  functions/
    analyze-image/    # Claude Vision Edge Function
```

## Commands
- Install: `npm install` *(an `.npmrc` sets `legacy-peer-deps=true` — a deep transitive react-dom peer range conflicts with the SDK-pinned react under strict npm; harmless. Use `npx expo install <pkg>` to add native modules at SDK-matched versions.)*
- Run dev: `npx expo start` *(camera flows need a dev client, not Expo Go.)*
- Typecheck: `npm run typecheck` (`tsc --noEmit`)
- Verify the bundle compiles end-to-end: `npx expo export --platform ios --output-dir /tmp/x` *(catches babel/NativeWind/reanimated graph errors tsc can't).*
- Project health: `npx expo-doctor`
- Build (dev client): `eas build --profile development` *(`eas.json` ready; not yet run — needs an EAS account.)*
- Supabase local / functions: `supabase start`, `supabase functions serve analyze-image`
- Lint/test: _not configured yet — add ESLint + a test runner when needed, then update this._

> Data source flag: `EXPO_PUBLIC_DATA_SOURCE` in `.env` (`mock` | `supabase`). Phase B is wired: `supabase` uses `SupabaseRepository` + `EdgeFunctionAnalyzer` against project `cwxgvpdbaihlulkiuucd`. It needs two one-time prereqs — Anonymous sign-ins enabled (Auth settings) + the `ANTHROPIC_API_KEY` Edge Function secret. `mock` stays fully working for fast UI iteration.
> Reanimated 4 note: its Babel plugin is `react-native-worklets/plugin` (in `babel.config.js`), not `react-native-reanimated/plugin`.
> Fake camera flag: `EXPO_PUBLIC_FAKE_CAMERA=1` swaps the `CameraView` for bundled sample photos (`assets/fake-camera/`) fed through the normal downscale→analyze→result-card path — the simulator has no camera (black preview, unusable `takePictureAsync`). Pair with `EXPO_PUBLIC_DATA_SOURCE=mock` for a fully clickable, zero-cost capture flow. Samples are ordered to match `MockAnalyzer`'s script. Off by default / on device. See `lib/dev/fakeCamera.ts`.

## Data model (see IMPLEMENTATION_PLAN.md §Phase 1 for full SQL)
`profiles` (goal, units, onboarding_completed, reminder schedule: enabled/interval/window) · `log_entries` (volume, beverage_type, hydration_coefficient, thumbnail_url, ai_confidence_score) · `daily-summary` as a SQL view.

## When in doubt
- Scope/priority questions → check the PRD's user-story priorities (P0/P1/P2) and the phase plan; build P0 first.
- Don't expand scope beyond the current phase without flagging it.
- Update `IMPLEMENTATION_PLAN.md` checkboxes and this file's Commands section as things actually land.
