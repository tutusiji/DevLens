# DevLens

> 面向研发团队的工程智能评估平台：将 **Git 仓库、技术规范和人员贡献** 转化为项目健康度、技术风险与团队能力洞察。

DevLens 的定位是辅助工程决策与团队成长，而不是单一 KPI 考核工具。系统从代码库和 Git 历史中采集证据，结合可配置规则、AI 审查和能力标准，提供可追溯的项目、开发者与团队视图。

## 当前能力

- **项目接入与仓库分析**：导入本地或远程 Git 仓库，采集提交、贡献者、语言、模块、近期变更和内部依赖边。
- **项目评估**：生成项目概览、健康趋势、技术资产、模块风险、AI 洞察和修复优先级。
- **开发者与团队洞察**：基于真实项目贡献进行能力评估、职级阈值对比、团队分析和项目组合比较。
- **规则与能力标准**：管理 Skill 来源、规则、规则组、角色维度和能力标准，并将规则快照保留在分析/评估结果中。
- **环境配置盘点**：扫描仓库中的环境和服务配置，识别中间件与连接信息，并在持久化前脱敏敏感值。
- **代码图谱与语义检索**：从内部依赖边生成项目图谱；可将代码片段向量化后写入 Qdrant，支持语义搜索。
- **组织与权限**：支持租户、成员、团队空间和 RBAC。
- **报告**：支持评估报告导出与导出审计；PDF 导出依赖系统 Chrome/Chromium。

## 系统架构

```mermaid
flowchart TB
    Browser[浏览器]
    Nginx[Nginx HTTPS :7506<br/>生产环境]
    Next[Next.js 15 :3800<br/>React Web 应用]
    Proxy[Next Route Handler<br/>/api/v1/* 代理]
    API[FastAPI :8000<br/>/api/v1]
    PG[(PostgreSQL<br/>业务数据)]
    Qdrant[(Qdrant :6333<br/>代码向量)]
    LLM[DeepSeek<br/>Anthropic-compatible API]
    Git[本地 / 远程 Git 仓库]

    Browser -->|生产访问| Nginx
    Nginx -->|/| Next
    Nginx -->|/api/*| API
    Browser -->|开发环境 /api/v1/*| Next
    Next --> Proxy --> API
    API --> PG
    API -. 可选语义索引 .-> Qdrant
    API -. AI 审查与评估 .-> LLM
    API -->|clone、Git 元数据与源码采样| Git
```

### 请求与分析数据流

1. 浏览器向同源 `/api/v1/*` 发起请求。
2. 在前端开发模式下，Next.js 的 catch-all Route Handler 会将请求转发至 `BACKEND_URL`（默认 `http://127.0.0.1:8000`）。
3. 在生产环境下，Nginx 将 `/api/*` 直接反向代理至 FastAPI，将其余请求交给 Next.js。
4. 项目分析会依次执行：仓库克隆/定位 → Git 与源码采集 → 可选的 Qdrant 代码索引 → LLM 审查 → PostgreSQL 持久化。
5. 项目分析与开发者评估在当前进程中使用 daemon thread 执行，前端通过 REST 接口轮询运行状态与结果。

> 当前实现**没有** Celery、Redis 或独立任务队列；也没有 Docker Compose 作为现行部署路径。

## 技术栈

| 层级 | 技术 | 主要职责 |
| --- | --- | --- |
| Web 前端 | Next.js 15.1、React 19、TypeScript | App Router 页面、API 代理和交互式研发数据界面 |
| UI 与样式 | Tailwind CSS 4、HeroUI 3、Lucide | 设计 token、响应式组件、深浅主题与图标 |
| 可视化 | Recharts、React Flow、ELK.js、Framer Motion | 指标图表、架构拓扑自动布局与动效 |
| API 服务 | Python 3.13+、FastAPI、Pydantic v2、Uvicorn | REST API、路由、输入输出模型和生命周期管理 |
| 数据访问 | SQLAlchemy 2、psycopg2-binary | 同步 ORM、PostgreSQL 连接与会话管理 |
| AI | HTTPX、DeepSeek Anthropic-compatible API | 项目 AI 审查与开发者能力评估 |
| RAG | sentence-transformers、Qdrant | `all-MiniLM-L6-v2` 代码 embedding 与语义检索 |
| 代码采集 | Git CLI、本地文件解析 | 提交/贡献者采集、代码样本与内部依赖边提取 |
| 生产运行 | systemd、Nginx、GitHub Actions | 服务托管、TLS/反向代理与自动部署 |

