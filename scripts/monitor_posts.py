#!/usr/bin/env python3
"""实时监控 production_posts 处理进度"""
import os
from dotenv import load_dotenv
from supabase import create_client
import time

load_dotenv()
supabase = create_client(
    os.getenv('SUPABASE_URL'), 
    os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_KEY')
)

def get_status_counts():
    """获取各状态的数量"""
    statuses = ['pending', 'processing', 'completed', 'failed']
    counts = {}
    
    for status in statuses:
        res = supabase.table('production_posts') \
            .select('id', count='exact') \
            .eq('enrichment_status', status) \
            .execute()
        counts[status] = res.count or 0
    
    return counts

def main():
    print("📊 Production Posts 处理进度监控")
    print("=" * 60)
    
    while True:
        counts = get_status_counts()
        total = sum(counts.values())
        completed_pct = (counts['completed'] / total * 100) if total > 0 else 0
        
        print(f"\r⏳ Pending: {counts['pending']:3d} | "
              f"🔄 Processing: {counts['processing']:3d} | "
              f"✅ Completed: {counts['completed']:3d} ({completed_pct:.1f}%) | "
              f"❌ Failed: {counts['failed']:3d}", end="")
        
        # 如果所有任务都完成了
        if counts['pending'] == 0 and counts['processing'] == 0:
            print("\n\n🎉 所有帖子处理完成！")
            break
        
        time.sleep(3)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⏹️  监控已停止")
