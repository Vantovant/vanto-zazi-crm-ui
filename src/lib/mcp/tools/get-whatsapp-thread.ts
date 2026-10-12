import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runTool } from "../run";

export default defineTool({
  name: "get_whatsapp_thread",
  title: "Get WhatsApp thread",
  description: 'Read a WhatsApp thread for a matched contact (read-only, no sending).',
  inputSchema: {
    contact_id: z.string(),
    limit: z.number().int().optional()
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: (input, ctx) => runTool("get_whatsapp_thread", input, ctx),
});
