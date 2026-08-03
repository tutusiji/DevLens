# DevLens 部署自动化 + Logo/Favicon 设计文档

日期：2026-08-03
状态：已批准（用户确认设计）

## 1. 背景与目标

DevLens 目前只在开发机本地运行（后端 uvicorn :8000，前端 next dev :3800，PG/Redis/Qdrant 本机）。需要：

1. 为仓库编写 GitHub Action，实现 push 到 main 后自动 CI + 部署。
2. 通过 SSH 把 DevLens 原生部署到远程服务器 `joox.cc`，以 `https://joox.cc:7506` 对外访问（自签名 HTTPS）。
3. 将用户提供的 SVG 图形作为网站 logo（侧边栏品牌位）与浏览器 favicon（icon + ico）。

## 2. 关键决策（已确认）

| 决策点 | 结论 |
|---|---|
| joox 是什么 | 远程部署服务器，GitHub Action push 后通过 SSH 登录部署 |
| Action 范围 | CI + 自动部署（push main 全流程；PR 仅 CI；支持手动触发） |
| 部署架构 | SSH + 原生部署（systemd 管理服务，nginx 做 TLS 反代），不使用 Docker |
| HTTPS 证书 | joox 上用 openssl 生成自签名证书（10 年），首次部署自动生成，已存在则跳过 |
| joox 基础设施 | PG / Redis / Qdrant / Python(uv) / Node(pnpm) 已就绪，部署脚本不负责安装 |
| 后端密钥 | DeepSeek API key 等机密存 joox 上的 `backend/.env`（不入库、不被覆盖）；GitHub 只放 SSH 密钥 |

## 3. 目标拓扑

```
浏览器 ──> https://joox.cc:7506 (nginx, TLS 自签名)
                ├─ /api/*        → 127.0.0.1:8000   (uvicorn, devlens-backend.service)
                └─ /*            → 127.0.0.1:3800   (next start, devlens-frontend.service)
```

- 后端启动时 `lifespan` 自动执行 `create_all` + `ensure_migrate()` 增量迁移，部署后无需手动迁移。
- 前端生产模式用 `next start -p 3800`（构建产物提交前在 joox 上由 `pnpm build` 生成）。

## 4. 文件清单

### 4.1 前端 Logo 与 Favicon

| 文件 | 说明 |
|---|---|
| `frontend/public/logo.svg` | 用户提供的 SVG 原样保存，作为 logo 源文件与静态资源 |
| `frontend/app/icon.svg` | Next.js App Router 约定文件，自动作为 favicon 输出（现代浏览器标准做法） |
| `frontend/app/favicon.ico` | 32px 多尺寸 ICO，用 sharp 一次性渲染 SVG→PNG→ICO，生成后提交进仓库 |
| `frontend/components/logo.tsx` | 内联 SVG 的 `Logo` 组件，`props.className` 可缩放；颜色沿用原 SVG `#13227a`，可用 `currentColor` 变量便于主题跟随 |
| `frontend/components/app-shell.tsx` | 侧边栏品牌位（现 `Activity` 图标）替换为 `<Logo className="h-8 w-8" />`；品牌位容器样式不变 |
| `frontend/app/layout.tsx` | `metadata.icons` 添加 `{ icon: '/icon.svg' }` 与 favicon.ico |

生成脚本 `scripts/generate-favicon.mjs`：用 sharp 渲染 SVG → 32px PNG → 打包 ICO，提交后不再需要该脚本运行（一次生成、产物入库）。若仓库环境 sharp 不可用，以 `icon.svg` 为唯一 favicon（所有现行浏览器均支持 SVG favicon），`favicon.ico` 可选。

### 4.2 GitHub Action

仓库根 `.github/workflows/deploy.yml`：

- **Triggers**
  - `push: branches: [main]` → CI + 部署
  - `pull_request: branches: [main]` → 仅 CI
  - `workflow_dispatch` → 手动触发完整流程
- **Job 1 `ci`**（ubuntu-latest）
  - 后端：`cd backend && uv sync`（或 `uv pip install`），冒烟测试 `uv run python -c "from app.main import app"`
  - 前端：`cd frontend && pnpm install --frozen-lockfile && pnpm build`（build 含类型检查，前端无 ESLint 配置，故不用 `next lint`）
- **Job 2 `deploy`**（needs: ci）
  - `actions/checkout@v4`
  - 用 GitHub Secrets 建立 SSH 连接并执行部署脚本：
    - `JOOX_HOST`（joox 地址）
    - `JOOX_USER`（SSH 用户）
    - `JOOX_SSH_KEY`（私钥，多行）
    - `JOOX_PORT`（可选，默认 22）
  - 远程执行 `scripts/deploy.sh`（脚本由 checkout 同步或随 SSH 传递）

