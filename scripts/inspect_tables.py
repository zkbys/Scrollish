import os
import json
from dotenv import load_dotenv
from supabase import create_client

# 加载环境变量
load_dotenv()

# 尝试从环境变量获取，如果没有则使用您 inspect_database.js 中的公开配置作为兜底
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://zgteuwwhiwfglrvjcekq.supabase.co")
# 注意：写入操作通常需要 SERVICE_ROLE_KEY，但读取检查通常 ANON_KEY 即可（取决于 RLS）
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "sb_publishable_ths2W9m7xVW9GB-t-MxYhg_Nm0kTJmA")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def inspect_table(table_name):
    print(f"\n{'='*60}")
    print(f"📁 表名: {table_name}")
    print(f"{'-'*60}")
    
    try:
        # 1. 获取总数和一条样本数据
        response = supabase.table(table_name).select("*", count="exact").limit(1).execute()
        
        # 检查是否出错
        if hasattr(response, 'error') and response.error:
            print(f"❌ 读取错误: {response.error}")
            return

        count = response.count
        data = response.data

        print(f"✅ 总记录数: {count}")

        if data and len(data) > 0:
            sample = data[0]
            keys = list(sample.keys())
            
            # 2. 打印字段列表
            print(f"\n🔑 字段列表 ({len(keys)}个):")
            print(f"   {', '.join(keys)}")
            
            # 3. 打印样本详情 (格式化 JSON)
            print("\n📄 样本数据 (第一条):")
            print(json.dumps(sample, indent=2, ensure_ascii=False))
            
            # 特别检查：如果是 enrichment 表，检查关键 JSON 字段是否存在
            if table_name == "comments_enrichment":
                print("\n🧐 深度检查 JSON 结构:")
                variants = sample.get('difficulty_variants', {})
                if variants:
                    print(f"   -> difficulty_variants 包含等级: {list(variants.keys())}")
                else:
                    print("   -> ⚠️ difficulty_variants 为空")
        else:
            print("⚠️ 表是空的，无法获取字段结构。")

    except Exception as e:
        print(f"❌ 发生异常: {str(e)}")

def main():
    print("🔍 开始数据库字段检查...")
    
    # 检查主表
    inspect_table("comments")
    
    # 检查所有被警告的表
    tables_to_check = [
        "achievements",
        "comments_enrichment",
        "level_config",
        "posts_enrichment",
        "subtree_vibes"
    ]
    
    for table in tables_to_check:
        inspect_table(table)

if __name__ == "__main__":
    main()