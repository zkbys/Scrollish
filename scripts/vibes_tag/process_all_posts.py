import asyncio
import json
import os
from typing import List, Dict
from dotenv import load_dotenv
from supabase import create_client, Client
from openai import AsyncOpenAI
from httpx import ConnectError

# 1. 配置加载
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SILICON_KEY = os.getenv("VITE_SILICONFLOW_API_KEY")
# 确保使用 Pro 模型路径，这是你之前截图要求的
MODEL_NAME = "Pro/deepseek-ai/DeepSeek-V3" 

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
client = AsyncOpenAI(api_key=SILICON_KEY, base_url="https://api.siliconflow.cn/v1")

async def analyze_subtree(post: Dict, root_comment: Dict, child_comments: List[Dict]) -> Dict:
    """调用 AI 分析子树的氛围和梗点"""
    context = f"[Context - Original Post]\nTitle: {post.get('title_en', '')}\n\n"
    context += f"[Sub-topic Starter (ID: {root_comment['id']})]\nUser: {root_comment['content']}\n\n"
    context += "[Replies to this starter]\n"
    for child in child_comments:
        context += f"-(ID: {child['id']}) User: {child['content']}\n"

    system_prompt = """
    你是一个精通 Reddit 文化的社区氛围打标员 Dopa。
    请阅读下方提供的原帖和一条评论串（子话题源头 + 大家的回复）。
    
    你的任务是极速判断这个讨论串的“调性”，并提取核心氛围。不要做长篇大论的文化解析。

    请严格返回如下 JSON 格式：
    {
        "vibe_tag": "氛围标签（10字内，带emoji。例如：🤡 牙医梗吐槽，或 ❤️ 温暖分享）",
        "dopa_summary": "用一句大白话总结大家在聊什么（30字内）。例如：网友们在分享主动组织朋友聚会的重要性。",
        "punchline_comment_ids": ["如果有明显抛梗、神转折的评论，把它们的ID放这里，最多2个。普通聊天返回 []"]
    }
    """
    
    try:
        response = await client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": context}
            ],
            response_format={"type": "json_object"},
            temperature=0.2
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        print(f"      ❌ API Error: {e}")
        return None

async def process_all_posts_incrementally():
    print("🚀 开始全局增量处理帖子...")

    # 1. 分页获取所有帖子 (解决 100 条限制问题)
    all_posts = []
    page_size = 100
    offset = 0
    while True:
        res = supabase.table("production_posts").select("id, title_en").range(offset, offset + page_size - 1).execute()
        if not res.data: break
        all_posts.extend(res.data)
        if len(res.data) < page_size: break
        offset += page_size
    
    print(f"📦 数据库中共有 {len(all_posts)} 个帖子待检查。")

    # 2. 获取全局已处理的 ID 缓存 (减少数据库查询压力)
    processed_res = supabase.table("subtree_vibes").select("root_comment_id").execute()
    global_processed_ids = {item['root_comment_id'] for item in processed_res.data}
    print(f"📊 已有缓存数据: {len(global_processed_ids)} 条")

    for post_idx, post in enumerate(all_posts):
        post_id = post['id']
        print(f"\n==================================================")
        print(f"🔍 [{post_idx+1}/{len(all_posts)}] 正在检查帖子: {post.get('title_en', '')[:40]}...")

        # 3. 获取评论 (注意：这里使用你确认后的表名 'comments')
        try:
            comments_res = supabase.table("comments").select("id, content, parent_id, upvotes").eq("post_id", post_id).execute()
            all_comments = comments_res.data
        except Exception as e:
            print(f"   ❌ 获取评论失败: {e}")
            continue

        if not all_comments:
            print("   ⚠️ 该帖子没有评论，跳过。")
            continue

        # 4. 识别“新增”子话题节点
        starters = []
        # 构建简单评论树
        children_map = {}
        for c in all_comments:
            pid = c['parent_id']
            if pid not in children_map: children_map[pid] = []
            children_map[pid].append(c)

        for c in all_comments:
            cid = c['id']
            if cid in global_processed_ids: continue # 增量跳过
                
            direct_replies = children_map.get(cid, [])
            is_root = c['parent_id'] is None

            # 判定标准：一级评论且有回复，或二级以上评论有 2+ 回复
            if (is_root and len(direct_replies) >= 1) or (len(direct_replies) >= 2):
                direct_replies.sort(key=lambda x: x['upvotes'] or 0, reverse=True)
                starters.append({
                    'comment': c,
                    'replies': direct_replies[:5] 
                })

        if not starters:
            print(f"   ✅ 无新增子话题。")
            continue

        starters.sort(key=lambda x: x['comment'].get('upvotes') or 0, reverse=True)
        starters = starters[:15] # 每个帖子最多 15 个
        
        print(f"   🎯 发现 {len(starters)} 个【新增】子话题节点，开始召唤 Dopa...")

        # 5. 批量处理并提交
        batch_payload = []
        for idx, item in enumerate(starters):
            root = item['comment']
            children = item['replies']
            
            print(f"      [{idx+1}/{len(starters)}] 分析节点 ID: {root['id'][:8]}...")
            result = await analyze_subtree(post, root, children)
            
            if result:
                batch_payload.append({
                    "post_id": post_id,
                    "root_comment_id": root['id'],
                    "vibe_tag": result.get('vibe_tag'),
                    "dopa_summary": result.get('dopa_summary'),
                    "punchline_comment_ids": result.get('punchline_comment_ids', [])
                })
                print(f"      💾 准备入库! 标签: {result.get('vibe_tag')}")
            
            # 保护 API，避免过快
            await asyncio.sleep(0.5)

        # 6. 执行批量 Upsert (带重试逻辑，解决 10054 问题)
        if batch_payload:
            max_db_retries = 3
            for retry in range(max_db_retries):
                try:
                    supabase.table("subtree_vibes").upsert(batch_payload, on_conflict="root_comment_id").execute()
                    # 写入成功后，更新本地缓存防止重复
                    for p in batch_payload: global_processed_ids.add(p['root_comment_id'])
                    break 
                except (ConnectError, Exception) as e:
                    if retry < max_db_retries - 1:
                        print(f"      ⚠️ 数据库连接波动，{retry+1}秒后重试...")
                        await asyncio.sleep(retry + 1)
                    else:
                        print(f"      ❌ 批量入库失败: {e}")

    print("\n🎉 所有任务处理完毕！")

if __name__ == "__main__":
    asyncio.run(process_all_posts_incrementally())