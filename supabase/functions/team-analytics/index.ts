import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Authenticate the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Validate the user's JWT
    const { createClient: createAnonClient } = await import("https://esm.sh/@supabase/supabase-js@2.95.3");
    const anonSupabase = createAnonClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await anonSupabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role for admin operations
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Server-side admin check using user_roles table
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all users from profiles
    const { data: profiles } = await supabase.from("profiles").select("id, display_name, created_at");

    // Get user emails from auth.users via admin API
    const { data: { users: authUsers } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const emailMap: Record<string, string> = {};
    for (const u of (authUsers || [])) {
      emailMap[u.id] = u.email || '';
    }

    // Get activity data for all users
    const { data: activities } = await supabase
      .from("user_activity")
      .select("user_id, action, page, created_at")
      .order("created_at", { ascending: false })
      .limit(5000);

    // Get contact counts per user
    const { data: contactCounts } = await supabase
      .from("contacts")
      .select("user_id");

    // Get order counts per user
    const { data: orderCounts } = await supabase
      .from("orders")
      .select("user_id");

    // Build profile map for quick lookup
    const profileMap: Record<string, any> = {};
    for (const p of (profiles || [])) {
      profileMap[p.id] = p;
    }

    // Merge auth users + profiles so users without profiles still appear
    const allUserIds = new Set<string>();
    for (const p of (profiles || [])) allUserIds.add(p.id);
    for (const u of (authUsers || [])) allUserIds.add(u.id);

    const userStats = [...allUserIds].map((uid) => {
      const profile = profileMap[uid];
      const authUser = (authUsers || []).find(u => u.id === uid);
      const userActivities = (activities || []).filter((a) => a.user_id === uid);
      const userContacts = (contactCounts || []).filter((c) => c.user_id === uid).length;
      const userOrders = (orderCounts || []).filter((o) => o.user_id === uid).length;

      const pagesVisited = [...new Set(userActivities.map((a) => a.page))];
      const totalActions = userActivities.length;
      const lastActive = userActivities.length > 0 ? userActivities[0].created_at : null;

      const pageFreq: Record<string, number> = {};
      for (const a of userActivities) {
        pageFreq[a.page] = (pageFreq[a.page] || 0) + 1;
      }

      return {
        userId: uid,
        displayName: profile?.display_name || authUser?.user_metadata?.display_name || authUser?.email?.split('@')[0] || "Unknown",
        email: emailMap[uid] || "",
        joinedAt: profile?.created_at || authUser?.created_at || null,
        lastActive,
        totalActions,
        contactsCreated: userContacts,
        ordersCreated: userOrders,
        pagesVisited,
        pageFrequency: pageFreq,
      };
    });

    const body = await req.json().catch(() => ({ action: "stats" }));
    const { action } = body;

    if (action === "delete_user" && body.userId) {
      await supabase.auth.admin.deleteUser(body.userId);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "ai_summary") {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

      const summaryData = JSON.stringify(userStats, null, 2);

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `You are ZAZI, the AI copilot for Vanto Zazi CRM. Analyze tester activity data and provide a clear, actionable UX feedback report. Focus on:
1. Who is most/least active
2. Which pages get the most/least traffic (indicates feature value)
3. Who hasn't created any contacts yet (may be confused)
4. Engagement patterns and drop-off signals
5. Specific recommendations to improve UX based on the data
Keep it practical, use markdown, and be encouraging.`,
            },
            {
              role: "user",
              content: `Here is the tester activity data for our CRM platform:\n\n${summaryData}\n\nGive me a comprehensive UX feedback report on how testers are faring.`,
            },
          ],
        }),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error("AI error:", aiResponse.status, errText);
        return new Response(JSON.stringify({ error: "AI analysis failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const aiData = await aiResponse.json();
      const aiText = aiData.choices?.[0]?.message?.content || "No analysis available.";

      return new Response(JSON.stringify({ stats: userStats, aiSummary: aiText }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ stats: userStats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("team-analytics error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
