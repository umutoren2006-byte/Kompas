-- Kompas: initial schema
-- Every table is scoped to auth.uid() via a user_id column + RLS.
-- Run this in the Supabase SQL editor of your project, or via `supabase db push`.

create extension if not exists "pgcrypto";

-- ========== profiles (bedrijfsgegevens van de gebruiker) ==========
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  company_name text,
  kvk_number text,
  vat_number text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Auto-create a profile row when a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ========== customers (klanten) ==========
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  company_name text,
  email text,
  address text,
  vat_number text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customers enable row level security;

create policy "customers_all_own" on public.customers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists customers_user_id_idx on public.customers(user_id);

-- ========== invoices (facturen) ==========
create type public.invoice_status as enum ('concept', 'verzonden', 'betaald', 'te_laat');

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  invoice_number text not null,
  status public.invoice_status not null default 'concept',
  issue_date date not null default current_date,
  due_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, invoice_number)
);

alter table public.invoices enable row level security;

create policy "invoices_all_own" on public.invoices
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists invoices_user_id_idx on public.invoices(user_id);
create index if not exists invoices_customer_id_idx on public.invoices(customer_id);

-- ========== invoice_lines (factuurregels) ==========
create table if not exists public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  quantity numeric(12,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  vat_rate numeric(5,2) not null default 21,
  sort_order int not null default 0
);

alter table public.invoice_lines enable row level security;

create policy "invoice_lines_all_own" on public.invoice_lines
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists invoice_lines_invoice_id_idx on public.invoice_lines(invoice_id);

-- ========== transactions (inkomsten & uitgaven) ==========
create type public.transaction_type as enum ('inkomst', 'uitgave');

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type public.transaction_type not null,
  category text not null default 'overig',
  description text,
  amount numeric(12,2) not null,
  vat_rate numeric(5,2) not null default 21,
  transaction_date date not null default current_date,
  invoice_id uuid references public.invoices(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.transactions enable row level security;

create policy "transactions_all_own" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists transactions_user_id_idx on public.transactions(user_id);
create index if not exists transactions_date_idx on public.transactions(transaction_date);

-- ========== receipts (bonnetjes) ==========
create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete set null,
  file_path text not null,
  file_name text not null,
  uploaded_at timestamptz not null default now()
);

alter table public.receipts enable row level security;

create policy "receipts_all_own" on public.receipts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists receipts_user_id_idx on public.receipts(user_id);
create index if not exists receipts_transaction_id_idx on public.receipts(transaction_id);

-- ========== tasks (actielijst) ==========
create type public.task_type as enum ('handmatig', 'ontbrekend_bonnetje', 'factuur_te_laat');

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  type public.task_type not null default 'handmatig',
  related_invoice_id uuid references public.invoices(id) on delete cascade,
  related_transaction_id uuid references public.transactions(id) on delete cascade,
  is_done boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.tasks enable row level security;

create policy "tasks_all_own" on public.tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists tasks_user_id_idx on public.tasks(user_id);

-- ========== storage: bonnetjes bucket ==========
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

create policy "receipts_storage_select_own"
  on storage.objects for select
  using (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "receipts_storage_insert_own"
  on storage.objects for insert
  with check (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "receipts_storage_delete_own"
  on storage.objects for delete
  using (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);
