# 快速开始

## 前置条件

- Docker & Docker Compose
- Node.js >= 18 + pnpm >= 8
- Python >= 3.12
- Git

## 第一步：克隆 & 配置

```bash
git clone <repo-url> && cd engi-intel

# 复制环境变量模板
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 编辑后端配置（必填项）
# - DATABASE_URL: PostgreSQL 连接
# - OPENAI_API_KEY / ANTHROPIC_API_KEY: LLM 密钥
# - QDRANT_URL: 向量数据库地址
```

## 第二步：启动基础设施

```bash
# 启动 PostgreSQL + Redis + Qdrant
make dev
# 或手动:
docker compose -f docker-compose.dev.yml up -d
```

## 第三步：启动后端

```bash
cd backend

# 创建虚拟环境
python -m venv .venv
source .venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 数据库迁移
alembic upgrade head

# 启动 API 服务
uvicorn app.main:app --reload --port 8000

# 另开终端，启动 Celery Worker
celery -A app.workers.celery_app worker --loglevel=info
```

## 第四步：启动前端

```bash
cd frontend

# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
```

## 第五步：接入第一个项目

1. 打开 http://localhost:3000
2. 点击「接入项目」
3. 输入 GitLab 仓库地址和 Access Token
4. 等待分析完成
5. 查看评估报告

## 验证安装

```bash
# 检查后端健康
curl http://localhost:8000/api/v1/health

# 检查数据库
curl http://localhost:8000/api/v1/projects

# 检查 Qdrant
curl http://localhost:6333/healthz
```

## 常见问题

### Q: Celery Worker 无法连接 Redis
确保 Redis 已启动且密码正确。开发模式下 Redis 无密码。

### Q: 前端 API 请求失败
检查 `frontend/.env` 中的 `VITE_API_BASE_URL` 是否正确。

### Q: tree-sitter 编译失败
确保安装了 gcc/g++ 和 Python 开发头文件。
