import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runTool } from "../run";

export default defineTool({
  name: "list_birthdays",
  title: "List birthdays",
  description: 'List birthdays for a cycle year with timing buckets (max 200).',
  inputSchema: {
    status: z.string().optional(),
    limit: z.number().int().optional(),
    cycle_year: z.number().int().optional()
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: (input, ctx) => runTool("list_birthdays", input, ctx),
});
