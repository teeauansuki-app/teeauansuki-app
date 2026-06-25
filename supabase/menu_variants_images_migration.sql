-- Menu variants and multiple images for existing Supabase projects.
-- Run this once in Supabase SQL Editor before deploying the matching app code.

create table if not exists menu_item_variants (
  id bigint generated always as identity primary key,
  menu_item_id bigint not null references menu_items(id) on delete cascade,
  name text not null,
  min_quantity integer not null default 1 check (min_quantity >= 0),
  max_quantity integer not null default 1 check (max_quantity >= min_quantity),
  sort_order integer not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists menu_item_images (
  id bigint generated always as identity primary key,
  menu_item_id bigint not null references menu_items(id) on delete cascade,
  image_url text not null,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_menu_item_variants_menu_item_id on menu_item_variants(menu_item_id);
create index if not exists idx_menu_item_images_menu_item_id on menu_item_images(menu_item_id);

create unique index if not exists menu_item_images_one_primary_per_item
  on menu_item_images(menu_item_id)
  where is_primary;

alter table menu_item_variants enable row level security;
alter table menu_item_images enable row level security;

drop policy if exists "Allow public read access to menu_item_variants" on menu_item_variants;
create policy "Allow public read access to menu_item_variants" on menu_item_variants for select using (true);

drop policy if exists "Allow service_role full access to menu_item_variants" on menu_item_variants;
create policy "Allow service_role full access to menu_item_variants" on menu_item_variants for all using (true);

drop policy if exists "Allow public read access to menu_item_images" on menu_item_images;
create policy "Allow public read access to menu_item_images" on menu_item_images for select using (true);

drop policy if exists "Allow service_role full access to menu_item_images" on menu_item_images;
create policy "Allow service_role full access to menu_item_images" on menu_item_images for all using (true);
