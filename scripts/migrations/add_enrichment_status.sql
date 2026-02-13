-- ============================================
-- Migration: Add enrichment_status to comments
-- ============================================

-- 1. 添加 enrichment_status 字段
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'comments' AND column_name = 'enrichment_status'
    ) THEN
        ALTER TABLE comments 
        ADD COLUMN enrichment_status TEXT DEFAULT 'pending';
        
        -- 添加注释
        COMMENT ON COLUMN comments.enrichment_status IS 
        '评论增强处理状态: pending(待处理), processing(处理中), completed(已完成), failed(失败)';
        
        RAISE NOTICE '✅ Column enrichment_status added successfully';
    ELSE
        RAISE NOTICE '⚠️  Column enrichment_status already exists';
    END IF;
END $$;

-- 2. 创建索引以提升查询性能
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_comments_enrichment_status'
    ) THEN
        CREATE INDEX idx_comments_enrichment_status 
        ON comments(enrichment_status);
        
        RAISE NOTICE '✅ Index created successfully';
    ELSE
        RAISE NOTICE '⚠️  Index already exists';
    END IF;
END $$;

-- 3. 查看统计信息
SELECT 
    enrichment_status,
    COUNT(*) as count
FROM comments
GROUP BY enrichment_status
ORDER BY enrichment_status;
