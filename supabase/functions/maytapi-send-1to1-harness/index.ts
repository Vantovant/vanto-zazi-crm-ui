// Phase E.6 — Admin-only NON-SENDING harness for Maytapi retry/error simulation.
// HARD GUARDS:
//  - never calls Maytapi
//  - never writes contact_activities
//  - never updates zazi_actions
//  - never sends real WhatsApp messages
//  - test_mode=true required
//  - admin role required
//  - no Send All / no cron / no autonomous send
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [0, 400, 1200];
const TOTAL_TIME_BUDGET_MS = 12_000;
const TRANSIENT_HTTP = new Set([408, 425, 429, 500, 502, 503, 504]);

type ErrorClass = 'transient' | 'permanent' | 'timeout' | 'network' | 'none';
type SafeErrorCode =
  | 'network_error' | 'timeout' | 'rate_limited'
  | 'maytapi_5xx' | 'maytapi_4xx' | 'maytapi_error' | 'unknown_error';

type Scenario =
  | 'transient_then_success'
  | 'permanent_failure'
  | 'timeout_chain'
  | 'network_failure';

interface SimAttempt {
  attempt: number;
  ok: boolean;
  status: number | null;
  errorClass: ErrorClass;
  shouldRetry: boolean;
  safeErrorCode: SafeErrorCode | null;
}

function classify(params: {
  status: number | null;
  networkError: string | null;
  timedOut: boolean;
}): { errorClass: ErrorClass; shouldRetry: boolean; safeErrorCode: SafeErrorCode | null } {
  const { status, networkError, timedOut } = params;
  if (timedOut) return { errorClass: 'timeout', shouldRetry: true, safeErrorCode: 'timeout' };
  if (networkError) return { errorClass: 'network', shouldRetry: true, safeErrorCode: 'network_error' };
  if (status == null) return { errorClass: 'network', shouldRetry: true, safeErrorCode: 'network_error' };
  if (status === 429) return { errorClass: 'transient', shouldRetry: true, safeErrorCode: 'rate_limited' };
  if (TRANSIENT_HTTP.has(status)) {
    return {
      errorClass: 'transient',
      shouldRetry: true,
      safeErrorCode: status >= 500 ? 'maytapi_5xx' : 'maytapi_error',
    };
  }
  if (status >= 400 && status < 500) {
    return { errorClass: 'permanent', shouldRetry: false, safeErrorCode: 'maytapi_4xx' };
  }
  if (status >= 500) {
    return { errorClass: 'permanent', shouldRetry: false, safeErrorCode: 'maytapi_5xx' };
  }
  return { errorClass: 'none', shouldRetry: false, safeErrorCode: null };
}

function simulateAttempt(scenario: Scenario, attemptIndex: number): SimAttempt {
  const attempt = attemptIndex + 1;
  switch (scenario) {
    case 'transient_then_success': {
      // First attempt 503, second succeeds.
      if (attemptIndex === 0) {
        const c = classify({ status: 503, networkError: null, timedOut: false });
        return { attempt, ok: false, status: 503, ...c };
      }
      return { attempt, ok: true, status: 200, errorClass: 'none', shouldRetry: false, safeErrorCode: null };
    }
    case 'permanent_failure': {
      const c = classify({ status: 400, networkError: null, timedOut: false });
      return { attempt, ok: false, status: 400, ...c };
    }
    case 'timeout_chain': {
      const c = classify({ status: null, networkError: null, timedOut: true });
      return { attempt, ok: false, status: null, ...c };
    }
    case 'network_failure': {
      const c = classify({ status: null, networkError: 'fetch failed', timedOut: false });
      return { attempt, ok: false, status: null, ...c };
    }
  }
}

async function logHarness(
  admin: ReturnType<typeof createClient>,
  row: Record<string, unknown>,
): Promise<void> {
  try {
    const { error } = await admin.from('prospector_send_log').insert(row);
    if (error) console.warn('[harness] prospector_send_log insert failed (non-blocking):', error.message);
  } catch (e) {
    console.warn('[harness] prospector_send_log insert threw (non-blocking):', (e as Error).message);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const invocationStart = Date.now();

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // ---- Admin JWT check ----
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const token = authHeader.replace('Bearer ', '');
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Invalid JWT' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const callerId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: roleRow } = await admin
      .from('user_roles').select('role').eq('user_id', callerId).eq('role', 'admin').maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: 'Admin role required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ---- Input ----
    const body = await req.json().catch(() => ({}));
    const { scenario, zazi_action_id, test_mode, write_log } = body || {};

    if (test_mode !== true) {
      return new Response(JSON.stringify({ error: 'test_mode=true required (harness)' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const allowed: Scenario[] = ['transient_then_success', 'permanent_failure', 'timeout_chain', 'network_failure'];
    if (!allowed.includes(scenario)) {
      return new Response(JSON.stringify({
        error: 'invalid scenario',
        allowed,
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ---- Simulate retry loop (mirrors live policy; NO Maytapi call) ----
    let attempts = 0;
    let last: SimAttempt | null = null;
    const trace: SimAttempt[] = [];
    let timeBudgetExhausted = false;

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const wait = BACKOFF_MS[i] || 0;
      if (wait > 0) {
        if (Date.now() - invocationStart + wait > TOTAL_TIME_BUDGET_MS) {
          timeBudgetExhausted = true;
          break;
        }
        // Skip real sleeping to keep harness fast; we still respect the budget shape.
      }

      attempts = i + 1;
      last = simulateAttempt(scenario, i);
      trace.push(last);

      if (last.ok) break;
      if (!last.shouldRetry) break;
      if (i === MAX_ATTEMPTS - 1) break;
    }

    const success = !!last?.ok;
    const finalRequestStatus: 'ok' | 'fail' = success ? 'ok' : 'fail';
    const safeErr: SafeErrorCode | null = success
      ? null
      : (last?.safeErrorCode ?? (timeBudgetExhausted ? 'timeout' : 'unknown_error'));

    // Optional safe log write — clearly marked harness=true. NEVER touches contact_activities or zazi_actions.
    if (write_log === true) {
      await logHarness(admin, {
        user_id: callerId,
        contact_id: null,
        zazi_action_id: typeof zazi_action_id === 'string' ? zazi_action_id : null,
        attempted_at: new Date().toISOString(),
        responded_at: new Date().toISOString(),
        mode: 'test',
        intended_send_type: 'media',
        request_status: finalRequestStatus,
        error_code: safeErr,
        metadata: {
          harness: true,
          scenario,
          retry_attempts: attempts,
          final_attempt: attempts,
          error_class: last?.errorClass ?? 'unknown',
          would_retry: last?.shouldRetry ?? false,
          time_budget_exhausted: timeBudgetExhausted,
        },
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      harness: true,
      scenario,
      simulated_attempts: attempts,
      final_request_status: finalRequestStatus,
      error_class: last?.errorClass ?? 'none',
      error_code: safeErr,
      retry_attempts: attempts,
      would_retry: last?.shouldRetry ?? false,
      time_budget_exhausted: timeBudgetExhausted,
      trace,
      notes: 'No Maytapi call, no contact_activities write, no zazi_actions update.',
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
