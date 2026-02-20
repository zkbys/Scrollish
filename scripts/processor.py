import os
import httpx
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SILICONFLOW_API_KEY = os.getenv("SILICONFLOW_API_KEY")

from utils.logger import processor_logger
from core.crawlers.reddit_comment_crawler import process_comments_for_post

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def ask_deepseek(prompt):
    """调用 硅基流动(SiliconFlow) API 处理内容"""
    if not SILICONFLOW_API_KEY:
        processor_logger.warning("未配置 SILICONFLOW_API_KEY，跳过 AI 处理")
        return None

    processor_logger.info("正在调用 硅基流动 API (DeepSeek-V3)...")
    url = "https://api.siliconflow.cn/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {SILICONFLOW_API_KEY}",
        "Content-Type": "application/json"
    }
    data = {
        "model": "deepseek-ai/DeepSeek-V3",
        "messages": [{"role": "user", "content": prompt}],
        "response_format": {"type": "json_object"} # 强制返回 JSON
    }
    
    try:
        with httpx.Client(timeout=60.0) as client:
            response = client.post(url, headers=headers, json=data)
            response.raise_for_status()
            content = response.json()['choices'][0]['message']['content']
            import json
            return json.loads(content)
    except Exception as e:
        processor_logger.error(f"AI 调用失败: {repr(e)}")
        return None

def ask_siliconflow_image(image_prompt):
    """调用硅基流动生成插画 (改用更稳定的 FLUX 模型)"""
    api_key = os.getenv("SILICONFLOW_API_KEY")
    if not api_key:
        processor_logger.warning("未配置 SILICONFLOW_API_KEY，跳过生图")
        return None
        
    processor_logger.info(f"正在调用硅基流动 (FLUX) 生成图片...")
    url = "https://api.siliconflow.cn/v1/images/generations"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    # FLUX.1-schnell 是目前性能最强且稳定的选择
    data = {
        "model": "black-forest-labs/FLUX.1-schnell", 
        "prompt": f"A cinematic, photorealistic shot. Subject: {image_prompt}. Shot on 35mm lens, dramatic lighting, depth of field, highly detailed, 8k resolution, masterpiece, cinematic color grading.",
        "image_size": "1024x1024",
        "num_inference_steps": 4 # Flux schnell 只需要 4 步，速度极快
    }
    try:
        with httpx.Client(timeout=120.0) as client:
            response = client.post(url, headers=headers, json=data)
            response.raise_for_status()
            return response.json()['images'][0]['url']
    except Exception as e:
        processor_logger.error(f"硅基流动生图失败: {e}")
        if hasattr(e, 'response'):
             processor_logger.error(f"错误详情: {e.response.text}")
        return None

def upload_image_to_storage(image_url, post_id):
    """
    下载图片并上传到 Supabase Storage，返回永久公开链接
    storage bucket: 'post-images' (需要先在 Supabase 创建)
    """
    import uuid
    
    if not image_url:
        return None
    
    processor_logger.info(f"正在持久化图片到 Storage...")
    
    try:
        # 1. 下载图片
        with httpx.Client(timeout=60.0) as client:
            response = client.get(image_url)
            response.raise_for_status()
            image_data = response.content
            content_type = response.headers.get('content-type', 'image/png')
        
        # 2. 确定文件扩展名
        ext = 'png'
        if 'jpeg' in content_type or 'jpg' in content_type:
            ext = 'jpg'
        elif 'gif' in content_type:
            ext = 'gif'
        elif 'webp' in content_type:
            ext = 'webp'
        
        # 3. 生成唯一文件名
        file_name = f"{post_id}_{uuid.uuid4().hex[:8]}.{ext}"
        file_path = f"generated/{file_name}"
        
        # 4. 上传到 Supabase Storage
        result = supabase.storage.from_('post-images').upload(
            path=file_path,
            file=image_data,
            file_options={"content-type": content_type}
        )
        
        # 5. 获取公开 URL
        public_url = supabase.storage.from_('post-images').get_public_url(file_path)
        processor_logger.info(f"图片已上传: {file_name}")
        return public_url
        
    except Exception as e:
        processor_logger.error(f"图片上传失败: {e}")
        return None


