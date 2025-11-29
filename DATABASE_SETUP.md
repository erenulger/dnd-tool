# Database Setup Guide for DND Helper Tool

This guide will walk you through setting up your Supabase database step-by-step. **Follow these instructions carefully.**

## Step 1: Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up or log in to your account
3. Click "New Project"
4. Fill in:
   - **Project Name**: `dnd-tool` (or any name you prefer)
   - **Database Password**: Create a strong password (save this somewhere safe!)
   - **Region**: Choose the region closest to you
5. Click "Create new project"
6. Wait for the project to be created (this takes 1-2 minutes)

## Step 2: Get Your Supabase Credentials

1. In your Supabase project dashboard, click on the **Settings** icon (gear icon) in the left sidebar
2. Click on **API** in the settings menu
3. You'll see several important values:
   - **Project URL** (this is your `SUPABASE_URL`)
   - **anon/public key** (this is your `SUPABASE_ANON_KEY`)
   - **service_role key** (this is your `SUPABASE_SERVICE_ROLE_KEY`) - **Keep this secret!**

Copy these values - you'll need them in the next steps.

## Step 3: Create Database Tables

1. In your Supabase dashboard, click on the **SQL Editor** icon in the left sidebar
2. Click "New query"
3. Copy and paste the entire SQL script below into the editor
4. Click "Run" (or press Ctrl/Cmd + Enter)
5. You should see "Success. No rows returned" - this means the tables were created successfully!

### SQL Script to Run:

```sql
-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sessions table: Stores D&D sessions
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  dm_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_map_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Session members table: Tracks which users are in which sessions
CREATE TABLE IF NOT EXISTS session_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_dm BOOLEAN DEFAULT FALSE,
  nickname VARCHAR(100),
  character_class VARCHAR(50),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, user_id)
);

-- Invitations table: Stores session invitations
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email VARCHAR(255) NOT NULL,
  invited_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, declined
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(session_id, invited_email, status) -- Prevent duplicate pending invitations
);

-- Maps table: Stores uploaded maps
CREATE TABLE IF NOT EXISTS maps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pawns table: Stores character pawns on the map
CREATE TABLE IF NOT EXISTS pawns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) NOT NULL DEFAULT '#667eea',
  x_position DECIMAL(10, 2) NOT NULL DEFAULT 0,
  y_position DECIMAL(10, 2) NOT NULL DEFAULT 0,
  hp INTEGER,
  max_hp INTEGER,
  status VARCHAR(20) DEFAULT NULL, -- 'killed', 'fled', 'freed', or NULL (active)
  status_set_at TIMESTAMP WITH TIME ZONE,
  status_set_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key for current_map_id in sessions table
ALTER TABLE sessions 
ADD CONSTRAINT fk_current_map 
FOREIGN KEY (current_map_id) 
REFERENCES maps(id) ON DELETE SET NULL;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_session_members_session_id ON session_members(session_id);
CREATE INDEX IF NOT EXISTS idx_session_members_user_id ON session_members(user_id);
CREATE INDEX IF NOT EXISTS idx_maps_session_id ON maps(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_dm_user_id ON sessions(dm_user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE maps ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sessions
-- Users can see sessions they are members of
CREATE POLICY "Users can view sessions they are members of"
  ON sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM session_members
      WHERE session_members.session_id = sessions.id
      AND session_members.user_id = auth.uid()
    )
  );

-- Users can create sessions (they become DM automatically)
CREATE POLICY "Users can create sessions"
  ON sessions FOR INSERT
  WITH CHECK (auth.uid() = dm_user_id);

-- Only DM can update their session
CREATE POLICY "DM can update their session"
  ON sessions FOR UPDATE
  USING (auth.uid() = dm_user_id);

-- RLS Policies for session_members
-- Users can view members of sessions they belong to
CREATE POLICY "Users can view members of their sessions"
  ON session_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM session_members sm
      WHERE sm.session_id = session_members.session_id
      AND sm.user_id = auth.uid()
    )
  );

-- Users can join sessions
CREATE POLICY "Users can join sessions"
  ON session_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for maps
-- Session members can view maps in their sessions
CREATE POLICY "Session members can view maps"
  ON maps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM session_members
      WHERE session_members.session_id = maps.session_id
      AND session_members.user_id = auth.uid()
    )
  );

-- Only DM can upload maps
CREATE POLICY "DM can upload maps"
  ON maps FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM session_members
      WHERE session_members.session_id = maps.session_id
      AND session_members.user_id = auth.uid()
      AND session_members.is_dm = TRUE
    )
  );

-- Enable RLS for invitations
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for invitations
-- Users can view invitations sent to their email
CREATE POLICY "Users can view their invitations"
  ON invitations FOR SELECT
  USING (
    invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR invited_user_id = auth.uid()
  );

-- DM can create invitations for their sessions
CREATE POLICY "DM can create invitations"
  ON invitations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM session_members
      WHERE session_members.session_id = invitations.session_id
      AND session_members.user_id = auth.uid()
      AND session_members.is_dm = TRUE
    )
  );

-- Users can update their own invitations (to accept/decline)
CREATE POLICY "Users can update their invitations"
  ON invitations FOR UPDATE
  USING (
    invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR invited_user_id = auth.uid()
  );

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(invited_email);
CREATE INDEX IF NOT EXISTS idx_invitations_user_id ON invitations(invited_user_id);
CREATE INDEX IF NOT EXISTS idx_invitations_session_id ON invitations(session_id);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status);

-- Pawns table: Stores character pawns on the map
CREATE TABLE IF NOT EXISTS pawns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) NOT NULL DEFAULT '#667eea',
  x_position DECIMAL(10, 2) NOT NULL DEFAULT 0,
  y_position DECIMAL(10, 2) NOT NULL DEFAULT 0,
  hp INTEGER,
  max_hp INTEGER,
  status VARCHAR(20) DEFAULT NULL, -- 'killed', 'fled', 'freed', or NULL (active)
  status_set_at TIMESTAMP WITH TIME ZONE,
  status_set_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for pawns
ALTER TABLE pawns ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pawns
CREATE POLICY "Session members can view pawns"
  ON pawns FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM session_members
      WHERE session_members.session_id = pawns.session_id
      AND session_members.user_id = auth.uid()
    )
  );

CREATE POLICY "DM can create pawns"
  ON pawns FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM session_members
      WHERE session_members.session_id = pawns.session_id
      AND session_members.user_id = auth.uid()
      AND session_members.is_dm = TRUE
    )
  );

CREATE POLICY "Users can update pawns"
  ON pawns FOR UPDATE
  USING (
    owned_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM session_members
      WHERE session_members.session_id = pawns.session_id
      AND session_members.user_id = auth.uid()
      AND session_members.is_dm = TRUE
    )
  );

CREATE POLICY "DM can delete pawns"
  ON pawns FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM session_members
      WHERE session_members.session_id = pawns.session_id
      AND session_members.user_id = auth.uid()
      AND session_members.is_dm = TRUE
    )
  );

CREATE INDEX IF NOT EXISTS idx_pawns_session_id ON pawns(session_id);
CREATE INDEX IF NOT EXISTS idx_pawns_owned_by ON pawns(owned_by);

-- Quotes table: Stores memorable quotes for sessions
CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quote_text TEXT NOT NULL,
  author_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for quotes
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for quotes
CREATE POLICY "Session members can view quotes"
  ON quotes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM session_members
      WHERE session_members.session_id = quotes.session_id
      AND session_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Session members can create quotes"
  ON quotes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM session_members
      WHERE session_members.session_id = quotes.session_id
      AND session_members.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_quotes_session_id ON quotes(session_id);
CREATE INDEX IF NOT EXISTS idx_quotes_created_at ON quotes(created_at);
```

### Optional: Create Helper Function for User Emails

If you want better performance when fetching user emails, you can create a database function. This is optional - the application will work without it, but it may be slightly slower when loading session members.

1. In Supabase SQL Editor, run this additional SQL:

```sql
-- Function to get user email from auth.users
CREATE OR REPLACE FUNCTION get_user_email(user_uuid UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN (SELECT email FROM auth.users WHERE id = user_uuid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Note:** This function is optional. The application will use the Supabase REST API as a fallback if this function doesn't exist.

## Step 4: Verify Tables Were Created

1. In Supabase dashboard, click on **Table Editor** in the left sidebar
2. You should see three tables:
   - `sessions`
   - `session_members`
   - `maps`

If you see all three tables, congratulations! Your database is set up correctly.

## Step 5: Configure Your Application

### Backend Configuration

1. In the `backend` folder, create a file named `.env` (copy from `.env.example` if it exists)
2. Add your Supabase credentials:

```env
SUPABASE_URL=your_project_url_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
SUPABASE_ANON_KEY=your_anon_key_here

