import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

# 找一个 pending 的帖子
res = supabase.table("production_posts").select("id").eq("enrichment_status", "pending").limit(1).execute()
if not res.data:
    print("No pending posts found")
    exit()

post_id = res.data[0]['id']
print(f"Attempting to update post {post_id}...")

update_res = supabase.table("production_posts").update({"enrichment_status": "completed"}).eq("id", post_id).execute()

print(f"Update response data: {update_res.data}")
if not update_res.data:
    print("FAILED: No rows were updated. This is likely an RLS permission issue with the current SUPABASE_KEY.")
else:
    print("SUCCESS: Row updated.")
