import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runTool } from "../run";

export default defineTool({
  name: "add_contact_note",
  title: "Add contact note",
  description: 'Append a note to a contact activity log (append-only, never edits existing entries).',
  inputSchema: {
    contact_id: z.string(),
    note: z.string()
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: (input, ctx) => runTool("add_contact_note", input, ctx),
});
