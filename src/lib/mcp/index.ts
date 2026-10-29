import { auth, defineMcp } from "@lovable.dev/mcp-js";
import ListContacts from "./tools/list-contacts";
import GetContact from "./tools/get-contact";
import CreateContact from "./tools/create-contact";
import UpdateContact from "./tools/update-contact";
import AddContactNote from "./tools/add-contact-note";
import FindDuplicateContacts from "./tools/find-duplicate-contacts";
import GetSponsorIdAudit from "./tools/get-sponsor-id-audit";
import ListOrders from "./tools/list-orders";
import PasteMonthlyActivity from "./tools/paste-monthly-activity";
import ListInventory from "./tools/list-inventory";
import UpdateInventoryStock from "./tools/update-inventory-stock";
import ListShipments from "./tools/list-shipments";
import GetShipment from "./tools/get-shipment";
import CreateShipment from "./tools/create-shipment";
import UpdateShipment from "./tools/update-shipment";
import ListBirthdays from "./tools/list-birthdays";
import ComposeBirthdayMessage from "./tools/compose-birthday-message";
import ListBirthdayMessageTones from "./tools/list-birthday-message-tones";
import ListWhatsappConversations from "./tools/list-whatsapp-conversations";
import GetWhatsappThread from "./tools/get-whatsapp-thread";
import GetProspectorStatus from "./tools/get-prospector-status";
import GetProspectorDrafts from "./tools/get-prospector-drafts";
import GetDealsSummary from "./tools/get-deals-summary";
import ListCallSheet from "./tools/list-call-sheet";
import GetCallSheetCard from "./tools/get-call-sheet-card";
import LogCall from "./tools/log-call";
import ListCalls from "./tools/list-calls";
import ListFollowupsDue from "./tools/list-followups-due";
import ListNeedsLevel from "./tools/list-needs-level";
import SetContactLevel from "./tools/set-contact-level";
import BulkSetLevels from "./tools/bulk-set-levels";
import GetCallSheetSettings from "./tools/get-call-sheet-settings";
import SetCallSheetSettings from "./tools/set-call-sheet-settings";

// Vite inlines the stable ref; issuer must be the direct supabase.co host.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "get-well-grow",
  title: "Get Well Grow",
  version: "2.1.0",
  instructions: "Get Well Grow downline CRM tools: contacts, notes, orders, monthly activity, inventory, shipments, birthdays (draft only), WhatsApp read-only, Prospector read-only, deals, call sheets (read, log calls, set levels, settings). No sending, deleting or merging.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [ListContacts, GetContact, CreateContact, UpdateContact, AddContactNote, FindDuplicateContacts, GetSponsorIdAudit, ListOrders, PasteMonthlyActivity, ListInventory, UpdateInventoryStock, ListShipments, GetShipment, CreateShipment, UpdateShipment, ListBirthdays, ComposeBirthdayMessage, ListBirthdayMessageTones, ListWhatsappConversations, GetWhatsappThread, GetProspectorStatus, GetProspectorDrafts, GetDealsSummary, ListCallSheet, GetCallSheetCard, LogCall, ListCalls, ListFollowupsDue, ListNeedsLevel, SetContactLevel, BulkSetLevels, GetCallSheetSettings, SetCallSheetSettings],
});