## 前端架构

前端位于 [`frontend/`](frontend/)，采用 Next.js App Router。

- **页面与路由**：页面位于 [`frontend/app/`](frontend/app/)，覆盖总览、项目、项目组合、开发者、团队、团队空间、仓库接入、规则、模型、向量模型、能力标准、租户权限和架构图谱等场景。
- **应用壳**：[`components/app-shell.tsx`](frontend/components/app-shell.tsx) 提供侧栏、移动端抽屉、面包屑、租户/团队空间切换、命令面板和主题控制。
- **数据访问**：[`lib/api.ts`](frontend/lib/api.ts) 是集中式、带类型的 API facade；领域类型集中在 [`lib/types.ts`](frontend/lib/types.ts)。
- **状态管理**：页面以 `useState`、`useEffect`、`useMemo` 与 `useCallback` 管理局部状态；跨页团队上下文使用 [`TeamSpaceProvider`](frontend/components/team-space-provider.tsx) 的 React Context。主题、当前租户和团队选择持久化在 `localStorage`。
- **图表与图谱**：Recharts 用于指标图；`@xyflow/react` 与 ELK.js 用于架构流程自动布局；另有自定义 SVG 关系图谱画布。
- **UI**：全局样式位于 [`app/globals.css`](frontend/app/globals.css)，以 Tailwind v4 和 HeroUI token 为基础，并提供 glass、Bento 卡片、skeleton、渐变边框等项目级样式；[`components/ui/`](frontend/components/ui/) 是项目内 UI 适配层。

### 真实 API 与 Mock 模式

前端 API 基址由 `NEXT_PUBLIC_API_URL` 控制：

- 配置 `NEXT_PUBLIC_API_URL=/api/v1`：调用真实后端，适用于本地联调与生产构建。
- 未配置该变量：[`lib/api.ts`](frontend/lib/api.ts) 会使用 [`lib/mock-data.ts`](frontend/lib/mock-data.ts) 提供的演示数据，便于纯前端展示。

项目提供的 [`frontend/.env.local`](frontend/.env.local) 已配置：

```env
NEXT_PUBLIC_API_URL=/api/v1
```

浏览器端会从本地存储读取当前用户与租户，并为真实请求添加 `X-DevLens-User-Id` 和 `X-DevLens-Tenant-Id`。Next.js 代理路由会透传这两个身份头至后端。

## 后端架构

后端位于 [`backend/`](backend/)，实际 ASGI 入口为 [`app.main:app`](backend/app/main.py)，并非 [`backend/main.py`](backend/main.py) 中的占位脚本。

### API 与业务模块

所有 REST API 统一使用 `/api/v1` 前缀，健康检查为 `GET /api/v1/health`。路由按业务域拆分在 [`backend/app/routers/`](backend/app/routers/) 中，包括：

- `projects.py`：项目导入、分析运行、项目详情、洞察、修复项、技术资产、身份匹配和代码搜索。
- `overview.py`、`portfolio.py`：总览、趋势、矩阵、活跃度和项目组合比较。
- `developers.py`、`teams.py`、`repos.py`：开发者、团队、团队空间与仓库。
- `skills.py`、`evaluations.py`、`env_inventory.py`：规则编组、能力评估、环境配置盘点。
- `tenants.py`、`reports.py`、`architecture_designs.py`、`config.py`：租户 RBAC、报告、架构设计和模型/向量配置。

应用服务模块位于 [`backend/app/`](backend/app/)：

