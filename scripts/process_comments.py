import asyncio
import json
import os
import re
from typing import List, Dict, Any
from dotenv import load_dotenv
from supabase import create_client, Client
from openai import AsyncOpenAI
from pydantic import BaseModel, Field, model_validator, ValidationError,model_validator # 确保引入了 model_validator

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
client = AsyncOpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL)

# --- 完整 7 等级数据模型 ---
class Segment(BaseModel):
    en: str
    zh: str

class Highlight(BaseModel):
    word: str
    meaning: str
    @model_validator(mode='before')
    @classmethod
    def check_string_input(cls, data: Any) -> Any:
        if isinstance(data, str): return {"word": data, "meaning": "暂无释义"}
        return data

class Variant(BaseModel):
    content: str
    highlights: List[Highlight]

class CulturalNote(BaseModel):
    trigger_word: str
    explanation: str = Field(..., description="Must be in Chinese.")

    # ✅ 核心修复：增加容错校验器
    @model_validator(mode='before')
    @classmethod
    def handle_string_or_malformed_dict(cls, data: Any) -> Any:
        # 如果 AI 错误地返回了纯字符串
        if isinstance(data, str):
            # 尝试从字符串中提取前几个词作为 trigger_word，全句作为 explanation
            words = data.split()
            trigger = " ".join(words[:2]) if len(words) > 2 else data
            return {"trigger_word": trigger, "explanation": data}
        
        # 如果 AI 返回了 dict 但字段名不对（比如用了 'term' 或 'note'）
        if isinstance(data, dict):
            if 'trigger_word' not in data:
                # 兼容常见的 AI 自作主张的字段名
                for alias in ['term', 'word', 'phrase', 'keyword']:
                    if alias in data:
                        data['trigger_word'] = data.pop(alias)
                        break
                if 'trigger_word' not in data:
                    data['trigger_word'] = "Key Point"
            
            if 'explanation' not in data:
                for alias in ['note', 'meaning', 'desc', 'context']:
                    if alias in data:
                        data['explanation'] = data.pop(alias)
                        break
        return data

class EnrichmentResult(BaseModel):
    corrected_content: str
    translated_content: str
    sentence_segments: List[Segment]
    difficulty_variants: Dict[str, Variant]
    cultural_notes: List[CulturalNote]

def clean_json_string(json_str: str) -> str:
    pattern = r"^```json\s*(.*?)\s*```$"
    match = re.search(pattern, json_str, re.DOTALL)
    if match: return match.group(1)
    return json_str.strip("`").strip()

# --- 核心处理逻辑 ---
async def process_comment(comment: Dict[str, Any], sem: asyncio.Semaphore):
    async with sem:
        print(f"🔄 Upgrading {comment['id'][:8]} to 7-Level Standard...")
        
        json_template = """
        {
            "corrected_content": "Standard English...",
            "translated_content": "中文翻译...",
            "sentence_segments": [{"en": "...", "zh": "..."}],
            "difficulty_variants": {
                "Mixed": {"content": "Chinglish style...", "highlights": [{"word": "style", "meaning": "风格"}]}, 
                "PrimarySchool": {"content": "...", "highlights": []},
                "MiddleSchool": {"content": "...", "highlights": []},
                "HighSchool": {"content": "...", "highlights": []},
                "CET4": {"content": "...", "highlights": []},
                "CET6": {"content": "...", "highlights": []},
                "IELTS": {"content": "...", "highlights": []}
            },
            "cultural_notes": []
        }
        """

        prompt = f"""
        Analyze this Reddit comment.
        Original: "{comment['content']}"
        
        Tasks:
        1. Correct typos & Translate.
        2. Segment sentences.
        3. Rewrite in 7 DISTINCT styles (Mixed, PrimarySchool, MiddleSchool, HighSchool, CET4, CET6, IELTS).
           - "Mixed": Chinese structure + English keywords.
        4. Explain slang.
        
        Return ONLY valid JSON:
        {json_template}
        """

        try:
            response = await client.chat.completions.create(
                model="deepseek-chat", 
                messages=[{"role": "system", "content": "You are a JSON generator. No truncation."}, {"role": "user", "content": prompt}],
                response_format={"type": "json_object"}, 
                temperature=0.1, max_tokens=8192
            )
            
            content = response.choices[0].message.content
            cleaned_json = clean_json_string(content)
            result_data = EnrichmentResult.model_validate_json(cleaned_json)
            data_dict = result_data.model_dump()
            
            # 更新 DB
            supabase.table("comments").update({"content_cn": data_dict["translated_content"]}).eq("id", comment["id"]).execute()
            
            enrichment_payload = {
                "comment_id": comment["id"],
                "corrected_content": data_dict["corrected_content"],
                "sentence_segments": data_dict["sentence_segments"],
                "difficulty_variants": data_dict["difficulty_variants"],
                "cultural_notes": data_dict["cultural_notes"]
            }
            supabase.table("comments_enrichment").upsert(enrichment_payload).execute()
            print(f"✅ Upgraded {comment['id'][:8]}")

        except Exception as e:
            print(f"❌ Failed {comment['id'][:8]}: {str(e)}")

async def main():
    print("🚀 Starting Database Standardization (Upgrade Old Records)...")
    
    # 1. 获取所有 enrichment 记录
    print("📥 Fetching existing enrichment data...")
    # 注意：这里假设 enrichment 表不超过几千条，一次拉取没问题。如果太多需要分页。
    enrichment_records = supabase.table("comments_enrichment").select("comment_id, difficulty_variants").execute().data
    
    # 2. 筛选出“旧格式”记录 (缺少 'Mixed' 字段的)
    ids_to_upgrade = []
    for record in enrichment_records:
        variants = record.get('difficulty_variants', {})
        # 如果没有 Mixed 模式，或者等级数量少于 5 个，就判定为旧数据
        if 'Mixed' not in variants or len(variants.keys()) < 5:
            ids_to_upgrade.append(record['comment_id'])
            
    print(f"📊 Total Enriched: {len(enrichment_records)}")
    print(f"⚠️  Old Format Detected: {len(ids_to_upgrade)}")
    
    if len(ids_to_upgrade) == 0:
        print("🎉 All records are up to date! No upgrade needed.")
        return

    # 3. 获取对应的 comments 原文
    # 因为 ID 列表可能很长，我们分批获取或者直接获取所有 comments 在内存里匹配
    all_comments = supabase.table("comments").select("id, content").execute().data
    comments_map = {c['id']: c for c in all_comments}
    
    to_process = []
    for cid in ids_to_upgrade:
        if cid in comments_map:
            to_process.append(comments_map[cid])

    print(f"🛠️  Starting upgrade for {len(to_process)} comments...")

    semaphore = asyncio.Semaphore(5)
    tasks = [process_comment(c, semaphore) for c in to_process]
    await asyncio.gather(*tasks, return_exceptions=True)

if __name__ == "__main__":
    asyncio.run(main())