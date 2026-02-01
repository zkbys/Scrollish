import asyncio
import json
import os
import re  # 新增正则处理
from typing import List, Dict, Any
from dotenv import load_dotenv
from supabase import create_client, Client
from openai import AsyncOpenAI
from pydantic import BaseModel, Field, ValidationError

# 加载环境变量
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "[https://api.deepseek.com](https://api.deepseek.com)")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
client = AsyncOpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL)

# --- 定义数据模型 ---
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
    explanation: str

class EnrichmentResult(BaseModel):
    corrected_content: str = Field(..., description="修正拼写和语法的标准英文原文")
    translated_content: str = Field(..., description="通顺、地道的中文翻译")
    sentence_segments: List[Segment] = Field(..., description="中英文对应的分句列表") # 注意：为了统一，这里字段名改为了 sentence_segments
    difficulty_variants: Dict[str, Variant] = Field(..., description="Key为等级: CET4, CET6, IELTS, Primary")
    cultural_notes: List[CulturalNote] = Field(default=[], description="文化背景、俚语解释")

# --- 核心处理逻辑 ---

def clean_json_string(json_str: str) -> str:
    """清洗 DEEPSEEK 返回的字符串，去除 markdown 代码块标记"""
    # 去除 ```json 和 ``` 
    pattern = r"^```json\s*(.*?)\s*```$"
    match = re.search(pattern, json_str, re.DOTALL)
    if match:
        return match.group(1)
    # 如果只有 ``` 没有 json
    return json_str.strip("`").strip()

async def process_comment(comment: Dict[str, Any]):
    print(f"Processing {comment['id'][:8]}...")
    
    # 明确给出 JSON 模板，防止 DEEPSEEK 乱起名
    json_template = """
    {
        "corrected_content": "Corrected English text here.",
        "translated_content": "中文翻译在这里。",
        "sentence_segments": [
            {"en": "Sentence 1.", "zh": "句子1。"},
            {"en": "Sentence 2.", "zh": "句子2。"}
        ],
        "difficulty_variants": {
            "CET4": {
                "content": "Simplified text...",
                "highlights": [{"word": "apple", "meaning": "苹果"}]
            },
            "IELTS": {
                "content": "Academic text...",
                "highlights": [{"word": "fruit", "meaning": "水果"}]
            }
        },
        "cultural_notes": [
            {"trigger_word": "slang_term", "explanation": "Explanation..."}
        ]
    }
    """

    prompt = f"""
    You are an expert English teacher. Analyze the following Reddit comment.
    
    Original Text: "{comment['content']}"
    
    Tasks:
    1. Correct typos and grammar errors.
    2. Provide a natural Chinese translation.
    3. Segment the corrected text into sentence pairs (en/zh).
    4. Rewrite for levels: 'Primary' (Simple), 'CET4' (Standard), 'IELTS' (Academic).
       - For each level, extract 1-2 key vocabulary words.
    5. Identify slang/cultural references if any.
    
    IMPORTANT: Return ONLY valid JSON matching this structure exactly:
    {json_template}
    """

    try:
        response = await client.chat.completions.create(
            model="deepseek-chat", 
            messages=[
                {"role": "system", "content": "You are a helpful assistant that outputs only valid JSON."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"}, 
            temperature=0.1 # 降低温度，让输出更稳定
        )
        
        raw_content = response.choices[0].message.content
        cleaned_json = clean_json_string(raw_content)
        
        # 使用 Pydantic 解析，如果字段不对会抛出详细错误
        result_data = EnrichmentResult.model_validate_json(cleaned_json)
        
        # 转换为 dict 用于写入 Supabase
        # exclude_none=True 有助于去除空值，但这里我们希望结构完整
        data_dict = result_data.model_dump()
        
        # 1. 回填翻译到 comments 表
        supabase.table("comments").update({
            "content_cn": data_dict["translated_content"]
        }).eq("id", comment["id"]).execute()
        
        # 2. 插入数据到 comments_enrichment 表
        enrichment_payload = {
            "comment_id": comment["id"],
            "corrected_content": data_dict["corrected_content"],
            "sentence_segments": data_dict["sentence_segments"],
            "difficulty_variants": data_dict["difficulty_variants"],
            "cultural_notes": data_dict["cultural_notes"]
        }
        
        supabase.table("comments_enrichment").upsert(enrichment_payload).execute()
        
        print(f"✅ Success: {comment['id'][:8]}")

    except ValidationError as e:
        print(f"❌ Validation Error {comment['id'][:8]}: Missing or invalid fields.")
        # print(f"Raw Output: {raw_content[:100]}...") # 调试时可打开
    except json.JSONDecodeError as e:
        print(f"❌ JSON Error {comment['id'][:8]}: Invalid format.")
        # print(f"Raw Output: {raw_content[:100]}...")
    except Exception as e:
        print(f"❌ System Error {comment['id'][:8]}: {str(e)}")

async def main():
    print("Fetching comments without enrichment...")
    
    # 优化查询：只获取还没有处理过的评论（通过 LEFT JOIN 逻辑模拟）
    # Supabase JS/Python SDK 的复杂 JOIN 比较难写，
    # 这里我们先获取所有评论ID，再获取已处理的ID，在内存里做差集（适合几千条数据量）
    
    all_comments_res = supabase.table("comments").select("id, content").limit(100).execute() # 调试先跑100条
    all_comments = all_comments_res.data
    
    processed_res = supabase.table("comments_enrichment").select("comment_id").execute()
    processed_ids = {item['comment_id'] for item in processed_res.data}
    
    # 过滤出未处理的
    comments_to_process = [c for c in all_comments if c['id'] not in processed_ids]
    
    print(f"Found {len(comments_to_process)} comments to process.")

    tasks = []
    semaphore = asyncio.Semaphore(5) # 并发控制
    
    async def limited_process(comment):
        async with semaphore:
            await process_comment(comment)

    for comment in comments_to_process:
        # 跳过太短的无意义评论
        if len(comment['content']) < 5:
            continue
        tasks.append(limited_process(comment))
        
    await asyncio.gather(*tasks)

if __name__ == "__main__":
    asyncio.run(main())