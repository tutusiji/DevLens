# DevLens 研发棱镜 — 项目上下文

## 项目定位
基于 AI 的研发认知系统：把 Git 仓库转化为组织能力画像。三位一体评估模型：项目（事）/ 技术（Skill 规则）/ 人才（人）。

## 技术栈
- 后端：Python 3.13 / FastAPI / SQLAlchemy 2.0 / PostgreSQL（本机库名 `devlens`，Unix socket peer auth）
- LLM：DeepSeek（Anthropic 兼容端点，env: `COPILOT_PROVIDER_BASE_URL` / `COPILOT_PROVIDER_API_KEY` / `COPILOT_MODEL`），封装在 `backend/app/llm.py`（chat / chat_json）
- 向量库：Qdrant（http://127.0.0.1:6333）+ sentence-transformers all-MiniLM-L6-v2，封装在 `backend/app/rag.py`
- 前端：Next.js 15 (App Router) / React 19 / TypeScript / HeroUI v3 + Tailwind 4 / recharts，dev 端口 3800
- 包管理：后端 uv（`backend/.venv`），前端 pnpm（`frontend/`）

## 目录结构
- `backend/app/`：main.py（FastAPI 入口 + 启动迁移）、models.py（ORM）、schemas.py（Pydantic，CamelModel 输出 camelCase）、analyzer.py（分析流水线，含 SKILL_GROUPS 硬编码）、git_collect.py（git 采集）、llm.py、rag.py、seed.py、routers/（projects/developers/teams/repos/overview/config）
- `frontend/app/`：页面（page.tsx / projects / developers / teams / team-spaces / capability-standards / models / vector-models / graph / repos / onboard）
- `frontend/lib/`：api.ts（USE_MOCK 开关，配置 NEXT_PUBLIC_API_URL 走真实后端）、types.ts、mock-data.ts
- `docs/架构设计/`：架构设计文档（含 Skill 管理模块详细设计文档）

## 关键约定
- ORM 主键用 String（如 `p-xxx`、`ins-xxx`），复杂结构用 JSON 字段，不拆过度拆表
- Pydantic schema 用 CamelModel（alias_generator=to_camel，前端 camelCase）
- 前端组件复用 `components/ui/`（Card/Button/Input/Badge/Table/Segmented/Sheet），图表用 `components/charts.tsx` + widgets
- API 全部 `/api/v1` 前缀，前端 api.ts 中 mock/real 双实现
- LLM 调用走 `llm.py` 的 `chat_json`，prompt 中文，输出严格 JSON，容错解析

## 常用命令
- 后端：`cd backend && .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000`（或 `uv run uvicorn ...`）
- 前端：`cd frontend && pnpm dev`（端口 3800）/ `pnpm build`
- 数据库：`psql devlens`（Unix socket peer auth）

## 当前能力
- **开发者能力实测评估**：`developer_evaluations` + `evaluation.py` + `routers/evaluations.py`。开发者详情页从当前租户的已接入仓库选择 Git 作者，按角色的 Skill Group 实测评分，和能力标准阈值比对后输出达标职级、参考职级和差距；评估中冻结 `rule_snapshot`，保证「规则即资产」的审计闭环。
- **项目组合对比 / 趋势**：`project_assessment_snapshots` 在每次完成项目分析后写入；`/project-portfolio` 负责批量横向对比、历史趋势与报告入口。
- **报告导出**：HTML/PDF 导出分别由 `/reports/project-comparison` 与开发者评估 report API 提供，导出审计写入 `report_exports`。
- **多租户 / RBAC**：`access.py` 解析 `X-DevLens-User-Id`、`X-DevLens-Tenant-Id`，业务资产按 `tenant_id` 隔离；成员和角色在 `/access-control` 管理。生产接入与环境变量见 `docs/guides/tenant-rbac-reporting.md`。

已完成模块：Skill 管理、Env Inventory、能力标准后端化（capability.py）、全站 HeroUI 化。
