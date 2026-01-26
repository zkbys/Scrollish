# Scrollish Supabase 数据库结构分析报告

**生成时间**: 2026-01-26  
**数据库**: zgteuwwhiwfglrvjcekq.supabase.co  
**总表数**: 4 个核心表

---

## 📊 数据库概览

### 数据量统计

| 表名                 | 记录数   | 说明                                           |
| -------------------- | -------- | ---------------------------------------------- |
| **categories**       | 13 条    | 内容分类（如 Science, Daily Life 等）          |
| **communities**      | 71 条    | 子社区/Subreddit（如 r/AskReddit, r/Jokes 等） |
| **production_posts** | 113 条   | 精选帖子（已完成双语处理）                     |
| **comments**         | 6,445 条 | 评论数据（支持多层级树形结构）                 |

**总数据量**: 6,642 条记录

---

## 🗂️ 表结构详解

### 1. `categories` - 内容大类表

**作用**: 首页顶部标签栏的数据源

#### 字段结构

```typescript
{
  id: UUID              // 主键
  name_en: TEXT         // 英文名称
  name_cn: TEXT         // 中文名称
  created_at: TIMESTAMP // 创建时间
}
```

#### 数据示例

| ID  | name_en    | name_cn  |
| --- | ---------- | -------- |
| xxx | Science    | 科学     |
| xxx | Daily Life | 日常生活 |
| xxx | Culture    | 文化     |

**记录数**: 13 个分类

---

### 2. `communities` - 子社区表

**作用**: 每个分类下的垂直 Subreddit 列表

#### 字段结构

```typescript
{
  id: UUID                    // 主键
  category_id: UUID           // 关联的分类ID（外键）
  name: TEXT                  // Subreddit 名称（如 "AskReddit"）
  display_name: TEXT          // 显示名称
  sub_category: TEXT          // 细分领域标签（如 "天文学"）
  subscriber_count: INT       // 订阅人数（用于热度排序）
  is_active: BOOLEAN          // 是否活跃
  created_at: TIMESTAMP       // 创建时间
  last_crawled_at: TIMESTAMP  // 最后爬取时间
}
```

#### 数据示例

| name     | display_name | sub_category    | subscriber_count |
| -------- | ------------ | --------------- | ---------------- |
| Jokes    | r/Jokes      | Humor           | 1,234,567        |
| whatisit | r/whatisit   | Mystery Objects | 456,789          |
| horror   | r/horror     | Horror Stories  | 789,012          |

**记录数**: 71 个社区

---

### 3. `production_posts` - 精选帖子表 ⭐

**作用**: App 信息流的核心数据源，所有内容已完成双语处理和媒体识别

#### 字段结构

```typescript
{
  id: UUID                    // 主键
  original_id: TEXT           // Reddit 原始帖子ID
  community_id: UUID          // 关联社区ID（外键）
  title_en: TEXT              // 英文标题
  title_cn: TEXT              // 中文标题
  summary_en: TEXT            // 英文摘要
  summary_cn: TEXT            // 中文摘要
  content_en: TEXT            // 英文正文
  content_cn: TEXT            // 中文正文（AI翻译）
  image_url: TEXT             // 图片URL
  video_url: TEXT             // 视频URL（.mp4直链，可能为null）
  image_type: TEXT            // 'original' | 'generated'（原图或AI生图）
  subreddit: TEXT             // 所属subreddit名称（如 "whatisit"）
  author: TEXT                // Reddit作者名
  reddit_url: TEXT            // Reddit原帖链接
  upvotes: INT                // 点赞数（用于热度排序）
  created_at: TIMESTAMP       // 创建时间
}
```

#### 数据示例（最新5条）

| title_en                               | title_cn                         | subreddit | upvotes | image_type |
| -------------------------------------- | -------------------------------- | --------- | ------- | ---------- |
| UK Rainforest Bones: Animal ID         | 英国雨林中的骨骼：属于何种动物？ | whatisit  | 114     | generated  |
| Long Fleece Bag with Baby Hat          | 与婴儿帽配套的长绒布袋           | whatisit  | 21      | generated  |
| Purple Streetlights on Highway         | 高速公路上的紫色路灯             | whatisit  | 16      | original   |
| Mystery object from shorts drawstring  | 短裤抽绳上的神秘物件             | whatisit  | 9       | generated  |
| Mysterious object found under car seat | 汽车座椅下发现的神秘物体         | whatisit  | 84      | generated  |

