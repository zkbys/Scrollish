import asyncio
import json
import os
import re
from typing import List, Dict, Any
from dotenv import load_dotenv
from supabase import create_client, Client
from openai import AsyncOpenAI
# ✅ 修复：补全 ValidationError 的引入
from pydantic import BaseModel, Field, field_validator, model_validator, ValidationError

# 加载环境变量
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
client = AsyncOpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL)

# --- 增强版数据模型 ---
class Segment(BaseModel):
    en: str
    zh: str

class Highlight(BaseModel):
    word: str
    meaning: str
    
    @model_validator(mode='before')
    @classmethod
    def check_string_input(cls, data: Any) -> Any:
        if isinstance(data, str):
            return {"word": data, "meaning": "暂无释义"}
        return data

class Variant(BaseModel):
    content: str
    highlights: List[Highlight]

class CulturalNote(BaseModel):
    trigger_word: str
    explanation: str = Field(..., description="Must be in Chinese.")

    @model_validator(mode='before')
    @classmethod
    def map_alias(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if 'term' in data and 'trigger_word' not in data:
                data['trigger_word'] = data.pop('term')
        return data

class EnrichmentResult(BaseModel):
    corrected_content: str
    translated_content: str
    sentence_segments: List[Segment]
    # 7个等级
    difficulty_variants: Dict[str, Variant]
    cultural_notes: List[CulturalNote]

# --- 工具函数 ---
def clean_json_string(json_str: str) -> str:
    # 移除 markdown 标记
    pattern = r"^```json\s*(.*?)\s*```$"
    match = re.search(pattern, json_str, re.DOTALL)
    if match: return match.group(1)
    return json_str.strip("`").strip()

# --- 核心处理逻辑 ---
async def process_comment(comment: Dict[str, Any], sem: asyncio.Semaphore):
    async with sem:
        print(f"🔄 Patching {comment['id'][:8]}...")
        
        json_template = """
        {
            "corrected_content": "Standard English version...",
            "translated_content": "中文翻译...",
            "sentence_segments": [{"en": "Sentence 1", "zh": "句子1"}],
            "difficulty_variants": {
                "Mixed": {
                    "content": "This is a mixed sentence...", 
                    "highlights": [
                        {"word": "mixed", "meaning": "混合的"}
                    ]
                }, 
                "PrimarySchool": {"content": "...", "highlights": []},
                "MiddleSchool": {"content": "...", "highlights": []},
                "HighSchool": {"content": "...", "highlights": []},
                "CET4": {"content": "...", "highlights": []},
                "CET6": {"content": "...", "highlights": []},
                "IELTS": {"content": "...", "highlights": []}
            },
            "cultural_notes": [
                {"trigger_word": "slang_term", "explanation": "中文解释"}
            ]
        }
        """

        # 优化 Prompt：增加 "Concise" 要求，防止 AI 写小作文导致截断
        prompt = f"""
        Analyze this Reddit comment for an English learning app.
        Original: "{comment['content']}"
        
        Tasks:
        1. Correct typos/grammar.
        2. Translate to Chinese.
        3. Segment sentences.
        4. Rewrite in 7 DISTINCT styles (Mixed, PrimarySchool, MiddleSchool, HighSchool, CET4, CET6, IELTS).
           - Keep rewrites CONCISE and to the point.
           - "Mixed" style MUST contain Chinese structure + English keywords.
           - "highlights" MUST be a list of OBJECTS with 'word' and 'meaning'.
        5. Explain slang in Chinese using key "trigger_word".
        
        Return ONLY valid JSON exactly matching this structure:
        {json_template}
        """

        try:
            response = await client.chat.completions.create(
                model="deepseek-chat", 
                messages=[{"role": "system", "content": "You are a strict JSON generator. Do not truncate output."}, {"role": "user", "content": prompt}],
                response_format={"type": "json_object"}, 
                temperature=0.1, 
                max_tokens=8192
            )
            
            content = response.choices[0].message.content
            if not content: raise ValueError("Empty response")

            # 简单的截断检查
            if not content.strip().endswith("}"):
                raise ValueError("JSON output truncated (incomplete)")

            cleaned_json = clean_json_string(content)
            result_data = EnrichmentResult.model_validate_json(cleaned_json)
            data_dict = result_data.model_dump()
            
            # 更新 DB
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
            print(f"✅ Patched {comment['id'][:8]}")

        except ValidationError as ve:
            # ✅ 修复：现在程序认识 ValidationError 了，不会崩溃
            print(f"❌ JSON Error {comment['id'][:8]}: Validation failed.")
        except Exception as e:
            # 捕获截断或其他网络错误
            print(f"❌ Failed {comment['id'][:8]}: {str(e)}")

async def main():
    print("🚀 Starting 7-Level Incremental Patch (Stable V3)...")
    
    # 1. 获取主表数据
    all_comments = supabase.table("comments").select("id, content").execute().data
    
    # 2. 获取已处理数据
    processed = supabase.table("comments_enrichment").select("comment_id").execute().data
    processed_ids = {p['comment_id'] for p in processed}
    
    # 3. 找出漏网之鱼
    to_process = [c for c in all_comments if c['id'] not in processed_ids and len(c['content']) > 5]
    
    print(f"📊 Total: {len(all_comments)} | Already Done: {len(processed_ids)} | 🛠️  To Patch: {len(to_process)}")

    # 降低并发数以减少网络压力
    semaphore = asyncio.Semaphore(5)
    tasks = [process_comment(c, semaphore) for c in to_process]
    
    # 使用 return_exceptions=True 防止单个任务崩溃影响整体
    await asyncio.gather(*tasks, return_exceptions=True)

if __name__ == "__main__":
    asyncio.run(main())