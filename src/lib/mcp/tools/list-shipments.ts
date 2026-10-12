import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runTool } from "../run";

export default defineTool({
  name: "list_shipments",
  title: "List shipments",
  description: 'List shipments with optional status/contact_id filters (max 200).',
  inputSchema: {
    status: z.string().optional(),
    contact_id: z.string().optional(),
    limit: z.number().int().optional()
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: (input, ctx) => runTool("list_shipments", input, ctx),
});
