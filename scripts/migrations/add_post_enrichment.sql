-- ========================================================
-- Migration: Add Enrichment Fields to production_posts
-- ========================================================

-- 1. 添加状态和各内容字段
DO $$ 
BEGIN
    -- enrichment_status
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'production_posts' AND column_name = 'enrichment_status') THEN
        ALTER TABLE production_posts ADD COLUMN enrichment_status TEXT DEFAULT 'pending';
        COMMENT ON COLUMN production_posts.enrichment_status IS '处理状态: pending, processing, completed, failed';
    END IF;

    -- native_polished
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'production_posts' AND column_name = 'native_polished') THEN
        ALTER TABLE production_posts ADD COLUMN native_polished TEXT;
    END IF;

    -- sentence_segments
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'production_posts' AND column_name = 'sentence_segments') THEN
        ALTER TABLE production_posts ADD COLUMN sentence_segments JSONB;
    END IF;

    -- difficulty_variants
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'production_posts' AND column_name = 'difficulty_variants') THEN
        ALTER TABLE production_posts ADD COLUMN difficulty_variants JSONB;
    END IF;

    -- cultural_notes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'production_posts' AND column_name = 'cultural_notes') THEN
        ALTER TABLE production_posts ADD COLUMN cultural_notes JSONB;
    END IF;
END $$;

-- 2. 创建索引以提升查询效率 (只针对 pending 状态)
DROP INDEX IF EXISTS idx_posts_enrichment_status;
CREATE INDEX idx_posts_enrichment_status ON production_posts(enrichment_status) 
WHERE enrichment_status = 'pending';

-- 3. 统计当前状态
SELECT enrichment_status, COUNT(*) 
FROM production_posts 
GROUP BY enrichment_status;
