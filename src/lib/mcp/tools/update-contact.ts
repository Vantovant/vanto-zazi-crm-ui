import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runTool } from "../run";

export default defineTool({
  name: "update_contact",
  title: "Update contact",
  description: 'Update only the provided fields of a contact. Phone numbers can never be changed.',
  inputSchema: {
    contact_id: z.string(),
    full_name: z.string().optional(),
    email_address: z.string().optional(),
    aplgo_id: z.string().optional(),
    lead_type: z.string().optional(),
    lead_temperature: z.string().optional(),
    registration_status: z.string().optional(),
    communication_status: z.string().optional(),
    assigned_to: z.string().optional(),
    next_action: z.string().optional(),
    sponsor_name: z.string().optional(),
    city: z.string().optional(),
    province: z.string().optional(),
    country: z.string().optional()
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: (input, ctx) => runTool("update_contact", input, ctx),
});
