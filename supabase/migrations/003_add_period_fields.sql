-- Add month, quarter, and year fields to transactions table
-- These fields are required to always track the period for each transaction

ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS month INTEGER CHECK (month >= 1 AND month <= 12),
ADD COLUMN IF NOT EXISTS quarter INTEGER CHECK (quarter >= 1 AND quarter <= 4),
ADD COLUMN IF NOT EXISTS year INTEGER;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_transactions_year_month ON transactions(year, month);
CREATE INDEX IF NOT EXISTS idx_transactions_year_quarter ON transactions(year, quarter);

-- Update existing transactions to populate these fields from date
-- Only update where date is not null
UPDATE transactions 
SET 
  year = EXTRACT(YEAR FROM date),
  month = EXTRACT(MONTH FROM date),
  quarter = CASE 
    WHEN EXTRACT(MONTH FROM date) IN (1, 2, 3) THEN 1
    WHEN EXTRACT(MONTH FROM date) IN (4, 5, 6) THEN 2
    WHEN EXTRACT(MONTH FROM date) IN (7, 8, 9) THEN 3
    WHEN EXTRACT(MONTH FROM date) IN (10, 11, 12) THEN 4
  END
WHERE date IS NOT NULL AND (year IS NULL OR month IS NULL OR quarter IS NULL);

-- Set default year for any remaining null years (use current year)
UPDATE transactions 
SET year = EXTRACT(YEAR FROM CURRENT_DATE)
WHERE year IS NULL;

-- Make year required (month and quarter can be null for flexibility)
ALTER TABLE transactions 
ALTER COLUMN year SET NOT NULL;

