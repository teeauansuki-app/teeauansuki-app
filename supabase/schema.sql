-- Supabase Database Schema for Tee Uan Shabu Auth & Cashier Table Selection
-- (Idempotent - Safe to run multiple times)

-- 1. EXTENSIONS
create extension if not exists "uuid-ossp";

-- 2. TABLES

-- staff table
create table if not exists staff (
  id bigint generated always as identity primary key,
  pin text not null unique check (length(pin) = 6),
  role text not null check (role in ('cashier', 'admin')),
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- packages table
create table if not exists packages (
  id text primary key check (id in ('standard', 'premium')),
  name text not null,
  price numeric(10, 2) not null check (price >= 0),
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- tables table
create table if not exists tables (
  id bigint generated always as identity primary key,
  table_number integer not null unique check (table_number > 0),
  status text not null default 'vacant' check (status in ('vacant', 'occupied')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- sessions table
create table if not exists sessions (
  id uuid default gen_random_uuid() primary key,
  table_id bigint not null references tables(id) on delete cascade,
  package_id text not null references packages(id),
  status text not null default 'active' check (status in ('active', 'completed')),
  opened_at timestamp with time zone default timezone('utc'::text, now()) not null,
  closed_at timestamp with time zone
);

-- categories table
create table if not exists categories (
  id bigint generated always as identity primary key,
  name text not null,
  description text,
  image_url text,
  sort_order integer not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- menu_items table
create table if not exists menu_items (
  id bigint generated always as identity primary key,
  category_id bigint references categories(id) on delete set null,
  name text not null,
  description text,
  price numeric(10, 2) not null default 0.00 check (price >= 0),
  image_url text,
  package_id text references packages(id),
  is_available boolean not null default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- menu option groups table
create table if not exists menu_option_groups (
  id bigint generated always as identity primary key,
  menu_item_id bigint not null references menu_items(id) on delete cascade,
  name text not null,
  selection_type text not null default 'single' check (selection_type in ('single', 'multiple')),
  is_required boolean not null default false,
  min_select integer not null default 0 check (min_select >= 0),
  max_select integer not null default 1 check (max_select >= 0),
  sort_order integer not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- menu option choices table
create table if not exists menu_option_choices (
  id bigint generated always as identity primary key,
  option_group_id bigint not null references menu_option_groups(id) on delete cascade,
  name text not null,
  price_delta numeric(10, 2) not null default 0.00 check (price_delta >= 0),
  sort_order integer not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- orders table
create table if not exists orders (
  id bigint generated always as identity primary key,
  session_id uuid not null references sessions(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'served', 'cancelled')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- order_items table
create table if not exists order_items (
  id bigint generated always as identity primary key,
  order_id bigint not null references orders(id) on delete cascade,
  menu_item_id bigint not null references menu_items(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  notes text,
  selected_options jsonb not null default '[]'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- print_jobs table
create table if not exists print_jobs (
  id bigint generated always as identity primary key,
  order_id bigint not null references orders(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'printed', 'failed')),
  error_message text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. INDEXES
create index if not exists idx_staff_pin on staff(pin);
create index if not exists idx_sessions_table_id on sessions(table_id);
create index if not exists idx_sessions_status on sessions(status);
create index if not exists idx_menu_items_category_id on menu_items(category_id);
create index if not exists idx_menu_option_groups_menu_item_id on menu_option_groups(menu_item_id);
create index if not exists idx_menu_option_choices_group_id on menu_option_choices(option_group_id);
create index if not exists idx_orders_session_id on orders(session_id);
create index if not exists idx_order_items_order_id on order_items(order_id);
create index if not exists idx_print_jobs_status on print_jobs(status);
-- Enforce a table can only have one active session at a time (partial unique index)
create unique index if not exists session_active_unique_per_table on sessions(table_id) where (status = 'active');

-- 4. ROW LEVEL SECURITY (RLS) POLICIES
alter table staff enable row level security;
alter table packages enable row level security;
alter table tables enable row level security;
alter table sessions enable row level security;
alter table categories enable row level security;
alter table menu_items enable row level security;
alter table menu_option_groups enable row level security;
alter table menu_option_choices enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table print_jobs enable row level security;

-- staff policies
drop policy if exists "Allow service_role full access to staff" on staff;
create policy "Allow service_role full access to staff" on staff for all using (true);

-- packages policies
drop policy if exists "Allow public read access to packages" on packages;
create policy "Allow public read access to packages" on packages for select using (true);

drop policy if exists "Allow service_role full access to packages" on packages;
create policy "Allow service_role full access to packages" on packages for all using (true);

-- tables policies
drop policy if exists "Allow public read access to tables" on tables;
create policy "Allow public read access to tables" on tables for select using (true);

drop policy if exists "Allow service_role full access to tables" on tables;
create policy "Allow service_role full access to tables" on tables for all using (true);

-- sessions policies
drop policy if exists "Allow customers to select their own active session" on sessions;
create policy "Allow customers to select their own active session" on sessions for select using (status = 'active');

drop policy if exists "Allow service_role full access to sessions" on sessions;
create policy "Allow service_role full access to sessions" on sessions for all using (true);

-- categories policies
drop policy if exists "Allow public read access to categories" on categories;
create policy "Allow public read access to categories" on categories for select using (true);

drop policy if exists "Allow service_role full access to categories" on categories;
create policy "Allow service_role full access to categories" on categories for all using (true);

-- menu_items policies
drop policy if exists "Allow public read access to menu_items" on menu_items;
create policy "Allow public read access to menu_items" on menu_items for select using (true);

drop policy if exists "Allow service_role full access to menu_items" on menu_items;
create policy "Allow service_role full access to menu_items" on menu_items for all using (true);

-- menu option groups policies
drop policy if exists "Allow public read access to menu_option_groups" on menu_option_groups;
create policy "Allow public read access to menu_option_groups" on menu_option_groups for select using (true);

drop policy if exists "Allow service_role full access to menu_option_groups" on menu_option_groups;
create policy "Allow service_role full access to menu_option_groups" on menu_option_groups for all using (true);

-- menu option choices policies
drop policy if exists "Allow public read access to menu_option_choices" on menu_option_choices;
create policy "Allow public read access to menu_option_choices" on menu_option_choices for select using (true);

drop policy if exists "Allow service_role full access to menu_option_choices" on menu_option_choices;
create policy "Allow service_role full access to menu_option_choices" on menu_option_choices for all using (true);

-- orders policies
drop policy if exists "Allow public read access to orders" on orders;
create policy "Allow public read access to orders" on orders for select using (true);

drop policy if exists "Allow public insert access to orders" on orders;
create policy "Allow public insert access to orders" on orders for insert with check (true);

drop policy if exists "Allow service_role full access to orders" on orders;
create policy "Allow service_role full access to orders" on orders for all using (true);

-- order_items policies
drop policy if exists "Allow public read access to order_items" on order_items;
create policy "Allow public read access to order_items" on order_items for select using (true);

drop policy if exists "Allow public insert access to order_items" on order_items;
create policy "Allow public insert access to order_items" on order_items for insert with check (true);

drop policy if exists "Allow service_role full access to order_items" on order_items;
create policy "Allow service_role full access to order_items" on order_items for all using (true);

-- print_jobs policies
drop policy if exists "Allow service_role full access to print_jobs" on print_jobs;
create policy "Allow service_role full access to print_jobs" on print_jobs for all using (true);

-- 5. TRIGGER FOR TABLE STATUS SYNCHRONIZATION
create or replace function handle_table_status_on_session_change()
returns trigger as $$
begin
  if (TG_OP = 'INSERT' and NEW.status = 'active') then
    update tables set status = 'occupied' where id = NEW.table_id;
  elsif (TG_OP = 'UPDATE' and NEW.status = 'completed' and OLD.status = 'active') then
    update tables set status = 'vacant' where id = NEW.table_id;
  end if;
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists trigger_update_table_status on sessions;
create trigger trigger_update_table_status
after insert or update on sessions
for each row execute function handle_table_status_on_session_change();

-- 6. SEED DATA

-- Insert default staff (only if pin doesn't exist)
insert into staff (pin, role, name) values
('111111', 'cashier', 'แคชเชียร์'),
('999999', 'admin', 'ผู้ดูแลระบบ')
on conflict (pin) do nothing;

-- Insert default packages (only if id doesn't exist)
insert into packages (id, name, price, description) values
('standard', 'Standard Buffet', 308.00, 'หมูสด ผักสด ซุปใสต้มยำ'),
('premium', 'Premium Buffet', 398.00, 'Standard + เนื้อวากิว ซีฟู้ด ซุปทรัฟเฟิล')
on conflict (id) do nothing;

-- Insert tables 1 to 28 (only if table_number doesn't exist)
insert into tables (table_number)
select generate_series(1, 28)
on conflict (table_number) do nothing;

-- 7. STORAGE BUCKETS FOR MENU IMAGES
insert into storage.buckets (id, name, public)
values ('menu', 'menu', true)
on conflict (id) do nothing;

-- Storage policies for public reading and admin uploads
drop policy if exists "Allow public read access to menu images" on storage.objects;
create policy "Allow public read access to menu images"
  on storage.objects for select
  using (bucket_id = 'menu');

drop policy if exists "Allow service_role full access to menu images" on storage.objects;
create policy "Allow service_role full access to menu images"
  on storage.objects for all
  using (bucket_id = 'menu');
