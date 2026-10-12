import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runTool } from "../run";

export default defineTool({
  name: "list_whatsapp_conversations",
  title: "List WhatsApp conversations",
  description: 'List WhatsApp conversations for matched contacts only (read-only).',
  inputSchema: {
    limit: z.number().int().optional()
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: (input, ctx) => runTool("list_whatsapp_conversations", input, ctx),
});
