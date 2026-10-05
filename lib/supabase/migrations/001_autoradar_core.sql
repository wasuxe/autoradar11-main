-- ============================================================
-- AutoRadar — Core Backend Schema
-- Migration 001
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
-- ORGANIZATIONS
-- ============================================================

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- ORGANIZATION MEMBERS
-- ============================================================

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member'
    check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),

  unique (organization_id, user_id)
);

-- ============================================================
-- WORKSPACES
-- ============================================================

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (organization_id, slug)
);

-- ============================================================
-- BUSINESS PROFILES
-- What the customer sells
-- ============================================================

create table if not exists public.business_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,

  business_name text not null,
  website text,
  description text,

  industry text,
  location text,

  services jsonb not null default '[]'::jsonb,
  target_markets jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (workspace_id)
);

-- ============================================================
-- ICP PROFILES
-- AutoRadar's understanding of the ideal customer
-- ============================================================

create table if not exists public.icp_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,

  name text not null default 'Default ICP',

  industries jsonb not null default '[]'::jsonb,
  countries jsonb not null default '[]'::jsonb,
  cities jsonb not null default '[]'::jsonb,
  company_sizes jsonb not null default '[]'::jsonb,

  required_signals jsonb not null default '[]'::jsonb,
  excluded_signals jsonb not null default '[]'::jsonb,

  service_tracks jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (workspace_id, name)
);

-- ============================================================
-- ACCOUNTS
-- Companies discovered by AutoRadar
-- ============================================================

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,

  company_name text not null,
  canonical_name text,

  website text,
  canonical_domain text,

  industry text,
  country text,
  city text,
  employee_range text,

  description text,
  founded_year integer,

  linkedin_url text,
  instagram_url text,
  facebook_url text,

  identity_confidence numeric(5,2),
  data_confidence numeric(5,2),

  status text not null default 'discovered'
    check (
      status in (
        'discovered',
        'researching',
        'verified',
        'rejected',
        'archived'
      )
    ),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists accounts_workspace_idx
  on public.accounts(workspace_id);

create index if not exists accounts_domain_idx
  on public.accounts(canonical_domain);

-- ============================================================
-- CONTACTS
-- Actual people associated with accounts
-- ============================================================

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,

  first_name text,
  last_name text,
  full_name text not null,

  role text,
  role_type text,

  email text,
  phone text,
  whatsapp text,

  linkedin_url text,
  instagram_url text,

  identity_confidence numeric(5,2),
  company_confidence numeric(5,2),
  role_confidence numeric(5,2),
  contact_confidence numeric(5,2),

  verification_status text not null default 'unverified'
    check (
      verification_status in (
        'verified',
        'partially_verified',
        'unverified',
        'rejected',
        'not_found'
      )
    ),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contacts_workspace_idx
  on public.contacts(workspace_id);

create index if not exists contacts_account_idx
  on public.contacts(account_id);

-- ============================================================
-- EVIDENCE
-- Every important claim should have evidence.
-- ============================================================

