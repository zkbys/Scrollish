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
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
# 使用 SiliconFlow 密钥
SILICONFLOW_API_KEY = os.getenv("VITE_SILICONFLOW_API_KEY")
# SiliconFlow 的 OpenAI 兼容接口地址
SILICONFLOW_BASE_URL = os.getenv("SILICONFLOW_BASE_URL", "https://api.siliconflow.cn/v1")
print(f"DEBUG: Key starts with: {SUPABASE_KEY[:10] if SUPABASE_KEY else 'None'}")
# 初始化 Supabase 客户端
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
# 使用 SiliconFlow 配置 OpenAI 客户端
client = AsyncOpenAI(api_key=SILICONFLOW_API_KEY, base_url=SILICONFLOW_BASE_URL)

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
    # 允许在不生成难度时为空
    difficulty_variants: Optional[Dict[str, List[DifficultySegment]]] = None
    cultural_notes: List[CulturalNote]

# --- 工具函数 ---
def clean_json_string(json_str: str) -> str:
    pattern = r"^```json\s*(.*?)\s*```$"
    match = re.search(pattern, json_str, re.DOTALL)
    if match: return match.group(1)
    return json_str.strip("`").strip()

def get_word_count(text: str) -> int:
    return len(re.findall(r'\w+', text))

def contains_chinese(text: str) -> bool:
    return bool(re.search(r'[\u4e00-\u9fff]', text))

def segment_text_consistent(text: str) -> List[str]:
    gif_pattern = r'!\[gif\]\(giphy\|[a-zA-Z0-9]+(?:\|[^)]*)?\)'
    gif_matches = re.findall(gif_pattern, text)
    protected_text = text
    placeholders = []
    for idx, gif in enumerate(gif_matches):
        placeholder = f"__GIF_PLACEHOLDER_{idx}__"
        placeholders.append((placeholder, gif))
        protected_text = protected_text.replace(gif, placeholder, 1)
    
    converted_text = protected_text
    for placeholder, original_gif in placeholders:
        gif_url = re.sub(r'!\[gif\]\(giphy\|([a-zA-Z0-9]+)(?:\|[^)]*)?\)', 
                        r'https://media.giphy.com/media/\1/giphy.gif', 
                        original_gif)
        converted_text = converted_text.replace(placeholder, gif_url)
    
    is_image = bool(re.match(r'^https?:\/\/.*\.(jpeg|jpg|gif|png|webp)(\?.*)?$|media\.giphy\.com|i\.redd\.it|preview\.redd\.it', converted_text.strip(), re.I))
    if is_image: return [converted_text.strip()]

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
        segments.append(restored.strip())
    
    final_segments = [s.strip() for s in segments if s.strip() and (re.search(r'[a-zA-Z0-9]', s) or len(s) >= 3)]
    return final_segments or [converted_text.strip()]

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
async def process_comment(comment: Dict[str, Any], sem: asyncio.Semaphore, generate_difficulty: bool = True):
    comment_id = comment['id']
    
    async with sem:
        # 1. 标记为处理中
        try:
            supabase.table("comments").update({"enrichment_status": "processing"}).eq("id", comment_id).execute()
        except Exception as e:
            print(f"⚠️ Warning: Could not set status to processing for {comment_id[:8]}: {e}")
        
        raw_content = comment['content'] or ""
        pre_sentences = merge_short_sentences(segment_text_consistent(raw_content))
        
        word_count = get_word_count(raw_content)
        is_short = word_count < 12
        
        numbered_input = "\n".join([f"{i+1}. {s}" for i, s in enumerate(pre_sentences)])
        segments_template = [{"index": i + 1, "en": s, "zh": "..."} for i, s in enumerate(pre_sentences)]
        
        json_template = {
            "native_polished": "Professional rewrite of the whole comment.",
            "translated_content": "Full text translation.",
            "sentence_segments": segments_template,
            "cultural_notes": [{"trigger_word": "...", "explanation": "..."}]
        }

        if generate_difficulty:
            levels = ["Mixed", "Basic"] if is_short else ["Mixed", "Basic", "Intermediate", "Expert"]
            json_template["difficulty_variants"] = {l: [{"index": i+1, "original": s, "rewritten": "..."} for i,s in enumerate(pre_sentences)] for l in levels}
            rules = "Return difficulty_variants for levels: " + ", ".join(levels)
            system_prompt = "Meticulous English educator. Ensure index alignment and no Chinese in Basic/Intermediate/Expert levels."
        else:
            rules = "Do NOT return 'difficulty_variants' key."
            system_prompt = "Meticulous English educator. Focus on accurate segment translation and native polishing."

        prompt = f"""
        # Task: Analyze this Reddit comment. Pre-segmented into {len(pre_sentences)} pieces.
        # Input:
        {numbered_input}
        # Rules:
        1. Index Integrity: Return EXACTLY {len(pre_sentences)} items.
        2. {rules}
        3. Cultural Notes: Explanation MUST be in Simplified Chinese.
        # Output Format:
        Return ONLY valid JSON:
        {json.dumps(json_template, ensure_ascii=False, indent=2)}
        """

        for attempt in range(3):
            try:
                response = await client.chat.completions.create(
                    model="deepseek-ai/DeepSeek-V3", 
                    messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": prompt}],
                    response_format={"type": "json_object"}, 
                    temperature=0.01
                )
                
                content = response.choices[0].message.content
                if not content: raise ValueError("Empty AI response")

                data_dict = json.loads(clean_json_string(content))
                
                # 基础字段补全与修正
                expected_indices = list(range(1, len(pre_sentences) + 1))
                for i, seg in enumerate(data_dict.get("sentence_segments", [])):
                    if i < len(pre_sentences): seg["en"] = pre_sentences[i]

                # 构造 Payload
                enrichment_payload = {
                    "comment_id": comment_id,
                    "native_polished": data_dict.get("native_polished", ""),
                    "sentence_segments": data_dict.get("sentence_segments", []),
                    "cultural_notes": data_dict.get("cultural_notes", []),
                    "difficulty_variants": data_dict.get("difficulty_variants", {})
                }
                
                # --- 强化入库检查 ---
                # 更新主表
                upd = supabase.table("comments").update({
                    "content_cn": data_dict.get("translated_content", ""),
                    "enrichment_status": "completed"
                }).eq("id", comment_id).execute()
                
                if not upd.data:
                    raise Exception(f"Database sync failed: No rows updated for {comment_id[:8]}")

                # 更新详细表
                ups = supabase.table("comments_enrichment").upsert(enrichment_payload).execute()
                if not ups.data:
                    raise Exception(f"Database upsert failed for {comment_id[:8]}")

                print(f"✅ [SUCCESS] {comment_id[:8]} - Attempt {attempt+1}")
                return

            except Exception as e:
                if attempt < 2:
                    print(f"⚠️ [RETRY {attempt+1}] {comment_id[:8]}: {str(e)[:100]}")
                    await asyncio.sleep(2)
                else:
                    print(f"❌ [FINAL FAIL] {comment_id[:8]}: {str(e)}")
                    supabase.table("comments").update({"enrichment_status": "failed"}).eq("id", comment_id).execute()

