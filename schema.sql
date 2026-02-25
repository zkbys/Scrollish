    -- ==========================================
    -- Scrollish Consolidated Schema (v3.0)
    -- ==========================================

    -- 0. Cleanup (Optional, use with caution)
    -- DROP TABLE IF EXISTS user_vocabulary CASCADE;
    -- DROP TABLE IF EXISTS user_learning_logs CASCADE;
    -- DROP TABLE IF EXISTS profiles CASCADE;
    -- DROP TABLE IF EXISTS comments CASCADE;
    -- DROP TABLE IF EXISTS production_posts CASCADE;
    -- DROP TABLE IF EXISTS staging_posts CASCADE;
    -- DROP TABLE IF EXISTS communities CASCADE;
    -- DROP TABLE IF EXISTS categories CASCADE;

    -- ==========================================
    -- 1. Content Management Layer
    -- ==========================================

    -- Categories
    CREATE TABLE IF NOT EXISTS categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name_en TEXT UNIQUE NOT NULL, 
        name_cn TEXT NOT NULL,        
        created_at TIMESTAMPTZ DEFAULT now()
    );

    -- Communities
    CREATE TABLE IF NOT EXISTS communities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
        name TEXT UNIQUE NOT NULL,    
        display_name TEXT,            
        sub_category TEXT,
        subscriber_count INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT now()
    );

    -- Staging Pool
    CREATE TABLE IF NOT EXISTS staging_posts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        community_id UUID REFERENCES communities(id) ON DELETE SET NULL,
        reddit_id TEXT UNIQUE NOT NULL,
        subreddit TEXT NOT NULL, 
        title TEXT NOT NULL,
        selftext TEXT,
        raw_json JSONB,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'auto_approved')),
        video_url TEXT,
        image_type TEXT DEFAULT 'original',
        created_at TIMESTAMPTZ DEFAULT now()
    );

    -- Production Pool
    CREATE TABLE IF NOT EXISTS production_posts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        original_id UUID REFERENCES staging_posts(id) ON DELETE SET NULL,
        community_id UUID REFERENCES communities(id) ON DELETE SET NULL,
        title_en TEXT NOT NULL,
        title_cn TEXT NOT NULL,
        summary_en TEXT,
        summary_cn TEXT,
        content_en TEXT,
        content_cn TEXT,
        image_url TEXT,
        video_url TEXT,
        image_type TEXT DEFAULT 'original',
        subreddit TEXT NOT NULL, 
        author TEXT,
        reddit_url TEXT,
        upvotes INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now()
    );

    -- Tree-style Comments
    CREATE TABLE IF NOT EXISTS comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id UUID REFERENCES production_posts(id) ON DELETE CASCADE,
        parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
        reddit_comment_id TEXT UNIQUE,
        author TEXT,
        content TEXT NOT NULL,
        content_cn TEXT,
        depth INTEGER DEFAULT 0,
        upvotes INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now()
    );

    -- ==========================================
    -- 2. User & Gamification Layer
    -- ==========================================

    -- User Profiles (Linked to auth.users)
    CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
    username text UNIQUE,
    display_name text,
    avatar_url text,
    email text,
    
    -- Learning Preferences
    native_language text DEFAULT 'zh-CN',
    target_level text DEFAULT 'beginner',
    daily_goal_mins int DEFAULT 15,
    learning_reason text,
    
    -- Aggregated Stats
    total_xp bigint DEFAULT 0,
    words_count int DEFAULT 0,
    course_id uuid,
    study_days int DEFAULT 0,
    
    -- Streak & Gamification
    current_streak int DEFAULT 0,
    longest_streak int DEFAULT 0,
    last_streak_at timestamptz,
    coins int DEFAULT 0,
    is_premium boolean DEFAULT false,
    is_verified boolean DEFAULT false,
    
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    -- [New] Cloned Voice Customization
    cloned_voice_avatar_url text,
    cloned_voice_name text,
    cloned_voice_desc text,
    cloned_voice_url text, -- Storage link or voice ID
    cloned_voice_text text -- Enrollment text
    );

    -- Learning Logs (For Streak & Calendar)
    CREATE TABLE IF NOT EXISTS public.user_learning_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    activity_type text NOT NULL, -- 'read_post', 'save_word', 'quiz', 'checkin'
    duration_seconds int DEFAULT 0,
    xp_earned int DEFAULT 0,
    metadata jsonb,
    created_at timestamptz DEFAULT now()
    );

    -- User Vocabulary (Unified History & Starred)
    CREATE TABLE IF NOT EXISTS public.user_vocabulary (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    word text NOT NULL,
    translation text, 
    
    -- Dictionary Details
    ipa text,
    definition_cn text,
    definition_en text,
    roots text,
    
    -- [New] History & Status Tracking
    lookup_count int DEFAULT 1,
    is_saved boolean DEFAULT false,
    last_interacted_at timestamptz DEFAULT now(),
    contexts jsonb DEFAULT '[]'::jsonb, -- Array of {text, meaning, created_at}
    
    mastery_level int DEFAULT 0, 
    next_review_at timestamptz DEFAULT now(),
    last_reviewed_at timestamptz,
    tags text[],
    created_at timestamptz DEFAULT now(),
    
    UNIQUE(user_id, word)
    );

    -- ==========================================
    -- 3. Security & Automation
    -- ==========================================

    -- RLS
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.user_learning_logs ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.user_vocabulary ENABLE ROW LEVEL SECURITY;

    -- Polices
    CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
    CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
    CREATE POLICY "Users can manage own logs" ON public.user_learning_logs USING (auth.uid() = user_id);
    CREATE POLICY "Users can manage own vocabulary" ON public.user_vocabulary USING (auth.uid() = user_id);

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_communities_subs ON communities(subscriber_count DESC);
    CREATE INDEX IF NOT EXISTS idx_staging_status ON staging_posts(status);
    CREATE INDEX IF NOT EXISTS idx_production_subreddit ON production_posts(subreddit);
    CREATE INDEX IF NOT EXISTS idx_comments_tree ON comments(post_id, parent_id);
    CREATE INDEX IF NOT EXISTS idx_vocab_next_review ON user_vocabulary(next_review_at);

    -- Trigger for Auto Profile Creation
    CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS trigger AS $$
    BEGIN
    INSERT INTO public.profiles (id, username, email, display_name)
    VALUES (new.id, new.raw_user_meta_data->>'username', new.email, new.email);
    RETURN new;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
