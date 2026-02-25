/**
 * TTS 等级 (0.1 - 1.0) 与 阿里 API 倍率 (0.5 - 2.0) 的映射工具
 * 标准 0.5 级 = 1.0x
 */

/**
 * 将等级 (0.1 - 1.0) 转换为 API 倍率 (0.5 - 2.0)
 */
export const toMultiplier = (level: number) => {
    // 分段线性映射：
    // [0.1, 0.5] -> [0.5, 1.0] (斜率 1.25)
    // [0.5, 1.0] -> [1.0, 2.0] (斜率 2.0)
    return level < 0.5 ? 1.25 * level + 0.375 : 2 * level;
};

/**
 * 将 API 倍率 (0.5 - 2.0) 转换为等级 (0.1 - 1.0)
 */
export const toLevel = (multiplier: number) => {
    return multiplier < 1.0 ? (multiplier - 0.375) / 1.25 : multiplier / 2.0;
};