### 4.3 部署配置（仓库内 `deploy/`）

| 文件 | 说明 |
|---|---|
| `deploy/nginx-devlens.conf` | TLS 反代配置：listen 7506 ssl；`/api/` → 127.0.0.1:8000（含 `proxy_set_header` 透传 X-DevLens-* 与 Host）；其余 → 127.0.0.1:3800 |
| `deploy/devlens-backend.service` | systemd 单元：`WorkingDirectory=…/backend`，`ExecStart` uvicorn :8000，`Restart=always`，用户以部署用户运行 |
| `deploy/devlens-frontend.service` | systemd 单元：`WorkingDirectory=…/frontend`，`ExecStart` `pnpm start --port 3800`，`Restart=always` |
| `scripts/deploy.sh` | 部署编排脚本（在 joox 执行，见 §5） |

### 4.4 忽略规则

`.gitignore` 需确认覆盖部署产物（`frontend/.next/` 已覆盖）、`backend/.env`（已覆盖 `.env` / `.env.*`）。部署脚本生成的证书放服务器 `/etc/ssl/devlens/` 或仓库外路径，不入库。

## 5. `scripts/deploy.sh` 逻辑（幂等）

1. **环境自检**：断言 `uv`、`pnpm`、`systemctl`、`nginx` 存在；`git pull` 到目标 commit（由 Action 传入 ref）。
2. **后端依赖**：`cd backend && uv sync`（复用已有 `.venv`）。
3. **后端 .env 保证**：若 `backend/.env` 不存在，从 `.env.example` 复制并写入占位提示（含 `COPILOT_PROVIDER_BASE_URL` / `COPILOT_MODEL` 默认值），提示用户填入 `COPILOT_PROVIDER_API_KEY`。**已存在则原样保留，绝不覆盖。**
4. **前端构建**：`cd frontend && pnpm install --frozen-lockfile && pnpm build`。
5. **证书**：若 `/etc/ssl/devlens/fullchain.pem` + `privkey.pem` 不存在，`openssl req -x509 -newkey rsa:2048 -nodes -days 3650 -subj "/CN=joox.cc"` 生成并写入。
6. **nginx 配置**：将 `deploy/nginx-devlens.conf` 安装到 `/etc/nginx/sites-available/devlens`（或 conf.d），`nginx -t` 通过后 `systemctl reload nginx`。
7. **systemd 单元**：安装 `deploy/devlens-*.service` 到 `/etc/systemd/system/`，`systemctl daemon-reload`；`restart` 后端与前端服务。
8. **健康检查**：等待 `curl -k -sf https://127.0.0.1:7506/api/v1/health` 返回 2xx（最多 ~60s），失败则退出非 0（服务保持上一版本）。

## 6. 错误处理与回滚

- 脚本任何一步失败：退出非 0，Action 标记失败；systemd 单元在旧版本运行的服务不受影响（除非重启步骤已执行）。
- 自签名证书只生成一次；nginx 配置 `nginx -t` 不通过则不改动现有配置。
- `.env` 只创建、不覆盖，避免 CI 覆盖人工填写的密钥。
- SSH 密钥仅在 GitHub Secrets 中，不写入仓库。

## 7. 验证方案

- 本地：前端 `pnpm build` 通过；`logo.svg` / `icon.svg` / `favicon.ico` 存在于产物。
- Action：push main 后，GitHub 上 `ci` 与 `deploy` 均绿。
- 服务器：`curl -k -I https://joox.cc:7506` 返回 200 且 TLS 生效；`/api/v1/health` 返回正常；浏览器访问可见 logo 与 favicon。
- 幂等性：`scripts/deploy.sh` 可重复执行，重复运行不破坏已部署服务。

## 8. 范围外（Non-Goals）

- Docker 化部署 / Kubernetes（本期不做）。
- Let's Encrypt 正式证书（自定义端口 7506 + 内网主机名不适用）。
- 前端 ESLint 规则补全（本期 CI 用 build 类型检查代替 lint）。
- joox 基础设施（PG/Redis/Qdrant）的安装。

## 9. 提交策略

- 本机当前分支 `feat/ui-ux-pro-max-international-theme`。Logo/favicon 与 Action 相关改动提交到独立分支（如 `feat/github-action-deploy-logo`），推送后由用户决定合并/开 PR 到 main。
- spec 文档单独提交。