| 模块 | 职责 |
| --- | --- |
| `analyzer.py` | 编排项目导入分析、代码采样、AI 审查、风险/洞察/评分落库 |
| `git_collect.py` | 通过 Git CLI 收集提交、贡献者、语言、模块和内部 import 边 |
| `evaluation.py` | 采样真实代码贡献，进行多维能力评分与职级差距判断 |
| `capability.py` | 管理角色能力维度、职级阈值和能力标准 |
| `env_scanner.py` | 扫描 `.env`、YAML、properties、Docker Compose、Nginx 等配置并脱敏 |
| `architecture.py` | 基于内部依赖、资产与风险模块生成代码图谱和架构设计 |
| `rag.py` | Qdrant 向量索引与项目代码语义搜索 |
| `llm.py` | Anthropic-compatible LLM 客户端与 JSON 结果解析 |
| `access.py` | 租户上下文、成员关系与轻量 RBAC |

### 数据库、初始化与迁移

DevLens 使用 **PostgreSQL** 作为业务数据存储，使用同步 SQLAlchemy engine 和 session：

- 默认连接：`postgresql+psycopg2:///devlens`，可通过 `DATABASE_URL` 覆盖。
- ORM 模型：[`backend/app/models.py`](backend/app/models.py)。
- 数据库会话：[`backend/app/db.py`](backend/app/db.py)。
- Pydantic 请求/响应模型：[`backend/app/schemas.py`](backend/app/schemas.py)，对外响应遵循 camelCase 字段。

核心领域数据包括：

- **组织与身份**：租户、账户、成员关系、角色授权。
- **项目与分析**：项目、仓库、分析运行、评分历史、AI 洞察、模块风险、修复优先级和身份匹配。
- **人员与团队**：开发者、团队、团队空间、团队组和大团队。
- **规则与标准**：规则来源、Skill、Skill Group、角色能力维度与职级阈值。
- **环境与审计**：环境盘点规则/扫描/条目、开发者评估和报告导出记录。

多数业务资产均带有 `tenant_id`，用于租户隔离。

当前未使用 Alembic。应用启动时会：

1. 执行 `Base.metadata.create_all()` 创建缺失表；
2. 通过 [`ensure_migrate()`](backend/app/main.py) 为已有表补充/回填必要字段；
3. 初始化本地默认租户、测试租户、本地管理员和必要的演示/默认规则数据。

> **部署注意**：代码内迁移适合当前单实例运行模式。升级生产环境前应备份 PostgreSQL，且避免多个实例同时启动并执行 schema 变更。

### 多租户与安全边界

DevLens 不保存密码或 SSO Token；认证由可信的上游 SSO/API Gateway 负责，后端消费以下身份头：

```http
X-DevLens-User-Id: usr-...
X-DevLens-Tenant-Id: tenant-...
```

当前角色为 `owner`、`admin`、`evaluator`、`analyst`、`viewer`。本地开发可启用本地管理员回退；**公网生产必须配置**：

```env
DEVLENS_ALLOW_LOCAL_ADMIN=false
```

关闭回退后，缺少任一身份头的请求会被拒绝。生产网关必须负责可信身份校验，并只向后端传递已验证的用户/租户头；不要让客户端绕过网关直接访问后端端口。

## AI、RAG 与外部依赖

### LLM 审查

[`backend/app/llm.py`](backend/app/llm.py) 通过 HTTPX 调用 Anthropic-compatible Messages API。默认配置指向 DeepSeek：

```env
COPILOT_PROVIDER_BASE_URL=https://api.deepseek.com/anthropic
COPILOT_PROVIDER_API_KEY=your-api-key
COPILOT_MODEL=deepseek-v4-pro
```

API Key 不应提交到仓库；请由 shell、systemd `EnvironmentFile` 或密钥管理服务注入。

### 代码语义检索

[`backend/app/rag.py`](backend/app/rag.py) 使用本地加载的 `all-MiniLM-L6-v2` 生成 **384 维** embedding；每个项目使用独立 Qdrant collection，命名格式为 `code_<project_id>`。当前 Qdrant 地址固定为：

```text
http://127.0.0.1:6333
```

Qdrant 不可用时，代码索引会被跳过，语义搜索返回空结果，不会阻断其余项目分析流程。

### 其他运行依赖

