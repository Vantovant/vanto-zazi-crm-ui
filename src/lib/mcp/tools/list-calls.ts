import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runTool } from "../run";

export default defineTool({
  name: "list_calls",
  title: "List logged calls",
  description: "Read-only. Lists calls logged between two dates (default today, SA time) with name, level, outcome, notes, next action and follow-up date.",
  inputSchema: {
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional(),
    level: z.number().int().optional(),
    outcome: z.enum(["Answered", "No answer", "Call back", "Wrong number", "Not interested"]).optional()
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: (input, ctx) => runTool("list_calls", input, ctx),
});
