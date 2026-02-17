import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, token: rawToken } = await req.json();
    const token = (rawToken || "").trim().toUpperCase();

    if (action === "validate") {
      // Check if token exists and is unused (case-insensitive match)
      const { data, error } = await supabase
        .from("invites")
        .select("id, token, label, is_used")
        .eq("token", token)
        .maybeSingle();

      if (error || !data) {
        return new Response(JSON.stringify({ valid: false, error: "Invalid invite code" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (data.is_used) {
        return new Response(JSON.stringify({ valid: false, error: "This invite code has already been used" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ valid: true, label: data.label }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "redeem") {
      // Mark token as used after successful signup
      const { data, error } = await supabase
        .from("invites")
        .update({ is_used: true, used_at: new Date().toISOString() })
        .eq("token", token)
        .eq("is_used", false)
        .select()
        .maybeSingle();

      if (error || !data) {
        return new Response(JSON.stringify({ success: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("invite-check error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
