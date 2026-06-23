-- Menu option groups/choices for existing Supabase projects.
-- Run this once in the SQL editor if your database was created before this feature.

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

create table if not exists menu_option_choices (
  id bigint generated always as identity primary key,
  option_group_id bigint not null references menu_option_groups(id) on delete cascade,
  name text not null,
  price_delta numeric(10, 2) not null default 0.00 check (price_delta >= 0),
  sort_order integer not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table order_items
  add column if not exists selected_options jsonb not null default '[]'::jsonb;

create index if not exists idx_menu_option_groups_menu_item_id on menu_option_groups(menu_item_id);
create index if not exists idx_menu_option_choices_group_id on menu_option_choices(option_group_id);

alter table menu_option_groups enable row level security;
alter table menu_option_choices enable row level security;

drop policy if exists "Allow public read access to menu_option_groups" on menu_option_groups;
create policy "Allow public read access to menu_option_groups" on menu_option_groups for select using (true);

drop policy if exists "Allow service_role full access to menu_option_groups" on menu_option_groups;
create policy "Allow service_role full access to menu_option_groups" on menu_option_groups for all using (true);

drop policy if exists "Allow public read access to menu_option_choices" on menu_option_choices;
create policy "Allow public read access to menu_option_choices" on menu_option_choices for select using (true);

drop policy if exists "Allow service_role full access to menu_option_choices" on menu_option_choices;
create policy "Allow service_role full access to menu_option_choices" on menu_option_choices for all using (true);
