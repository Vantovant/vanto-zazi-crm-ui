import { defineTool } from "@lovable.dev/mcp-js";
import { runTool } from "../run";

export default defineTool({
  name: "list_needs_level",
  title: "List people needing a level",
  description: "Read-only. Same list as the page"s "Needs a level" panel, plus "Outside the range" (level above 12).",
  inputSchema: {
    
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: (input, ctx) => runTool("list_needs_level", input, ctx),
});
