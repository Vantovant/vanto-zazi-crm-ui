import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runTool } from "../run";

export default defineTool({
  name: "find_duplicate_contacts",
  title: "Find duplicate contacts",
  description: 'Detect duplicate contact groups by phone/email. Detection only, no merges.',
  inputSchema: {
    
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: (input, ctx) => runTool("find_duplicate_contacts", input, ctx),
});
