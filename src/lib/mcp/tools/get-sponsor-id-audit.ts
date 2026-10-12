import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runTool } from "../run";

export default defineTool({
  name: "get_sponsor_id_audit",
  title: "Sponsor ID audit",
  description: 'Read-only sponsor-ID audit summary and missing uplines.',
  inputSchema: {
    
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: (input, ctx) => runTool("get_sponsor_id_audit", input, ctx),
});
