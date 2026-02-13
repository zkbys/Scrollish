import os
import json
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def inspect_table(table_name):
    print(f"\n{'='*60}")
    print(f"📁 表名: {table_name}")
    print(f"{'-'*60}")
    
    try:
        response = supabase.table(table_name).select("*", count="exact").limit(1).execute()
        count = response.count
        data = response.data

        print(f"✅ 总记录数: {count}")

        if data and len(data) > 0:
            sample = data[0]
            keys = list(sample.keys())
            print(f"\n🔑 字段列表 ({len(keys)}个):")
            print(f"   {', '.join(keys)}")
            print("\n📄 样本数据 (第一条):")
            print(json.dumps(sample, indent=2, ensure_ascii=False))
        else:
            print("⚠️ 表是空的")

    except Exception as e:
        print(f"❌ 发生异常: {str(e)}")

if __name__ == "__main__":
    inspect_table("production_posts")
