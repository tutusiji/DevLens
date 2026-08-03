# DevLens 部署自动化 + Logo/Favicon 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 DevLens 编写 GitHub Action（push main 自动 CI+部署到 joox），将用户提供的 SVG 作为侧边栏 logo 与 favicon，使 `https://joox:7504` 可访问。

**Architecture:** GitHub Actions 两个 Job：`ci`（后端 uv 安装+导入冒烟，前端 pnpm build）与 `deploy`（SSH scp 同步代码到 `/opt/devlens`，远程执行 `scripts/deploy.sh`）。joox 上用 systemd 管 devlens-backend（uvicorn:8000）与 devlens-frontend（next start:3800），nginx 在 7504 端口 TLS 终止并反代 `/api/*`→后端、其余→前端。favicon 用 Next.js 约定文件 `app/icon.svg` + 一次性 sharp 生成的 `app/favicon.ico`。

**Tech Stack:** GitHub Actions / Next.js 15 App Router / sharp / FastAPI / nginx / systemd / OpenSSL。

## Global Constraints

- 部署目标：远程服务器 `joox`，访问地址 `https://joox:7504`（自签名证书）。
- joox 基础设施（PostgreSQL/Redis/Qdrant/uv/pnpm/nginx）已就绪，部署脚本**不负责安装**。
- 后端机密（`COPILOT_PROVIDER_API_KEY`）只存 joox 上 `backend/.env`，不入库、不被覆盖；GitHub 只放 SSH 密钥。
- 前端生产构建必须设 `NEXT_PUBLIC_API_URL=/api/v1`（否则 `USE_MOCK=!NEXT_PUBLIC_API_URL` 会启用 mock，前端不连后端）。
- 后端读 env 只走 `os.getenv`（无 load_dotenv），systemd 单元必须用 `EnvironmentFile=backend/.env` 注入变量。
- 仓库内没有 `.env.example`，部署脚本需从零生成 `backend/.env`。
- CI 不跑 `next lint`（前端无 ESLint 配置）；用 `pnpm build`（含类型检查）作门槛。
- 部署脚本幂等，可重复执行；`nginx -t` 不通过则不动现有配置。
- SSH 用户（`JOOX_USER`）需具备 passwordless sudo（或为 root），脚本用 `sudo -n`。
- 所有改动在独立分支 `feat/github-action-deploy-logo` 上提交。

---

### Task 1: Logo 源文件与 favicon 资源

**Files:**
- Create: `frontend/public/logo.svg`
- Create: `frontend/app/icon.svg`（内容同 logo.svg，Next 自动作为 favicon 输出）
- Create: `frontend/scripts/generate-favicon.mjs`（前端自有脚本，运行 `cd frontend && node scripts/generate-favicon.mjs`）
- Create: `frontend/app/favicon.ico`（生成产物）
- Modify: `frontend/package.json`（devDependencies 增加 sharp）

**Interfaces:**
- Consumes: 无
- Produces: `public/logo.svg`（后续 Task 2 组件、Task 3 metadata 引用）；`app/icon.svg`、`app/favicon.ico`（Next 自动 favicon）；`scripts/generate-favicon.mjs`（可复用再生成）

- [ ] **Step 1: 创建分支并写入 logo.svg**

