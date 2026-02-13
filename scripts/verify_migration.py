"""
快速验证脚本：测试 enrichment_status 字段是否存在，并提供迁移指南
"""

import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

print("="*70)
print("🔍 Checking if enrichment_status field exists...")
print("="*70)

try:
    # 尝试查询 enrichment_status 字段
    test_query = supabase.table("comments") \
        .select("id, enrichment_status") \
        .limit(1) \
        .execute()
    
    print("✅ enrichment_status field exists!")
    print(f"   Sample record: {test_query.data[0] if test_query.data else 'No data'}")
    
    # 统计各状态的数量
    print("\n📊 Current status distribution:")
    for status in ["pending", "processing", "completed", "failed"]:
        count = supabase.table("comments") \
            .select("id", count="exact") \
            .eq("enrichment_status", status) \
            .execute().count
        print(f"   {status.capitalize()}: {count}")
    
    print("\n✅ Ready to use process_comments_v4.py with status-based mode!")
    
except Exception as e:
    error_msg = str(e)
    
    if "column" in error_msg.lower() and "does not exist" in error_msg.lower():
        print("❌ enrichment_status field does NOT exist.")
        print("\n📋 Migration Steps:")
        print("-" * 70)
        print("1. Open Supabase Dashboard: " + SUPABASE_URL.replace("/rest/v1", ""))
        print("\n2. Go to 'SQL Editor'")
        print("\n3. Copy and execute the SQL from:")
        print("   scripts/migrations/add_enrichment_status.sql")
        print("\n4. Run the migration script:")
        print("   python scripts/migrate_add_enrichment_status.py")
        print("\n5. Re-run this verification script")
        print("-" * 70)
    else:
        print(f"❌ Unexpected error: {error_msg}")

print("="*70)
