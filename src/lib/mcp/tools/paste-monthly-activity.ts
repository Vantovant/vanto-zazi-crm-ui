import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runTool } from "../run";

export default defineTool({
  name: "paste_monthly_activity",
  title: "Paste monthly activity",
  description: 'Parse a pasted APLGO monthly activity report and match to contacts. dry_run defaults to true; pass dry_run:false to write.',
  inputSchema: {
    pasted_text: z.string(),
    activity_month: z.string(),
    period_start: z.string().optional(),
    period_end: z.string().optional(),
    dry_run: z.boolean().optional()
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: (input, ctx) => runTool("paste_monthly_activity", input, ctx),
});
