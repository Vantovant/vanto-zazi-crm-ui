import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runTool } from "../run";

export default defineTool({
  name: "get_prospector_status",
  title: "Prospector status",
  description: 'Prospector counts by status and pending review items (read-only).',
  inputSchema: {
    
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: (input, ctx) => runTool("get_prospector_status", input, ctx),
});
