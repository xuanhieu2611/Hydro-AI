-- Avatar photo URL for the profile, seeded from the auth provider (Google
-- returns a photo; Apple does not). Nullable; the app falls back to an
-- initial-badge when absent. RLS already covers `profiles`, so no policy change.
alter table public.profiles add column if not exists avatar_url text;