- **Git**：项目导入和贡献采集调用本机 Git CLI。
- **Chrome/Chromium**：生成 PDF 报告时使用 headless 浏览器；可通过 `DEVLENS_CHROME_BINARY` 覆盖可执行文件路径。
- **PostgreSQL**：后端健康检查会执行 `SELECT 1` 验证数据库连接。

## 本地快速开始

### 前置条件

| 依赖 | 说明 |
| --- | --- |
| PostgreSQL | 必需。创建 `devlens` 数据库，或提供可访问的 `DATABASE_URL`。 |
| Python 3.13+ 与 uv | 必需。后端依赖由 `uv.lock` 锁定。 |
| Node.js 22 与 pnpm 10 | 必需。用于前端构建与开发服务器。 |
| Git | 必需。用于仓库导入、提交与源码采集。 |
| DeepSeek 兼容 API Key | 进行 AI 项目审查和能力评估时需要。 |
| Qdrant | 使用代码语义索引/搜索时需要，默认监听 `6333`。 |
| Chrome/Chromium | 生成 PDF 报告时需要。 |

### 1. 配置后端环境

后端的配置从进程环境读取。可以在启动前导出变量，或在生产环境由 systemd `EnvironmentFile` 注入：

```bash
export DATABASE_URL='postgresql+psycopg2:///devlens'
export COPILOT_PROVIDER_BASE_URL='https://api.deepseek.com/anthropic'
export COPILOT_PROVIDER_API_KEY='your-api-key'
export COPILOT_MODEL='deepseek-v4-pro'
export DEVLENS_REPOS_CACHE='/tmp/devlens-repos'
export DEVLENS_ALLOW_LOCAL_ADMIN='true'
# 可选：PDF 导出使用的浏览器路径
export DEVLENS_CHROME_BINARY='/usr/bin/google-chrome'
```

本地默认 `DATABASE_URL` 使用 PostgreSQL Unix socket peer authentication；如需用户名、密码或远端数据库，请改为类似：

```bash
export DATABASE_URL='postgresql+psycopg2://user:password@host:5432/devlens'
```

### 2. 启动后端

```bash
cd backend
uv sync --frozen
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
```

健康检查：

```bash
curl http://127.0.0.1:8000/api/v1/health
```

### 3. 启动前端

```bash
cd frontend
pnpm install --frozen-lockfile
NEXT_PUBLIC_API_URL=/api/v1 pnpm dev
```