```bash
cd /home/tutuos/CodeLab/devlens
git checkout -b feat/github-action-deploy-logo
mkdir -p frontend/public scripts
# 将用户提供的 base64 解码为 logo.svg
printf '%s' 'PD94bWwgdmVyc2lvbj0iMS4wIiBzdGFuZGFsb25lPSJubyI/PjwhRE9DVFlQRSBzdmcgUFVCTElDICItLy9XM0MvL0RURCBTVkcgMS4xLy9FTiIgImh0dHA6Ly93d3cudzMub3JnL0dyYXBoaWNzL1NWRy8xLjEvRFREL3N2ZzExLmR0ZCI+PHN2ZyB0PSIxNzg1NzIzNzMyMDMyIiBjbGFzcz0iaWNvbiIgdmlld0JveD0iMCAwIDEwMjQgMTAyNCIgdmVyc2lvbj0iMS4xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHAtaWQ9IjIxNDMiIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCI+PHBhdGggZD0iTTMyOS4yIDUwOGMtNS4yIDAtMTAuMi0yLTE0LjItNS44TDg4LjIgMjc1LjRjLTE4LTE4LTE4LTQ3LjIgMC02NWwxNTcuNi0xNTcuNmMxOC0xOCA0Ny4yLTE4IDY1IDBsMjI2LjQgMjI2LjRjNy44IDcuOCA3LjggMjAuNCAwIDI4LjItNy44IDcuOC0yMC40IDcuOC0yOC4yIDBMMjgyLjYgODEuMmMtMi40LTIuNC02LjItMi40LTguNCAwbC0xNTcuNiAxNTcuNmMtMS40IDEuNC0xLjggMy4yLTEuOCA0LjJzMC40IDIuOCAxLjggNC4yTDM0My40IDQ3NGM3LjggNy44IDcuOCAyMC40IDAgMjguMi00IDMuOC05LjIgNS44LTE0LjIgNS44ek03NjcuMiA5MzUuNGMtMTEuOCAwLTIzLjYtNC40LTMyLjYtMTMuNEw1MDkuMiA2OTYuNGMtNy44LTcuOC03LjgtMjAuNCAwLTI4LjIgNy44LTcuOCAyMC40LTcuOCAyOC4yIDBsMjI1LjQgMjI1LjRjMi40IDIuNCA2LjIgMi40IDguNCAwbDE1Ny42LTE1Ny42YzEuNC0xLjQgMS44LTMuMiAxLjgtNC4yIDAtMS4yLTAuNC0yLjgtMS44LTQuMkw3MDMuMiA1MDEuOGMtNy44LTcuOC03LjgtMjAuNCAwLTI4LjIgNy44LTcuOCAyMC40LTcuOCAyOC4yIDBsMjI1LjggMjI1LjhjOC42IDguNiAxMy40IDIwLjIgMTMuNCAzMi42IDAgMTIuMi00LjggMjMuOC0xMy40IDMyLjZsLTE1Ny42IDE1Ny42Yy04LjggOC42LTIwLjYgMTMuMi0zMi40IDEzLjJ6IiBmaWxsPSIjMTMyMjdhIiBwLWlkPSIyMTQ0Ij48L3BhdGg+PHBhdGggZD0iTTkxLjIgOTQxYy01LjIgMC0xMC40LTItMTQuMi01LjgtNC40LTQuNC02LjQtMTAuNC01LjgtMTYuNmwyNy42LTIyMS44YzAuNi00LjQgMi42LTguNiA1LjYtMTEuNmw2MjQtNjI2YzEwLjQtMTAuNCAyNC0xNiAzOC42LTE2IDE0LjYgMCAyOC4yIDUuNiAzOC42IDE2bDE0NS40IDE0NS40YzIxLjIgMjEuMiAyMS4yIDU1LjggMCA3Ny4ybC02MjQgNjI2Yy0zLjIgMy4yLTcuMiA1LjItMTEuNiA1LjhMOTMuNiA5NDAuOGMtMC44IDAuMi0xLjYgMC4yLTIuNCAwLjJ6IG00Ni42LTIzMi42TDExNC4yIDg5OGwxODkuNi0yMy42IDYxOS4yLTYyMS4yYzUuOC01LjggNS44LTE1IDAtMjAuNmwtMTQ1LjQtMTQ1LjRjLTIuOC0yLjgtNi40LTQuMi0xMC40LTQuMi0zLjggMC03LjYgMS42LTEwLjQgNC4yTDEzNy44IDcwOC40eiIgZmlsbD0iIzEzMjI3YSIgcC1pZD0iMjE0NSI+PC9wYXRoPjxwYXRoIGQ9Ik04NDUgMzc5LjZjLTUuMiAwLTEwLjItMi0xNC4yLTUuOGwtMTk0LjQtMTk0LjRjLTcuOC03LjgtNy44LTIwLjQgMC0yOC4yIDcuOC03LjggMjAuNC03LjggMjguMiAwbDE5NC40IDE5NC40YzcuOCA3LjggNy44IDIwLjQgMCAyOC4yLTMuOCAzLjgtOSA1LjgtMTQgNS44ek0zMTUgOTExLjZjLTUuMiAwLTEwLjItMi0xNC4yLTUuOGwtMTk0LjQtMTk0LjRjLTcuOC03LjgtNy44LTIwLjQgMC0yOC4yIDcuOC03LjggMjAuNC03LjggMjguMiAwbDE5NC40IDE5NC40YzcuOCA3LjggNy44IDIwLjQgMCAyOC4yLTMuOCAzLjgtOSA1LjgtMTQgNS44ek02OTAuOCA4NjMuOGMtNS4yIDAtMTAuMi0yLTE0LjItNS44LTcuOC03LjgtNy44LTIwLjQgMC0yOC4ybDEyNC44LTEyNC44YzcuOC03LjggMjAuNC03LjggMjguMiAwIDcuOCA3LjggNy44IDIwLjQgMCAyOC4yTDcwNSA4NThjLTMuOCA0LTkgNS44LTE0LjIgNS44ek02MTAgNzgzYy01LjIgMC0xMC4yLTItMTQuMi01LjgtNy44LTcuOC03LjgtMjAuNCAwLTI4LjJsMTI0LjgtMTI0LjhjNy44LTcuOCAyMC40LTcuOCAyOC4yIDAgNy44IDcuOCA3LjggMjAuNCAwIDI4LjJMNjI0IDc3Ny4yYy0zLjggMy44LTguOCA1LjgtMTQgNS44ek0yNDkgNDIyYy01LjIgMC0xMC4yLTItMTQuMi01LjgtNy44LTcuOC03LjgtMjAuNCAwLTI4LjJsMTI0LjgtMTI0LjhjNy44LTcuOCAyMC40LTcuOCAyOC4yIDAgNy44IDcuOCA3LjggMjAuNCAwIDI4LjJsLTEyNC44IDEyNC44Yy0zLjggMy44LTguOCA1LjgtMTQgNS44ek0xNjguMiAzNDEuMmMtNS4yIDAtMTAuMi0yLTE0LjItNS44LTcuOC03LjgtNy44LTIwLjQgMC0yOC4yTDI3OSAxODJjNy44LTcuOCAyMC40LTcuOCAyOC4yIDAgNy44IDcuOCA3LjggMjAuNCAwIDI4LjJsLTEyNC44IDEyNC44Yy00IDQuMi05LjIgNi4yLTE0LjIgNi4yeiIgZmlsbD0iIzEzMjI3YSIgcC1pZD0iMjE0NiI+PC9wYXRoPjwvc3ZnPg==' | base64 -d > frontend/public/logo.svg
```

