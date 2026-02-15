import asyncio
import json
import os
import re
from typing import List, Dict, Any, Optional
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client, Client
from openai import AsyncOpenAI
from pydantic import BaseModel, Field, model_validator, ValidationError

# 加载环境变量
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
# 优先使用 SERVICE_ROLE_KEY 以绕过 RLS 限制
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
SILICONFLOW_API_KEY = os.getenv("VITE_SILICONFLOW_API_KEY")
SILICONFLOW_BASE_URL = os.getenv("SILICONFLOW_BASE_URL", "https://api.siliconflow.cn/v1")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
client = AsyncOpenAI(api_key=SILICONFLOW_API_KEY, base_url=SILICONFLOW_BASE_URL)

# 数据库更新重试装饰器
async def retry_db_operation(operation, max_retries=3):
    """重试数据库操作，处理连接中断"""
    for attempt in range(max_retries):
        try:
            return operation()
        except Exception as e:
            if attempt < max_retries - 1:
                await asyncio.sleep(2 ** attempt)  # 指数退避
            else:
                raise e

# --- 数据模型 ---
class Segment(BaseModel):
    index: int
    en: str
    zh: str

class DifficultySegment(BaseModel):
    index: int
    original: str
    rewritten: str

class CulturalNote(BaseModel):
    trigger_word: str = Field(..., description="来自原文的英文俚语或词组")
    explanation: str = Field(..., description="中文背景解释/内涵说明")

class EnrichmentResult(BaseModel):
    native_polished: str = Field(..., description="地道、流畅的母语级英语版本")
    translated_content: str
    sentence_segments: List[Segment]
    difficulty_variants: Dict[str, List[DifficultySegment]]
    cultural_notes: List[CulturalNote]

# --- 工具函数 ---
def is_image_url(url: str) -> bool:
    """检查 URL 是否为图片或 GIF"""
    image_extensions = ('.jpg', '.jpeg', '.png', '.gif', '.webp')
    image_hosts = ('media.giphy.com', 'i.redd.it', 'preview.redd.it')
    
    clean_url = url.split('?')[0].lower()
    if clean_url.endswith(image_extensions):
        return True
    if any(host in clean_url for host in image_hosts):
        return True
    return False

def clean_links(text: str) -> str:
    """
    清理无关链接：
    1. [text](url) -> 如果 url 不是图片，保留 text，删除 url
    2. 纯 http(s) 链接 -> 如果不是图片，直接删除
    """
    if not text:
        return ""

    # 1. 处理 Markdown 链接 [text](url)
    def md_link_replacer(match):
        link_text = match.group(1)
        url = match.group(2)
        if is_image_url(url):
            return match.group(0) # 保持原样 (通常是图片或 GIF)
        return link_text # 只保留文本

    text = re.sub(r'\[([^\]]+)\]\((https?://[^\s)]+)\)', md_link_replacer, text)

    # 2. 处理纯文本链接 (注意不要破坏已经保护好的 Markdown 图片语法)
    # 我们排查那些不在 []() 里的纯 URL
    # 简单的策略：先用占位符保护 Markdown 语法
    md_pattern = r'(!?\[[^\]]*\]\([^)]+\))'
    parts = re.split(md_pattern, text)
    
    cleaned_parts = []
    for part in parts:
        if re.match(md_pattern, part):
            cleaned_parts.append(part)
        else:
            # 在非 Markdown 部分搜索纯 URL
            # 这里的正则要小心，不要误删
            def plain_url_replacer(match):
                url = match.group(0)
                if is_image_url(url):
                    return url
                return "" # 删除无关链接
            
            cleaned_part = re.sub(r'https?://[^\s)\]]+', plain_url_replacer, part)
            cleaned_parts.append(cleaned_part)
    
    return "".join(cleaned_parts).strip()

def clean_json_string(json_str: str) -> str:
    pattern = r"^```json\s*(.*?)\s*```$"
    match = re.search(pattern, json_str, re.DOTALL)
    if match: return match.group(1)
    return json_str.strip("`").strip()

def contains_chinese(text: str) -> bool:
    return bool(re.search(r'[\u4e00-\u9fff]', text))

