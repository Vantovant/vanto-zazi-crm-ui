import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runTool } from "../run";

export default defineTool({
  name: "log_call",
  title: "Log a phone call",
  description: "WRITES: saves one call exactly like "Save call" on the page (a "call" note on the contact; updates the contact"s next action if given). Returns the new activity id.",
  inputSchema: {
    contact_id: z.string(),
    outcome: z.enum(["Answered", "No answer", "Call back", "Wrong number", "Not interested"]),
    notes: z.string().optional(),
    next_action: z.string().optional(),
    follow_up_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional()
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: (input, ctx) => runTool("log_call", input, ctx),
});
