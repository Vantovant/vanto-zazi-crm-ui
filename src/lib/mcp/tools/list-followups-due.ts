import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runTool } from "../run";

export default defineTool({
  name: "list_followups_due",
  title: "List follow-ups due",
  description: "Read-only. People whose latest call has a follow-up date on or before the given date (default today).",
  inputSchema: {
    on_or_before: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional(),
    level: z.number().int().optional()
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: (input, ctx) => runTool("list_followups_due", input, ctx),
});
