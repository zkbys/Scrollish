-- ============================================
-- Fast Migration: Batch update using SQL
-- ============================================
-- 在 Supabase Dashboard SQL Editor 中执行此脚本
-- 可以在几秒内完成所有更新

-- 1. 更新所有在 comments_enrichment 表中有记录的评论为 'completed'
UPDATE comments
SET enrichment_status = 'completed'
WHERE id IN (
    SELECT comment_id 
    FROM comments_enrichment
);

-- 2. 查看更新结果
SELECT 
    enrichment_status,
    COUNT(*) as count
FROM comments
GROUP BY enrichment_status
ORDER BY enrichment_status;

-- 预期结果:
-- completed: ~1461 (实际处理过的数量)
-- pending:   ~6347 (未处理的数量)
