
- MCP OAuth server: tools live in src/lib/mcp (one per file, shared ported logic in actions.ts); runs as caller under RLS, never service role. mcp-bridge stays separate for the Railway server.
