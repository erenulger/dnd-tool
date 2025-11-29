-- Migration: Add HP columns to pawns table
-- Run this SQL in your Supabase SQL editor if you already have a pawns table

ALTER TABLE pawns ADD COLUMN IF NOT EXISTS hp INTEGER;
ALTER TABLE pawns ADD COLUMN IF NOT EXISTS max_hp INTEGER;

-- Verify the columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'pawns' 
AND column_name IN ('hp', 'max_hp');

