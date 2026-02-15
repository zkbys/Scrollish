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

    # 3. 对保护后的文本进行分句 (使用负向先行断言，避免在小数点处切分)
    # 匹配条件：非标点符号序列 + (标点符号(?!\d) 或 换行符 或 字符串末尾)
    pattern = r'[^.!?\n]+(?:(?:\.(?!\d)|[!?\n])+|(?=$))'
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
    
    # 过滤掉纯噪声（不含字母或数字且长度极短）的片段
    final_segments = []
    for s in segments:
        s = s.strip()
        if not s: continue
        # 如果片段不含字母数字且长度小于 3，通常是脏数据
        if not re.search(r'[a-zA-Z0-9]', s) and len(s) < 3:
            continue
        final_segments.append(s)

    return final_segments or [converted_text.strip()]

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
    """处理单个评论，使用状态字段进行追踪"""
    comment_id = comment['id']
    
    async with sem:
        # 1. 标记为处理中
        try:
            supabase.table("comments").update({
                "enrichment_status": "processing"
            }).eq("id", comment_id).execute()
        except Exception as e:
            print(f"⚠️ Failed to update status to processing for {comment_id[:8]}: {e}")
        
        raw_content = comment['content'] or ""
        pre_sentences = segment_text_consistent(raw_content)
        # 应用短句合并
        pre_sentences = merge_short_sentences(pre_sentences)
        
        word_count = get_word_count(raw_content)
        is_short = word_count < 12
        
        print(f"🔄 Processing {comment_id[:8]} (Segments: {len(pre_sentences)}, Mode: {'Simple' if is_short else 'Full'})...")
        
        # 3. 构造 编号输入 (Numbered Input) 强制 AI 关注每一个分片
        numbered_input = "\n".join([f"{i+1}. {s}" for i, s in enumerate(pre_sentences)])
        
        # 定义难度等级 (已注释以提速)
        # levels_to_generate = ["Mixed", "Basic"] if is_short else ["Mixed", "Basic", "Intermediate", "Expert"]
        
        # 构建句子模板
        segments_template = [{"index": i + 1, "en": s, "zh": "..."} for i, s in enumerate(pre_sentences)]
        
        # 构建难度变体模板 (已注释以提速)
        difficulty_template = {}
        # for level in levels_to_generate:
        #     difficulty_template[level] = [
        #         {"index": i + 1, "original": s, "rewritten": "..."} for i, s in enumerate(pre_sentences)
        #     ]

        json_template = {
            "native_polished": "Professional rewrite of the whole comment.",
            "translated_content": "Full text translation.",
            "sentence_segments": segments_template,
            "difficulty_variants": {}, # 暂时不生成难度变体以节省 token
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
            "difficulty_variants": {}, # 已简化
            "cultural_notes": [
                {"trigger_word": "culture war", "explanation": "文化战争：指社会中不同群体之间关于价值观、政治立场的激烈冲突。"}
            ]
        }

        prompt = f"""
        # Role: Expert English Education Specialist
        
        # Task: Analyze this Reddit comment. I have pre-segmented it into {len(pre_sentences)} pieces.
        
        # Input (Numbered Pieces):
        {numbered_input}
        
        # CRITICAL RULES (STRICT ALIGNMENT):
        1. **Index Integrity**: I provided {len(pre_sentences)} numbered pieces. You MUST return EXACTLY {len(pre_sentences)} items in 'sentence_segments'.
        2. **Consistency**: Index 'X' in all lists MUST refer to the EXACT SAME text from Piece 'X'.
        # 3. **Language Purity**: (SKIP FOR NOW)
        #    - 'Mixed': Chinese + English allowed.
        #    - 'Basic', 'Intermediate', 'Expert': MUST be 100% PURE ENGLISH. ZERO Chinese characters.
        4. **Cultural Notes**: The 'explanation' field MUST be in **SIMPLIFIED CHINESE** (简体中文). Do NOT explain in English.
        
        # Output Format:
        Return ONLY a single valid JSON object following this template:
        {json.dumps(json_template, ensure_ascii=False, indent=2)}
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

                # 注释难度变体验证以提速
                # for level, segments in data_dict["difficulty_variants"].items():
                #     # 检查难度变体索引
                #     level_indices = [s["index"] for s in segments]
                #     if level_indices != expected_indices:
                #         raise ValueError(f"AI Error: Level '{level}' indices mismatch. Expected {expected_indices}, got {level_indices}")
                #     
                #     for seg in segments:
                #         if level != "Mixed" and contains_chinese(seg["rewritten"]):
                #             raise ValueError(f"AI Error: Level '{level}' contains Chinese in: {seg['rewritten'][:50]}")
                
                # 2. 检查数组长度一致性
                expected_length = len(data_dict["sentence_segments"])
                # for level, segments in data_dict["difficulty_variants"].items():
                #     if len(segments) != expected_length:
                #         raise ValueError(f"AI Error: Level '{level}' has {len(segments)} sentences, expected {expected_length}")
                
                # 3. 检查 original 字段与预分句一致
                # for level, segments in data_dict["difficulty_variants"].items():
                #     for idx, seg in enumerate(segments):
                #         if idx < len(pre_sentences):
                #             seg["original"] = pre_sentences[idx]  # 强制覆盖
                
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
                    "comment_id": comment_id,
                    "native_polished": data_dict["native_polished"],
                    "sentence_segments": data_dict["sentence_segments"],
                    "difficulty_variants": {}, # 暂时设置为空以提速
                    "cultural_notes": data_dict["cultural_notes"]
                }
                
                # 写入数据库并更新状态为 completed
                supabase.table("comments").update({
                    "content_cn": data_dict["translated_content"],
                    "enrichment_status": "completed"
                }).eq("id", comment_id).execute()
                
                supabase.table("comments_enrichment").upsert(enrichment_payload).execute()
                print(f"✅ Finished {comment_id[:8]} on attempt {attempt+1}")
                return  # 成功处理，直接返回

            except Exception as e:
                if attempt < 2:
                    print(f"⚠️ Retry {attempt+1} for {comment_id[:8]} due to: {str(e)[:100]}")
                    await asyncio.sleep(2)
                else:
                    # 最终失败，标记为 failed
                    print(f"❌ Final Failure {comment_id[:8]}: {str(e)}")
                    try:
                        supabase.table("comments").update({
                            "enrichment_status": "failed"
                        }).eq("id", comment_id).execute()
                    except Exception as update_error:
                        print(f"⚠️ Failed to update status to failed: {update_error}")
                    raise  # 重新抛出异常以便统计

async def main(post_limit: Optional[int] = None, comment_limit: Optional[int] = None):
    """主函数：使用 enrichment_status 字段进行增量处理"""
    print(f"🚀 Starting Incremental Processing (DeepSeek-V3) - Status-Based Mode")
    print("="*60)
    
    # 1. 直接查询状态为 pending 的评论（极速查询，有索引支持）
    try:
        print("🔍 Querying pending comments...")
        all_pending_comments = []
        offset = 0
        page_size = 100
        
        while True:
            page_res = supabase.table("comments") \
                .select("id, content, post_id") \
                .eq("enrichment_status", "pending") \
                .gt("content", "") \
                .range(offset, offset + page_size - 1) \
                .execute()
            
            batch = page_res.data
            # 过滤：内容长度 > 5
            filtered_batch = [c for c in batch if c.get('content') and len(c['content']) > 5]
            all_pending_comments.extend(filtered_batch)
            
            if len(batch) < page_size:
                break
            
            offset += page_size
            if offset % 500 == 0:
                print(f"  📥 Fetched {len(all_pending_comments)} pending comments so far...")
        
        print(f"💡 Found {len(all_pending_comments)} pending comments in total.")
        
        # 应用评论数量限制（用于测试）
        if comment_limit and len(all_pending_comments) > comment_limit:
            all_pending_comments = all_pending_comments[:comment_limit]
            print(f"🧪 Test Mode: Limited to {comment_limit} comments.")
        
    except Exception as e:
        print(f"❌ Failed to fetch pending comments: {e}")
        return
    
    if not all_pending_comments:
        print("\n✨ No pending comments found. All caught up!")
        return
    
    # 2. 按 post_id 分组（保持原有的组织逻辑）
    from collections import defaultdict
    comments_by_post = defaultdict(list)
    for comment in all_pending_comments:
        comments_by_post[comment['post_id']].append(comment)
    
    # 3. 获取帖子标题（用于显示）
    post_ids = list(comments_by_post.keys())
    if post_limit:
        post_ids = post_ids[:post_limit]
        print(f"🧪 Test Mode: Limited to {post_limit} posts.")
    
    print(f"\n📊 Processing {len(post_ids)} posts with pending comments...")
    print("="*60)
    
    total_processed = 0
    total_failed = 0
    semaphore = asyncio.Semaphore(10)
    
    for idx, post_id in enumerate(post_ids):
        comments = comments_by_post[post_id]
        
        # 获取帖子标题
        try:
            post_info = supabase.table("production_posts").select("title_en").eq("id", post_id).limit(1).execute()
            post_title = post_info.data[0].get("title_en", "Untitled")[:30] if post_info.data else "Unknown"
        except:
            post_title = "Unknown"
        
        print(f"\n📦 [{idx+1}/{len(post_ids)}] Post: {post_title}... ({post_id})")
        print(f"  📝 Processing {len(comments)} pending comments...")
        
        # 4. 并发处理评论
        tasks = [process_comment(c, semaphore) for c in comments]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        success_count = sum(1 for r in results if r is None)
        fail_count = len(comments) - success_count
        
        total_processed += success_count
        total_failed += fail_count
        
        print(f"  ✅ Post Completed: {success_count} success, {fail_count} failed.")
    
    # 5. 最终统计
    print("\n" + "="*60)
    print("🏁 Processing Complete!")
    print("="*60)
    print(f"📈 Successfully Processed: {total_processed}")
    print(f"📉 Failed: {total_failed}")
    
    # 6. 显示当前状态分布
    try:
        print("\n📊 Current Status Distribution:")
        for status in ["pending", "processing", "completed", "failed"]:
            count = supabase.table("comments") \
                .select("id", count="exact") \
                .eq("enrichment_status", status) \
                .execute().count
            print(f"   {status.capitalize()}: {count}")
    except Exception as e:
        print(f"⚠️ Could not fetch status distribution: {e}")
    
    print("="*60)

if __name__ == "__main__":
    # 使用新的参数：post_limit 和 comment_limit
    # post_limit: 限制处理的帖子数量
    # comment_limit: 限制处理的评论总数
    # asyncio.run(main(post_limit=None, comment_limit=50))  # 测试：处理 50 条评论
    asyncio.run(main(post_limit=10))
