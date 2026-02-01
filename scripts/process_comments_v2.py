import asyncio
import json
import os
import re
from typing import List, Dict, Optional, Any
from dotenv import load_dotenv
from supabase import create_client, Client
from openai import AsyncOpenAI
from pydantic import BaseModel, Field, ValidationError

# 加载环境变量
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
client = AsyncOpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL)

# --- 升级后的数据模型 ---
class Segment(BaseModel):
    en: str
    zh: str

class Highlight(BaseModel):
    word: str
    meaning: str
    
class Variant(BaseModel):
    content: str
    highlights: List[Highlight]

class CulturalNote(BaseModel):
    trigger_word: str
    explanation: str = Field(..., description="Must be in Chinese. 必须用中文解释")

class EnrichmentResult(BaseModel):
    corrected_content: str = Field(..., description="Standardized English text")
    translated_content: str = Field(..., description="Natural Chinese translation")
    sentence_segments: List[Segment]
    difficulty_variants: Dict[str, Variant] = Field(
        ..., 
        description="Keys: IELTS, CET6, CET4, HighSchool, MiddleSchool, PrimarySchool, Mixed"
    )
    cultural_notes: List[CulturalNote]

# --- 核心逻辑 ---

def clean_json_string(json_str: str) -> str:
    pattern = r"^```json\s*(.*?)\s*```$"
    match = re.search(pattern, json_str, re.DOTALL)
    if match: return match.group(1)
    return json_str.strip("`").strip()

async def process_comment(comment: Dict[str, Any], sem: asyncio.Semaphore):
    async with sem:
        print(f"🔄 Processing {comment['id'][:8]}...")
        
        json_template = """
        {
            "corrected_content": "Standard English...",
            "translated_content": "中文翻译...",
            "sentence_segments": [{"en": "...", "zh": "..."}],
            "difficulty_variants": {
                "IELTS": {"content": "...", "highlights": [{"word": "...", "meaning": "..."}]},
                "CET6": {"content": "...", "highlights": [...]},
                "CET4": {"content": "...", "highlights": [...]},
                "HighSchool": {"content": "...", "highlights": [...]},
                "MiddleSchool": {"content": "...", "highlights": [...]},
                "PrimarySchool": {"content": "...", "highlights": [...]},
                "Mixed": {"content": "这看起来像是一个 deer bone...", "highlights": [...]} 
            },
            "cultural_notes": [{"trigger_word": "...", "explanation": "中文解释..."}]
        }
        """

        prompt = f"""
        Analyze this Reddit comment for an English learning app.
        
        Original: "{comment['content']}"
        
        Tasks:
        1. Correct typos/grammar.
        2. Translate to Chinese.
        3. Segment into sentence pairs.
        4. Rewrite in 7 styles:
           - Levels: IELTS, CET6, CET4, HighSchool, MiddleSchool, PrimarySchool.
           - "Mixed": A "Chinglish" style for beginners (Chinese sentence structure with key English words retained).
        5. Explain slang/culture in CHINESE (中文).
        
        Return ONLY valid JSON:
        {json_template}
        """

        try:
            response = await client.chat.completions.create(
                model="deepseek-chat", 
                messages=[
                    {"role": "system", "content": "You are a strict JSON generator."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"}, 
                temperature=0.2
            )
            
            cleaned_json = clean_json_string(response.choices[0].message.content)
            result_data = EnrichmentResult.model_validate_json(cleaned_json)
            data_dict = result_data.model_dump()
            
            # 写入数据库
            supabase.table("comments").update({
                "content_cn": data_dict["translated_content"]
            }).eq("id", comment["id"]).execute()
            
            enrichment_payload = {
                "comment_id": comment["id"],
                "corrected_content": data_dict["corrected_content"],
                "sentence_segments": data_dict["sentence_segments"],
                "difficulty_variants": data_dict["difficulty_variants"],
                "cultural_notes": data_dict["cultural_notes"]
            }
            supabase.table("comments_enrichment").upsert(enrichment_payload).execute()
            print(f"✅ Saved {comment['id'][:8]}")

        except Exception as e:
            print(f"❌ Error {comment['id'][:8]}: {str(e)}")

async def main():
    print("🚀 Starting Batch Processing...")
    
    # 1. 获取所有 ID
    all_comments = supabase.table("comments").select("id, content").execute().data
    
    # 2. 获取已处理 ID
    processed = supabase.table("comments_enrichment").select("comment_id").execute().data
    processed_ids = {p['comment_id'] for p in processed}
    
    # 3. 筛选未处理
    to_process = [c for c in all_comments if c['id'] not in processed_ids and len(c['content']) > 3]
    print(f"📊 Total: {len(all_comments)}, Processed: {len(processed_ids)}, Remaining: {len(to_process)}")

    semaphore = asyncio.Semaphore(10) # 提高并发到10
    tasks = [process_comment(c, semaphore) for c in to_process]
    
    # 使用 as_completed 显示进度
    for f in asyncio.as_completed(tasks):
        await f

if __name__ == "__main__":
    asyncio.run(main())