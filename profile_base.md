🚀 Scrollish 技术更新摘要 (v3.0)
更新说明：本次更新完成了核心“数据库地基”的搭建及“个人中心”的实时化对接，正式引入了用户成长系统。

1. 📂 数据库 Schema 升级 (Supabase)
新增及优化的表结构已整合至根目录 
schema.sql
。核心业务表如下：

public.profiles：用户业务主表。包含等级 (level)、总经验 (total_xp)、掌握单词数 (words_count)、连击天数 (current_streak)、打卡时间 (last_streak_at) 等。通过 id 与 Supabase 内置的 auth.users 关联。
public.user_learning_logs：打卡流水表。记录用户每天的学习时长、获取的 XP 等。
public.user_vocabulary：生词本系统。支持艾宾浩斯复习算法所需的 next_review_at 和 mastery_level 字段。
2. ⚡ 前端 Store 扩展 (
useUserStore.ts
)
useUserStore 现在支持以下新状态和方法：

profile: 存储当前登录用户的详细业务数据（类型：any | null）。
fetchProfile()
: [Action] 从 Supabase 加载最新的个人资料并同步到本地 Store。
updateXP(amount)
: [Action] 更新用户 XP 的通用方法。它会自动：
计算新 XP。
计算对应的 Level。
同步到 Supabase。
更新本地 Store 状态。
3. 🎨 UI 变更 (Profile Page)
Profile.tsx
 现已从“静态 Mock 数据”切换为“全量实时数据”：

等级与经验：基于 total_xp 自动计算（公式：LV = floor(sqrt(XP / 100)) + 1）。
进度条：动态显示升级所需 XP 以及当前完成百分比。
统计矩阵：Words、XP、Streak 现均读取自 profile 状态。
生命周期：组件挂载时会自动调用 
fetchProfile()
 以确保数据最新。
4. 🛠️ 给前端开发的 Tip
新用户自动初始化：已部署数据库触发器 on_auth_user_created。新用户在 auth 注册后，对应的 public.profiles 记录会自动生成，前端无需手动插入。
旧账号补全：若老账号没有 profile 记录，请在 SQL Editor 执行 
schema.sql
 最后的补全脚本。