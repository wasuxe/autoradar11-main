-- ============================================================
-- AUTORADAR — DATABASE FOUNDATION
-- Migration: 0001_autoradar_foundation
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
-- ENUMS
-- ============================================================

create type public.organization_member_role as enum (
  'owner',
  'admin',
  'member'
);

create type public.lead_status as enum (
  'new',
  'qualified',
  'review',
  'contacted',
  'replied',
  'won',
  'lost',
  'rejected'
);

create type public.confidence_level as enum (
  'high',
  'medium',
  'low',
  'unknown'
);

create type public.verification_status as enum (
  'verified',
  'partially_verified',
  'unverified',
  'not_found',
  'rejected'
);

create type public.evidence_type as enum (
  'official_website',
  'official_about',
  'official_team',
  'official_contact',
  'public_professional_profile',
  'public_social_profile',
  'public_business_source',
  'public_news',
  'public_directory',
  'licensed_enrichment',
  'search_result',
  'other'
);

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
-- ORGANIZATIONS
-- ============================================================

create table public.organizations (
  id uuid primary key default gen_random_uuid(),

  name text not null,
  slug text not null unique,

  created_by uuid references auth.users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- ORGANIZATION MEMBERS
-- ============================================================

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  role public.organization_member_role not null default 'member',

  created_at timestamptz not null default now(),

  unique (organization_id, user_id)
);

create index organization_members_user_idx
  on public.organization_members(user_id);

create index organization_members_org_idx
  on public.organization_members(organization_id);

-- ============================================================
-- WORKSPACES
-- ============================================================

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,

  name text not null,
  slug text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (organization_id, slug)
);

create index workspaces_org_idx
  on public.workspaces(organization_id);

-- ============================================================
-- BUSINESS PROFILE
-- What AutoRadar learns about the customer.
-- ============================================================

create table public.business_profiles (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  business_name text not null,

  website text,
  description text,

  services jsonb not null default '[]'::jsonb,
  industries jsonb not null default '[]'::jsonb,
  locations jsonb not null default '[]'::jsonb,

  target_company_size jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (workspace_id)
);

-- ============================================================
-- ICP
-- AutoRadar's understanding of the ideal customer.
-- ============================================================

