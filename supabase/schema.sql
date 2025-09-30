-- CloudBlinker schema definition
-- run via: supabase db push

begin;

create extension if not exists "uuid-ossp";

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text check (role in ('client','blinker','admin')) not null,
  display_name text,
  stripe_customer_id text,
  stripe_account_id text,
  email text,
  created_at timestamptz default timezone('utc', now()),
  updated_at timestamptz default timezone('utc', now())
);

create table if not exists public.wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  available bigint not null default 0,
  on_hold bigint not null default 0,
  updated_at timestamptz default timezone('utc', now())
);

create table if not exists public.ledger_entries (
  id bigserial primary key,
  user_id uuid references auth.users(id),
  task_id bigint,
  type text check (type in ('debit','credit')) not null,
  bucket text check (bucket in ('available','on_hold')) not null,
  amount bigint not null,
  currency text default 'JPY',
  source_type text,
  source_id text,
  note text,
  created_at timestamptz default timezone('utc', now())
);

create table if not exists public.tasks (
  id bigserial primary key,
  client_id uuid references auth.users(id) not null,
  blinker_id uuid references auth.users(id),
  title text not null,
  description text,
  reward bigint not null,
  status text check (status in ('open','assigned','in_review','done','canceled')) default 'open',
  hold_locked boolean default false,
  created_at timestamptz default timezone('utc', now()),
  updated_at timestamptz default timezone('utc', now())
);

create table if not exists public.payments (
  id bigserial primary key,
  user_id uuid references auth.users(id) not null,
  amount bigint not null,
  currency text default 'JPY',
  payment_intent_id text unique,
  charge_id text,
  consumed_amount bigint default 0,
  refunded_amount bigint default 0,
  created_at timestamptz default timezone('utc', now())
);

create table if not exists public.payout_requests (
  id bigserial primary key,
  blinker_id uuid references auth.users(id) not null,
  amount bigint not null,
  status text check (status in ('requested','transferred','payout_paid','failed')) default 'requested',
  transfer_id text,
  payout_id text,
  created_at timestamptz default timezone('utc', now()),
  updated_at timestamptz default timezone('utc', now())
);

-- updated_at trigger helper
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_wallets_updated_at
before update on public.wallets
for each row execute function public.set_updated_at();

create trigger set_tasks_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

create trigger set_payout_requests_updated_at
before update on public.payout_requests
for each row execute function public.set_updated_at();

-- handle new user registration
create or replace function public.handle_new_user()
returns trigger as $$
declare
  user_role text;
  display_name text;
  email text;
begin
  user_role := coalesce(new.raw_user_meta_data->>'role', 'client');
  display_name := new.raw_user_meta_data->>'display_name';
  email := new.email;

  insert into public.profiles (user_id, role, display_name, email)
  values (new.id, user_role, display_name, email)
  on conflict (user_id) do update
    set role = excluded.role,
        display_name = coalesce(excluded.display_name, public.profiles.display_name),
        email = excluded.email,
        updated_at = timezone('utc', now());

  insert into public.wallets (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- grants
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to service_role;

-- row level security policies
alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.tasks enable row level security;
alter table public.payments enable row level security;
alter table public.payout_requests enable row level security;
alter table public.ledger_entries enable row level security;

create policy "Profiles are visible to owner"
on public.profiles for select
using (auth.uid() = user_id or exists(select 1 from public.profiles p2 where p2.user_id = auth.uid() and p2.role = 'admin'));

create policy "Profiles updatable by owner"
on public.profiles for update
using (auth.uid() = user_id or exists(select 1 from public.profiles p2 where p2.user_id = auth.uid() and p2.role = 'admin'))
with check (auth.uid() = user_id or exists(select 1 from public.profiles p2 where p2.user_id = auth.uid() and p2.role = 'admin'));

create policy "Wallets readable by owner"
on public.wallets for select
using (auth.uid() = user_id or exists(select 1 from public.profiles p2 where p2.user_id = auth.uid() and p2.role = 'admin'));

create policy "Ledger entries visible to admins"
on public.ledger_entries for select
using (exists(select 1 from public.profiles p2 where p2.user_id = auth.uid() and p2.role = 'admin'));

create policy "Tasks for clients"
on public.tasks for select
using (
  auth.uid() = client_id or
  auth.uid() = blinker_id or
  exists(select 1 from public.profiles p2 where p2.user_id = auth.uid() and p2.role = 'admin')
);

create policy "Tasks insert by clients"
on public.tasks for insert
with check (auth.uid() = client_id);

create policy "Tasks update by owner or assigned"
on public.tasks for update
using (
  auth.uid() = client_id or
  auth.uid() = blinker_id or
  exists(select 1 from public.profiles p2 where p2.user_id = auth.uid() and p2.role = 'admin')
)
with check (
  auth.uid() = client_id or
  auth.uid() = blinker_id or
  exists(select 1 from public.profiles p2 where p2.user_id = auth.uid() and p2.role = 'admin')
);

create policy "Payments readable by owner"
on public.payments for select
using (auth.uid() = user_id or exists(select 1 from public.profiles p2 where p2.user_id = auth.uid() and p2.role = 'admin'));

create policy "Payout requests accessible by owner"
on public.payout_requests for select
using (auth.uid() = blinker_id or exists(select 1 from public.profiles p2 where p2.user_id = auth.uid() and p2.role = 'admin'));

create policy "Payout requests insert by owner"
on public.payout_requests for insert
with check (auth.uid() = blinker_id);

commit;