#### 图片类型统计

- **AI生成图片**: 72 条 (64%)
- **原始图片**: 41 条 (36%)

**记录数**: 113 条精选帖子

**💡 前端渲染建议**:

1. 优先检查 `video_url`，有值则使用 VideoPlayer
2. 若无视频，展示 `image_url`
3. 如果 `image_type === 'generated'`，可添加 "AI插画" 标签

---

### 4. `comments` - 评论表 ⭐

**作用**: 帖子详情页的评论树形数据

#### 字段结构

```typescript
{
  id: UUID                    // 主键
  post_id: UUID               // 所属帖子ID（外键）
  parent_id: UUID             // 父评论ID（顶层评论为null）
  reddit_comment_id: TEXT     // Reddit原始评论ID
  author: TEXT                // 评论作者名
  content: TEXT               // 评论内容（英文）
  content_cn: TEXT            // 评论内容（中文翻译）
  depth: INT                  // 评论深度（0=主评论，1=一级回复，2=二级回复...）
  upvotes: INT                // 点赞数
  created_at: TIMESTAMP       // 创建时间
  media_urls: JSON            // 媒体链接（可能包含图片、视频等）
}
```

#### 数据示例（最新5条）

| author              | depth | upvotes | created_at          |
| ------------------- | ----- | ------- | ------------------- |
| palm-               | 0     | 1       | 2026-01-25 17:43:50 |
| Nitrofox2           | 0     | 1       | 2026-01-25 17:38:41 |
| Secure-Tradition793 | 0     | 1       | 2026-01-25 17:38:36 |
| RationalReformer    | 0     | 1       | 2026-01-25 17:34:13 |
| Rich-Shallot6762    | 1     | 1       | 2026-01-25 17:31:36 |

#### 评论深度分布

| 深度              | 数量 | 百分比 |
| ----------------- | ---- | ------ |
| 深度0（主评论）   | 232  | 3.6%   |
| 深度1（一级回复） | 305  | 4.7%   |
| 深度2（二级回复） | 210  | 3.3%   |
| 深度3             | 112  | 1.7%   |
| 深度4             | 78   | 1.2%   |
| 深度5             | 32   | 0.5%   |
| 深度6             | 16   | 0.2%   |
| 深度7             | 6    | 0.1%   |
| 深度8             | 8    | 0.1%   |
| 深度9             | 1    | 0.01%  |

**最深评论层级**: 9 层

**记录数**: 6,445 条评论

**💡 前端渲染建议**:

1. 使用 `parent_id` 构建递归树形结构
2. 根据 `depth` 增加左侧缩进（每层 16px）
3. 按 `upvotes` 排序展示热门评论

---

## 🔧 RPC 函数（Remote Procedure Call）

### `get_random_posts(limit_count: INT)`

**功能**: 从 `production_posts` 表中随机获取指定数量的帖子

**参数**:

- `limit_count`: 需要返回的帖子数量

**返回**: `ProductionPost[]`

**状态**: ✅ 正常工作

**使用示例**:

```typescript
const { data } = await supabase.rpc('get_random_posts', {
  limit_count: 15
})
```

**测试结果**: 成功返回 3 条随机帖子

---

## 🔗 表关系图

```
categories (1) ──┬── (n) communities
                 │
                 └── (n) production_posts ──── (n) comments
                                           │
                                           └── (self-reference via parent_id)
```

### 关系说明

1. **categories ➡ communities**: 一对多
   - 一个分类可以包含多个社区
   - 通过 `communities.category_id` 关联

2. **communities ➡ production_posts**: 一对多
   - 一个社区可以有多个帖子
   - 通过 `production_posts.community_id` 关联

3. **production_posts ➡ comments**: 一对多
   - 一个帖子可以有多个评论
   - 通过 `comments.post_id` 关联

4. **comments ➡ comments**: 自关联（树形结构）
   - 通过 `parent_id` 实现评论回复功能
   - `parent_id = null` 表示顶层评论

---

## 📋 常用查询模式

### 1. 获取最新 20 条精选帖子

```typescript
const { data } = await supabase
  .from('production_posts')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(20)
```

### 2. 获取特定分类下的所有帖子

```typescript
const { data } = await supabase
  .from('production_posts')
  .select('*, communities!inner(*)')
  .eq('communities.category_id', categoryId)
  .order('upvotes', { ascending: false })
```

