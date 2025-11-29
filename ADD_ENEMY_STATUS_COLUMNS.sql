-- Add enemy status columns to pawns table
ALTER TABLE pawns ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT NULL;
ALTER TABLE pawns ADD COLUMN IF NOT EXISTS status_set_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE pawns ADD COLUMN IF NOT EXISTS status_set_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add index for status queries
CREATE INDEX IF NOT EXISTS idx_pawns_status ON pawns(session_id, status) WHERE status IS NOT NULL;

