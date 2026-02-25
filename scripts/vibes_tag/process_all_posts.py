import asyncio
import json
import os
from typing import List, Dict
from dotenv import load_dotenv
from supabase import create_client, Client
from openai import AsyncOpenAI

load_dotenv()
supabase: Client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
client = AsyncOpenAI(api_key=os.getenv("VITE_SILICONFLOW_API_KEY"), base_url=os.getenv("SILICONFLOW_BASE_URL", "https://api.siliconflow.cn/v1"))

async def analyze_subtree(post: Dict, root_comment: Dict, child_comments: List[Dict]) -> Dict:
    """调用 DeepSeek 分析子树的氛围和梗点"""
    context = f"[Context - Original Post]\nTitle: {post['title_en']}\n\n"
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
            model="deepseek-ai/DeepSeek-V3", 
            messages=[
                {"role": "system", "content": system_prompt}, 
                {"role": "user", "content": context}
            ],
            response_format={"type": "json_object"},
            temperature=0.2
        )
        clean_content = response.choices[0].message.content.replace("```json", "").replace("```", "").strip()
        return json.loads(clean_content, strict=False)
    except Exception as e:
        print(f"❌ API Error: {e}")
        return None

async def process_all_posts_incrementally():
    print("🚀 开始全局增量处理帖子...")
    
    # 1. 获取数据库中所有的帖子 (如果帖子非常多，以后可以加上按 created_at 倒序或分页)
    posts_response = supabase.table("production_posts").select("id, title_en").execute()
    all_posts = posts_response.data
    print(f"📦 数据库中共有 {len(all_posts)} 个帖子待检查。")
    
    for post_idx, post in enumerate(all_posts):
        post_id = post['id']
        print(f"\n==================================================")
        print(f"🔍 [{post_idx+1}/{len(all_posts)}] 正在检查帖子: {post['title_en'][:40]}...")
        
        # 2. 获取该帖子的所有评论
        all_comments = supabase.table("comments").select("id, content, parent_id, upvotes").eq("post_id", post_id).execute().data
        if not all_comments:
            print("   ⚠️ 该帖子没有评论，跳过。")
            continue
            
        # 3. 【增量核心】查询该帖子已经处理过的子话题节点
        existing_vibes = supabase.table("subtree_vibes").select("root_comment_id").eq("post_id", post_id).execute().data
        processed_root_ids = {v['root_comment_id'] for v in existing_vibes}
        
        # 4. 构建本地评论树
        children_map = {}
        for c in all_comments:
            pid = c['parent_id']
            if pid not in children_map:
                children_map[pid] = []
            children_map[pid].append(c)

        # 5. 识别开启子话题的节点
        starters = []
        for c in all_comments:
            cid = c['id']
            
            # 【增量拦截】如果这个节点已经打过标签了，直接无视，节约 API 费！
            if cid in processed_root_ids:
                continue
                
            direct_replies = children_map.get(cid, [])
            is_root = c['parent_id'] is None

            # 规则：一级评论且有回复，或者拥有 >= 2 条直接回复
            if (is_root and len(direct_replies) >= 1) or (len(direct_replies) >= 2):
                direct_replies.sort(key=lambda x: x['upvotes'] or 0, reverse=True)
                starters.append({
                    'comment': c,
                    'replies': direct_replies[:5] 
                })

        if not starters:
            print(f"   ✅ 该帖子没有需要【新增】处理的子话题 (已处理过 {len(processed_root_ids)} 个)。")
            continue

        starters.sort(key=lambda x: x['comment']['upvotes'] or 0, reverse=True)
        MAX_SUBTREES = 15 # 每个帖子最多处理 15 个神级子话题
        starters = starters[:MAX_SUBTREES]
        
        print(f"   🎯 发现 {len(starters)} 个【新增】子话题节点，开始召唤 Dopa...")

        # 6. 交给 AI 处理并入库
        for idx, item in enumerate(starters):
            root = item['comment']
            children = item['replies']
            
            print(f"      [{idx+1}/{len(starters)}] 分析节点 ID: {root['id'][:8]}...")
            result = await analyze_subtree(post, root, children)
            
            if result:
                payload = {
                    "post_id": post_id,
                    "root_comment_id": root['id'],
                    "vibe_tag": result.get('vibe_tag'),
                    "dopa_summary": result.get('dopa_summary'),
                    "punchline_comment_ids": result.get('punchline_comment_ids', [])
                }
                supabase.table("subtree_vibes").upsert(payload, on_conflict="root_comment_id").execute()
                print(f"      💾 入库成功! 标签: {result.get('vibe_tag')}")
            
            # 🚦 API 并发保护：每次调用 AI 后强制休眠 1 秒，防止被硅基流动拉黑
            await asyncio.sleep(1)

if __name__ == "__main__":
    asyncio.run(process_all_posts_incrementally())