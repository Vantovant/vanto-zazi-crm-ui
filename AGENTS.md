
- MCP OAuth server: tools live in src/lib/mcp (one per file, shared ported logic in actions.ts); runs as caller under RLS, never service role. mcp-bridge stays separate for the Railway server.
- Call Sheets cards come from the security_invoker view call_sheet_cards and calls save via the save_call RPC; the page only reads WhatsApp data and never sends, so sending safeguards stay in one place.
- Scorecard MCP tools share page week/rating helpers and additive validation in duplicationScorecardMcp; partial caller-token upserts preserve omitted fields and dry runs never write.
