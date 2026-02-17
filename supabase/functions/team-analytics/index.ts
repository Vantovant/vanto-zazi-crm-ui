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

    // Build per-user stats
    const userStats = (profiles || []).map((profile) => {
      const uid = profile.id;
      const userActivities = (activities || []).filter((a) => a.user_id === uid);
      const userContacts = (contactCounts || []).filter((c) => c.user_id === uid).length;
      const userOrders = (orderCounts || []).filter((o) => o.user_id === uid).length;

      const pagesVisited = [...new Set(userActivities.map((a) => a.page))];
      const totalActions = userActivities.length;
      const lastActive = userActivities.length > 0 ? userActivities[0].created_at : null;

      // Page visit frequency
      const pageFreq: Record<string, number> = {};
      for (const a of userActivities) {
        pageFreq[a.page] = (pageFreq[a.page] || 0) + 1;
      }

      return {
        userId: uid,
        displayName: profile.display_name || "Unknown",
        email: emailMap[uid] || "",
        joinedAt: profile.created_at,
        lastActive,
        totalActions,
        contactsCreated: userContacts,
        ordersCreated: userOrders,
        pagesVisited,
        pageFrequency: pageFreq,
      };
    });

    // Build AI summary for ZAZI
    const { action } = await req.json().catch(() => ({ action: "stats" }));

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
