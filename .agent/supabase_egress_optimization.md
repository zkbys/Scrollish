# Supabase Cached Egress 优化方案

## 问题诊断

当前Cached Egress使用量: **10.76 GB/月** (超出免费额度 5.76 GB)

### 主要原因分析

#### 1. 数据库查询过度 (占比约 40-50%)
- ✗ 使用 `select('*')` 获取所有字段
- ✗ 没有分页限制或合理的limit
- ✗ 重复查询相同数据,缺少缓存

#### 2. Enrichment 数据量大 (占比约 30-40%)
- 每条评论的enrichment数据包含:
  - sentence_segments (多个句子的双语版本)
  - difficulty_variants (4个难度级别的改写)
  - cultural_notes
- 估算:每条enriched comment约2-5KB

#### 3. 媒体内容引用从数据库返回 (占比约 10-20%)
- image_url, video_url 等字段在每次查询中返回
- 虽然媒体文件本身可能托管在Reddit或其他CDN,但URL仍占用egress

## 🎯 优化方案

### 方案1: 优化数据库查询 (立即可做,影响最大)

#### A. 仅选择必要字段

**当前代码 (Explore.tsx:130)**:
```typescript
let query = supabase.from('production_posts').select('*')
```

**优化后**:
```typescript
// 列表视图只需要这些字段
let query = supabase
  .from('production_posts')
  .select('id, title_en, title_cn, subreddit, image_url, upvotes, comment_count, created_at')
```

**预计节省**: 30-40% egress

#### B. 实现分页和限制

```typescript
// 每次只加载20条
.range(offset, offset + 19)
.limit(20)
```

#### C. 评论数据按需加载

**ChatRoom.tsx优化**:
```typescript
// 第一次只加载基础评论,不加载enrichment
const { data: comments } = await supabase
  .from('comments')
  .select('id, author, content, content_cn, parent_id, depth, upvotes')
  .eq('post_id', postId)

// 只在用户切换难度级别或点击特定评论时加载enrichment
const { data: enrichment } = await supabase
  .from('comments_enrichment')
  .select('*')
  .eq('comment_id', commentId)
  .single()
```

**预计节省**: 40-60% egress (ChatRoom是大头)

---

### 方案2: 实现前端缓存 (中期优化)

#### A. 使用localStorage缓存热门数据

```typescript
// 缓存热门帖子列表
const CACHE_KEY = 'trending_posts'
const CACHE_DURATION = 5 * 60 * 1000 // 5分钟

const getCachedPosts = () => {
  const cached = localStorage.getItem(CACHE_KEY)
  if (!cached) return null
  
  const { data, timestamp } = JSON.parse(cached)
  if (Date.now() - timestamp > CACHE_DURATION) return null
  
  return data
}

const setCachedPosts = (data) => {
  localStorage.setItem(CACHE_KEY, JSON.stringify({
    data,
    timestamp: Date.now()
  }))
}
```

#### B. 使用IndexedDB缓存enrichment数据

enrichment数据不常变化,可以长期缓存:
- 首次加载后存入IndexedDB
- 7天过期时间
- 用户清除缓存时删除

**预计节省**: 20-30% egress

---

### 方案3: 后端优化 (长期方案)

#### A. 创建轻量级视图(View)

在Supabase中创建专门的视图,只返回列表所需字段:

```sql
CREATE VIEW production_posts_list AS
SELECT 
  id,
  title_en,
  title_cn,
  subreddit,
  image_url,
  upvotes,
  comment_count,
  created_at
FROM production_posts;
```

前端查询:
```typescript
supabase.from('production_posts_list').select('*')
```

#### B. 实现服务端分页API

创建Edge Function来控制数据传输:

```typescript
// supabase/functions/get-posts/index.ts
const posts = await supabaseClient
  .from('production_posts')
  .select('id, title_en, title_cn, subreddit, image_url')
  .range(offset, offset + limit - 1)

return new Response(JSON.stringify(posts), {
  headers: { 
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=300' // 5分钟缓存
  }
})
```

---

### 方案4: 评论Enrichment按需加载策略

#### 当前问题:
ChatRoom加载所有评论的完整enrichment数据

#### 优化策略:

1. **懒加载enrichment**:只为可见的评论加载enrichment
2. **难度级别按需加载**:用户选择"Basic"时,只加载Basic变体
3. **压缩cultural_notes**:只在用户点击灯泡图标时加载

**实现示例**:
```typescript
// 只加载当前可见评论的enrichment
const visibleCommentIds = getVisibleComments().map(c => c.id)

const { data } = await supabase
  .from('comments_enrichment')
  .select(`
    comment_id,
    ${difficulty !== 'Original' ? `difficulty_variants->${difficulty}` : ''},
    cultural_notes
  `)
  .in('comment_id', visibleCommentIds)
```

**预计节省**: 50-70% ChatRoom的egress

---

## 📈 预期效果

| 优化方案              | 预计节省 | 实施难度 | 优先级 |
| --------------------- | -------- | -------- | ------ |
| 方案1A: 精简查询字段  | 30-40%   | 低       | ⭐⭐⭐    |
| 方案1B: 分页限制      | 10-15%   | 低       | ⭐⭐⭐    |
| 方案1C: 评论按需加载  | 40-60%   | 中       | ⭐⭐⭐    |
| 方案2: 前端缓存       | 20-30%   | 中       | ⭐⭐     |
| 方案3: 后端优化       | 15-25%   | 高       | ⭐      |
| 方案4: Enrichment优化 | 50-70%   | 中       | ⭐⭐⭐    |

**综合优化后预计总节省**: 60-80%

**目标**: 将月使用量从 10.76GB 降至 2-4GB (在免费额度内)

---

## 🚀 实施优先级

### 第一阶段 (立即执行,1-2天)
1. ✅ 修改所有`.select('*')`为精简字段
2. ✅ ChatRoom评论列表与enrichment分离加载
3. ✅ 添加分页限制

### 第二阶段 (1周内)
1. ✅ 实现前端localStorage缓存
2. ✅ Enrichment按需加载(只加载当前难度级别)
3. ✅ 图片懒加载优化

### 第三阶段 (可选,长期)
1. 创建数据库视图
2. 实现Edge Function API
3. 考虑使用CDN缓存静态数据

---

## 📝 监控建议

1. **Supabase Dashboard**:
   - 每日检查Cached Egress趋势
   - 关注SQL查询性能

2. **日志记录**:
   - 记录每次大数据查询的耗时和数据量
   - 设置告警阈值

3. **用户行为分析**:
   - 统计哪些页面/功能产生最多流量
   - 优先优化高频功能
