create table if not exists public.hub_contacts_mirror (
  id uuid primary key,
  full_name text,
  first_name text,
  last_name text,
  whatsapp_display_name text,
  phone_e164 text,
  email text,
  contact_type text,
  lead_type text,
  temperature text,
  tags text[] default '{}',
  consent_whatsapp boolean default false,
  consent_email boolean default false,
  consent_sms boolean default false,
  notes text,
  version int not null default 1,
  is_deleted boolean not null default false,
  hub_updated_at timestamptz,
  synced_at timestamptz not null default now()
);

create index if not exists hub_contacts_mirror_email_idx on public.hub_contacts_mirror(email);
create index if not exists hub_contacts_mirror_phone_idx on public.hub_contacts_mirror(phone_e164);

grant select on public.hub_contacts_mirror to authenticated;
grant all    on public.hub_contacts_mirror to service_role;

alter table public.hub_contacts_mirror enable row level security;

create policy "authenticated read hub mirror"
  on public.hub_contacts_mirror for select
  to authenticated using (true);