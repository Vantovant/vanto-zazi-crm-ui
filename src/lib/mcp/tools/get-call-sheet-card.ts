import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runTool } from "../run";

export default defineTool({
  name: "get_call_sheet_card",
  title: "Get one call sheet card",
  description: "Read-only. Returns one person"s call sheet card, last 10 history lines and last 10 WhatsApp messages, found by contact_id, aplgo_id or phone.",
  inputSchema: {
    contact_id: z.string().optional(),
    aplgo_id: z.string().optional(),
    phone: z.string().optional()
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: (input, ctx) => runTool("get_call_sheet_card", input, ctx),
});
