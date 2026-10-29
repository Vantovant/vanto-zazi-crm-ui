import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runTool } from "../run";

export default defineTool({
  name: "get_whatsapp_thread",
  title: "Get WhatsApp thread",
  description: 'Read-only. The last `limit` WhatsApp messages (default 30) for one contact, oldest to newest, each with direction, date, text, or a media label when there is no text.',
  inputSchema: {
    contact_id: z.string(),
    limit: z.number().int().optional()
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: (input, ctx) => runTool("get_whatsapp_thread", input, ctx),
});
