import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runTool } from "../run";

export default defineTool({
  name: "update_shipment",
  title: "Update shipment",
  description: 'Update provided fields of a shipment by waybill number.',
  inputSchema: {
    waybill_number: z.string(),
    status: z.string().optional(),
    product_summary: z.string().optional(),
    collection_address: z.string().optional(),
    delivery_address: z.string().optional(),
    service_level: z.string().optional(),
    courier_reference: z.string().optional(),
    earliest_delivery_date: z.string().nullable().optional(),
    contact_id: z.string().nullable().optional(),
    order_id: z.string().nullable().optional()
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: (input, ctx) => runTool("update_shipment", input, ctx),
});
