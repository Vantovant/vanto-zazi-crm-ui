import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runTool } from "../run";

export default defineTool({
  name: "set_call_sheet_settings",
  title: "Change call sheet settings",
  description: "WRITES: changes only the call sheet settings given (levels 1 to 12; day values 1 or more).",
  inputSchema: {
    min_level: z.number().int().optional(),
    max_level: z.number().int().optional(),
    new_days: z.number().int().optional(),
    steady_days: z.number().int().optional(),
    export_fresh_days: z.number().int().optional()
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: (input, ctx) => runTool("set_call_sheet_settings", input, ctx),
});
