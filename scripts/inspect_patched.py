import os
import json
from dotenv import load_dotenv
from supabase import create_client

# 加载环境变量
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# 你刚刚修复的那 3 个 ID (前 8 位)
target_prefixes = ["7376b71e", "22a40680", "31f01704"]

def main():
    print("🔍 Inspecting the 3 patched comments...\n")
    
    # 获取所有评论 ID 用于匹配 (因为 Supabase 不支持直接按 UUID 前缀批量查询，这里简单遍历匹配)
    # 如果数据量特别大，建议改用 SQL like 查询，但 1000 条可以直接拉下来匹配
    all_comments = supabase.table("comments").select("id, content, content_cn").execute().data
    
    found_count = 0
    for comment in all_comments:
        short_id = comment['id'][:8]
        if short_id in target_prefixes:
            found_count += 1
            print(f"🆔 ID: {comment['id']} (Prefix: {short_id})")
            print(f"📝 Content: {comment['content']}")
            print(f"🇨🇳 Translation: {comment['content_cn']}")
            
            # 查 enrichment
            enrichment = supabase.table("comments_enrichment").select("*").eq("comment_id", comment['id']).execute().data
            
            if enrichment:
                data = enrichment[0]
                print(f"✨ Enrichment Status: ✅ Found")
                print(f"📚 Mixed Version: {data.get('difficulty_variants', {}).get('Mixed', {}).get('content', 'N/A')}")
                
                # 看看有没有生成文化梗
                notes = data.get('cultural_notes', [])
                if notes:
                    print(f"💡 Cultural Notes: {[n['trigger_word'] for n in notes]}")
            else:
                print(f"✨ Enrichment Status: ❌ Missing")
            
            print("-" * 50)
            
    if found_count == 0:
        print("❌ Could not find comments with these prefixes. Are they in the 'comments' table?")

if __name__ == "__main__":
    main()