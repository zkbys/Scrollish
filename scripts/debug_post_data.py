import os
import json
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

def check_processed():
    res = supabase.table("production_posts").select("id, sentence_segments").not_.is_("sentence_segments", "null").limit(1).execute()
    if res.data:
        print(json.dumps(res.data[0], indent=2, ensure_ascii=False))
    else:
        print("No processed posts found with sentence_segments.")

if __name__ == "__main__":
    check_processed()
