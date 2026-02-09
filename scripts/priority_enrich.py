import asyncio
import os
from dotenv import load_dotenv
from supabase import create_client, Client

# 加载环境变量
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") # 需要 service role 来调用 edge function

# 使用 service role client 以便有权限调用函数
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY)

async def trigger_enrichment(comment_id: str):
    try:
        # 模拟前端调用 Edge Function
        print(f"✨ Triggering enrichment for comment: {comment_id[:8]}...")
        result = supabase.functions.invoke("enrich-comment", {
            "body": {"comment_id": comment_id}
        })
        print(f"✅ Success: {comment_id[:8]}")
    except Exception as e:
        print(f"❌ Failed: {comment_id[:8]} - {str(e)}")

async def main():
    print("🚀 Starting Priority Enrichment Script (Hot Posts Only)...")
    
    # 1. 找到排名前 50 的热门帖子
    posts_res = supabase.table("production_posts") \
        .select("id, title_en, upvotes") \
        .order("upvotes", desc=True) \
        .limit(50) \
        .execute()
    
    hot_posts = posts_res.data
    print(f"🔥 Found {len(hot_posts)} hot posts.")

    # 2. 对每个帖子，找到点赞数最高的顶级评论
    all_tasks = []
    for post in hot_posts:
        comment_res = supabase.table("comments") \
            .select("id") \
            .eq("post_id", post["id"]) \
            .eq("depth", 0) \
            .order("upvotes", desc=True) \
            .limit(1) \
            .execute()
        
        if comment_res.data:
            comment_id = comment_res.data[0]["id"]
            
            # 检查是否已处理 (查询 enrichment 表)
            check_res = supabase.table("comments_enrichment") \
                .select("comment_id") \
                .eq("comment_id", comment_id) \
                .execute()
            
            if not check_res.data:
                all_tasks.append(trigger_enrichment(comment_id))

    if not all_tasks:
        print("Cool! All top comments of hot posts are already enriched.")
        return

    print(f"⚙️  Enriching {len(all_tasks)} priority comments...")
    # 限制并发
    semaphore = asyncio.Semaphore(5)
    async def sem_task(task):
        async with semaphore:
            await task

    await asyncio.gather(*(sem_task(t) for t in all_tasks))
    print("🎉 Priority enrichment complete.")

if __name__ == "__main__":
    asyncio.run(main())
