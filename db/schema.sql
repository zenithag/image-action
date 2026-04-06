create extension if not exists "pgcrypto";

-- Tenants

create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'suspended', 'archived')),
  plan_code text not null,
  created_at timestamptz not null default now()
);

create table if not exists tenant_domains (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  hostname text not null unique,
  is_primary boolean not null default false,
  status text not null default 'pending_verification'
    check (status in ('pending_verification', 'verified', 'failed', 'disabled')),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists tenant_channels (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  channel_type text not null check (channel_type in ('whatsapp', 'instagram')),
  provider text not null check (provider in ('uazapi', 'wuzapi')),
  external_session_id text not null,
  webhook_secret text,
  status text not null default 'pending'
    check (status in ('pending', 'connected', 'disconnected', 'error')),
  created_at timestamptz not null default now()
);

create table if not exists llm_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  provider text not null default 'openrouter',
  default_model text not null,
  fallback_model text,
  system_prompt text not null,
  guardrail_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Contacts & Conversations

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  external_contact_id text not null,
  display_name text not null,
  phone text,
  created_at timestamptz not null default now()
);

create unique index if not exists contacts_tenant_external_idx
  on contacts (tenant_id, external_contact_id);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  channel_id uuid not null references tenant_channels(id) on delete restrict,
  contact_id uuid not null references contacts(id) on delete restrict,
  status text not null default 'open'
    check (status in ('open', 'waiting_customer', 'waiting_operator', 'closed')),
  state text not null default 'idle'
    check (state in ('idle', 'awaiting_base_image', 'collecting_preferences',
                     'showing_options', 'awaiting_selection', 'composing', 'completed')),
  handled_by text not null default 'ai' check (handled_by in ('ai', 'operator')),
  operator_id uuid,
  last_message_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  role text not null check (role in ('customer', 'assistant', 'operator', 'system')),
  content text not null,
  content_type text not null default 'text'
    check (content_type in ('text', 'image', 'catalog_options', 'composition_result')),
  provider_message_id text,
  created_at timestamptz not null default now()
);

create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete set null,
  role text not null
    check (role in ('reference', 'base_image', 'overlay', 'mask', 'render', 'attachment', 'catalog')),
  mime_type text not null,
  storage_key text not null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Catalog

create table if not exists catalog_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  parent_id uuid references catalog_categories(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (tenant_id, name, parent_id)
);

create table if not exists catalog_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  category_id uuid not null references catalog_categories(id) on delete restrict,
  name text not null,
  description text not null default '',
  sku text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  tags jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists catalog_item_images (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  catalog_item_id uuid not null references catalog_items(id) on delete cascade,
  asset_id uuid not null references assets(id) on delete restrict,
  role text not null default 'primary'
    check (role in ('primary', 'swatch', 'applied_example')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Composition Jobs & Renders

create table if not exists composition_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  mode text not null check (mode in ('interior', 'product', 'print', 'fashion')),
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'done', 'failed')),
  catalog_item_id uuid references catalog_items(id) on delete set null,
  base_asset_id uuid not null references assets(id) on delete restrict,
  overlay_asset_id uuid references assets(id) on delete restrict,
  mask_asset_id uuid references assets(id) on delete restrict,
  input_payload jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists renders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  job_id uuid not null references composition_jobs(id) on delete cascade,
  asset_id uuid not null references assets(id) on delete restrict,
  version integer not null default 1,
  created_at timestamptz not null default now()
);

-- Usage / Billing

create table if not exists usage_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  kind text not null,
  provider text not null,
  reference_id text,
  quantity numeric(18, 4) not null,
  unit_cost numeric(18, 8) not null default 0,
  total_cost numeric(18, 8) not null default 0,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
