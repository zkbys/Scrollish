-- Create the user_interactions table for tracking analytics

-- Optional: Create an ENUM type for interaction types (or just use text check constraints)
-- CREATE TYPE interaction_type AS ENUM ('view', 'dwell', 'complete', 'click_discussion', 'click_like', 'click_share');

CREATE TABLE IF NOT EXISTS user_interactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- The ID of the post being interacted with
  post_id TEXT NOT NULL,
  
  -- type: 'dwell', 'click_discussion', 'click_like', etc.
  interaction_type TEXT NOT NULL,
  
  -- JSONB column for flexible metadata (e.g. { "duration_ms": 5000, "is_complete": true })
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Optional: Link to auth.users if you have authentication
  user_id UUID REFERENCES auth.users(id)
);

-- Enable Row Level Security (RLS)
ALTER TABLE user_interactions ENABLE ROW LEVEL SECURITY;

-- [UPDATED Policy] Allow ALL users (including anonymous) to insert
-- Since your app allows browsing without login, we need to allow public inserts.
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON user_interactions;

CREATE POLICY "Enable insert for all users" ON user_interactions
    FOR INSERT 
    WITH CHECK (true);

-- Index for querying analytics by post
CREATE INDEX IF NOT EXISTS idx_interactions_post_id ON user_interactions(post_id);
