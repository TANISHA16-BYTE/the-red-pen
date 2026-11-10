create table if not exists public.company_brain_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  record_type text not null check (record_type in ('rule', 'fact', 'claim', 'asset')),
  title text not null,
  description text not null default '',
  content text not null default '',
  category text not null default 'General',
  status text not null default 'draft'
    check (status in ('draft', 'pending', 'approved', 'archived')),
  source_url text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists company_brain_records_org_idx
  on public.company_brain_records(organization_id);

create index if not exists company_brain_records_status_idx
  on public.company_brain_records(organization_id, status);

alter table public.company_brain_records enable row level security;

drop policy if exists "Company Brain members can view records"
  on public.company_brain_records;
create policy "Company Brain members can view records"
on public.company_brain_records for select
to authenticated
using (
  exists (
    select 1 from public.org_memberships m
    where m.organization_id = company_brain_records.organization_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists "Company Brain members can insert records"
  on public.company_brain_records;
create policy "Company Brain members can insert records"
on public.company_brain_records for insert
to authenticated
with check (
  exists (
    select 1 from public.org_memberships m
    where m.organization_id = company_brain_records.organization_id
      and m.user_id = auth.uid()
  )
  and (created_by is null or created_by = auth.uid())
);

drop policy if exists "Company Brain members can update records"
  on public.company_brain_records;
create policy "Company Brain members can update records"
on public.company_brain_records for update
to authenticated
using (
  exists (
    select 1 from public.org_memberships m
    where m.organization_id = company_brain_records.organization_id
      and m.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.org_memberships m
    where m.organization_id = company_brain_records.organization_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists "Company Brain members can delete records"
  on public.company_brain_records;
create policy "Company Brain members can delete records"
on public.company_brain_records for delete
to authenticated
using (
  exists (
    select 1 from public.org_memberships m
    where m.organization_id = company_brain_records.organization_id
      and m.user_id = auth.uid()
  )
);
