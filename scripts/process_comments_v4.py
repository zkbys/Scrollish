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

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
# 使用 SiliconFlow 配置客户端
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
    difficulty_variants: Dict[str, List[DifficultySegment]]
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
    """检查文本是否包含中文字符"""
    return bool(re.search(r'[\u4e00-\u9fff]', text))

def segment_text_consistent(text: str) -> List[str]:
    """
    前端一致的分句逻辑，保护 GIF 语法不被拆分
    """
    # 1. 先提取并保护所有 GIF 语法（使用占位符）
    gif_pattern = r'!\[gif\]\(giphy\|[a-zA-Z0-9]+(?:\|[^)]*)?\)'
    gif_matches = re.findall(gif_pattern, text)
    
    # 用占位符替换 GIF（防止分句时被标点符号打断）
    protected_text = text
    placeholders = []
    for idx, gif in enumerate(gif_matches):
        placeholder = f"__GIF_PLACEHOLDER_{idx}__"
        placeholders.append((placeholder, gif))
        protected_text = protected_text.replace(gif, placeholder, 1)
    
    # 2. 判断是否为纯图片 URL（转换后检查）
    converted_text = protected_text
    for placeholder, original_gif in placeholders:
        gif_url = re.sub(r'!\[gif\]\(giphy\|([a-zA-Z0-9]+)(?:\|[^)]*)?\)', 
                        r'https://media.giphy.com/media/\1/giphy.gif', 
                        original_gif)
        converted_text = converted_text.replace(placeholder, gif_url)
    
    is_image = bool(re.match(r'^https?:\/\/.*\.(jpeg|jpg|gif|png|webp)(\?.*)?$|media\.giphy\.com|i\.redd\.it|preview\.redd\.it', converted_text.strip(), re.I))
    if is_image:
        return [converted_text.strip()]

    # 3. 对保护后的文本进行分句
    pattern = r'[^.!?\n]+[.!?\n]+|[^.!?\n]+$'
    matches = re.findall(pattern, protected_text)
    
    # 4. 还原 GIF 语法并转换为 URL
    segments = []
    for segment in matches:
        restored = segment
        for placeholder, original_gif in placeholders:
            if placeholder in restored:
                # 转换为 URL
                gif_url = re.sub(r'!\[gif\]\(giphy\|([a-zA-Z0-9]+)(?:\|[^)]*)?\)', 
                               r'https://media.giphy.com/media/\1/giphy.gif', 
                               original_gif)
                restored = restored.replace(placeholder, gif_url)
        segments.append(restored.strip())
    
    return [s for s in segments if s] or [converted_text.strip()]

def merge_short_sentences(segments: List[str]) -> List[str]:
    """
    合并短句（如 "OK," "Maybe." 等过渡词）到下一句
    """
    if len(segments) <= 1:
        return segments
    
    merged = []
    i = 0
    while i < len(segments):
        current = segments[i]
        word_count = len(re.findall(r'\w+', current))
        
        # 如果当前句子词数 <= 2 且不是最后一句，则与下一句合并
        if word_count <= 2 and i < len(segments) - 1:
            merged.append(current + " " + segments[i + 1])
            i += 2  # 跳过下一句
        else:
            merged.append(current)
            i += 1
    
    return merged

