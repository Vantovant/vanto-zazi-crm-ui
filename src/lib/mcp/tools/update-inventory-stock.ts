import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runTool } from "../run";

export default defineTool({
  name: "update_inventory_stock",
  title: "Update inventory stock",
  description: 'Set an absolute stock quantity by id or product_name (creates the product row if missing).',
  inputSchema: {
    id: z.string().optional(),
    product_name: z.string().optional(),
    quantity: z.number().int()
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: (input, ctx) => runTool("update_inventory_stock", input, ctx),
});
