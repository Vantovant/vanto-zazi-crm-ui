import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runTool } from "../run";

export default defineTool({
  name: "list_call_sheet",
  title: "List a call sheet",
  description: "Read-only. Lists the call sheet cards for one level (only people in the latest APLGO export), same fields as the in-app page, plus the last 3 history lines each.",
  inputSchema: {
    level: z.number().int().describe("Level number, 1 to 12"),
    bucket: z.enum(["open", "new", "steady", "little"]).optional(),
    not_called_today: z.boolean().optional(),
    limit: z.number().int().positive().max(500).optional()
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: (input, ctx) => runTool("list_call_sheet", input, ctx),
});