# --- 核心处理逻辑 ---
async def process_comment(comment: Dict[str, Any], sem: asyncio.Semaphore):
    async with sem:
        raw_content = comment['content'] or ""
        pre_sentences = segment_text_consistent(raw_content)
        # 应用短句合并
        pre_sentences = merge_short_sentences(pre_sentences)
        
        word_count = get_word_count(raw_content)
        is_short = word_count < 12
        
        print(f"🔄 Processing {comment['id'][:8]} (Segments: {len(pre_sentences)}, Mode: {'Simple' if is_short else 'Full'})...")
        
        # 定义难度等级
        levels_to_generate = ["Mixed", "Basic"] if is_short else ["Mixed", "Basic", "Intermediate", "Expert"]
        
        # 构建句子模板 (添加 index)
        segments_template = [{"index": i + 1, "en": s, "zh": "..."} for i, s in enumerate(pre_sentences)]
        
        # 构建难度变体模板 (添加 index)
        difficulty_template = {}
        for level in levels_to_generate:
            difficulty_template[level] = [
                {"index": i + 1, "original": s, "rewritten": "..."} for i, s in enumerate(pre_sentences)
            ]

        json_template = {
            "native_polished": "Professional rewrite of the whole comment.",
            "translated_content": "Full text translation.",
            "sentence_segments": segments_template,
            "difficulty_variants": difficulty_template,
            "cultural_notes": [{"trigger_word": "...", "explanation": "..."}]
        }

        # 构造高质量的 One-Shot Example (带索引)
        one_shot_input = "Honestly, the NFL is just playing the culture war for ratings. They lean into it when it's trendy, but they don't care about actual reform."
        one_shot_output = {
            "native_polished": "To be honest, the NFL is simply exploiting the culture war to boost their viewership. They embrace these issues when they're popular but show little interest in substantive reform.",
            "translated_content": "老实说，NFL 只是在利用文化战争来提高收视率。当这些话题流行时，他们会参与其中，但他们并不关心真正的改革。",
            "sentence_segments": [
                {"index": 1, "en": "Honestly, the NFL is just playing the culture war for ratings.", "zh": "老实说，NFL 只是在利用文化战争来提高收视率。"},
                {"index": 2, "en": "They lean into it when it's trendy, but they don't care about actual reform.", "zh": "当这些话题流行时，他们会参与其中，但他们并不关心真正的改革。"}
            ],
            "difficulty_variants": {
                "Mixed": [
                    {"index": 1, "original": "Honestly, the NFL is just playing the culture war for ratings.", "rewritten": "Honestly，NFL 只是在 playing 这个 culture war 来赚 ratings。"},
                    {"index": 2, "original": "They lean into it when it's trendy, but they don't care about actual reform.", "rewritten": "当它很 trendy 的时候他们会 lean into it，但他们并不 care 真正的 reform。"}
                ],
                "Basic": [
                    {"index": 1, "original": "Honestly, the NFL is just playing the culture war for ratings.", "rewritten": "I think the NFL uses culture problems to get more viewers."},
                    {"index": 2, "original": "They lean into it when it's trendy, but they don't care about actual reform.", "rewritten": "They do this when it is popular, but they do not want real change."}
                ],
                "Intermediate": [
                    {"index": 1, "original": "Honestly, the NFL is just playing the culture war for ratings.", "rewritten": "In my opinion, the NFL exploits cultural conflicts to increase their television ratings."},
                    {"index": 2, "original": "They lean into it when it's trendy, but they don't care about actual reform.", "rewritten": "They engage with these trends for publicity, yet they lack commitment to genuine reform."}
                ],
                "Expert": [
                    {"index": 1, "original": "Honestly, the NFL is just playing the culture war for ratings.", "rewritten": "Truth be told, the NFL is merely weaponizing the culture war to bolster their viewership figures."},
                    {"index": 2, "original": "They lean into it when it's trendy, but they don't care about actual reform.", "rewritten": "They pivot towards these social issues when advantageous, while remaining indifferent to systemic reform."}
                ]
            },
            "cultural_notes": [
                {"trigger_word": "culture war", "explanation": "文化战争：指社会中不同群体之间关于价值观、政治立场的激烈冲突。"}
            ]
        }

        prompt = f"""
        # Role: Expert English Education Specialist
        
        # Task: Analyze this Reddit comment following the One-Shot Example.
        ## Input: "{raw_content}"
        
        # CRITICAL RULES (STRICT ALIGNMENT):
        1. **Sentence Indexing**: Each sentence has a fixed 'index' (1, 2, 3...). 
        2. **Consistency**: You MUST ensure that the 'zh' translation and all 'rewritten' versions (Mixed, Basic, Intermediate, Expert) for index 'X' correspond EXACTLY to the same original English sentence at index 'X'.
        3. **Language Purity**: 
           - 'Mixed': Chinese + English allowed.
           - 'Basic', 'Intermediate', 'Expert': MUST be 100% PURE ENGLISH. ZERO Chinese characters.
        4. **Matching**: Array lengths MUST match the number of pre-segmented sentences ({len(pre_sentences)}).

        # One-Shot Example:
        {json.dumps(one_shot_output, ensure_ascii=False, indent=2)}

        # Output Format:
        Return ONLY a single valid JSON object following the structure above.
        """

        current_model = "deepseek-ai/DeepSeek-V3"
        for attempt in range(3):
            try:
                response = await client.chat.completions.create(
                    model=current_model, 
                    messages=[
                        {
                            "role": "system", 
                            "content": "You are a meticulous English educator. You strictly follow sentence indexing to ensure translations and rewrites never lose alignment. ZERO Chinese characters allowed in non-Mixed levels."
                        }, 
                        {"role": "user", "content": prompt}
                    ],
                    response_format={"type": "json_object"}, 
                    temperature=0.01, 
                    max_tokens=8192
                )
                
                content = response.choices[0].message.content
                if not content: raise ValueError("Empty AI response")

                cleaned_json = clean_json_string(content)
                result_data = EnrichmentResult.model_validate_json(cleaned_json)
                data_dict = result_data.model_dump()

                # === 验证逻辑 ===
                
                # 1. 检查语言纯度和索引一致性
                expected_indices = list(range(1, len(pre_sentences) + 1))
                
                # 检查 sentence_segments 索引
                seg_indices = [s["index"] for s in data_dict["sentence_segments"]]
                if seg_indices != expected_indices:
                    raise ValueError(f"AI Error: Sentence segments indices mismatch. Expected {expected_indices}, got {seg_indices}")

                for level, segments in data_dict["difficulty_variants"].items():
                    # 检查难度变体索引
                    level_indices = [s["index"] for s in segments]
                    if level_indices != expected_indices:
                        raise ValueError(f"AI Error: Level '{level}' indices mismatch. Expected {expected_indices}, got {level_indices}")
                    
                    for seg in segments:
                        if level != "Mixed" and contains_chinese(seg["rewritten"]):
                            raise ValueError(f"AI Error: Level '{level}' contains Chinese in: {seg['rewritten'][:50]}")
                
                # 2. 检查数组长度一致性
                expected_length = len(data_dict["sentence_segments"])
                for level, segments in data_dict["difficulty_variants"].items():
                    if len(segments) != expected_length:
                        raise ValueError(f"AI Error: Level '{level}' has {len(segments)} sentences, expected {expected_length}")
                
                # 3. 检查 original 字段与预分句一致
                for level, segments in data_dict["difficulty_variants"].items():
                    for idx, seg in enumerate(segments):
                        if idx < len(pre_sentences):
                            seg["original"] = pre_sentences[idx]  # 强制覆盖
                
                # 4. 检查 cultural_notes 的 explanation 是否为中文
                for note in data_dict["cultural_notes"]:
                    if note["explanation"] and not contains_chinese(note["explanation"]):
                        raise ValueError(f"AI Error: cultural_note explanation must be in Chinese: {note['explanation'][:50]}")

                # 5. 对齐 sentence_segments 的 en 字段
                for idx, seg in enumerate(data_dict["sentence_segments"]):
                    if idx < len(pre_sentences):
                        seg["en"] = pre_sentences[idx]
                
                # 构建入库数据
                enrichment_payload = {
                    "comment_id": comment["id"],
                    "native_polished": data_dict["native_polished"],
                    "sentence_segments": data_dict["sentence_segments"],
                    "difficulty_variants": data_dict["difficulty_variants"],
                    "cultural_notes": data_dict["cultural_notes"]
                }
                
                # 写入数据库
                supabase.table("comments").update({
                    "content_cn": data_dict["translated_content"]
                }).eq("id", comment["id"]).execute()
                
                supabase.table("comments_enrichment").upsert(enrichment_payload).execute()
                print(f"✅ Finished {comment['id'][:8]} on attempt {attempt+1}")
                break 

            except Exception as e:
                if attempt < 2:
                    print(f"⚠️ Retry {attempt+1} for {comment['id'][:8]} due to: {str(e)[:100]}")
                    await asyncio.sleep(2)
                else:
                    print(f"❌ Final Failure {comment['id'][:8]}: {str(e)}")

