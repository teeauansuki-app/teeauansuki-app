-- 1. Add package_ids array column to menu_items
ALTER TABLE menu_items ADD COLUMN package_ids text[];

-- 2. Migrate existing data from package_id to package_ids
UPDATE menu_items SET package_ids = ARRAY[package_id] WHERE package_id IS NOT NULL;

-- 3. Set default to empty array instead of NULL for easier querying
ALTER TABLE menu_items ALTER COLUMN package_ids SET DEFAULT '{}';

-- 4. Drop the old package_id column (and its foreign key constraint)
ALTER TABLE menu_items DROP COLUMN package_id;

-- 5. Update package prices to the new rates
UPDATE packages SET price = 308.00 WHERE id = 'standard';
UPDATE packages SET price = 398.00 WHERE id = 'premium';
