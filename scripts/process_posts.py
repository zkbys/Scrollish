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
# 使用 SiliconFlow 密钥
SILICONFLOW_API_KEY = os.getenv("VITE_SILICONFLOW_API_KEY")
# SiliconFlow 的 OpenAI 兼容接口地址
SILICONFLOW_BASE_URL = os.getenv("SILICONFLOW_BASE_URL", "https://api.siliconflow.cn/v1")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
# 使用 SiliconFlow 配置客户端
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
    difficulty_variants: Optional[Dict[str, List[DifficultySegment]]] = None
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
    """清理无关链接"""
    if not text: return ""
    def md_link_replacer(match):
        link_text = match.group(1)
        url = match.group(2)
        if is_image_url(url): return match.group(0)
        return link_text
    text = re.sub(r'\[([^\]]+)\]\((https?://[^\s)]+)\)', md_link_replacer, text)
    md_pattern = r'(!?\[[^\]]*\]\([^)]+\))'
    parts = re.split(md_pattern, text)
    cleaned_parts = []
    for part in parts:
        if re.match(md_pattern, part):
            cleaned_parts.append(part)
        else:
            def plain_url_replacer(match):
                url = match.group(0)
                if is_image_url(url): return url
                return ""
            cleaned_part = re.sub(r'https?://[^\s)\]]+', plain_url_replacer, part)
            cleaned_parts.append(cleaned_part)
    return "".join(cleaned_parts).strip()

def clean_json_string(json_str: str) -> str:
    pattern = r"^```json\s*(.*?)\s*```$"
    match = re.search(pattern, json_str, re.DOTALL)
    if match: return match.group(1)
    return json_str.strip("`").strip()

def contains_chinese(text: str) -> bool:
    """检查文本是否包含中文字符"""
    return bool(re.search(r'[\u4e00-\u9fff]', text))

