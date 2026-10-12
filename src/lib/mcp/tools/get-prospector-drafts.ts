import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runTool } from "../run";

export default defineTool({
  name: "get_prospector_drafts",
  title: "Prospector drafts",
  description: 'Read Prospector drafts in full detail. No approve/reject/send.',
  inputSchema: {
    status: z.string().optional(),
    limit: z.number().int().optional()
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: (input, ctx) => runTool("get_prospector_drafts", input, ctx),
});
