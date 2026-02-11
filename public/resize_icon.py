import os
from PIL import Image, ImageDraw, ImageChops, ImageOps

def aggressive_crop(img, tolerance=40):
    """ V5版核心：智能去背景，只取图标主体 """
    img = img.convert("RGB")
    bg_color = img.getpixel((0, 0))
    # 如果背景不是白色，尝试获取角落的颜色作为基准
    bg = Image.new("RGB", img.size, bg_color)
    diff = ImageChops.difference(img, bg)
    diff = diff.convert("L")
    # 提高一点容差，确保切得干净
    mask = diff.point(lambda x: 255 if x > tolerance else 0)
    bbox = mask.getbbox()
    if bbox:
        # 为了防止切太紧，往外扩一点点像素
        padding = 2
        left, top, right, bottom = bbox
        width, height = img.size
        left = max(0, left - padding)
        top = max(0, top - padding)
        right = min(width, right + padding)
        bottom = min(height, bottom + padding)
        return img.crop((left, top, right, bottom))
    return img

def apply_squircle_mask(img, size):
    """ 生成透明圆角图标 (适用于 Android/PWA) """
    # 先缩放到略大于目标尺寸，方便后面居中截取，保证比例
    aspect_ratio = img.width / img.height
    if aspect_ratio > 1:
        new_width = size
        new_height = int(size / aspect_ratio)
    else:
        new_height = size
        new_width = int(size * aspect_ratio)
        
    img_resized = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
    
    # 创建透明底画布并居中
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    left = (size - new_width) // 2
    top = (size - new_height) // 2
    canvas.paste(img_resized.convert("RGBA"), (left, top))

    # 创建圆角遮罩
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    radius = int(size * 0.22) # 标准圆角比例
    draw.rounded_rectangle([(0, 0), (size, size)], radius=radius, fill=255)
    
    # 应用遮罩
    canvas.putalpha(mask)
    return canvas

def make_ios_icon_full_bleed(img, size):
    """ 【修正版】生成 iOS 专用图标 (不透明正方形，充满画布，无白边) """
    # iOS 会自动切圆角，所以我们需要提供一个填满的正方形。
    
    # 1. 将裁剪后的主体内容直接缩放到目标尺寸 (正方形)
    # 这里不保持比例，强制拉伸填满，适合本身接近正方形的图标
    # 如果你的图标很长或很扁，这里可能需要改用居中填充策略
    img_resized = img.resize((size, size), Image.Resampling.LANCZOS)

    # 2. 确保不透明 (iOS要求)
    # 如果图像有透明通道，将其混合到白底上
    if img_resized.mode == 'RGBA':
        bg = Image.new("RGB", img_resized.size, (255, 255, 255))
        # 使用自身的 alpha 通道作为 mask 进行合成
        bg.paste(img_resized, mask=img_resized.split()[3])
        return bg
    else:
        return img_resized.convert("RGB")

def generate_pwa_assets():
    # ================= 配置 =================
    image_filename = "哆吧1.png"
    # 裁剪容差
    CROP_TOLERANCE = 50
    # =======================================

    script_dir = os.path.dirname(os.path.abspath(__file__))
    input_path = os.path.join(script_dir, image_filename)
    output_dir = script_dir

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    if not os.path.exists(input_path):
        print(f"❌ 找不到源文件: {image_filename}")
        return

    try:
        with Image.open(input_path) as img:
            print(f"🖼️  正在读取源图...")
            
            # 1. 智能裁剪主体
            print("✂️  正在裁剪主体内容...")
            cropped_img = aggressive_crop(img, tolerance=CROP_TOLERANCE)
            
            # ==========================================
            # 任务 A: Android/PWA (透明圆角) - 保持一致
            # ==========================================
            pwa_sizes = [192, 512]
            for size in pwa_sizes:
                filename = f"pwa-{size}x{size}.png"
                print(f"🔨 生成 {filename} (透明圆角)...")
                icon = apply_squircle_mask(cropped_img, size)
                icon.save(os.path.join(output_dir, filename), "PNG")

            # ==========================================
            # 任务 B: iOS 专用 (为了统一感，我们也给它加一个背景色)
            # ==========================================
            filename = "apple-touch-icon.png"
            print(f"🍎 生成 {filename} (iOS专用)...")
            # iOS 不支持透明，我们直接生成高质量正方形
            ios_icon = make_ios_icon_full_bleed(cropped_img, 180)
            ios_icon.save(os.path.join(output_dir, filename), "PNG")

            # ==========================================
            # 任务 C: Favicon (透明圆角 .ico) - 统一为圆角样式
            # ==========================================
            filename = "favicon.ico"
            print(f"🌐 生成 {filename} (圆角版本)...")
            fav_icon = apply_squircle_mask(cropped_img, 64)
            # 转为 RGB 以便存为 ICO，或者保留 RGBA
            fav_icon.save(os.path.join(output_dir, filename), format='ICO', sizes=[(64, 64)])

            print(f"\n✅ 修复完成！文件已保存在: {output_dir}")
            print("请查看新生成的 apple-touch-icon.png，它现在应该是一个填满的正方形了。")

    except Exception as e:
        print(f"❌ 出错: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    generate_pwa_assets()