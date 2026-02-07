import asyncio
import os
from playwright.async_api import async_playwright

# 你的 HTML 文件名
HTML_FILENAME = "xhs_promote/detail.html"

async def capture_cards():
    # 获取 HTML 文件的绝对路径
    file_path = os.path.abspath(HTML_FILENAME)
    
    async with async_playwright() as p:
        print("正在启动浏览器...")
        browser = await p.chromium.launch(headless=True)
        
        # 关键设置：device_scale_factor=3 
        # 这就像是用一台 3倍分辨率的手机去浏览，能保留所有微小的文字和边框细节
        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            device_scale_factor=3.0 
        )
        page = await context.new_page()

        print(f"正在加载页面: {HTML_FILENAME} ...")
        await page.goto(file_path)
        
        # 等待页面完全加载（确保字体和本地图片都渲染完毕）
        # 如果你的图片很大，可以适当增加 timeout
        await page.wait_for_load_state("networkidle")
        
        # 定义要截图的卡片 ID (对应 HTML 中的 id)
        card_ids = [
            "card-1", # Hook
            "card-2", # Contrast
            "card-3", # Content
            "card-4", # Interaction
            "card-5"  # Chat
        ]

        # 创建输出目录
        output_dir = "output_cards"
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)

        print("开始截图...")
        
        for card_id in card_ids:
            # 定位卡片元素
            locator = page.locator(f"#{card_id}")
            
            # 检查元素是否存在
            if await locator.count() > 0:
                # 截图并保存
                # type='png' 保证无损，omit_background=True 保证圆角外的背景透明
                await locator.screenshot(
                    path=f"{output_dir}/{card_id}.png", 
                    type="png", 
                    omit_background=True
                )
                print(f"✅ 已保存: {output_dir}/{card_id}.png")
            else:
                print(f"⚠️ 未找到 ID 为 {card_id} 的卡片")

        await browser.close()
        print("🎉 全部完成！")

if __name__ == "__main__":
    asyncio.run(capture_cards())