（`<B64_SVG>` 即用户提供的 base64 常量的完整展开，已内嵌于上方命令。）

- [ ] **Step 2: 复制为 icon.svg**

```bash
cp frontend/public/logo.svg frontend/app/icon.svg
```

- [ ] **Step 3: 验证 SVG 内容正确**

```bash
head -c 120 frontend/public/logo.svg
python3 -c "import xml.dom.minidom,sys; xml.dom.minidom.parse('frontend/public/logo.svg'); print('SVG XML OK')"
```

Expected: 开头为 `<?xml version="1.0" standalone="no"?>`，XML 解析无异常，含 3 个 `<path>` 且 `viewBox="0 0 1024 1024"`。

- [ ] **Step 4: 添加 sharp 开发依赖**

```bash
cd frontend && pnpm add -D sharp
```

Expected: `frontend/package.json` devDependencies 出现 `"sharp": "^0.33.x"`，`pnpm-lock.yaml` 更新。

- [ ] **Step 5: 编写 favicon 生成脚本**

创建 `frontend/scripts/generate-favicon.mjs`：

```js
// scripts/generate-favicon.mjs — 渲染 logo.svg → app/favicon.ico（PNG-in-ICO）
// 用法：cd frontend && node scripts/generate-favicon.mjs
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(resolve(frontendDir, 'public/logo.svg'));

// 渲染 32x32 PNG
const png = await sharp(svg).resize(32, 32).png().toBuffer();

// 打包为单入口 ICO（PNG 压缩图标，Vista+ 支持）
const dir = Buffer.alloc(16);
dir.writeUInt8(32, 0);                 // width
dir.writeUInt8(32, 1);                 // height
dir.writeUInt8(0, 2);                  // palette
dir.writeUInt8(0, 3);                  // reserved
dir.writeUInt16LE(1, 4);               // planes
dir.writeUInt16LE(32, 6);              // bit count
dir.writeUInt32LE(png.length, 8);      // size
dir.writeUInt32LE(22, 12);             // offset = 6 (header) + 16 (dir)

const ico = Buffer.concat([
  Buffer.from([0, 0, 1, 0, 1, 0]),     // header: reserved=0, type=1, count=1
  dir,
  png,
]);

writeFileSync(resolve(frontendDir, 'app/favicon.ico'), ico);
console.log('wrote app/favicon.ico', ico.length, 'bytes');
```

- [ ] **Step 6: 运行生成脚本**

```bash
cd frontend && node scripts/generate-favicon.mjs
```

Expected: 输出 `wrote app/favicon.ico ... bytes`。

- [ ] **Step 7: 验证 ICO 文件头**

```bash
file frontend/app/favicon.ico
xxd frontend/app/favicon.ico | head -1
```

Expected: `file` 报 `MS Windows icon resource - 1 icon, 32x32`；`xxd` 首行以 `0000 0100 0100` 开头。

- [ ] **Step 8: 提交**

