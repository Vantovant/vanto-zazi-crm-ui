import { defineTool } from "@lovable.dev/mcp-js";
import { runTool } from "../run";

export default defineTool({
  name: "get_call_sheet_settings",
  title: "Get call sheet settings",
  description: "Read-only. Returns the level range, new-joiner days, steady-buyer days and export freshness days.",
  inputSchema: {
    
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: (input, ctx) => runTool("get_call_sheet_settings", input, ctx),
});
