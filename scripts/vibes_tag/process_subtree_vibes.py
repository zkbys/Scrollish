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
    """调用 DeepSeek 分析子树的氛围和梗点 (极简版)"""
    
    context = f"[Context - Original Post]\nTitle: {post['title_en']}\n\n"
    context += f"[Sub-topic Starter (ID: {root_comment['id']})]\nUser: {root_comment['content']}\n\n"
    context += "[Replies to this starter]\n"
    for child in child_comments:
        context += f"-(ID: {child['id']}) User: {child['content']}\n"

    # 使用你之前定的“轻量化众包” Prompt，不写长篇大论，只打标和找梗
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
        # strict=False 完美防止换行符报错
        return json.loads(clean_content, strict=False)
    except Exception as e:
        print(f"❌ API Error: {e}")
        return None

async def run_full_post(target_title="Strengthen friendships with one simple Question"):
    print(f"🚀 开始全帖处理: {target_title}")
    
    # 1. 获取帖子信息
    post = supabase.table("production_posts").select("id, title_en").ilike("title_en", f"%{target_title}%").execute().data[0]
    post_id = post['id']
    
    # 2. 一次性拉取该帖子的所有评论！
    print("📦 正在拉取所有评论...")
    all_comments = supabase.table("comments").select("id, content, parent_id, upvotes").eq("post_id", post_id).execute().data
    print(f"✅ 共获取到 {len(all_comments)} 条评论。")

    # 3. 构建本地评论树 (找出谁回复了谁)
    children_map = {}
    for c in all_comments:
        pid = c['parent_id']
        if pid not in children_map:
            children_map[pid] = []
        children_map[pid].append(c)

    # 4. 核心算法：识别“子话题开启者 (Sub-topic Starters)”
    starters = []
    for c in all_comments:
        cid = c['id']
        direct_replies = children_map.get(cid, [])
        is_root = c['parent_id'] is None

        # 规则：一级评论且有回复，或者任何级别的评论拥有 >= 2 条直接回复
        if (is_root and len(direct_replies) >= 1) or (len(direct_replies) >= 2):
            # 按点赞数给回复排序，取前 5 条最有代表性的回复给 AI 看
            direct_replies.sort(key=lambda x: x['upvotes'] or 0, reverse=True)
            starters.append({
                'comment': c,
                'replies': direct_replies[:5] 
            })

    # 按点赞数给这些源头节点排个序
    starters.sort(key=lambda x: x['comment']['upvotes'] or 0, reverse=True)
    
    # 为了防止某些神贴评论太多导致 API 费用过高，我们设个上限（比如只处理前 15 个最火的子话题）
    MAX_SUBTREES = 15
    starters = starters[:MAX_SUBTREES]
    
    print(f"🎯 算法检测到 {len(starters)} 个开启子话题的节点，开始召唤 Dopa 打标...")

    # 5. 循环交给 AI 处理并入库
    for idx, item in enumerate(starters):
        root = item['comment']
        children = item['replies']
        
        print(f"\n[{idx+1}/{len(starters)}] 🌳 分析子话题节点 ID: {root['id'][:8]} (引出了 {len(children)} 条跟帖)...")
        
        result = await analyze_subtree(post, root, children)
        
        if result:
            print(f"   ✨ Vibe Tag: {result.get('vibe_tag')}")
            print(f"   🎯 Punchlines: {[i[:8] for i in result.get('punchline_comment_ids', [])]}")
            
            payload = {
                "post_id": post_id,
                "root_comment_id": root['id'],
                "vibe_tag": result.get('vibe_tag'),
                "dopa_summary": result.get('dopa_summary'),
                "punchline_comment_ids": result.get('punchline_comment_ids', [])
            }
            # upsert 保证即使重复跑也不会插入多条相同的记录
            supabase.table("subtree_vibes").upsert(payload, on_conflict="root_comment_id").execute()
            print("   💾 数据入库成功！")

if __name__ == "__main__":
    asyncio.run(run_full_post())