```bash
git add frontend/public/logo.svg frontend/app/icon.svg frontend/app/favicon.ico frontend/scripts/generate-favicon.mjs frontend/package.json frontend/pnpm-lock.yaml
git commit -m "feat: 添加 DevLens logo 源文件与 favicon（icon.svg + favicon.ico）

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Logo 组件并接入侧边栏

**Files:**
- Create: `frontend/components/logo.tsx`
- Modify: `frontend/components/app-shell.tsx:104-112`（侧边栏品牌位图标替换）

**Interfaces:**
- Consumes: `public/logo.svg` 的三个 path（Task 1）
- Produces: `Logo` 组件，签名 `Logo({ className }: { className?: string })`，SVG `viewBox="0 0 1024 1024"`、`fill="currentColor"`

- [ ] **Step 1: 创建 Logo 组件**

创建 `frontend/components/logo.tsx`：

```tsx
/** DevLens 品牌 Logo（内联 SVG，颜色跟随 currentColor 以适配深浅主题） */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1024 1024" className={className} fill="currentColor" aria-hidden="true">
      <path d="M329.2 508c-5.2 0-10.2-2-14.2-5.8L88.2 275.4c-18-18-18-47.2 0-65l157.6-157.6c18-18 47.2-18 65 0l226.4 226.4c7.8 7.8 7.8 20.4 0 28.2-7.8 7.8-20.4 7.8-28.2 0L282.6 81.2c-2.4-2.4-6.2-2.4-8.4 0l-157.6 157.6c-1.4 1.4-1.8 3.2-1.8 4.2s0.4 2.8 1.8 4.2L343.4 474c7.8 7.8 7.8 20.4 0 28.2-4 3.8-9.2 5.8-14.2 5.8zM767.2 935.4c-11.8 0-23.6-4.4-32.6-13.4L509.2 696.4c-7.8-7.8-7.8-20.4 0-28.2 7.8-7.8 20.4-7.8 28.2 0l225.4 225.4c2.4 2.4 6.2 2.4 8.4 0l157.6-157.6c1.4-1.4 1.8-3.2 1.8-4.2 0-1.2-0.4-2.8-1.8-4.2L703.2 501.8c-7.8-7.8-7.8-20.4 0-28.2 7.8-7.8 20.4-7.8 28.2 0l225.8 225.8c8.6 8.6 13.4 20.2 13.4 32.6 0 12.2-4.8 23.8-13.4 32.6l-157.6 157.6c-8.8 8.6-20.6 13.2-32.4 13.2z" />
      <path d="M91.2 941c-5.2 0-10.4-2-14.2-5.8-4.4-4.4-6.4-10.4-5.8-16.6l27.6-221.8c0.6-4.4 2.6-8.6 5.6-11.6l624-626c10.4-10.4 24-16 38.6-16 14.6 0 28.2 5.6 38.6 16l145.4 145.4c21.2 21.2 21.2 55.8 0 77.2l-624 626c-3.2 3.2-7.2 5.2-11.6 5.8L93.6 940.8c-0.8 0.2-1.6 0.2-2.4 0.2z m46.6-232.6L114.2 898l189.6-23.6 619.2-621.2c5.8-5.8 5.8-15 0-20.6l-145.4-145.4c-2.8-2.8-6.4-4.2-10.4-4.2-3.8 0-7.6 1.6-10.4 4.2L137.8 708.4z" />
      <path d="M845 379.6c-5.2 0-10.2-2-14.2-5.8l-194.4-194.4c-7.8-7.8-7.8-20.4 0-28.2 7.8-7.8 20.4-7.8 28.2 0l194.4 194.4c7.8 7.8 7.8 20.4 0 28.2-3.8 3.8-9 5.8-14 5.8zM315 911.6c-5.2 0-10.2-2-14.2-5.8l-194.4-194.4c-7.8-7.8-7.8-20.4 0-28.2 7.8-7.8 20.4-7.8 28.2 0l194.4 194.4c7.8 7.8 7.8 20.4 0 28.2-3.8 3.8-9 5.8-14 5.8zM690.8 863.8c-5.2 0-10.2-2-14.2-5.8-7.8-7.8-7.8-20.4 0-28.2l124.8-124.8c7.8-7.8 20.4-7.8 28.2 0 7.8 7.8 7.8 20.4 0 28.2L705 858c-3.8 4-9 5.8-14.2 5.8zM610 783c-5.2 0-10.2-2-14.2-5.8-7.8-7.8-7.8-20.4 0-28.2l124.8-124.8c7.8-7.8 20.4-7.8 28.2 0 7.8 7.8 7.8 20.4 0 28.2L624 777.2c-3.8 3.8-8.8 5.8-14 5.8zM249 422c-5.2 0-10.2-2-14.2-5.8-7.8-7.8-7.8-20.4 0-28.2l124.8-124.8c7.8-7.8 20.4-7.8 28.2 0 7.8 7.8 7.8 20.4 0 28.2l-124.8 124.8c-3.8 3.8-8.8 5.8-14 5.8zM168.2 341.2c-5.2 0-10.2-2-14.2-5.8-7.8-7.8-7.8-20.4 0-28.2L279 182c7.8-7.8 20.4-7.8 28.2 0 7.8 7.8 7.8 20.4 0 28.2l-124.8 124.8c-4 4.2-9.2 6.2-14.2 6.2z" />
    </svg>
  );
}
```

- [ ] **Step 2: 接入侧边栏品牌位**

修改 `frontend/components/app-shell.tsx`。在顶部 import 区域（第 15 行附近）添加：

```tsx
import { Logo } from '@/components/logo';
```

将品牌位（约第 105-108 行）：

```tsx
<div className="flex h-8 w-8 items-center justify-center bg-primary text-primary-foreground">
  <Activity className="h-4 w-4" />
