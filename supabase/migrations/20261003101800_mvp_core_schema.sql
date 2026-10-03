-- Applied remotely via MCP (fisdjuejbuszldfqratl). Kept for repo history.
-- See also harden_rls_helpers migration.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  asaas_key_enc text,
  env text not null default 'sandbox' check (env in ('sandbox', 'production')),
  wallet_id text,
  nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounts_user_id_key unique (user_id)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  parts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.pending_actions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  type text not null,
  payload jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'cancelled', 'executed', 'failed', 'expired')),
  idempotency_key text not null,
  result jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  executed_at timestamptz,
  constraint pending_actions_idempotency_key unique (idempotency_key)
);

create table if not exists public.tool_logs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.accounts (id) on delete set null,
  conversation_id uuid references public.conversations (id) on delete set null,
  tool_name text not null,
  request jsonb,
  response jsonb,
  latency_ms integer,
  error text,
  created_at timestamptz not null default now()
);
