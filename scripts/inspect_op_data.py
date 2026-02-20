
import os
import json
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def inspect_posts():
    print(f"\n{'='*60}")
    print(f"🕵️‍♂️ Inspecting production_posts")
    print(f"{'-'*60}")
    
    # Fetch posts where sentence_segments might be problematic
    # We'll just fetch a few recent ones
    response = supabase.table("production_posts") \
        .select("id, title_en, content_en, content_cn, sentence_segments, cultural_notes, difficulty_variants") \
        .limit(5) \
        .execute()
        
    posts = response.data
    
    for post in posts:
        print(f"\n🆔 ID: {post['id']}")
        print(f"📝 Title: {post['title_en'][:50]}...")
        
        # Check sentence_segments
        segs = post.get('sentence_segments')
        print(f"🧩 Sentence Segments: {type(segs)} - {segs if not segs else f'Length: {len(segs)}'}")
        if not segs:
             print("   ⚠️  EMPTY/NULL")
        
        # Check content_cn
        cn = post.get('content_cn')
        print(f"🇨🇳 Content CN: {type(cn)} - {cn[:50] + '...' if cn else 'NULL'}")

        # Check raw values for [] vs null
        # Note: The python client might convert json [] to python list [], and null to None.
        # So 'None' means database NULL, '[]' means database empty JSON array.
        
        print("-" * 20)

if __name__ == "__main__":
    inspect_posts()