create table if not exists public.evidence (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null references public.workspaces(id) on delete cascade,

  account_id uuid references public.accounts(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete cascade,

  field text not null,

  value text,

  source_type text,
  source_url text,

  evidence_text text,

  verification_status text not null default 'unverified'
    check (
      verification_status in (
        'verified',
        'partially_verified',
        'unverified',
        'rejected'
      )
    ),

  confidence numeric(5,2),

  discovered_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists evidence_account_idx
  on public.evidence(account_id);

create index if not exists evidence_contact_idx
  on public.evidence(contact_id);

create index if not exists evidence_workspace_idx
  on public.evidence(workspace_id);

-- ============================================================
-- OPPORTUNITIES
-- Why this company may need the customer's service
-- ============================================================

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,

  opportunity_type text,
  why_company text,
  why_they_may_need_service text,
  why_reach_out text,
  why_now text,

  recommended_action text,
  recommended_channel text,
  recommended_timing text,

  confidence numeric(5,2),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists opportunities_workspace_idx
  on public.opportunities(workspace_id);

create index if not exists opportunities_account_idx
  on public.opportunities(account_id);

-- ============================================================
-- LEADS
-- Final lead objects delivered to the customer
-- ============================================================

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null references public.workspaces(id) on delete cascade,

  account_id uuid not null references public.accounts(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  opportunity_id uuid references public.opportunities(id) on delete set null,

  quality_score numeric(5,2),
  relevance_score numeric(5,2),
  data_confidence numeric(5,2),

  status text not null default 'new'
    check (
      status in (
        'new',
        'reviewed',
        'contacted',
        'replied',
        'qualified',
        'converted',
        'rejected',
        'archived'
      )
    ),

  delivery_date date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_workspace_idx
  on public.leads(workspace_id);

create index if not exists leads_delivery_idx
  on public.leads(workspace_id, delivery_date);

-- ============================================================
-- RESEARCH RUNS
-- Every autonomous research cycle
-- ============================================================

create table if not exists public.research_runs (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null references public.workspaces(id) on delete cascade,

  run_type text not null default 'lead_research',

  status text not null default 'queued'
    check (
      status in (
        'queued',
        'running',
        'completed',
        'failed',
        'cancelled'
      )
    ),

  candidates_discovered integer not null default 0,
  businesses_verified integer not null default 0,
  contacts_found integer not null default 0,
  contacts_verified integer not null default 0,
  leads_delivered integer not null default 0,

  started_at timestamptz,
  completed_at timestamptz,

  error_message text,

  created_at timestamptz not null default now()
);

create index if not exists research_runs_workspace_idx
  on public.research_runs(workspace_id);

-- ============================================================
-- JOBS
-- Background work
-- ============================================================

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null references public.workspaces(id) on delete cascade,

  job_type text not null,

  status text not null default 'queued'
    check (
      status in (
        'queued',
        'running',
        'completed',
        'failed',
        'cancelled'
      )
    ),

  payload jsonb not null default '{}'::jsonb,

  attempts integer not null default 0,
  max_attempts integer not null default 3,

  run_after timestamptz not null default now(),

  locked_at timestamptz,
  completed_at timestamptz,

  error_message text,

  created_at timestamptz not null default now()
);

create index if not exists jobs_queue_idx
  on public.jobs(status, run_after);

-- ============================================================
-- USAGE EVENTS
-- Credits / usage / billing foundation
-- ============================================================

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null references public.workspaces(id) on delete cascade,

  event_type text not null,
  quantity integer not null default 1,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index if not exists usage_events_workspace_idx
  on public.usage_events(workspace_id);

-- ============================================================
-- AUDIT LOGS
-- ============================================================

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null references public.organizations(id) on delete cascade,

  user_id uuid references auth.users(id) on delete set null,

  action text not null,
  entity_type text,
  entity_id uuid,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index if not exists audit_logs_org_idx
  on public.audit_logs(organization_id);

-- ============================================================
-- UPDATED_AT FUNCTION
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

drop trigger if exists organizations_updated_at on public.organizations;

create trigger organizations_updated_at
before update on public.organizations
for each row
execute function public.set_updated_at();


drop trigger if exists workspaces_updated_at on public.workspaces;

create trigger workspaces_updated_at
before update on public.workspaces
for each row
execute function public.set_updated_at();


drop trigger if exists business_profiles_updated_at on public.business_profiles;

create trigger business_profiles_updated_at
before update on public.business_profiles
for each row
execute function public.set_updated_at();


drop trigger if exists icp_profiles_updated_at on public.icp_profiles;

create trigger icp_profiles_updated_at
before update on public.icp_profiles
for each row
execute function public.set_updated_at();


drop trigger if exists accounts_updated_at on public.accounts;

create trigger accounts_updated_at
before update on public.accounts
for each row
execute function public.set_updated_at();


drop trigger if exists contacts_updated_at on public.contacts;

create trigger contacts_updated_at
before update on public.contacts
for each row
execute function public.set_updated_at();


drop trigger if exists opportunities_updated_at on public.opportunities;

create trigger opportunities_updated_at
before update on public.opportunities
for each row
execute function public.set_updated_at();


drop trigger if exists leads_updated_at on public.leads;

create trigger leads_updated_at
before update on public.leads
for each row
execute function public.set_updated_at();

-- ============================================================
-- ENABLE RLS
-- ============================================================

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.workspaces enable row level security;
alter table public.business_profiles enable row level security;
alter table public.icp_profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.contacts enable row level security;
alter table public.evidence enable row level security;
alter table public.opportunities enable row level security;
alter table public.leads enable row level security;
alter table public.research_runs enable row level security;
alter table public.jobs enable row level security;
alter table public.usage_events enable row level security;
alter table public.audit_logs enable row level security;

-- ============================================================
-- MEMBERSHIP HELPER
-- ============================================================

create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = target_org
      and om.user_id = auth.uid()
  );
$$;

-- ============================================================
-- WORKSPACE ACCESS HELPER
-- ============================================================

create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspaces w
    join public.organization_members om
      on om.organization_id = w.organization_id
    where w.id = target_workspace
      and om.user_id = auth.uid()
  );
$$;

-- ============================================================
-- ORGANIZATION POLICIES
-- ============================================================

create policy "organization members can view organizations"
on public.organizations
for select
to authenticated
using (
  public.is_org_member(id)
);

create policy "organization owners can update organizations"
on public.organizations
for update
to authenticated
using (
  created_by = auth.uid()
)
with check (
  created_by = auth.uid()
);

-- ============================================================
-- ORGANIZATION MEMBER POLICIES
-- ============================================================

create policy "members can view organization members"
on public.organization_members
for select
to authenticated
using (
  public.is_org_member(organization_id)
);

create policy "users can join organizations they create"
on public.organization_members
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_org_member(organization_id)
);

-- ============================================================
-- WORKSPACE POLICIES
-- ============================================================

create policy "members can view workspaces"
on public.workspaces
for select
to authenticated
using (
  public.is_org_member(organization_id)
);

