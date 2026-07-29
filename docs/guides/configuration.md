# 配置说明

## 环境变量

### 后端 (backend/.env)

```bash
# ==================== 数据库 ====================
DATABASE_URL=postgresql+asyncpg://engi:password@localhost:5432/engi_intel

# ==================== Redis ====================
REDIS_URL=redis://localhost:6379/0

# ==================== Qdrant 向量数据库 ====================
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=your-qdrant-api-key

# ==================== LLM 配置 ====================
# OpenAI
OPENAI_API_KEY=sk-xxx
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o

# Anthropic
ANTHROPIC_API_KEY=sk-ant-xxx
ANTHROPIC_BASE_URL=https://api.anthropic.com
ANTHROPIC_MODEL=claude-sonnet-4-20250514

# 多模态大模型（用于代码截图分析等）
MULTIMODAL_MODEL=gpt-4o
MULTIMODAL_API_KEY=sk-xxx
MULTIMODAL_BASE_URL=https://api.openai.com/v1

# ==================== 应用配置 ====================
SECRET_KEY=your-secret-key-min-32-chars
ENVIRONMENT=development  # development / production
DEBUG=true
LOG_LEVEL=INFO

# ==================== 分析配置 ====================
# 分析范围默认值
DEFAULT_ANALYSIS_MONTHS=6
DEFAULT_BRANCHES=main,develop

# AI 审查采样数量
AI_REVIEW_SAMPLE_SIZE=50

# 代码图谱最大文件数
CODE_GRAPH_MAX_FILES=1000
```

### 前端 (frontend/.env)

```bash
# API 地址
VITE_API_BASE_URL=http://localhost:8000

# 可选：Sentry DSN
VITE_SENTRY_DSN=
```

## LLM 调用策略

系统内部按任务类型自动选择模型：

| 任务 | 模型 | 原因 |
|------|------|------|
| 代码审查 | Claude Sonnet | 代码理解能力强 |
| 安全审计 | GPT-4o | 安全知识全面 |
| 模块文档生成 | Claude Sonnet | 文档质量高 |
| 评论质量评估 | GPT-4o-mini | 简单分类任务，节省成本 |
| 多模态分析 | GPT-4o | 支持图片输入 |

## 性能调优

### Celery Worker

```python
# 根据服务器配置调整并发数
CELERY_WORKER_CONCURRENCY=4      # CPU 核心数
CELERY_TASK_TIME_LIMIT=3600      # 单任务最大时间（秒）
CELERY_TASK_SOFT_TIME_LIMIT=3000 # 软超时
```

### Qdrant

```python
# 向量维度配置
EMBEDDING_DIMENSION=1536  # text-embedding-3-small
# 如果使用其他 Embedding 模型，调整此值
```