打开 [http://127.0.0.1:3800](http://127.0.0.1:3800)。前端将通过 Next.js `/api/v1/*` 代理连接后端 `http://127.0.0.1:8000`。

### 常用端口

| 服务 | 默认地址 | 用途 |
| --- | --- | --- |
| Next.js | `http://127.0.0.1:3800` | 前端开发/生产服务 |
| FastAPI | `http://127.0.0.1:8000` | 后端 REST API |
| Qdrant | `http://127.0.0.1:6333` | 代码向量数据库 |
| Nginx | `https://joox.cc:7506` | 当前生产 HTTPS 入口 |

## 配置参考

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql+psycopg2:///devlens` | PostgreSQL SQLAlchemy 连接串 |
| `COPILOT_PROVIDER_BASE_URL` | `https://api.deepseek.com/anthropic` | Anthropic-compatible LLM API 基址 |
| `COPILOT_PROVIDER_API_KEY` | 空 | LLM API Key |
| `COPILOT_MODEL` | `deepseek-v4-pro` | LLM 模型标识 |
| `DEVLENS_REPOS_CACHE` | `/tmp/devlens-repos` | Git clone 缓存目录 |
| `DEVLENS_ALLOW_LOCAL_ADMIN` | `true` | 缺少上游身份头时是否回退本地 owner；生产必须设为 `false` |
| `DEVLENS_CHROME_BINARY` | 系统默认 Chrome 路径 | PDF 导出使用的 Chrome/Chromium 路径 |
| `NEXT_PUBLIC_API_URL` | 未设置时启用 Mock | 前端真实 API 基址；联调/生产应为 `/api/v1` |
| `BACKEND_URL` | `http://127.0.0.1:8000` | Next.js API 代理的上游 FastAPI 地址 |

> `QDRANT_URL` 和 `QDRANT_API_KEY` 目前不是运行时配置项；Qdrant 地址在 [`backend/app/rag.py`](backend/app/rag.py) 中固定为 `http://127.0.0.1:6333`。

## 生产部署与 CI/CD

### 运行模型

生产部署文件位于 [`deploy/`](deploy/) 与 [`scripts/deploy.sh`](scripts/deploy.sh)：

- Nginx 在 **7506** 端口提供 HTTPS，`/api/` 转发到 FastAPI `127.0.0.1:8000`，其余路径转发到 Next.js `127.0.0.1:3800`。
- systemd 使用 [`devlens-backend.service.template`](deploy/devlens-backend.service.template) 与 [`devlens-frontend.service.template`](deploy/devlens-frontend.service.template) 托管两个服务，并配置 `Restart=always`。
- 部署脚本默认在 `/opt/devlens` 工作，执行 `uv sync --frozen`、`pnpm install --frozen-lockfile`、`NEXT_PUBLIC_API_URL=/api/v1 pnpm build`、Nginx 校验/重载和服务健康检查。
- 首次部署脚本会生成有效期 10 年的自签名证书。生产应替换为受信任 CA 签发的证书。

### GitHub Actions

[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) 在 `master` 的 push、PR 与手动触发时执行：

1. 使用 Python 3.13/uv 安装后端依赖，并导入 FastAPI 应用做 smoke test；
2. 使用 Node.js 22/pnpm 10 构建前端；
3. 仅在 `master` push 后，通过 SCP 将代码同步至 `/opt/devlens`，再通过 SSH 运行部署脚本。

部署需要配置以下 GitHub Actions Secrets：

```text
JOOX_HOST
JOOX_USER
JOOX_SSH_KEY
```

部署服务器必须预先具备 `uv`、pnpm、Nginx、systemd、curl、openssl、PostgreSQL，以及按需提供 Qdrant、Git 和 Chrome/Chromium。

## 项目结构

```text
.
├── frontend/
│   ├── app/                    # Next.js App Router 页面、全局样式和 API 代理
│   ├── components/             # 应用壳、业务组件、图表、图谱、Provider、UI 适配层
│   ├── lib/                    # typed API client、领域类型、mock 数据与工具函数
│   ├── scripts/                # 前端仓库分析与辅助脚本
│   ├── package.json            # 前端依赖与运行脚本
│   └── next.config.mjs         # Next.js 配置
├── backend/
│   ├── app/
│   │   ├── routers/            # REST API，按领域拆分
│   │   ├── main.py             # FastAPI 装配、初始化和代码内迁移
│   │   ├── models.py           # SQLAlchemy ORM 模型
│   │   ├── schemas.py          # Pydantic 请求/响应模型
│   │   ├── analyzer.py         # 项目分析编排
│   │   ├── git_collect.py      # Git/源码信息采集
│   │   ├── evaluation.py       # 开发者能力评估
│   │   ├── env_scanner.py      # 环境配置盘点与脱敏
│   │   ├── architecture.py     # 代码图谱与架构设计
│   │   ├── rag.py              # Qdrant 代码向量与检索
│   │   └── access.py           # 租户上下文与 RBAC
│   ├── pyproject.toml          # Python 依赖和 Python 版本要求
│   └── uv.lock                 # uv 锁文件
├── deploy/                     # Nginx 与 systemd 模板
├── scripts/deploy.sh           # 服务器部署脚本
├── .github/workflows/          # CI/CD 工作流
└── docs/                       # 架构设计与产品文档索引
```

## 文档说明

详细的产品与设计资料请从 [文档中心](docs/README.md) 开始。该目录中部分 Docker Compose、Redis/Celery、Alembic、Vite 环境变量、JWT/SSE 或外部扫描集成的描述属于早期设计或规划，可能与当前可运行实现不一致。

以本 README、[`frontend/package.json`](frontend/package.json)、[`backend/pyproject.toml`](backend/pyproject.toml)、[`backend/app/`](backend/app/) 和 [`deploy/`](deploy/) 中的代码/部署配置为准。
