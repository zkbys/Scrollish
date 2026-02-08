# Scrollish - 多巴胺英语习得 (Dopamine English Acquisition)

<!-- <div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div> -->

## 📖 产品定位：多巴胺学习 (Dopamine Learning)

**Scrollish** 是我们产品的 MVP 版本（PWA应用）。我们的核心定位是 **“多巴胺学习”**：旨在将用户对小红书、抖音等短视频平台的“刷屏成瘾”，转移到 Reddit 等英文互联网内容上。我们希望用户能够 **“爽着、刷着、不知不觉地习得英文”**。

这不是一个严肃痛苦的学习工具，而是一个让你在“吃瓜”和娱乐中自然吸收英语的窗口。

## 💡 核心理念 (Core Philosophy)

我们致力于打造一种 **“不正经”的英语学习新思路**：
1.  **立足英文互联网**：以 Reddit 为 MVP 起点，未来通过 AI 赋能，辐射整个英文互联网内容。
2.  **“娱乐化”为载体**：拒绝枯燥的说教，通过有趣的真实语料和社区讨论吸引用户。
3.  **“习得”而非“学习”**：强调在真实语境中的潜移默化（Acquisition），而非应试教育式的死记硬背（Learning）。
4.  **良药亦可甜口**：学习不应该总是苦差事，Scrollish 就是那层让知识好入口的“糖衣”。

## 🚀 为什么选择 Scrollish？ (Why Scrollish?)

有人可能会问：*“这和直接装个浏览器插件刷 Reddit 有什么区别？”* 
Scrollish 的独特价值在于它专为**英语习得**打造的六大核心特性，这是普通客户端或插件无法比拟的：

### 1. 📱 TikTok 式无限流体验 (Infinite Scroll)
我们包装成符合现代网民习惯的 **无限刷流（Infinite Feed）** 交互。利用碎片化时间，像刷短视频一样刷英文帖子，降低心理启动门槛。

### 2. 🧠 潜移默化的“内容替换”
我们在尊重用户习惯的基础上，将原本消耗在中文娱乐内容上的时间，无缝替换为英文内容。用户在满足娱乐需求的同时，完成了语言环境的沉浸。

### 3. 💬 特色“唠嗑群”式评论区 (Chat-style Comments)
针对 Reddit 原生树状评论区阅读困难（“堆成一坨”）的痛点，我们将评论区改造为 **线性的“唠嗑群”模式**。
*   用户可以像看群聊一样轻松“潜水吃瓜”。
*   这种熟悉的交互不仅降低了阅读压力，更让用户卸下对英语阅读理解的防御机制，用“好奇吃瓜脑”去接触真实的英文语料。

### 4. 🛠️ 专为习得打造的 AI 辅助 (Learning-First Tools)
整个 App 的交互细节均为学习服务：
*   **点击查词**：即点即查，无缝阅读。
*   **长按翻译**：搞不懂的句子一键 AI 解析。
*   **引用追问**：对内容有疑问？直接 AI 追问，把语料吃透。

### 5. 🔄 算法驱动的复习机制 (Spaced Repetition)
用户只管轻松刷，遗忘复习的问题交给我们。我们会在首页 Feed 流中 **自动穿插复习** 用户收藏或查询过的单词/内容，利用算法对抗遗忘曲线，无需刻意背单词。

### 6. 📊 量化你的进步 (Quantified Self)
类似“微信读书”的记录机制，我们会记录用户的浏览时长、阅读轨迹和学习行为，帮助用户看见自己的积累和成长。

## 🔬 市场与竞品调研 (Market & Research)

我们调研发现：
*   **用户需求真实存在**：大量用户认可“刷 Reddit 学英语”的思路，小红书上搬运 Reddit 内容的账号数据优异。
*   **竞品缺位**：
    *   **Apollo / Narwhal 等**：本质上只是优秀的 Reddit **新闻/社区客户端**，定位是“看帖”。
    *   **Scrollish**：定位是 **学习类应用**。Reddit 只是我们的 MVP 内容源，我们的视角是整个英文互联网的优质内容。

## 💻 本地运行 (Run Locally)

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`

2. Set the `VITE_SILICONFLOW_API_KEY` in [.env](.env) to your Silicon API Key. Similar to `.env.example`.

3. Run the app:
   `npm run dev`