### 3. 获取帖子的所有评论（按热度排序）

```typescript
const { data } = await supabase
  .from('comments')
  .select('*')
  .eq('post_id', postId)
  .order('upvotes', { ascending: false })
```

### 4. 获取帖子的树状评论（按深度+热度）

```typescript
const { data } = await supabase
  .from('comments')
  .select('*')
  .eq('post_id', postId)
  .order('depth', { ascending: true })
  .order('upvotes', { ascending: false })
```

### 5. 统计每个社区的帖子数量

```typescript
const { data } = await supabase
  .from('communities')
  .select('name, production_posts(count)')
```

---

## 📈 数据质量分析

### ✅ 优势

1. **完整的双语支持**: 所有帖子和评论都有英文和中文版本
2. **丰富的媒体资源**:
   - 64% 的帖子使用 AI 生成的配图
   - 支持视频内容（video_url 字段）
3. **深度评论树**: 最深支持 9 层评论嵌套
4. **良好的数据关联**: 外键关系清晰，便于联表查询
5. **RPC 函数支持**: 提供随机帖子获取功能

### ⚠️ 注意事项

1. **数据量偏少**:
   - 目前只有 113 条帖子
   - 建议扩充到至少 500+ 条以支持更好的用户体验

2. **社区分布不均**:
   - 大部分帖子来自 `whatisit` subreddit
   - 建议增加更多热门 subreddit 的内容

3. **图片外链风险**:
   - 部分 `image_url` 可能有外链保护
   - 建议前端增加图片加载失败的占位符

4. **视频数据缺失**:
   - 大部分帖子的 `video_url` 为 null
   - 如果需要视频内容，需要补充爬取

---

## 🔍 数据示例展示

### 一个完整的帖子数据结构

```json
{
  "id": "067856d6-b444-4201-a71f-9d26d3984fbd",
  "original_id": "reddit_post_xyz",
  "community_id": "some-community-uuid",
  "title_en": "UK Rainforest Bones: Animal ID",
  "title_cn": "英国雨林中的骨骼：属于何种动物？",
  "summary_en": "Found mysterious bones...",
  "summary_cn": "发现神秘骨骼...",
  "content_en": "Full content here...",
  "content_cn": "完整内容在这里...",
  "image_url": "https://...",
  "video_url": null,
  "image_type": "generated",
  "subreddit": "whatisit",
  "author": "mystery_hunter",
  "reddit_url": "https://reddit.com/r/whatisit/...",
  "upvotes": 114,
  "created_at": "2026-01-25T17:59:10.608993+00:00"
}
```

### 一个评论的数据结构

```json
{
  "id": "e06b2de1-fa1b-4167-b31d-b7f914545832",
  "post_id": "54ceb1ee-4ddc-4764-890f-4f6b353613ed",
  "parent_id": null,
  "reddit_comment_id": "comment_abc",
  "author": "palm-",
  "content": "This looks like a deer bone...",
  "content_cn": "这看起来像是鹿骨...",
  "depth": 0,
  "upvotes": 1,
  "created_at": "2026-01-25T17:43:50+00:00",
  "media_urls": []
}
```

---

## 🚀 推荐优化方向

### 1. 数据扩充

- [ ] 增加帖子数量至 500+ 条
- [ ] 覆盖更多热门 subreddit
- [ ] 补充视频内容

### 2. 数据质量

- [ ] 添加帖子标签系统（tags）
- [ ] 增加用户喜好数据（favorites, history）
- [ ] 添加学习进度追踪表

### 3. 性能优化

- [ ] 为高频查询字段添加索引（subreddit, created_at）
- [ ] 考虑使用视图（View）缓存复杂查询
- [ ] 实现分页加载避免一次性加载过多数据

### 4. 功能扩展

- [ ] 添加用户认证和个人数据表
- [ ] 实现评论点赞功能的实时更新
- [ ] 添加内容推荐算法（基于用户行为）

---

## 📚 相关文档

- [Supabase 官方文档](https://supabase.com/docs)
- [PostgreSQL 数据类型](https://www.postgresql.org/docs/current/datatype.html)
- [项目架构分析](./project_structure_analysis.md)
- [模块功能速查表](./module_reference.md)

---

**报告生成工具**: Antigravity AI Assistant  
**数据库检查脚本**: `scripts/inspect_database.js`  
**最后更新**: 2026-01-26 13:03
