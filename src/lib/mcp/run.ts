import type { ToolContext } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "./supabase";
import { runAction } from "./actions";

type Text = { type: "text"; text: string };

/** Shared handler: auth check, user-token client (RLS), run ported action. */
export async function runTool(action: string, input: Record<string, unknown>, ctx: ToolContext): Promise<{ content: Text[]; isError?: boolean }> {
  if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
  const ownerId = ctx.getUserId();
  if (!ownerId) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
  try {
    const res = await runAction(action, { ...input, action }, supabaseForUser(ctx), ownerId);
    return { content: [{ type: "text", text: JSON.stringify(res.body) }], ...(res.status >= 400 ? { isError: true } : {}) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : (e as { message?: string })?.message ?? "internal_error";
    return { content: [{ type: "text", text: JSON.stringify({ error: "internal_error", message: msg }) }], isError: true };
  }
}
