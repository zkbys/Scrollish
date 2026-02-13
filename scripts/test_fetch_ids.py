import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
supabase = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_KEY'))

# 测试获取已处理的 ID
all_processed_ids = []
offset = 0
page_size = 100

print("🔍 Fetching all processed comment IDs...")
while True:
    page_res = supabase.table("comments_enrichment") \
        .select("comment_id") \
        .range(offset, offset + page_size - 1) \
        .execute()
    
    page_data = page_res.data
    batch_size = len(page_data)
    all_processed_ids.extend([p['comment_id'] for p in page_data])
    
    if batch_size < page_size:
        break
    
    offset += page_size
    if offset % 500 == 0:
        print(f"  📥 Fetched {len(all_processed_ids)} processed IDs so far...")

processed_ids = set(all_processed_ids)
print(f"💡 Found {len(processed_ids)} already processed comments in total.")

# 测试：获取第一个帖子的评论
print("\n🧪 Testing comment filtering for first post...")
posts_response = supabase.table("production_posts").select("id, title_en").limit(1).execute()
if posts_response.data:
    post = posts_response.data[0]
    post_id = post["id"]
    post_title = post.get("title_en", "Untitled")[:30]
    
    print(f"📦 Post: {post_title}... ({post_id})")
    
    comments = supabase.table("comments").select("id, content").eq("post_id", post_id).execute().data
    to_process = [c for c in comments if c.get('content') and len(c['content']) > 5 and c['id'] not in processed_ids]
    
    print(f"  Total comments: {len(comments)}")
    print(f"  Already processed (will skip): {len(comments) - len(to_process)}")
    print(f"  New to process: {len(to_process)}")
    
    if len(to_process) == 0:
        print("  ✅ All comments already processed! Skip mechanism working correctly.")
    else:
        print(f"  🔄 Would process {len(to_process)} new comments")
