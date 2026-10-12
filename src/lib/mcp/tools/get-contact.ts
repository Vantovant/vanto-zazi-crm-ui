import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runTool } from "../run";

export default defineTool({
  name: "get_contact",
  title: "Get contact",
  description: 'Get one contact by contact_id or phone_normalized, with the last 10 activities.',
  inputSchema: {
    contact_id: z.string().optional(),
    phone_normalized: z.string().optional()
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: (input, ctx) => runTool("get_contact", input, ctx),
});
