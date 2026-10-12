import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runTool } from "../run";

export default defineTool({
  name: "compose_birthday_message",
  title: "Compose birthday message",
  description: 'Draft a birthday message greeting "Leader {first_name}". Draft only: never sends or marks congratulated.',
  inputSchema: {
    birthday_id: z.string().optional(),
    associate_id: z.string().optional(),
    tone: z.string().optional(),
    all_tones: z.boolean().optional(),
    cycle_year: z.number().int().optional(),
    sender_name: z.string().optional(),
    sender_email: z.string().optional()
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: (input, ctx) => runTool("compose_birthday_message", input, ctx),
});
