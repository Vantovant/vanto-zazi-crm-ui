import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runTool } from "../run";

export default defineTool({
  name: "create_shipment",
  title: "Create shipment",
  description: 'Create a shipment record (no sending).',
  inputSchema: {
    waybill_number: z.string(),
    contact_id: z.string().optional(),
    order_id: z.string().optional(),
    status: z.string().optional(),
    product_summary: z.string().optional(),
    collection_address: z.string().optional(),
    delivery_address: z.string().optional(),
    service_level: z.string().optional(),
    courier_reference: z.string().optional(),
    earliest_delivery_date: z.string().optional()
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: (input, ctx) => runTool("create_shipment", input, ctx),
});