async def main(post_limit: Optional[int] = None, comment_limit: Optional[int] = None, generate_difficulty: bool = True, status_filter: Optional[str] = "pending"):
    print(f"🚀 Starting Status-Based Processing - Difficulty: {generate_difficulty}")
    
    try:
        # 查询 Pending 评论
        all_pending = []
        offset, page_size = 0, 100
        while True:
            res = supabase.table("comments").select("id, content, post_id").eq("enrichment_status", status_filter).gt("content", "").range(offset, offset + page_size - 1).execute()
            if not res.data: break
            all_pending.extend([c for c in res.data if len(c.get('content', '')) > 5])
            if len(res.data) < page_size: break
            offset += page_size
        
        if not all_pending:
            print("✨ No pending tasks."); return

        from collections import defaultdict
        grouped = defaultdict(list)
        for c in all_pending: grouped[c['post_id']].append(c)
        
        post_ids = list(grouped.keys())
        total_posts = len(post_ids)
        if post_limit: post_ids = post_ids[:post_limit]

        print(f"📊 Processing {len(post_ids)}/{total_posts} posts ({len(all_pending)} comments total)...")
        
        semaphore = asyncio.Semaphore(10)
        for idx, pid in enumerate(post_ids):
            comments = grouped[pid]
            print(f"\n📦 [{idx+1}/{len(post_ids)}] Post ID: {pid} ({len(comments)} comments)")
            tasks = [process_comment(c, semaphore, generate_difficulty) for c in comments]
            await asyncio.gather(*tasks)

    except Exception as e:
        print(f"❌ Global Error: {e}")

    # 最终状态汇报
    try:
        print("\n📊 Current Status Distribution:")
        for s in ["pending", "processing", "completed", "failed"]:
            count = supabase.table("comments").select("id", count="exact").eq("enrichment_status", s).execute().count
            print(f"   {s.capitalize()}: {count}")
    except: pass

# if __name__ == "__main__":
    # 建议先用 post_limit=2 测试，确认 Completed 数量增加后再全量跑
    # asyncio.run(main(post_limit=1, generate_difficulty=False))

if __name__ == "__main__":
    # 设置循环次数或直到处理完为止
    MAX_ROUNDS = 80
    
    async def run_multiple_rounds():
        for i in range(MAX_ROUNDS):
            print(f"\n\n{'='*20} 第 {i+1} 轮批处理开始 {'='*20}")
            
            # 调用 main 函数，每次处理 1 个帖子（你也可以增加到 2-5 个提高速度）
            # generate_difficulty=False 保持省流模式
            await main(post_limit=1, generate_difficulty=False, status_filter="processing")
            
            # 检查实时状态，如果没有 Pending 了就提前退出
            # 这里的逻辑 main 函数最后会打印，你也可以通过 main 的返回值来判断
            
            print(f"第 {i+1} 轮任务执行完毕，休息 2 秒后继续...")
            await asyncio.sleep(2)  # 给数据库和 API 一个喘息时间

    asyncio.run(run_multiple_rounds())