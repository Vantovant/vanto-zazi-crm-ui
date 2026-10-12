# OAuth MCP server for Get Well Grow (v2.0.0)

Categories: backend, permissions/RLS, platform.

## What gets built
- New sign-in-protected MCP server ("get-well-grow" / "Get Well Grow" / 2.0.0) using Lovable's built-in MCP support, generated into its own function (`mcp`). ChatGPT/Claude connect with the URL alone, sign in, then see an Approve/Deny screen.
- Turn on the backend OAuth server (dynamic client registration on).
- New page at `/.lovable/oauth/consent` with Approve / Deny, loading and error states.
- Sign-in page (`/auth`) honours a safe `?next=` return path so the consent flow resumes after login.

## Tools (23, ported 1:1 from mcp-bridge)
list_contacts, get_contact, create_contact, update_contact, add_contact_note, find_duplicate_contacts, get_sponsor_id_audit, list_orders, paste_monthly_activity, list_inventory, update_inventory_stock, list_shipments, get_shipment, create_shipment, update_shipment, list_birthdays, compose_birthday_message, list_birthday_message_tones, list_whatsapp_conversations, get_whatsapp_thread, get_prospector_status, get_prospector_drafts, get_deals_summary.

Every tool: checks sign-in, runs with the caller's own token under row-level security, no service-role key. Safety limits kept: no sending, no order edits/deletes/merges, no Prospector approve/reject/send, create_contact duplicate check unless `force`, update_contact never touches phone, notes append-only, paste_monthly_activity dry_run defaults true, birthday composer drafts only with "Leader {first_name}". readOnlyHint set per tool.

## RLS check (done, read-only)
- Owner-scoped (`auth.uid() = user_id`), OK for owner: contacts, contact_activities, orders, inventory, shipments, contact_birthdays, contact_waiting_room, zazi_actions, profiles.
- Admin-only, OK because owner account holds the admin role: maytapi_messages (WhatsApp tables), birthday_campaign_recipients.
- Deals: computed from orders/contacts in the bridge (no separate table) — no change needed.
- **No new policies required.** No migrations.

## Untouched
`supabase/functions/mcp-bridge`, `mcp-server/` (Railway), current Claude connection.

## After build
Manifest extraction, then you republish — the new endpoint only goes live after publish:
`https://urfyfuakgabieellbuce.supabase.co/functions/v1/mcp`

## Rollback
Delete `src/lib/mcp/`, the consent page/route and the generated `mcp` function; bridge unaffected.
