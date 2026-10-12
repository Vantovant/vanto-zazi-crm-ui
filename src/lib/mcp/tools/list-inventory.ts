import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runTool } from "../run";

export default defineTool({
  name: "list_inventory",
  title: "List inventory",
  description: 'List inventory products and stock quantities.',
  inputSchema: {
    
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: (input, ctx) => runTool("list_inventory", input, ctx),
});