PORT=3000
NODE_ENV=development
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads
```

### Frontend Configuration

1. In the `frontend` folder, create a file named `.env` (copy from `.env.example` if it exists)
2. Add your Supabase credentials:

```env
VITE_SUPABASE_URL=your_project_url_here
VITE_SUPABASE_ANON_KEY=your_anon_key_here
VITE_API_URL=http://localhost:3000
```

**Important Notes:**
- Replace `your_project_url_here` with your actual Project URL
- Replace `your_service_role_key_here` with your actual service_role key
- Replace `your_anon_key_here` with your actual anon/public key
- **Never commit `.env` files to git!** They contain sensitive information.

## Troubleshooting

### "relation does not exist" error
- Make sure you ran the SQL script in Step 3
- Check that all tables appear in the Table Editor

### "permission denied" error
- Make sure RLS policies were created correctly
- Verify you're using the correct user credentials

### Authentication issues
- Double-check your Supabase URL and keys
- Make sure you copied the keys correctly (no extra spaces)

## Next Steps

Once your database is set up:
1. Install dependencies: `npm run install:all`
2. Start the backend: `npm run dev:backend`
3. Start the frontend: `npm run dev:frontend`
4. Open your browser to `http://localhost:5173`

## Database Schema Overview

### `sessions` Table
- Stores D&D session information
- Each session has one DM (dungeon master)
- Can have one current map displayed

### `session_members` Table
- Links users to sessions
- Tracks who is DM vs regular member
- Prevents duplicate memberships

### `maps` Table
- Stores uploaded map files
- Links maps to sessions
- Tracks upload metadata (filename, size, etc.)

All tables use UUIDs for primary keys and have proper foreign key relationships to ensure data integrity.

## Adding HP Columns to Existing Pawns Table

If you already have a `pawns` table and need to add HP functionality, run this SQL in your Supabase SQL editor:

```sql
-- Add HP columns to existing pawns table
ALTER TABLE pawns ADD COLUMN IF NOT EXISTS hp INTEGER;
ALTER TABLE pawns ADD COLUMN IF NOT EXISTS max_hp INTEGER;
```

This will add the `hp` and `max_hp` columns to your existing table without affecting existing data.

## Personal Notes Table

Create a table for personal notes that each player can maintain:

```sql
-- Personal notes table: Each player has their own notes per session
CREATE TABLE IF NOT EXISTS personal_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(200),
  note_text TEXT NOT NULL,
  background_color VARCHAR(20) DEFAULT 'default',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, user_id, id)
);

-- Enable RLS for personal_notes
ALTER TABLE personal_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for personal_notes
CREATE POLICY "Users can view their own personal notes"
  ON personal_notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own personal notes"
  ON personal_notes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM session_members
      WHERE session_members.session_id = personal_notes.session_id
      AND session_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own personal notes"
  ON personal_notes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own personal notes"
  ON personal_notes FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for personal_notes
CREATE INDEX IF NOT EXISTS idx_personal_notes_session_user ON personal_notes(session_id, user_id);
CREATE INDEX IF NOT EXISTS idx_personal_notes_created_at ON personal_notes(created_at);
```

## Shared Notes Table

Create a table for shared notes that all session members can access:

```sql
-- Shared notes table: All session members can view/edit
CREATE TABLE IF NOT EXISTS shared_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(200),
  note_text TEXT NOT NULL,
  background_color VARCHAR(20) DEFAULT 'default',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for shared_notes
ALTER TABLE shared_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for shared_notes
CREATE POLICY "Session members can view shared notes"
  ON shared_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM session_members
      WHERE session_members.session_id = shared_notes.session_id
      AND session_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Session members can create shared notes"
  ON shared_notes FOR INSERT
  WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM session_members
      WHERE session_members.session_id = shared_notes.session_id
      AND session_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Session members can update shared notes"
  ON shared_notes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM session_members
      WHERE session_members.session_id = shared_notes.session_id
      AND session_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM session_members
      WHERE session_members.session_id = shared_notes.session_id
      AND session_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Session members can delete shared notes"
  ON shared_notes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM session_members
      WHERE session_members.session_id = shared_notes.session_id
      AND session_members.user_id = auth.uid()
    )
  );

-- Indexes for shared_notes
CREATE INDEX IF NOT EXISTS idx_shared_notes_session ON shared_notes(session_id);
CREATE INDEX IF NOT EXISTS idx_shared_notes_created_at ON shared_notes(created_at);
```

