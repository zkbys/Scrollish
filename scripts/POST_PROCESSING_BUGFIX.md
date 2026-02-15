# Production Posts 处理脚本 - Bug修复说明

## 🐛 已修复的主要问题

### 1. **RLS权限问题** (最关键)
**问题**: 使用 `SUPABASE_KEY` (anon key) 无法更新 `production_posts` 表，返回空数组。

**原因**: Supabase 的 Row Level Security (RLS) 策略限制了匿名用户的写入权限。

**解决方案**: 
```python
# 优先使用 SERVICE_ROLE_KEY 以绕过 RLS 限制
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
```

**你需要做的**:
1. 前往 Supabase Dashboard → Settings → API
2. 找到 `service_role` secret (通常隐藏，需点击 "Reveal" 查看)
3. 将其添加到 `.env` 文件:
```bash
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ey...
```

⚠️ **注意**: SERVICE_ROLE_KEY 拥有完全数据库访问权限，**不要泄露或提交到Git**。

---

### 2. **Server断连错误**
**问题**: 长时间运行时出现 `httpcore.RemoteProtocolError: Server disconnected`

**解决方案**: 
- 添加了自动重试机制，带指数退避策略
- 所有数据库更新操作都包裹在 `retry_db_operation` 中
- 最多重试3次，每次延迟递增 (1s, 2s, 4s)

```python
async def retry_db_operation(operation, max_retries=3):
    for attempt in range(max_retries):
        try:
            return operation()
        except Exception as e:
            if attempt < max_retries - 1:
                await asyncio.sleep(2 ** attempt)  # 指数退避
            else:
                raise e
```

---

### 3. **空内容批量更新失败**
**问题**: `.or_()` 复杂查询语法在某些情况下不被支持。

**解决方案**: 
- 改为分两次查询：先找出所有空内容的帖子ID
- 再逐个更新（效率稍低，但稳定性大幅提升）

```python
# 查询 null 内容
empty_posts = supabase.table("production_posts").select("id").is_("content_en", "null").execute()
# 查询空字符串
empty_posts_2 = supabase.table("production_posts").select("id").eq("content_en", "").execute()
# 合并并逐个更新
for empty_id in all_empty_ids:
    await retry_db_operation(...)
```

---

### 4. **错误处理不完善**
**新增内容**:
- 所有DB操作都有 try-except 包裹
- 失败时不会导致整个脚本崩溃
- 会打印详细的错误信息，便于调试

---

## 🚀 运行脚本

### 前提条件
1. 确保已在 Supabase 执行 SQL migration:
```bash
# 在 Supabase SQL Editor 中运行
scripts/migrations/add_post_enrichment.sql
```

2. 在 `.env` 文件中添加 SERVICE_ROLE_KEY:
```bash
SUPABASE_SERVICE_ROLE_KEY=<从 Supabase Dashboard 获取>
```

### 执行命令
```bash
python scripts/process_posts.py
```

### 预期输出
```
🚀 Starting Post Enrichment Processing
🧹 Cleaning up empty content posts...
   - Marked 71 empty posts as completed.
📊 Found 14 posts to process.
🔄 Processing Post ed1538c9 (11 segments)...
✅ Finished Post ed1538c9
```

---

## 📋 TODO (可选优化)

1. **添加进度条**: 使用 `tqdm` 显示处理进度
2. **断点续传**: 记录处理进度，脚本中断后可继续
3. **并发优化**: 根据API限流调整 `Semaphore(5)` 的值
4. **日志系统**: 使用 `logging` 模块替代 `print`

---

## 🔍 验证脚本运行正常

运行以下测试脚本确认权限正常：
```bash
python scripts/test_update.py
```

预期输出:
```
Attempting to update post ed1538c9-950f-432b-aef2-cd3087096a67...
Update response data: [{'id': 'ed1538c9...', 'enrichment_status': 'completed', ...}]
SUCCESS: Row updated.
```
