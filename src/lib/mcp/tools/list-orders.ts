import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runTool } from "../run";

export default defineTool({
  name: "list_orders",
  title: "List orders",
  description: 'List orders with optional status/contact_id filters (read-only, max 100).',
  inputSchema: {
    status: z.string().optional(),
    contact_id: z.string().optional(),
    limit: z.number().int().optional()
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: (input, ctx) => runTool("list_orders", input, ctx),
});
