
-- 1. categories 表
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_en TEXT NOT NULL,
    name_cn TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. communities 表
CREATE TABLE communities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sub_category TEXT,
    subscriber_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. production_posts 表
CREATE TABLE production_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID REFERENCES communities(id) ON DELETE SET NULL,
    title_en TEXT NOT NULL,
    title_cn TEXT,
    content_en TEXT,
    content_cn TEXT,
    image_url TEXT,
    video_url TEXT,
    image_type TEXT DEFAULT 'original', -- 'original' 或 'generated'
    upvotes INT DEFAULT 0,
    stars INT DEFAULT 0,
    subreddit TEXT,
    author_name TEXT,
    author_avatar TEXT,
    hashtags TEXT[], -- 数组类型存储标签
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. comments 表
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES production_posts(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    author TEXT NOT NULL,
    author_avatar TEXT,
    content TEXT NOT NULL,
    content_zh TEXT, -- 中文翻译
    upvotes INT DEFAULT 0,
    depth INT DEFAULT 0,
    is_ai BOOLEAN DEFAULT false,
    analysis JSONB, -- 存储 AI 分析数据: { keyword, type, explanation }
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 插入一些初始数据 (可选)
INSERT INTO categories (name_en, name_cn) VALUES 
('Science', '科学'),
('Life', '生活'),
('Social', '社交');
