// analyze-image — Claude Vision proxy for Hydro AI.
//
// CLAUDE.md hard rules enforced here:
//  - The app NEVER calls the Anthropic API directly; it goes through this fn.
//  - The full-resolution image is processed EPHEMERALLY and never persisted
//    server-side. Only the structured estimate is returned; the app stores a
//    small thumbnail + metadata.
//
// Auth: verify_jwt is on, so only signed-in (anonymous) users can call it.
// Secret: ANTHROPIC_API_KEY is an Edge Function env var, never in the app.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
// Sonnet tier for cost on a high-volume vision task (IMPLEMENTATION_PLAN §0).
const MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-sonnet-4-6';

// Cost guardrails (IMPLEMENTATION_PLAN §Phase 5). Per-user AI rate limit,
// enforced server-side via the consume_ai_quota() RPC, plus an upload size cap.
// All tunable via Edge Function env without a redeploy.
const RATE_LIMIT_PER_MINUTE = Number(Deno.env.get('AI_RATE_LIMIT_PER_MINUTE') ?? '10');
const RATE_LIMIT_PER_DAY = Number(Deno.env.get('AI_RATE_LIMIT_PER_DAY') ?? '100');
// Reject oversized uploads before we pay to forward them. The app sends a
// downscaled ~1024px JPEG (tens to low-hundreds of KB); 6 MB of base64 is a
// generous ceiling that still blocks abuse / accidental full-res posts.
const MAX_IMAGE_BASE64_CHARS = Number(
  Deno.env.get('AI_MAX_IMAGE_BASE64_CHARS') ?? String(6 * 1024 * 1024),
);

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are a hydration-tracking vision assistant. Look at the photo and estimate the drink.

Return ONLY a JSON object matching the schema. Rules:
- is_drink: false if the photo is not a drink/beverage in a container. When false, set every other field except confidence and reasoning to null.
- container_type: one of glass, mug, ceramic_mug, disposable_cup, water_bottle, tumbler, can, pint_glass, other.
- beverage_type: one of water, coffee, tea, juice, soda, smoothie, other.
- estimated_volume_ml: best single estimate of the LIQUID volume currently in the container (account for fill level), in millilitres.
- volume_range_ml: [low, high] in ml ONLY when you are unsure (confidence < 0.70); otherwise null.
- fill_ratio: 0..1, how full the container looks.
- confidence: 0..1 overall confidence in the estimate.
- hydration_coefficient: hydrating value multiplier — water 1.0, tea ~0.9, coffee ~0.8, juice/soda ~0.85, smoothie ~0.7. null if not a drink.
- reasoning: one short human-readable sentence, e.g. "Detected: ceramic mug, ~80% full."`;

const RESULT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    is_drink: { type: 'boolean' },
    container_type: { type: ['string', 'null'] },
    beverage_type: { type: ['string', 'null'] },
    estimated_volume_ml: { type: ['number', 'null'] },
    volume_range_ml: {
      anyOf: [
        { type: 'array', items: { type: 'number' } },
        { type: 'null' },
      ],
    },
    fill_ratio: { type: ['number', 'null'] },
    confidence: { type: 'number' },
    hydration_coefficient: { type: ['number', 'null'] },
    reasoning: { type: 'string' },
  },
  required: [
    'is_drink',
    'container_type',
    'beverage_type',
    'estimated_volume_ml',
    'volume_range_ml',
    'fill_ratio',
    'confidence',
    'hydration_coefficient',
    'reasoning',
  ],
} as const;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!ANTHROPIC_API_KEY) {
    return json({ error: 'ANTHROPIC_API_KEY is not configured.' }, 500);
  }

  let body: { image_base64?: string; media_type?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const { image_base64, media_type = 'image/jpeg' } = body;
  if (!image_base64) {
    return json({ error: 'image_base64 is required.' }, 400);
  }

  // Guardrail 1: reject oversized uploads before forwarding (cost + abuse).
  if (image_base64.length > MAX_IMAGE_BASE64_CHARS) {
    return json({ error: 'Image is too large.' }, 413);
  }

  // Guardrail 2: per-user rate limit. verify_jwt is on, so the caller's JWT is
  // present; forward it so consume_ai_quota() charges the right user under RLS.
  const rate = await checkRateLimit(req);
  if (rate && !rate.allowed) {
    return new Response(
      JSON.stringify({
        error:
          rate.limit_kind === 'day'
            ? "You've reached today's analysis limit. Try again tomorrow."
            : "You're going a bit fast — give it a moment and try again.",
        limit_kind: rate.limit_kind,
        retry_after_seconds: rate.retry_after_seconds,
      }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          'content-type': 'application/json',
          'retry-after': String(rate.retry_after_seconds ?? 60),
        },
      },
    );
  }

  // Call Claude Vision with a strict JSON schema so the response is parseable.
  const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      output_config: { format: { type: 'json_schema', schema: RESULT_SCHEMA } },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type,
                data: image_base64,
              },
            },
            { type: 'text', text: 'Analyze this drink.' },
          ],
        },
      ],
    }),
  });

  if (!aiResponse.ok) {
    const detail = await aiResponse.text();
    console.error('Anthropic API error', aiResponse.status, detail);
    return json({ error: 'AI request failed.', status: aiResponse.status }, 502);
  }

  const payload = await aiResponse.json();

  if (payload.stop_reason === 'refusal') {
    return json({ error: 'The model declined to analyze this image.' }, 422);
  }

  const text = (payload.content ?? [])
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { text: string }) => b.text)
    .join('');

  let result: unknown;
  try {
    result = JSON.parse(text);
  } catch {
    console.error('Unparseable model output:', text);
    return json({ error: 'Model returned malformed JSON.' }, 502);
  }

  // The image is gone the moment this handler returns — nothing is persisted.
  return json(result, 200);
});

type RateResult = {
  allowed: boolean;
  limit_kind: string | null;
  retry_after_seconds: number | null;
};

/**
 * Charge one AI request against the caller's quota via the consume_ai_quota
 * RPC (atomic, RLS-scoped to auth.uid()). Returns the decision, or null if the
 * limiter can't be reached — in which case we FAIL OPEN (allow the request) so
 * a limiter hiccup never blocks a paying user. The DB RPC is the source of
 * truth; this is best-effort enforcement on top of it.
 */
async function checkRateLimit(req: Request): Promise<RateResult | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  const authorization = req.headers.get('Authorization');
  if (!authorization) return null;

  try {
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data, error } = await client.rpc('consume_ai_quota', {
      p_minute_limit: RATE_LIMIT_PER_MINUTE,
      p_day_limit: RATE_LIMIT_PER_DAY,
    });
    if (error) {
      console.error('consume_ai_quota failed (failing open):', error.message);
      return null;
    }
    return (Array.isArray(data) ? data[0] : data) as RateResult;
  } catch (e) {
    console.error('Rate-limit check threw (failing open):', e);
    return null;
  }
}

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}
