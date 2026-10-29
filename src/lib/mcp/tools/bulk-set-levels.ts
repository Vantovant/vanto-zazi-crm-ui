import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runTool } from "../run";

export default defineTool({
  name: "bulk_set_levels",
  title: "Bulk refresh from an APLGO export",
  description: "WRITES: for up to 100 people (matched by aplgo_id, then phone) updates only changed level/leg/GO status/dates, marks each matched person as in the latest export, and adds a note per changed person. Never creates contacts.",
  inputSchema: {
    items: z.array(z.object({
      aplgo_id: z.string().optional(), phone: z.string().optional(),
      level: z.number().int().optional(), leg: z.enum(["L", "R"]).optional(), go_status: z.string().optional(),
      enrolled_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional(), activated_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional(),
    })).min(1).max(100)
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: (input, ctx) => runTool("bulk_set_levels", input, ctx),
});