def segment_text_consistent(text: str) -> List[str]:
    """与 process_comments_v4 一致的分句逻辑，保护 GIF"""
    gif_pattern = r'!\[gif\]\(giphy\|[a-zA-Z0-9]+(?:\|[^)]*)?\)'
    gif_matches = re.findall(gif_pattern, text)
    protected_text = text
    placeholders = []
    for idx, gif in enumerate(gif_matches):
        placeholder = f"__GIF_PLACEHOLDER_{idx}__"
        placeholders.append((placeholder, gif))
        protected_text = protected_text.replace(gif, placeholder, 1)
    
    pattern = r'[^.!?\n]+(?:(?:\.(?!\d)|[!?\n])+|(?=$))'
    matches = re.findall(pattern, protected_text)
    
    segments = []
    for segment in matches:
        restored = segment
        for placeholder, original_gif in placeholders:
            if placeholder in restored:
                gif_url = re.sub(r'!\[gif\]\(giphy\|([a-zA-Z0-9]+)(?:\|[^)]*)?\)', 
                               r'https://media.giphy.com/media/\1/giphy.gif', 
                               original_gif)
                restored = restored.replace(placeholder, gif_url)
        s = restored.strip()
        if not s: continue
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
        
        raw_content = post.get('content_en') or post.get('title_en') or ""
        cleaned_content = clean_links(raw_content)
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
        
        json_template = {
            "native_polished": "Professional rewrite of the whole post.",
            "translated_content": "Full text translation.",
            "sentence_segments": [{"index": i + 1, "en": s, "zh": "..."} for i, s in enumerate(pre_sentences)],
            "difficulty_variants": {},
            "cultural_notes": [{"trigger_word": "...", "explanation": "..."}]
        }

        prompt = f"""
        # Role: Expert English Education Specialist
        # Task: Analyze this Reddit post. I have pre-segmented it into {len(pre_sentences)} pieces.
        # Input (Numbered Pieces):
        {numbered_input}
        
        # CRITICAL RULES (STRICT ALIGNMENT):
        1. **Index Integrity**: I provided {len(pre_sentences)} numbered pieces. You MUST return EXACTLY {len(pre_sentences)} items in 'sentence_segments'.
        2. **Consistency**: Index 'X' in all lists MUST refer to the EXACT SAME text from Piece 'X'.
        3. **Cultural Notes**: The 'explanation' field MUST be in **SIMPLIFIED CHINESE** (简体中文). Do NOT explain in English.
        
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
                    temperature=0.01,
                    max_tokens=8192
                )
                
                content = response.choices[0].message.content
                if not content: raise ValueError("Empty response from AI")
                
                result_data = EnrichmentResult.model_validate_json(clean_json_string(content))
                data_dict = result_data.model_dump()

                # === 验证与对齐 ===
                expected_indices = list(range(1, len(pre_sentences) + 1))
                seg_indices = [s["index"] for s in data_dict["sentence_segments"]]
                if seg_indices != expected_indices:
                    raise ValueError(f"AI Index mismatch. Expected {expected_indices}, got {seg_indices}")

                for idx, seg in enumerate(data_dict["sentence_segments"]):
                    if idx < len(pre_sentences):
                        seg["en"] = pre_sentences[idx]

                # 更新数据库
                try:
                    await retry_db_operation(
                        lambda: supabase.table("production_posts").update({
                            "content_cn": data_dict["translated_content"],
                            "native_polished": data_dict["native_polished"],
                            "sentence_segments": data_dict["sentence_segments"],
                            "difficulty_variants": {},
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
        
        try:
            await retry_db_operation(
                lambda: supabase.table("production_posts").update({"enrichment_status": "failed"}).eq("id", post_id).execute()
            )
        except Exception as e:
            print(f"⚠️ Could not mark post as failed: {e}")

async def main(limit: int = 50, force_update: bool = False):
    print(f"🚀 Starting Post Enrichment Processing (Mode: {'Force' if force_update else 'Smart'})")
    
    # 1. 构建查询
    # 我们不仅要处理 pending 的，还要处理那些状态为 completed 但缺失分句数据的帖子
    if not force_update:
        # 获取 pending 帖子
        res_pending = supabase.table("production_posts") \
            .select("id, content_en, title_en") \
            .eq("enrichment_status", "pending") \
            .neq("content_en", "") \
            .limit(limit) \
            .execute()
        
        # 获取已完成但无分句的帖子 (NULL 或 空数组)
        # 注意：supabase-py 可能无法直接查询 json 类型的长度或空数组，通常只能查 is null
        # 但我们可以尝试列出 completed 的，然后在 python 层过滤
        res_completed = supabase.table("production_posts") \
            .select("id, content_en, title_en, sentence_segments") \
            .in_("enrichment_status", ["completed", "processing"]) \
            .order("enrichment_status", desc=True) \
            .limit(limit * 2) \
            .execute()
            
        posts_pending = res_pending.data or []
        posts_completed = res_completed.data or []
        
        # 过滤出真正缺失 segments 的 posts
        posts_missing_segments = [
            p for p in posts_completed 
            if not p.get('sentence_segments') or len(p.get('sentence_segments', [])) == 0
        ]
        
        # 合并列表，优先处理缺失分句的已完成贴
        #以此修复 TopicHub 只显示整段翻译的问题
        posts = posts_missing_segments[:limit] + posts_pending
        # 去重
        seen = set()
        posts = [x for x in posts if not (x['id'] in seen or seen.add(x['id']))][:limit]
        
    else:
        res = supabase.table("production_posts") \
            .select("id, content_en") \
            .neq("content_en", "") \
            .not_.is_("content_en", "null") \
            .limit(limit) \
            .execute()
        posts = res.data
    if not posts:
        print("✨ No posts found to process.")
        return

    print(f"📊 Found {len(posts)} posts to process.")
    semaphore = asyncio.Semaphore(5)
    tasks = [process_post(p, semaphore) for p in posts]
    await asyncio.gather(*tasks)

if __name__ == "__main__":
    # 可以手动调整 limit 或者是否强制更新
    import sys
    limit = 50
    if len(sys.argv) > 1:
        limit = int(sys.argv[1])
    asyncio.run(main(limit=limit))
