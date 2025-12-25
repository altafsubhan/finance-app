-- Make category_id nullable in transactions table
-- This allows transactions to be created without a category for items that are yet to be categorized
-- or for items that may be getting returned

ALTER TABLE transactions 
  ALTER COLUMN category_id DROP NOT NULL;

