-- Staff call + POS FCM notification support
-- Safe to run multiple times in Supabase SQL Editor.

create table if not exists pos_devices (
  id bigint generated always as identity primary key,
  name text not null,
  fcm_token text not null unique,
  is_active boolean not null default true,
  last_seen_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists staff_calls (
  id bigint generated always as identity primary key,
  session_id uuid not null references sessions(id) on delete cascade,
  table_id bigint not null references tables(id) on delete cascade,
  table_number integer not null check (table_number > 0),
  status text not null default 'pending' check (status in ('pending', 'acknowledged', 'cancelled')),
  message text not null default 'เรียกพนักงาน',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  acknowledged_at timestamp with time zone
);

create index if not exists idx_pos_devices_active on pos_devices(is_active) where is_active;
create index if not exists idx_staff_calls_status_created_at on staff_calls(status, created_at desc);
create index if not exists idx_staff_calls_session_id on staff_calls(session_id);

alter table pos_devices enable row level security;
alter table staff_calls enable row level security;

drop policy if exists "Allow service_role full access to pos_devices" on pos_devices;
create policy "Allow service_role full access to pos_devices" on pos_devices for all using (true);

drop policy if exists "Allow public read access to staff_calls" on staff_calls;
create policy "Allow public read access to staff_calls" on staff_calls for select using (true);

drop policy if exists "Allow service_role full access to staff_calls" on staff_calls;
create policy "Allow service_role full access to staff_calls" on staff_calls for all using (true);
