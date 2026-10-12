import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runTool } from "../run";

export default defineTool({
  name: "list_birthday_message_tones",
  title: "List birthday tones",
  description: 'List available birthday message tones.',
  inputSchema: {
    
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: (input, ctx) => runTool("list_birthday_message_tones", input, ctx),
});
