// Run: deno test -A supabase/functions/mcp-bridge/kairos_gate_test.ts
// Uses stand-in keys; checks the Kairos allowlist gate before any data access.
import { assertEquals } from 'jsr:@std/assert@1'

Deno.env.set('MCP_BRIDGE_TOKEN', 'main-test-key')
Deno.env.set('KAIROS_BRIDGE_TOKEN', 'kairos-test-key')
Deno.env.set('SUPABASE_URL', 'http://127.0.0.1:1')
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'x')

let handler: (req: Request) => Promise<Response> = async () => new Response()
// deno-lint-ignore no-explicit-any
;(Deno as any).serve = (h: any) => { handler = h; return {} }
await import('./index.ts')

const call = (token: string, action: string) =>
  handler(new Request('http://x', {
    method: 'POST',
    headers: { 'x-mcp-token': token, 'content-type': 'application/json' },
    body: JSON.stringify({ action }),
  }))

for (const a of ['log_call', 'bulk_set_levels', 'set_contact_level', 'get_whatsapp_thread', 'create_contact', 'paste_monthly_activity']) {
  Deno.test(`kairos refused: ${a}`, async () => {
    const r = await call('kairos-test-key', a)
    const j = await r.json()
    assertEquals(r.status, 403)
    assertEquals(j.error, 'forbidden_for_kairos_token')
  })
}
for (const a of ['list_followups_due', 'list_call_sheet', 'list_birthdays', 'list_contacts']) {
  Deno.test(`kairos allowed past gate: ${a}`, async () => {
    const r = await call('kairos-test-key', a)
    await r.body?.cancel()
    if (r.status === 403 || r.status === 401) throw new Error(`blocked: ${r.status}`)
  })
}
Deno.test('main key not restricted', async () => {
  const r = await call('main-test-key', 'log_call')
  await r.body?.cancel()
  if (r.status === 403 || r.status === 401) throw new Error(`blocked: ${r.status}`)
})
Deno.test('wrong key -> 401', async () => {
  const r = await call('nope', 'list_contacts')
  await r.body?.cancel()
  assertEquals(r.status, 401)
})
