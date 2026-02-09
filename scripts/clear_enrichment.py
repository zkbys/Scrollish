import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def clear_enrichment_table():
    print("⚠️  Warning: This will delete all data in 'comments_enrichment' table.")
    confirm = input("Type 'yes' to confirm: ")
    
    if confirm.lower() == 'yes':
        try:
            # 在 Supabase 中，不带 filter 的 delete 会清空表（需确保 RLS 允许或使用 service_role）
            # 注意：某些配置下可能需要加一个永远成立的 filter，如 .neq("id", "00000000-0000-0000-0000-000000000000")
            response = supabase.table("comments_enrichment").delete().neq("comment_id", "00000000-0000-0000-0000-000000000000").execute()
            print(f"✅ Success! Cleared records.")
        except Exception as e:
            print(f"❌ Failed: {e}")
    else:
        print("Operation cancelled.")

if __name__ == "__main__":
    clear_enrichment_table()
