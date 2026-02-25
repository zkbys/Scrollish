/**
 * 头像图片批量压缩脚本
 * 将 public/avatars 中的所有 PNG 转换为 WebP 格式
 * 同时保留原始 PNG 文件名（以 .png 结尾），但实际内容为 WebP
 * 这样无需修改代码中的引用路径
 */
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const AVATARS_DIR = path.join(PROJECT_ROOT, 'public', 'avatars');
const BACKUP_DIR = path.join(PROJECT_ROOT, 'public', 'avatars_original_backup');
const TARGET_SIZE = 256; // 最大宽高
const QUALITY = 80; // WebP 质量

async function compressAvatars() {
    // 创建备份目录
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const files = fs.readdirSync(AVATARS_DIR).filter(f => f.endsWith('.png'));
    console.log(`找到 ${files.length} 个 PNG 文件，开始压缩...\\n`);

    let totalOriginal = 0;
    let totalCompressed = 0;

    for (const file of files) {
        const inputPath = path.join(AVATARS_DIR, file);
        const backupPath = path.join(BACKUP_DIR, file);
        const outputPath = path.join(AVATARS_DIR, file); // 覆盖原文件

        const originalSize = fs.statSync(inputPath).size;
        totalOriginal += originalSize;

        // 备份原文件
        fs.copyFileSync(inputPath, backupPath);

        // 压缩为 WebP（保留 .png 文件名以避免修改代码引用）
        await sharp(inputPath)
            .resize(TARGET_SIZE, TARGET_SIZE, {
                fit: 'cover',
                position: 'centre'
            })
            .webp({ quality: QUALITY })
            .toFile(outputPath + '.tmp');

        // 替换原文件
        fs.unlinkSync(outputPath);
        fs.renameSync(outputPath + '.tmp', outputPath);

        const compressedSize = fs.statSync(outputPath).size;
        totalCompressed += compressedSize;
        const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);

        console.log(`✅ ${file.padEnd(20)} ${(originalSize / 1024).toFixed(0).padStart(5)} KB → ${(compressedSize / 1024).toFixed(0).padStart(5)} KB  (${ratio}% 压缩率)`);
    }

    console.log(`\\n📊 总计: ${(totalOriginal / 1024 / 1024).toFixed(1)} MB → ${(totalCompressed / 1024 / 1024).toFixed(1)} MB  (${((1 - totalCompressed / totalOriginal) * 100).toFixed(1)}% 压缩率)`);
    console.log(`💾 原始文件已备份到: ${BACKUP_DIR}`);
}

compressAvatars().catch(console.error);
