create extension if not exists pgcrypto;

create type public.user_role as enum ('admin', 'dispatcher', 'driver');
create type public.load_status as enum (
  'Assigned',
  'Arrived',
  'Loaded',
  'In Transit',
  'Delivered',
  'Cancelled'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.user_role not null default 'driver',
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.loads (
  id uuid primary key default gen_random_uuid(),
  load_number text unique not null,
  driver_id uuid references public.profiles(id),
  pickup_location text not null,
  pickup_date date,
  status public.load_status not null default 'Assigned',
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS controls rows, not columns. Isolating these fields prevents drivers
-- from bypassing the UI and reading protected values through the API.
create table public.load_destinations (
  load_id uuid primary key references public.loads(id) on delete cascade,
  delivery_location text not null,
  delivery_date date
);

create table public.load_dispatch_details (
  load_id uuid primary key references public.loads(id) on delete cascade,
  broker text,
  reference_number text,
  driver_pay numeric(10,2) not null default 0
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  load_id uuid not null references public.loads(id) on delete cascade,
  document_type text not null check (
    document_type in (
      'pod',
      'load_photo',
      'rate_confirmation',
      'fuel_receipt',
      'lumper_receipt'
    )
  ),
  storage_path text not null,
  file_name text not null,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.loads enable row level security;
alter table public.load_destinations enable row level security;
alter table public.load_dispatch_details enable row level security;
alter table public.documents enable row level security;

create policy "users read own profile"
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy "staff read profiles"
on public.profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'dispatcher')
  )
);

create policy "drivers read active assigned load"
on public.loads
for select
to authenticated
using (
  (driver_id = auth.uid() and active = true)
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'dispatcher')
  )
);

create policy "staff manage loads"
on public.loads
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'dispatcher')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'dispatcher')
  )
);

create policy "drivers read unlocked destination"
on public.load_destinations
for select
to authenticated
using (
  exists (
    select 1 from public.loads l
    where l.id = load_id
      and l.driver_id = auth.uid()
      and l.active = true
  )
  and exists (
    select 1 from public.documents d
    where d.load_id = load_id and d.document_type = 'load_photo'
  )
);

create policy "staff manage destinations"
on public.load_destinations
for all
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'dispatcher')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'dispatcher')
  )
);

create policy "staff manage dispatch details"
on public.load_dispatch_details
for all
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'dispatcher')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'dispatcher')
  )
);

create policy "drivers read their operational documents"
on public.documents
for select
to authenticated
using (
  (
    document_type in ('pod', 'load_photo')
    and exists (
      select 1
      from public.loads l
      where l.id = load_id
        and l.driver_id = auth.uid()
    )
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'dispatcher')
  )
);

create policy "drivers add operational documents"
on public.documents
for insert
to authenticated
with check (
  document_type in ('pod', 'load_photo')
  and exists (
    select 1
    from public.loads l
    where l.id = load_id
      and l.driver_id = auth.uid()
  )
);

create policy "staff manage documents"
on public.documents
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'dispatcher')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'dispatcher')
  )
);
