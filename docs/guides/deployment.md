# 部署指南

## 开发环境

```bash
# 启动基础设施（PG + Redis + Qdrant）
docker compose -f docker-compose.dev.yml up -d

# 后端（热重载）
cd backend && uvicorn app.main:app --reload

# 前端（热重载）
cd frontend && pnpm dev

# Celery Worker
cd backend && celery -A app.workers.celery_app worker --loglevel=info
```

## 生产环境（Docker Compose）

### 1. 配置环境变量

```bash
# 创建生产环境配置
cp backend/.env.example backend/.env
# 必须修改以下配置：
# - POSTGRES_PASSWORD（强密码）
# - REDIS_PASSWORD（强密码）
# - SECRET_KEY（随机字符串）
# - OPENAI_API_KEY
# - ANTHROPIC_API_KEY
# - QDRANT_API_KEY
```

### 2. 构建 & 启动

```bash
# 构建所有镜像
docker compose build

# 启动所有服务
docker compose up -d

# 查看日志
docker compose logs -f

# 检查服务状态
docker compose ps
```

### 3. 初始化

```bash
# 运行数据库迁移
docker compose exec backend alembic upgrade head

# 创建管理员账户
docker compose exec backend python -m app.scripts.create_admin
```

## 生产环境（Kubernetes）

> 待补充 K8s manifests

## 监控

### 健康检查端点

```
GET /api/v1/health          # 后端整体状态
GET /api/v1/health/db       # 数据库连接
GET /api/v1/health/redis    # Redis 连接
GET /api/v1/health/qdrant   # Qdrant 连接
```

### 日志

```bash
# 查看所有服务日志
docker compose logs -f

# 查看特定服务
docker compose logs -f backend
docker compose logs -f worker
docker compose logs -f frontend
```

## 备份

```bash
# 备份 PostgreSQL
docker compose exec postgres pg_dump -U engi engi_intel > backup_$(date +%Y%m%d).sql

# 备份 Qdrant
# 参考 Qdrant 快照文档
```