</div>
```

替换为：

```tsx
<div className="flex h-8 w-8 items-center justify-center bg-primary text-primary-foreground">
  <Logo className="h-8 w-8" />
</div>
```

保留容器背景与文字颜色不变，仅图标换成 Logo。

- [ ] **Step 3: 验证类型与构建**

```bash
cd frontend && pnpm build
```

Expected: `next build` 成功（含 tsc 类型检查），无报错。若 `Activity` 在该文件其他地方仍被使用则保留其 import；若无其它使用，删除 `Activity` 的 import 以免 `next lint`/tsc 报未使用（build 失败时修正）。

- [ ] **Step 4: 提交**

```bash
git add frontend/components/logo.tsx frontend/components/app-shell.tsx
git commit -m "feat: 侧边栏品牌位使用 DevLens Logo

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: 元数据声明 favicon

**Files:**
- Modify: `frontend/app/layout.tsx:27-31`（`metadata`）

**Interfaces:**
- Consumes: `app/icon.svg`、`app/favicon.ico`（Task 1）
- Produces: 无（浏览器与元数据引用 favicon）

- [ ] **Step 1: 修改 metadata**

修改 `frontend/app/layout.tsx` 中 `export const metadata`：

```tsx
export const metadata: Metadata = {
  title: 'DevLens · 研发棱镜',
  description: '基于 AI 的研发认知系统 - 项目 / 团队 / 人员三位一体评估',
  icons: {
    icon: '/icon.svg',
    shortcut: '/favicon.ico',
  },
};
```

- [ ] **Step 2: 验证构建**

```bash
cd frontend && pnpm build
```

Expected: 构建成功，`.next/server/app/icon.svg` 与 `favicon.ico` 出现在产物中（`ls .next/server/app/` 或 `grep` 验证）。

- [ ] **Step 3: 提交**

```bash
git add frontend/app/layout.tsx
git commit -m "feat: layout 元数据声明 icon.svg 与 favicon.ico

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: GitHub Action 工作流

**Files:**
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: `scripts/deploy.sh`（Task 7，先建文件无碍）、仓库整体
- Produces: 部署入口；依赖 GitHub Secrets：`JOOX_HOST`、`JOOX_USER`、`JOOX_SSH_KEY`

- [ ] **Step 1: 创建工作流文件**

创建 `.github/workflows/deploy.yml`：

```yaml
name: DevLens CI/CD

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

jobs:
  ci:
    name: CI · build & smoke
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up uv
        uses: astral-sh/setup-uv@v5
        with:
          python-version: "3.13"

      - name: Backend deps + import smoke
        run: |
          cd backend
          uv sync --frozen
          uv run python -c "from app.main import app"

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
          cache-dependency-path: frontend/pnpm-lock.yaml

      - name: Frontend build
        run: |
          cd frontend
          pnpm install --frozen-lockfile
          NEXT_PUBLIC_API_URL=/api/v1 pnpm build

  deploy:
    name: Deploy to joox
    needs: ci
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Copy code to joox
        uses: appleboy/scp-action@v0.1.7
        with:
          host: ${{ secrets.JOOX_HOST }}
          username: ${{ secrets.JOOX_USER }}
          key: ${{ secrets.JOOX_SSH_KEY }}
          port: 22   # joox SSH 端口；若非 22，改用 secrets.JOOX_PORT
          source: "./"
          target: /opt/devlens
          exclude: ".git/*,node_modules/*,.next/*,backups/*,backend/.venv/*"

      - name: Run deploy script
        uses: appleboy/ssh-action@v1.2.0
        with:
          host: ${{ secrets.JOOX_HOST }}
          username: ${{ secrets.JOOX_USER }}
          key: ${{ secrets.JOOX_SSH_KEY }}
          port: 22   # 同上
          script: |
            bash /opt/devlens/scripts/deploy.sh
