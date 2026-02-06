/**
 * 图片预加载工具
 * 用于在页面切换前将关键资源抓取到浏览器缓存
 */
export const preloadImage = (url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (!url) return resolve();
        const img = new Image();
        img.src = url;
        img.onload = () => resolve();
        img.onerror = () => reject();

        // 如果 5 秒还没加载完，也直接 resolve，防止阻塞导航太久
        setTimeout(resolve, 5000);
    });
};

/**
 * 批量预加载图片
 */
export const preloadImages = async (urls: string[]): Promise<void> => {
    const promises = urls.filter(Boolean).map(url => preloadImage(url));
    await Promise.all(promises);
};
