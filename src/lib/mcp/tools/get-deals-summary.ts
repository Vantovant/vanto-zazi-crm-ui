import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runTool } from "../run";

export default defineTool({
  name: "get_deals_summary",
  title: "Deals summary",
  description: 'Read-only deals summary derived from contacts and orders.',
  inputSchema: {
    limit: z.number().int().optional()
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: (input, ctx) => runTool("get_deals_summary", input, ctx),
});