create table public.icp_profiles (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  name text not null default 'Default ICP',

  industries jsonb not null default '[]'::jsonb,
  locations jsonb not null default '[]'::jsonb,
  company_sizes jsonb not null default '[]'::jsonb,

  required_signals jsonb not null default '[]'::jsonb,
  excluded_signals jsonb not null default '[]'::jsonb,

  service_tracks jsonb not null default '[]'::jsonb,

  rules jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index icp_profiles_workspace_idx
  on public.icp_profiles(workspace_id);

-- ============================================================
-- ACCOUNTS
-- A researched company / organization.
-- ============================================================

create table public.accounts (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  canonical_name text not null,

  website text,
  website_domain text,

  industry text,
  country text,
  city text,

  employee_range text,
  founded_year integer,

  description text,

  identity_confidence public.confidence_level
    not null default 'unknown',

  website_verification public.verification_status
    not null default 'not_found',

  is_business_entity boolean not null default false,

  source text,
  source_url text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index accounts_workspace_idx
  on public.accounts(workspace_id);

create index accounts_domain_idx
  on public.accounts(website_domain);

create index accounts_name_idx
  on public.accounts using gin (to_tsvector('simple', canonical_name));

-- ============================================================
-- CONTACTS
-- Person-level information.
-- Separate from account-level phone/email.
-- ============================================================

create table public.contacts (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  account_id uuid not null
    references public.accounts(id)
    on delete cascade,

  full_name text not null,

  role text,

  role_confidence public.confidence_level
    not null default 'unknown',

  person_confidence public.confidence_level
    not null default 'unknown',

  email text,
  email_status public.verification_status
    not null default 'not_found',

  phone text,
  phone_status public.verification_status
    not null default 'not_found',

  linkedin_url text,
  linkedin_status public.verification_status
    not null default 'not_found',

  instagram_url text,
  instagram_status public.verification_status
    not null default 'not_found',

  is_decision_maker boolean not null default false,

  decision_maker_reason text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contacts_workspace_idx
  on public.contacts(workspace_id);

create index contacts_account_idx
  on public.contacts(account_id);

create index contacts_decision_maker_idx
  on public.contacts(account_id, is_decision_maker);

-- ============================================================
-- EVIDENCE
-- Every important claim can point back to evidence.
-- ============================================================

create table public.evidence (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  account_id uuid
    references public.accounts(id)
    on delete cascade,

  contact_id uuid
    references public.contacts(id)
    on delete cascade,

  type public.evidence_type not null,

  source_url text not null,

  source_domain text,

  title text,

  claim text not null,

  field_name text,

  verification_status public.verification_status
    not null default 'unverified',

  confidence public.confidence_level
    not null default 'unknown',

  observed_at timestamptz not null default now(),

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  constraint evidence_target_check
  check (
    account_id is not null
    or contact_id is not null
  )
);

create index evidence_account_idx
  on public.evidence(account_id);

create index evidence_contact_idx
  on public.evidence(contact_id);

create index evidence_workspace_idx
  on public.evidence(workspace_id);

-- ============================================================
-- LEADS
-- A lead is an opportunity, not merely a company.
-- ============================================================

create table public.leads (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  account_id uuid not null
    references public.accounts(id)
    on delete cascade,

  contact_id uuid
    references public.contacts(id)
    on delete set null,

  status public.lead_status not null default 'new',

  relevance_score numeric(5,2),
  data_quality_score numeric(5,2),
  contactability_score numeric(5,2),

  why_this_company text,
  why_they_may_need_you text,
  why_reach_out text,
  why_now text,

  recommended_action text,
  recommended_channel text,
  recommended_timing text,

  confidence public.confidence_level
    not null default 'unknown',

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leads_workspace_idx
  on public.leads(workspace_id);

create index leads_status_idx
  on public.leads(workspace_id, status);

create index leads_quality_idx
  on public.leads(workspace_id, data_quality_score desc);

-- ============================================================
-- RESEARCH RUNS
-- Every automated research operation gets a record.
-- ============================================================

create table public.research_runs (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  run_type text not null,

  status text not null default 'queued',

  candidates_found integer not null default 0,
  candidates_rejected integer not null default 0,
  accounts_verified integer not null default 0,
  contacts_found integer not null default 0,
  leads_created integer not null default 0,

  started_at timestamptz,
  completed_at timestamptz,

  error_message text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index research_runs_workspace_idx
  on public.research_runs(workspace_id);

-- ============================================================
-- JOBS
-- Background work.
-- ============================================================

create table public.jobs (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  job_type text not null,

  status text not null default 'queued',

  priority integer not null default 100,

  payload jsonb not null default '{}'::jsonb,

  attempts integer not null default 0,

  max_attempts integer not null default 3,

  available_at timestamptz not null default now(),

  started_at timestamptz,
  completed_at timestamptz,

  error_message text,

  created_at timestamptz not null default now()
);

create index jobs_queue_idx
  on public.jobs(status, priority, available_at);

create index jobs_workspace_idx
  on public.jobs(workspace_id);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

create trigger organizations_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

create trigger workspaces_updated_at
before update on public.workspaces
for each row execute function public.set_updated_at();

create trigger business_profiles_updated_at
before update on public.business_profiles
for each row execute function public.set_updated_at();

create trigger icp_profiles_updated_at
before update on public.icp_profiles
for each row execute function public.set_updated_at();

create trigger accounts_updated_at
before update on public.accounts
for each row execute function public.set_updated_at();

create trigger contacts_updated_at
before update on public.contacts
for each row execute function public.set_updated_at();

create trigger leads_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

-- ============================================================
-- SECURITY HELPERS
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

create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    join public.workspaces w
      on w.organization_id = om.organization_id
    where w.id = target_workspace
      and om.user_id = auth.uid()
  );
$$;

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
alter table public.leads enable row level security;
alter table public.research_runs enable row level security;
alter table public.jobs enable row level security;

-- ============================================================
-- ORGANIZATION POLICIES
-- ============================================================

create policy "members can view organizations"
on public.organizations
for select
to authenticated
using (
  public.is_org_member(id)
);

create policy "users can create organizations"
on public.organizations
for insert
to authenticated
with check (
  created_by = auth.uid()
);

create policy "organization members can view membership"
on public.organization_members
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_org_member(organization_id)
);

-- ============================================================
-- WORKSPACE POLICIES
-- ============================================================

create policy "members can view workspaces"
on public.workspaces
for select
to authenticated
using (
  public.is_workspace_member(id)
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
  public.is_workspace_member(id)
)
with check (
  public.is_workspace_member(id)
);

-- ============================================================
-- WORKSPACE-SCOPED POLICIES
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

create policy "members can manage research runs"
on public.research_runs
for all
to authenticated
using (
  public.is_workspace_member(workspace_id)
)
with check (
  public.is_workspace_member(workspace_id)
);

create policy "members can view jobs"
on public.jobs
for select
to authenticated
using (
  public.is_workspace_member(workspace_id)
);

create policy "members can manage jobs"
on public.jobs
for all
to authenticated
using (
  public.is_workspace_member(workspace_id)
)
with check (
  public.is_workspace_member(workspace_id)
);

-- ============================================================
-- GRANTS
-- ============================================================

revoke all on public.organizations from anon;
revoke all on public.organization_members from anon;
revoke all on public.workspaces from anon;
revoke all on public.business_profiles from anon;
revoke all on public.icp_profiles from anon;
revoke all on public.accounts from anon;
revoke all on public.contacts from anon;
revoke all on public.evidence from anon;
revoke all on public.leads from anon;
revoke all on public.research_runs from anon;
revoke all on public.jobs from anon;

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
on public.leads
to authenticated;

grant select, insert, update, delete
on public.research_runs
to authenticated;

grant select, insert, update, delete
on public.jobs
to authenticated;