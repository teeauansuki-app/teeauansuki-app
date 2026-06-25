-- Add soft-delete support for table management.
-- Safe to run multiple times.

alter table tables
add column if not exists is_active boolean not null default true;

create index if not exists idx_tables_is_active on tables(is_active);

update tables
set is_active = true
where is_active is null;