def segment_text_consistent(text: str) -> List[str]:
    """与 process_comments_v4 一致的分句逻辑，保护 GIF"""
    # 1. 保护 GIF 语法
    gif_pattern = r'!\[gif\]\(giphy\|[a-zA-Z0-9]+(?:\|[^)]*)?\)'
    gif_matches = re.findall(gif_pattern, text)
    
    protected_text = text
    placeholders = []
    for idx, gif in enumerate(gif_matches):
        placeholder = f"__GIF_PLACEHOLDER_{idx}__"
        placeholders.append((placeholder, gif))
        protected_text = protected_text.replace(gif, placeholder, 1)
    
    # 2. 分句
    pattern = r'[^.!?\n]+(?:(?:\.(?!\d)|[!?\n])+|(?=$))'
    matches = re.findall(pattern, protected_text)
    
    # 3. 还原并清理
    segments = []
    for segment in matches:
        restored = segment
        for placeholder, original_gif in placeholders:
            if placeholder in restored:
                # 转换 giphy 语法为直接 URL (符合 App 展示逻辑)
                gif_url = re.sub(r'!\[gif\]\(giphy\|([a-zA-Z0-9]+)(?:\|[^)]*)?\)', 
                               r'https://media.giphy.com/media/\1/giphy.gif', 
                               original_gif)
                restored = restored.replace(placeholder, gif_url)
        
        s = restored.strip()
        if not s: continue
        # 过滤噪声
        if not re.search(r'[a-zA-Z0-9]', s) and len(s) < 3:
            continue
        segments.append(s)
    
    return segments

def merge_short_sentences(segments: List[str]) -> List[str]:
    if len(segments) <= 1: return segments
    merged = []
    i = 0
    while i < len(segments):
        current = segments[i]
        word_count = len(re.findall(r'\w+', current))
        if word_count <= 2 and i < len(segments) - 1:
            merged.append(current + " " + segments[i + 1])
            i += 2
        else:
            merged.append(current)
            i += 1
    return merged

