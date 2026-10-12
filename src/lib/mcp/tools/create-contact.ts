import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runTool } from "../run";

export default defineTool({
  name: "create_contact",
  title: "Create contact",
  description: 'Create a contact; runs the duplicate check on phone/email unless force is true.',
  inputSchema: {
    full_name: z.string(),
    phone_number: z.string().optional(),
    email_address: z.string().optional(),
    aplgo_id: z.string().optional(),
    city: z.string().optional(),
    province: z.string().optional(),
    country: z.string().optional(),
    lead_temperature: z.string().optional(),
    communication_status: z.string().optional(),
    registration_status: z.string().optional(),
    lead_type: z.string().optional(),
    sponsor_name: z.string().optional(),
    additional_notes: z.string().optional(),
    force: z.boolean().optional()
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: (input, ctx) => runTool("create_contact", input, ctx),
});
