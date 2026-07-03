// delete-account — permanently delete the caller's account (App Store 5.1.1(v)).
//
// The app can't delete its own `auth.users` row (that needs the service-role
// key, which must never ship in the client). This function resolves the caller
// from their JWT, then uses an admin client to delete the user. Every
// user-scoped table (profiles, log_entries, ai_usage, connections,
// connection_invites) has an ON DELETE CASCADE FK to auth.users, so removing
// the user row wipes all their data in one shot.
//
// Auth: verify_jwt is on, so an unauthenticated caller is rejected before this
// handler runs. We still re-resolve the user from the token here so the id we
// delete is the token's own user — a caller can only ever delete themselves.
//
// Secret: SUPABASE_SERVICE_ROLE_KEY is an Edge Function env var, never in the app.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('delete-account is missing required env vars.');
    return json({ error: 'Account deletion is not configured.' }, 500);
  }

  const authorization = req.headers.get('Authorization');
  if (!authorization) {
    return json({ error: 'Not signed in.' }, 401);
  }

  // Resolve the caller from their own JWT. This is the only id we will delete,
  // so a caller can never delete another user's account.
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: 'Invalid or expired session.' }, 401);
  }
  const uid = userData.user.id;

  // Admin client (service role) to delete the auth.users row. The FK cascades
  // remove profiles, log_entries, ai_usage, connections, connection_invites.
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: deleteError } = await admin.auth.admin.deleteUser(uid);
  if (deleteError) {
    console.error('deleteUser failed for', uid, deleteError.message);
    return json({ error: 'Failed to delete account.' }, 502);
  }

  return json({ deleted: true }, 200);
});

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}
