import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runTool } from "../run";

export default defineTool({
  name: "set_contact_level",
  title: "Set a contact's level",
  description: "WRITES: sets level (1 to 12) and optionally leg (L/R) and GO status on one contact, and adds a note 'Level set to N via Claude'.",
  inputSchema: {
    contact_id: z.string(),
    level: z.number().int().describe("1 to 12"),
    leg: z.enum(["L", "R"]).optional(),
    go_status: z.string().optional()
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: (input, ctx) => runTool("set_contact_level", input, ctx),
});
