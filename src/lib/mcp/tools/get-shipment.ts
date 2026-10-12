import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runTool } from "../run";

export default defineTool({
  name: "get_shipment",
  title: "Get shipment",
  description: 'Get a shipment by waybill number.',
  inputSchema: {
    waybill_number: z.string()
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: (input, ctx) => runTool("get_shipment", input, ctx),
});
