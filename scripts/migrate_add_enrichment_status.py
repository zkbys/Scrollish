"""
数据库迁移：为 comments 表添加 enrichment_status 字段
执行此脚本将：
1. 添加 enrichment_status 字段（默认值为 'pending'）
2. 根据 comments_enrichment 表更新已处理评论的状态为 'completed'
3. 创建索引以提升查询性能
"""

import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def main():
    print("🚀 Starting database migration...")
    print("="*60)
    
    # 步骤 1：添加 enrichment_status 字段
    print("\n📝 Step 1: Adding enrichment_status column to comments table...")
    try:
        # 使用 Supabase SQL Editor 或 RPC 执行 SQL
        # 由于 Python SDK 不直接支持 ALTER TABLE，我们需要使用 SQL 执行
        add_column_sql = """
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
            END IF;
        END $$;
        """
        
        # 注意：Supabase Python SDK 需要通过 RPC 执行原生 SQL
        # 你需要在 Supabase Dashboard 的 SQL Editor 中执行上述 SQL
        print("⚠️  Please execute the following SQL in Supabase Dashboard SQL Editor:")
        print("-" * 60)
        print(add_column_sql)
        print("-" * 60)
        
        input("\n按 Enter 键继续（执行完 SQL 后）...")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return
    
    # 步骤 2：获取所有已处理的 comment_id
    print("\n📥 Step 2: Fetching all processed comment IDs from comments_enrichment...")
    try:
        all_processed_ids = []
        offset = 0
        page_size = 100
        
        while True:
            page_res = supabase.table("comments_enrichment") \
                .select("comment_id") \
                .range(offset, offset + page_size - 1) \
                .execute()
            
            batch = [p['comment_id'] for p in page_res.data]
            all_processed_ids.extend(batch)
            
            if len(batch) < page_size:
                break
            
            offset += page_size
            if offset % 500 == 0:
                print(f"  Fetched {len(all_processed_ids)} IDs...")
        
        print(f"✅ Found {len(all_processed_ids)} processed comments")
        
    except Exception as e:
        print(f"❌ Failed to fetch processed IDs: {e}")
        return
    
    # 步骤 3：逐条更新已处理评论的状态（更可靠）
    print(f"\n🔄 Step 3: Updating status to 'completed' for {len(all_processed_ids)} comments...")
    print("   (This may take a few minutes...)")
    try:
        updated_count = 0
        failed_count = 0
        
        for idx, comment_id in enumerate(all_processed_ids):
            try:
                # 逐条更新（虽然慢但可靠）
                supabase.table("comments") \
                    .update({"enrichment_status": "completed"}) \
                    .eq("id", comment_id) \
                    .execute()
                
                updated_count += 1
                
                # 每 100 条显示一次进度
                if (idx + 1) % 100 == 0:
                    print(f"  Updated {updated_count}/{len(all_processed_ids)} comments...")
                    
            except Exception as e:
                failed_count += 1
                if failed_count <= 5:  # 只显示前 5 个错误
                    print(f"  ⚠️ Failed to update {comment_id[:8]}: {e}")
        
        print(f"✅ Successfully updated {updated_count} comments to 'completed'")
        if failed_count > 0:
            print(f"⚠️ Failed to update {failed_count} comments")
        
    except Exception as e:
        print(f"❌ Failed to update statuses: {e}")
        return
    
    # 步骤 4：创建索引
    print("\n🔍 Step 4: Creating index for better query performance...")
    create_index_sql = """
    DO $$ 
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE indexname = 'idx_comments_enrichment_status'
        ) THEN
            CREATE INDEX idx_comments_enrichment_status 
            ON comments(enrichment_status);
        END IF;
    END $$;
    """
    
    print("⚠️  Please execute the following SQL in Supabase Dashboard SQL Editor:")
    print("-" * 60)
    print(create_index_sql)
    print("-" * 60)
    
    input("\n按 Enter 键继续（执行完 SQL 后）...")
    
    # 步骤 5：验证迁移结果
    print("\n✅ Step 5: Verifying migration...")
    try:
        # 统计各状态的评论数
        pending_count = supabase.table("comments") \
            .select("id", count="exact") \
            .eq("enrichment_status", "pending") \
            .execute().count
        
        completed_count = supabase.table("comments") \
            .select("id", count="exact") \
            .eq("enrichment_status", "completed") \
            .execute().count
        
        print(f"  📊 Status summary:")
        print(f"     - Pending: {pending_count}")
        print(f"     - Completed: {completed_count}")
        
    except Exception as e:
        print(f"⚠️  Could not verify (column might not exist yet): {e}")
    
    print("\n" + "="*60)
    print("🎉 Migration completed successfully!")
    print("="*60)
    print("\n💡 Next steps:")
    print("   1. Run the updated process_comments_v4.py script")
    print("   2. Monitor the enrichment_status field for progress tracking")

if __name__ == "__main__":
    main()