async def main(post_limit: Optional[int] = None):
    print(f"🚀 Starting Incremental Processing (DeepSeek-V3)...")
    
    # 1. 获取所有已处理的 ID
    try:
        processed_res = supabase.table("comments_enrichment").select("comment_id").execute()
        processed_ids = {p['comment_id'] for p in processed_res.data}
        print(f"💡 Found {len(processed_ids)} already processed comments.")
    except Exception as e:
        print(f"⚠️ Failed to fetch processed IDs, starting from scratch: {e}")
        processed_ids = set()

    # 2. 获取所有帖子
    try:
        posts_response = supabase.table("production_posts").select("id, title_en").execute()
        posts = posts_response.data
        if post_limit:
            posts = posts[:post_limit]
            print(f"🧪 Test Mode: Limited to {post_limit} posts.")
    except Exception as e:
        print(f"❌ Failed to fetch posts: {e}")
        return

    if not posts:
        print("No posts found in production_posts.")
        return

    print(f"📊 Processing {len(posts)} posts. Starting...")
    
    total_processed = 0
    total_failed = 0
    semaphore = asyncio.Semaphore(10)

    for idx, post in enumerate(posts):
        post_id = post["id"]
        post_title = post.get("title_en", "Untitled")[:30]
        
        print(f"\n📦 [{idx+1}/{len(posts)}] Post: {post_title}... ({post_id})")
        
        # 3. 获取该帖子下的所有评论
        try:
            comments = supabase.table("comments").select("id, content").eq("post_id", post_id).execute().data
            # 过滤：1. 长度 > 5, 2. 不在 processed_ids 中
            to_process = [c for c in comments if c.get('content') and len(c['content']) > 5 and c['id'] not in processed_ids]
        except Exception as e:
            print(f"  ⚠️ Failed to fetch comments for {post_id}: {e}")
            continue

        if not to_process:
            print(f"  ☕ All comments already processed for this post.")
            continue

        print(f"  📝 Found {len(to_process)} new comments. Processing...")
        
        tasks = [process_comment(c, semaphore) for c in to_process]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        success_count = sum(1 for r in results if r is None)
        fail_count = len(to_process) - success_count
        
        total_processed += success_count
        total_failed += fail_count
        
        print(f"  ✅ Post Completed: {success_count} success, {fail_count} failed.")

    print(f"\n{'='*40}")
    print(f"🏁 DONE!")
    print(f"📈 New Success: {total_processed}")
    print(f"📉 Total Failed: {total_failed}")
    print(f"{'='*40}")

if __name__ == "__main__":
    # >>> 修改此处：设置为 2 个帖子进行测试 <<<
    asyncio.run(main(post_limit=1))
