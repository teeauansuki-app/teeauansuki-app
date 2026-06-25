-- Rename package display names for production.
-- Safe to run multiple times.

update packages
set name = 'Standard'
where id = 'standard';

update packages
set name = 'Premium'
where id = 'premium';