# --- 核心处理逻辑 ---
async def process_post(post: Dict[str, Any], sem: asyncio.Semaphore):
    post_id = post['id']
    
    async with sem:
        try:
            await retry_db_operation(
                lambda: supabase.table("production_posts").update({"enrichment_status": "processing"}).eq("id", post_id).execute()
            )
        except Exception as e:
            print(f"⚠️ Failed to update status for {post_id[:8]}: {e}")
        
        raw_content = post['content_en'] or ""
        # 0. 清理链接
        cleaned_content = clean_links(raw_content)
        # 1. 分句
        pre_sentences = segment_text_consistent(cleaned_content)
        pre_sentences = merge_short_sentences(pre_sentences)
        
        if not pre_sentences:
            print(f"⏩ Skipping {post_id[:8]}: Empty after cleaning.")
            try:
                await retry_db_operation(
                    lambda: supabase.table("production_posts").update({"enrichment_status": "completed"}).eq("id", post_id).execute()
                )
            except Exception as e:
                print(f"⚠️ Failed to mark as completed: {e}")
            return

        print(f"🔄 Processing Post {post_id[:8]} ({len(pre_sentences)} segments)...")
        
        numbered_input = "\n".join([f"{i+1}. {s}" for i, s in enumerate(pre_sentences)])
        levels_to_generate = ["Mixed", "Basic", "Intermediate", "Expert"]
        
        json_template = {
            "native_polished": "Professional rewrite of the whole post.",
            "translated_content": "Full text translation.",
            "sentence_segments": [{"index": i + 1, "en": s, "zh": "..."} for i, s in enumerate(pre_sentences)],
            "difficulty_variants": {level: [{"index": i + 1, "original": s, "rewritten": "..."} for i, s in enumerate(pre_sentences)] for level in levels_to_generate},
            "cultural_notes": [{"trigger_word": "...", "explanation": "..."}]
        }

        prompt = f"""
        # Role: Expert English Education Specialist
        # Task: Analyze this Reddit post. I have pre-segmented it into {len(pre_sentences)} pieces.
        # Input:
        {numbered_input}
        
        # CRITICAL RULES:
        1. **Index Integrity**: Return EXACTLY {len(pre_sentences)} items in all lists.
        2. **Language**: 
           - 'Mixed': Chinese + English.
           - 'Basic', 'Intermediate', 'Expert': 100% PURE ENGLISH.
        3. **Cultural Notes**: 'explanation' MUST be in SIMPLIFIED CHINESE.
        
        # Output Format:
        Return ONLY valid JSON:
        {json.dumps(json_template, ensure_ascii=False, indent=2)}
        """

        for attempt in range(3):
            try:
                response = await client.chat.completions.create(
                    model="deepseek-ai/DeepSeek-V3",
                    messages=[
                        {"role": "system", "content": "You are a meticulous English educator. Ensure strict index alignment and language purity. Return a complete, valid JSON object."},
                        {"role": "user", "content": prompt}
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.1,
                    max_tokens=8192 # 增加 token 限制防止截断
                )
                
                content = response.choices[0].message.content
                if not content:
                    raise ValueError("Empty response from AI")
                
                result_data = EnrichmentResult.model_validate_json(clean_json_string(content))
                data_dict = result_data.model_dump()

                # 数据同步与覆盖 (确保 AI 没有串改原文)
                for level in levels_to_generate:
                    for idx, seg in enumerate(data_dict["difficulty_variants"][level]):
                        if idx < len(pre_sentences):
                            seg["original"] = pre_sentences[idx]
                for idx, seg in enumerate(data_dict["sentence_segments"]):
                    if idx < len(pre_sentences):
                        seg["en"] = pre_sentences[idx]

                # 更新数据库 (带重试)
                try:
                    await retry_db_operation(
                        lambda: supabase.table("production_posts").update({
                            "content_cn": data_dict["translated_content"],
                            "native_polished": data_dict["native_polished"],
                            "sentence_segments": data_dict["sentence_segments"],
                            "difficulty_variants": data_dict["difficulty_variants"],
                            "cultural_notes": data_dict["cultural_notes"],
                            "enrichment_status": "completed"
                        }).eq("id", post_id).execute()
                    )
                    print(f"✅ Finished Post {post_id[:8]}")
                except Exception as db_err:
                    print(f"❌ DB Update failed for {post_id[:8]}: {db_err}")
                    raise
                return

            except Exception as e:
                print(f"⚠️ Retry {attempt+1} for {post_id[:8]}: {str(e)[:100]}")
                await asyncio.sleep(2)
        
        # 最终失败，标记状态
        try:
            await retry_db_operation(
                lambda: supabase.table("production_posts").update({"enrichment_status": "failed"}).eq("id", post_id).execute()
            )
        except Exception as e:
            print(f"⚠️ Could not mark post as failed: {e}")

async def main(limit: int = 50):
    print(f"🚀 Starting Post Enrichment Processing")
    
    # 1. 预处理：将 content_en 为空字符串的帖子直接标记为 completed
    print("🧹 Cleaning up empty content posts...")
    try:
        # 分两次查询：先找出空内容和null的ID，再逐个更新（避免复杂查询语法问题）
        empty_posts = supabase.table("production_posts") \
            .select("id") \
            .eq("enrichment_status", "pending") \
            .is_("content_en", "null") \
            .execute()
        
        empty_posts_2 = supabase.table("production_posts") \
            .select("id") \
            .eq("enrichment_status", "pending") \
            .eq("content_en", "") \
            .execute()
        
        all_empty_ids = [p['id'] for p in (empty_posts.data or [])] + [p['id'] for p in (empty_posts_2.data or [])]
        
        if all_empty_ids:
            for empty_id in all_empty_ids:
                await retry_db_operation(
                    lambda id=empty_id: supabase.table("production_posts").update({"enrichment_status": "completed"}).eq("id", id).execute()
                )
            print(f"   - Marked {len(all_empty_ids)} empty posts as completed.")
    except Exception as e:
        print(f"   - Cleanup empty posts failed: {e}")

    # 2. 获取待处理帖子 (过滤空内容)
    res = supabase.table("production_posts") \
        .select("id, content_en") \
        .eq("enrichment_status", "pending") \
        .neq("content_en", "") \
        .not_.is_("content_en", "null") \
        .limit(limit) \
        .execute()
    
    posts = res.data
    if not posts:
        print("✨ No pending posts found (that aren't empty).")
        return

    print(f"📊 Found {len(posts)} posts to process.")
    semaphore = asyncio.Semaphore(5)
    tasks = [process_post(p, semaphore) for p in posts]
    await asyncio.gather(*tasks)

if __name__ == "__main__":
    asyncio.run(main(limit=50))