create policy "members can create workspaces"
on public.workspaces
for insert
to authenticated
with check (
  public.is_org_member(organization_id)
);

create policy "members can update workspaces"
on public.workspaces
for update
to authenticated
using (
  public.is_org_member(organization_id)
)
with check (
  public.is_org_member(organization_id)
);

-- ============================================================
-- WORKSPACE-OWNED DATA POLICIES
-- ============================================================

create policy "members can view business profiles"
on public.business_profiles
for select
to authenticated
using (
  public.is_workspace_member(workspace_id)
);

create policy "members can manage business profiles"
on public.business_profiles
for all
to authenticated
using (
  public.is_workspace_member(workspace_id)
)
with check (
  public.is_workspace_member(workspace_id)
);


create policy "members can view icp profiles"
on public.icp_profiles
for select
to authenticated
using (
  public.is_workspace_member(workspace_id)
);

create policy "members can manage icp profiles"
on public.icp_profiles
for all
to authenticated
using (
  public.is_workspace_member(workspace_id)
)
with check (
  public.is_workspace_member(workspace_id)
);


create policy "members can view accounts"
on public.accounts
for select
to authenticated
using (
  public.is_workspace_member(workspace_id)
);

create policy "members can manage accounts"
on public.accounts
for all
to authenticated
using (
  public.is_workspace_member(workspace_id)
)
with check (
  public.is_workspace_member(workspace_id)
);


create policy "members can view contacts"
on public.contacts
for select
to authenticated
using (
  public.is_workspace_member(workspace_id)
);

create policy "members can manage contacts"
on public.contacts
for all
to authenticated
using (
  public.is_workspace_member(workspace_id)
)
with check (
  public.is_workspace_member(workspace_id)
);


create policy "members can view evidence"
on public.evidence
for select
to authenticated
using (
  public.is_workspace_member(workspace_id)
);

create policy "members can manage evidence"
on public.evidence
for all
to authenticated
using (
  public.is_workspace_member(workspace_id)
)
with check (
  public.is_workspace_member(workspace_id)
);


create policy "members can view opportunities"
on public.opportunities
for select
to authenticated
using (
  public.is_workspace_member(workspace_id)
);

create policy "members can manage opportunities"
on public.opportunities
for all
to authenticated
using (
  public.is_workspace_member(workspace_id)
)
with check (
  public.is_workspace_member(workspace_id)
);


create policy "members can view leads"
on public.leads
for select
to authenticated
using (
  public.is_workspace_member(workspace_id)
);

create policy "members can manage leads"
on public.leads
for all
to authenticated
using (
  public.is_workspace_member(workspace_id)
)
with check (
  public.is_workspace_member(workspace_id)
);


create policy "members can view research runs"
on public.research_runs
for select
to authenticated
using (
  public.is_workspace_member(workspace_id)
);


create policy "members can view jobs"
on public.jobs
for select
to authenticated
using (
  public.is_workspace_member(workspace_id)
);


create policy "members can view usage"
on public.usage_events
for select
to authenticated
using (
  public.is_workspace_member(workspace_id)
);


create policy "organization members can view audit logs"
on public.audit_logs
for select
to authenticated
using (
  public.is_org_member(organization_id)
);

-- ============================================================
-- LOCK DOWN ANONYMOUS ACCESS
-- ============================================================

revoke all on public.organizations from anon;
revoke all on public.organization_members from anon;
revoke all on public.workspaces from anon;
revoke all on public.business_profiles from anon;
revoke all on public.icp_profiles from anon;
revoke all on public.accounts from anon;
revoke all on public.contacts from anon;
revoke all on public.evidence from anon;
revoke all on public.opportunities from anon;
revoke all on public.leads from anon;
revoke all on public.research_runs from anon;
revoke all on public.jobs from anon;
revoke all on public.usage_events from anon;
revoke all on public.audit_logs from anon;

-- ============================================================
-- AUTHENTICATED GRANTS
-- ============================================================

grant select, insert, update, delete
on public.organizations
to authenticated;

grant select, insert, update, delete
on public.organization_members
to authenticated;

grant select, insert, update, delete
on public.workspaces
to authenticated;

grant select, insert, update, delete
on public.business_profiles
to authenticated;

grant select, insert, update, delete
on public.icp_profiles
to authenticated;

grant select, insert, update, delete
on public.accounts
to authenticated;

grant select, insert, update, delete
on public.contacts
to authenticated;

grant select, insert, update, delete
on public.evidence
to authenticated;

grant select, insert, update, delete
on public.opportunities
to authenticated;

grant select, insert, update, delete
on public.leads
to authenticated;

grant select
on public.research_runs
to authenticated;

grant select
on public.jobs
to authenticated;

grant select
on public.usage_events
to authenticated;

grant select
on public.audit_logs
to authenticated;

grant execute
on function public.is_org_member(uuid)
to authenticated;

grant execute
on function public.is_workspace_member(uuid)
to authenticated;

-- ============================================================
-- END
-- ============================================================