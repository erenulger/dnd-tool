-- Add title and background_color columns to personal_notes table
ALTER TABLE personal_notes ADD COLUMN IF NOT EXISTS title VARCHAR(200);
ALTER TABLE personal_notes ADD COLUMN IF NOT EXISTS background_color VARCHAR(20) DEFAULT 'default';

-- Add title and background_color columns to shared_notes table
ALTER TABLE shared_notes ADD COLUMN IF NOT EXISTS title VARCHAR(200);
ALTER TABLE shared_notes ADD COLUMN IF NOT EXISTS background_color VARCHAR(20) DEFAULT 'default';

