-- Marbella Maintenance — database schema
-- Run this once in: Supabase Dashboard > SQL Editor > New query > paste all > Run

-- 1. Client profiles (extends the built-in auth.users with our own fields)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  address text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- 2. Maintenance visit history — written only by staff via the Supabase
--    Table Editor, read-only for the client it belongs to.
create table public.maintenance_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  visit_date date not null,
  service_es text not null,
  service_en text not null,
  status text not null check (status in ('ok','progress','pending')),
  technician text,
  note_es text,
  note_en text,
  created_at timestamptz not null default now()
);

alter table public.maintenance_records enable row level security;

create policy "Users can view own records"
  on public.maintenance_records for select
  using (auth.uid() = user_id);

-- 3. Messages a logged-in client sends to the company
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;

create policy "Users can view own messages"
  on public.messages for select
  using (auth.uid() = user_id);

create policy "Users can send messages"
  on public.messages for insert
  with check (auth.uid() = user_id);

-- 4. Public booking requests (anyone can submit, nobody can read back
--    through the API — only visible to you in the Table Editor)
create table public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  address text,
  services text[],
  preferred_date date,
  time_slot text,
  message text,
  created_at timestamptz not null default now()
);

alter table public.booking_requests enable row level security;

create policy "Anyone can submit a booking request"
  on public.booking_requests for insert
  with check (true);

-- 5. Public contact form messages (same idea as above)
create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subject text,
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.contact_messages enable row level security;

create policy "Anyone can send a contact message"
  on public.contact_messages for insert
  with check (true);

-- 6. Auto-create a profile row the moment someone registers
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, address)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'address'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 7. Baseline table grants. RLS policies above control *which rows* a
--    role can touch, but Postgres still blocks everything by default
--    unless the role also has a GRANT on the table itself.
grant usage on schema public to anon, authenticated;

grant select on public.profiles to authenticated;
grant update on public.profiles to authenticated;

grant select on public.maintenance_records to authenticated;

grant select, insert on public.messages to authenticated;

grant insert on public.booking_requests to anon, authenticated;

grant insert on public.contact_messages to anon, authenticated;
