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
    """调用 DeepSeek 分析整个子树的氛围和梗点"""
    
    # 1. 组装子树上下文 (非常关键)
    context = f"[Context - Original Post]\nTitle: {post['title_en']}\n\n"
    context += f"[Root Comment (ID: {root_comment['id']})]\nUser: {root_comment['content']}\n\n"
    context += "[Replies in this Thread]\n"
    for child in child_comments:
        context += f"-(ID: {child['id']}) User: {child['content']}\n"

    system_prompt = """
    你是一个精通 Reddit 文化的社区氛围打标员 Dopa。
    请阅读下方提供的原帖和一条评论串（Root Comment + Replies）。
    
    你的任务是极速判断这个讨论串的“调性”，并提取核心氛围。不要做长篇大论的文化解析。

    请严格返回如下 JSON 格式：
    {
        "vibe_tag": "氛围标签（10字内，带emoji。例如：🤡 牙医梗吐槽，或 ❤️ 温暖分享）",
        "dopa_summary": "用一句大白话总结大家在聊什么（30字内）。例如：网友们在分享主动组织朋友聚会的重要性。",
        "punchline_comment_ids": ["如果有明显抛梗、神转折、或金句的评论，把它们的 ID 放在这里，最多2个。如果是普通的聊天，返回空列表 []"]
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

async def run_pilot(target_title = "Strengthen friendships with one simple Question"):
    print(f"🚀 开始试点测试: {target_title}")
    
    # 获取帖子
    post = supabase.table("production_posts").select("id, title_en").ilike("title_en", f"%{target_title}%").execute().data[0]
    post_id = post['id']
    
    # 获取 Top 3 顶级评论 (作为 Root)
    roots = supabase.table("comments").select("id, content").eq("post_id", post_id).is_("parent_id", "null").order("upvotes", desc=True).limit(3).execute().data
    
    for root in roots:
        print(f"\n🌳 分析子树 Root ID: {root['id'][:8]}...")
        # 获取该 root 下的子评论 (这里为了简单，只取第一层回复，按点赞排序取前5)
        children = supabase.table("comments").select("id, content").eq("parent_id", root['id']).order("upvotes", desc=True).limit(5).execute().data
        
        if not children:
            continue
            
        result = await analyze_subtree(post, root, children)
        
        if result:
            print(f"   ✨ Vibe Tag: {result.get('vibe_tag')}")
            print(f"   🎯 Punchline IDs: {[i[:8] for i in result.get('punchline_comment_ids', [])]}")
            
            # 入库
            payload = {
                "post_id": post_id,
                "root_comment_id": root['id'],
                "vibe_tag": result.get('vibe_tag'),
                "dopa_summary": result.get('dopa_summary'),
                "punchline_comment_ids": result.get('punchline_comment_ids', [])
            }
            supabase.table("subtree_vibes").upsert(payload, on_conflict="root_comment_id").execute()
            print("   💾 子树数据入库成功！")

if __name__ == "__main__":
    asyncio.run(run_pilot())