def process_approved_posts():
    # 每次处理 50 条 Approved 帖子，兼顾内容量与 AI 成本
    res = supabase.table("staging_posts")\
        .select("*, communities(category_id)")\
        .eq("status", "approved")\
        .limit(100)\
        .execute()
    posts = res.data
    
    if not posts:
        print("没有可处理的 Approved 帖子。")
        return

    from core.crawlers.reddit_comment_crawler import validate_and_extract_comment_tree

    for post in posts:
        print(f"正在分析: {post['title'][:30]}...")
        
        # --- 优化点 1: 断点续传检查 ---
        res_check = supabase.table("production_posts").select("id").eq("original_id", post['id']).execute()
        existing_prod = res_check.data[0] if res_check.data else None
        
        prod_id = None
        scanned_tree = None
        
        if existing_prod:
            prod_id = existing_prod['id']
            processor_logger.info(f"检测到该帖已存在于生产池 (ID: {prod_id})，将尝试补全评论。")
        else:
            # --- 优化点 2: 优先进行评论深度探测 (Pre-Scan) ---
            # 只有通过了评论结构校验，才去浪费钱调 AI
            status, scanned_tree = validate_and_extract_comment_tree(post['reddit_id'])
            
            if status == -1:
                processor_logger.warning(f"由于网络问题，暂时跳过帖子 {post['reddit_id']}")
                continue
            elif status == 0:
                processor_logger.warning(f"帖子 {post['reddit_id']} 互动深度不足，直接拒绝。")
                supabase.table("staging_posts").update({"status": "rejected"}).eq("id", post['id']).execute()
                continue
            
            # --- 正常 AI 加工逻辑 ---
            # 准备 Prompt
            prompt = f"""你是一个英语学习助手。请处理以下 Reddit 帖子内容：
标题: {post['title']}
社区: {post['subreddit']}
内容: {post['selftext'][:1000]}

任务：
1. 如果原标题无效或缺失,请基于内容生成一个 15 字以内的简洁英文标题。
2. 将标题翻译成中文。
3. 为英语学习者提供高质量的全文正文译文。
4. 根据内容内容和分类，生成一段 FLUX 图像生成提示词（英文，100 字内）。

请根据内容主题选择对应的视觉风格：
- Story → 电影感：叙事性强，情绪饱满，光影对比，人物剪影或特写 (无真人面部)
- Info → 图解感：清晰直观，扁平化，信息图表风格，简约现代
- 科技/编程 → 未来感：深蓝/紫色渐变背景，几何线条，全息光效，简约图标
- 生活/情感 → 温暖感：柔和暖色调，生活场景，故事氛围
- 其他 → 简约感：扁平插画，渐变背景，居中主体，通用适配

通用要求：无文字水印，无真人面部特写，适合手机竖屏展示，画面干净主体突出。

请严格按此 JSON 格式返回：
{{
    "title_en": "生成的英文标题",
    "title_cn": "生成的中文标题",
    "content_cn": "全文译文",
    "image_prompt": "FLUX prompt in English, following the style guide above..."
}}
"""
            result = ask_deepseek(prompt)
            if not result:
                processor_logger.error(f"跳过该帖: AI 响应异常")
                continue

            # 媒体处理
            image_url = None
            image_type = "original"
            video_url = post.get('video_url')

            raw_json = post['raw_json']
            url = raw_json.get('url', '')
            if any(url.lower().endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.gif']):
                image_url = url
                persistent_url = upload_image_to_storage(image_url, post['id'])
                if persistent_url: image_url = persistent_url
            elif not video_url:
                generated_url = ask_siliconflow_image(result['image_prompt'])
                if generated_url:
                    persistent_url = upload_image_to_storage(generated_url, post['id'])
                    image_url = persistent_url if persistent_url else generated_url
                    image_type = "generated"

            if not image_url and not video_url:
                image_url = f"https://picsum.photos/seed/{post['id']}/800/600"

            content_cn = result['content_cn'] if post['selftext'].strip() else ""
            
            prod_entry = {
                "original_id": post['id'],
                "community_id": post['community_id'],
                "title_en": result['title_en'],
                "title_cn": result['title_cn'],
                "summary_en": "",
                "summary_cn": "",
                "content_en": post['selftext'],
                "content_cn": content_cn,
                "image_url": image_url,
                "video_url": video_url,
                "image_type": image_type,
                "subreddit": post['subreddit'],
                "upvotes": post['raw_json'].get('ups', 0)
            }
            
            try:
                res_prod = supabase.table("production_posts").upsert(prod_entry).execute()
                if res_prod.data:
                    prod_id = res_prod.data[0]['id']
            except Exception as e:
                processor_logger.error(f"插入生产池失败: {e}")
                continue

        if prod_id:
            # 使用之前预扫描的结果，避免重复请求 Reddit
            comment_count = process_comments_for_post(prod_id, post['reddit_id'], pre_scanned_tree=scanned_tree)
            
            if comment_count >= 30: # 这里的校验逻辑与获取端的总数保持一致
                supabase.table("staging_posts").update({"status": "auto_approved"}).eq("id", post['id']).execute()
                print(f"✅ 加工完成 (共计 {comment_count} 条高质量评论)")
            else:
                # 状态细化：标记为互动不足
                processor_logger.warning(f"⚠️ 评论数最终校验未通过，标记为互动不足。")
                supabase.table("production_posts").delete().eq("id", prod_id).execute()
                supabase.table("staging_posts").update({"status": "rejected_low_engagement"}).eq("id", post['id']).execute()

if __name__ == "__main__":
    process_approved_posts()
