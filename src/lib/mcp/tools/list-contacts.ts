import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runTool } from "../run";

export default defineTool({
  name: "list_contacts",
  title: "List contacts",
  description: 'List contacts with optional lead_type/lead_temperature/registration_status/search filters (max 100).',
  inputSchema: {
    lead_type: z.string().optional(),
    lead_temperature: z.string().optional(),
    registration_status: z.string().optional(),
    search: z.string().optional(),
    limit: z.number().int().optional()
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: (input, ctx) => runTool("list_contacts", input, ctx),
});