```

- [ ] **Step 2: 验证 YAML 语法**

```bash
cd /home/tutuos/CodeLab/devlens/backend
.venv/bin/python -c "
import yaml
with open('../.github/workflows/deploy.yml') as f:
    d = yaml.safe_load(f)
assert d['jobs']['ci'] and d['jobs']['deploy'], 'jobs missing'
print('YAML OK, jobs:', list(d['jobs']))
"
```

Expected: `YAML OK, jobs: ['ci', 'deploy']`。

- [ ] **Step 3: 提交**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: 添加 GitHub Action（push main 自动 CI + 部署 joox）

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: nginx 反向代理配置

**Files:**
- Create: `deploy/nginx-devlens.conf`

**Interfaces:**
- Consumes: 自签名证书路径 `/etc/ssl/devlens/*.pem`（Task 7 生成）
- Produces: joox 上 `/etc/nginx/sites-available/devlens` 的内容；监听 7504

- [ ] **Step 1: 创建配置**

创建 `deploy/nginx-devlens.conf`：

```nginx
# DevLens — HTTPS 反向代理，对外端口 7504
server {
    listen 7504 ssl;
    server_name joox;

    ssl_certificate     /etc/ssl/devlens/fullchain.pem;
    ssl_certificate_key /etc/ssl/devlens/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    client_max_body_size 50m;

    # 后端 API
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-DevLens-User-Id $http_x_devlens_user_id;
        proxy_set_header X-DevLens-Tenant-Id $http_x_devlens_tenant_id;
        proxy_read_timeout 300s;
    }

    # 前端（Next.js）
    location / {
        proxy_pass http://127.0.0.1:3800;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

- [ ] **Step 2: 静态检查关键字段**

```bash
grep -E "listen 7504 ssl|ssl_certificate|proxy_pass http://127.0.0.1:(8000|3800)" deploy/nginx-devlens.conf
```

Expected: 四行均命中（listen 7504 ssl、两个证书路径、两个 proxy_pass）。

- [ ] **Step 3: 提交**

```bash
git add deploy/nginx-devlens.conf
git commit -m "feat: nginx TLS 反代配置（7504 → 后端/前端）

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: systemd 单元模板

**Files:**
- Create: `deploy/devlens-backend.service.template`
- Create: `deploy/devlens-frontend.service.template`

**Interfaces:**
- Consumes: `__USER__` / `__APP_DIR__` 占位符（Task 7 的 deploy.sh 用 sed 替换）
- Produces: joox 上 `/etc/systemd/system/devlens-{backend,frontend}.service`

- [ ] **Step 1: 创建后端单元模板**

创建 `deploy/devlens-backend.service.template`：

```ini
[Unit]
Description=DevLens Backend (FastAPI)
After=network.target

[Service]
Type=simple
User=__USER__
WorkingDirectory=__APP_DIR__/backend
EnvironmentFile=__APP_DIR__/backend/.env
ExecStart=/usr/bin/env bash -lc 'cd __APP_DIR__/backend && uv run uvicorn app.main:app --host 127.0.0.1 --port 8000'
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 2: 创建前端单元模板**

创建 `deploy/devlens-frontend.service.template`：

```ini
[Unit]
Description=DevLens Frontend (Next.js)
After=network.target

[Service]
Type=simple
User=__USER__
WorkingDirectory=__APP_DIR__/frontend
Environment=NODE_ENV=production
ExecStart=/usr/bin/env bash -lc 'cd __APP_DIR__/frontend && pnpm start --port 3800'
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 3: 验证模板占位符与关键字段**

```bash
grep -l "__USER__" deploy/*.service.template
grep -l "__APP_DIR__" deploy/*.service.template
grep -E "port 8000|port 3800" deploy/*.service.template
```

Expected: 两个模板文件都含 `__USER__` 与 `__APP_DIR__`；后端 `port 8000`、前端 `port 3800` 命中。

- [ ] **Step 4: 提交**

```bash
git add deploy/devlens-backend.service.template deploy/devlens-frontend.service.template
git commit -m "feat: systemd 单元模板（后端 uvicorn + 前端 next start）

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7: 部署脚本

**Files:**
- Create: `scripts/deploy.sh`

**Interfaces:**
- Consumes: Task 5 的 `deploy/nginx-devlens.conf`、Task 6 的 `deploy/*.service.template`、`backend/pyproject.toml` + `uv.lock`、`frontend/pnpm-lock.yaml`
- Produces: joox 上运行的服务（uvicorn:8000、next:3800、nginx:7504）；`backend/.env`（首次创建）；自签名证书 `/etc/ssl/devlens/*.pem`（首次）
- 退出码：0=成功；非 0=失败（Action 据此判定）

- [ ] **Step 1: 编写部署脚本**

创建 `scripts/deploy.sh`：

```bash
#!/usr/bin/env bash
# DevLens 部署脚本 — 在 joox 服务器上执行，幂等可重复运行
# 用法: bash /opt/devlens/scripts/deploy.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/devlens}"
SSL_DIR="/etc/ssl/devlens"
SITE_CONF="/etc/nginx/sites-available/devlens"
SITE_LINK="/etc/nginx/sites-enabled/devlens"
DEPLOY_USER="${DEPLOY_USER:-$USER}"

if [ "$(id -u)" = "0" ]; then SUDO=""; else SUDO="sudo -n"; fi

log() { printf '[deploy] %s\n' "$*"; }
die() { printf '[deploy] ERROR: %s\n' "$*" >&2; exit 1; }

# 1. 环境自检
command -v uv >/dev/null || die "uv not found (需要 Python/uv，基础设施应已就绪)"
command -v pnpm >/dev/null || die "pnpm not found (需要 Node/pnpm)"
command -v nginx >/dev/null || die "nginx not found"
[ -d "$APP_DIR/backend" ] || die "$APP_DIR/backend 不存在 — 先完成 scp 同步"

# 2. 后端依赖
log "安装后端依赖"
cd "$APP_DIR/backend"
uv sync --frozen

# 3. 后端 .env（只创建、不覆盖）
if [ ! -f "$APP_DIR/backend/.env" ]; then
  cat > "$APP_DIR/backend/.env" <<'EOF'
COPILOT_PROVIDER_BASE_URL=https://api.deepseek.com/anthropic
COPILOT_MODEL=deepseek-v4-pro
# 请填写你的 DeepSeek API key（此文件不提交 git，也绝不被部署覆盖）：
COPILOT_PROVIDER_API_KEY=
EOF
  log "已生成 backend/.env — 请人工填入 COPILOT_PROVIDER_API_KEY 后重跑部署"
fi

# 4. 前端构建（NEXT_PUBLIC_API_URL 指向同源 /api/v1，关闭 mock）
log "构建前端"
cd "$APP_DIR/frontend"
pnpm install --frozen-lockfile
NEXT_PUBLIC_API_URL=/api/v1 pnpm build

# 5. 自签名证书（仅首次）
if [ ! -f "$SSL_DIR/fullchain.pem" ] || [ ! -f "$SSL_DIR/privkey.pem" ]; then
  log "生成自签名证书（10 年）"
  $SUDO mkdir -p "$SSL_DIR"
  $SUDO openssl req -x509 -newkey rsa:2048 -nodes -days 3650 \
    -keyout "$SSL_DIR/privkey.pem" -out "$SSL_DIR/fullchain.pem" \
    -subj "/CN=joox"
fi

# 6. nginx（nginx -t 不通过则不改动现有配置）
log "安装 nginx 配置"
$SUDO cp "$APP_DIR/deploy/nginx-devlens.conf" "$SITE_CONF"
$SUDO ln -sfn "$SITE_CONF" "$SITE_LINK"
$SUDO nginx -t
$SUDO systemctl reload nginx

# 7. systemd 单元（模板替换用户与目录）
log "安装并重启 systemd 服务"
for unit in devlens-backend devlens-frontend; do
  sed -e "s|__USER__|$DEPLOY_USER|g" -e "s|__APP_DIR__|$APP_DIR|g" \
    "$APP_DIR/deploy/$unit.service.template" > "/tmp/$unit.service"
  $SUDO install -m 0644 "/tmp/$unit.service" "/etc/systemd/system/$unit.service"
done
$SUDO systemctl daemon-reload
$SUDO systemctl restart devlens-backend devlens-frontend

# 8. 健康检查（最多 90s）
log "等待 https://127.0.0.1:7504/api/v1/health"
for i in $(seq 1 90); do
  if curl -k -sf "https://127.0.0.1:7504/api/v1/health" >/dev/null 2>&1; then
    log "部署成功"
    exit 0
  fi
  sleep 1
done
die "健康检查 90s 内未通过"
```

- [ ] **Step 2: 语法检查**

```bash
chmod +x scripts/deploy.sh
bash -n scripts/deploy.sh && echo "syntax OK"
```

Expected: `syntax OK`。

- [ ] **Step 3: 逻辑自检（无需 joox）**

```bash
APP_DIR=/tmp/devlens-fixture bash -x scripts/deploy.sh 2>&1 | grep -E "找不到|not found|die|ERROR" | head
```

Expected: 在缺少 uv 的沙箱中第一步即失败（`uv not found`），确认 `set -euo pipefail` 与 `die` 生效。此步骤只验证失败路径，真正成功路径在 Task 8 部署到 joox 时验证。

- [ ] **Step 4: 提交**

```bash
git add scripts/deploy.sh
git commit -m "feat: 部署脚本 deploy.sh（幂等，含 .env/证书/systemd/nginx/健康检查）

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 8: 端到端验证与收尾提交

**Files:**
- Modify: `docs/superpowers/specs/2026-08-03-devops-deploy-logo-design.md`（如无修改则跳过）
- 追加提交：剩余未提交改动

**Interfaces:**
- Consumes: 所有已产出文件
- Produces: 可部署的分支状态 + 本地构建证明

- [ ] **Step 1: 本地全量构建（含 logo 与 favicon 改动）**

```bash
cd /home/tutuos/CodeLab/devlens/frontend
rm -rf .next
NEXT_PUBLIC_API_URL=/api/v1 pnpm build
```

Expected: `next build` 成功。随后验证产物含 favicon：

```bash
ls .next/server/app/ | grep -E "icon|favicon" || find .next -name "*.ico" -o -name "icon.svg" | head
```

Expected: 能定位到 `.ico` 与 `icon.svg`（Next 约定文件自动复制）。

- [ ] **Step 2: 后端冒烟（回归）**

```bash
cd /home/tutuos/CodeLab/devlens/backend
.venv/bin/python -c "from app.main import app; print('backend OK')"
```

Expected: `backend OK`。

- [ ] **Step 3: 检查工作区剩余改动并提交**

```bash
cd /home/tutuos/CodeLab/devlens
git status --short
# 确认只剩 backups/ 未跟踪（不纳入）；若有其它遗留改动，逐一确认后提交
git add docs/superpowers/plans/2026-08-03-deploy-logo.md
git commit -m "docs: 添加部署自动化 + logo 实现计划

Co-Authored-By: Claude <noreply@anthropic.com>"
```

注意：spec 文档（`docs/superpowers/specs/...`）此前未提交，一并 `git add` 提交。

- [ ] **Step 4: 汇总提交历史**

```bash
git log --oneline feat/ui-ux-pro-max-international-theme..feat/github-action-deploy-logo
```

Expected: 列出 Task 1-7 各提交 + docs 提交，无遗漏。

---

## 部署上线（人工步骤，非自动化任务）

以下步骤在代码提交并推送到 GitHub 后，由用户完成，供参考：

1. **推送分支并合并到 main**：
   ```bash
   git push origin feat/github-action-deploy-logo
   # 在 GitHub 开 PR，合并到 main（合并后 push main 触发 workflow）
   ```
2. **配置 GitHub Secrets**（仓库 Settings → Secrets and variables → Actions）：
   - `JOOX_HOST`：joox 的 IP 或主机名
   - `JOOX_USER`：SSH 用户名（需 passwordless sudo）
   - `JOOX_SSH_KEY`：SSH 私钥全文
3. **首次部署后填 API key**：登录 joox，编辑 `/opt/devlens/backend/.env` 填入 `COPILOT_PROVIDER_API_KEY`，然后 `sudo systemctl restart devlens-backend`。
4. **访问**：浏览器打开 `https://joox:7504`，信任自签名证书；确认侧边栏 logo 与浏览器标签 favicon 生效。

## Self-Review 结论

- **Spec 覆盖**：§4.1 logo/favicon → Task 1-3；§4.2 Action → Task 4；§4.3 nginx/systemd/deploy.sh → Task 5-7；§5 部署逻辑（自检/uv sync/.env 不覆盖/前端构建/证书/nginx/systemd/健康检查）→ Task 7；§6 错误处理（set -euo、nginx -t 门禁、.env 不覆盖）→ Task 7；§7 验证 → Task 8 + 上线步骤；§9 提交策略（独立分支）→ Task 1 Step 1 建分支。
- **占位符扫描**：base64 常量已完整内嵌于 Task 1 Step 1，无 TBD/TODO/占位符。
- **类型一致性**：`Logo` 组件签名、systemd 模板占位符 `__USER__`/`__APP_DIR__`、nginx 端口、`NEXT_PUBLIC_API_URL=/api/v1` 在各 Task 间一致。
