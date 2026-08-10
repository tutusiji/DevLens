# DevLens 总开发路线图（P0 → P6）

> 本文档是 DevLens 从"项目接入 → 深度智能 → 规模化"的总开发清单。
> **每完成一块就在对应条目前打 ✅**，作为唯一进度事实来源。
> 更新日期：2026-08-11

## 进度总览

| 阶段 | 主题 | 状态 |
| --- | --- | --- |
| P0 | 网络拉取改造 + 管理闭环 | ✅ 完成 |
| P1 | 工程化（搜索 / 测试 / 迁移） | ✅ 完成 |
| P2 | 代码平台集成 + 智能建议 | ✅ 完成 |
| P3 | 深度分析（安全扫描 / 预测） | ✅ 完成 |
| P4 | 基础设施（Docker / Celery / K8s） | ✅ 完成 |
| P5 | 智能预测与推荐 | ✅ 完成 |
| P6 | 规模化与开放平台 | 🔄 进行中 |

---

## P0 · 网络拉取改造 + 管理闭环 ✅

**目标**：项目接入只支持远程 Git（GitHub / GitLab / Gitee / Gitea），私有仓库凭证安全持久化；补齐项目/开发者/团队管理闭环。

- [x] `vcs.py`：远程 clone 工具，仅接受 URL，拒绝本地 `.git` 目录
- [x] 指定分支克隆（`--branch --single-branch`），超时可配置（`DEVLENS_CLONE_TIMEOUT`）
- [x] `security.py`：Fernet 加密，`Repository.access_token_encrypted` 落库，重分析自动复用
- [x] 缓存目录按 `tenant_id/project_id` 隔离，避免同名覆盖与跨租户泄漏
- [x] 前端 onboard 移除 local/remote 切换，仅远程 URL + Token + 分支
- [x] `DELETE /projects/{pid}`：级联清理 + 删除本地缓存
- [x] `POST /projects/{pid}/reanalyze`：复用加密 token 触发重新分析
- [x] 开发者 `PATCH`（编辑归属：组织树团队/工号/邮箱）
- [x] 开发者 `POST merge-identities`（身份合并）
- [x] `GET /developers?team_space_id=` 按组织树过滤
- [x] `identity_matcher.py`：邮箱 / 工号 / 姓名 / 拼音多维度身份匹配

## P1 · 工程化 ✅

**目标**：全局搜索真实化、自动化测试、数据库迁移体系。

- [x] `GET /search` 全局搜索（项目 / 开发者 / 团队空间 / 团队）
- [x] 命令面板接真实搜索，移除 mock-data
- [x] pytest 冒烟测试 17 个（auth / RBAC / 项目创建加密 / 删除 / 重分析 / 身份匹配）
- [x] Alembic 迁移体系（baseline + env.py 接 `DATABASE_URL`）
- [x] `ensure_migrate` 兼容存量库（新增列补迁移）

## P2 · 代码平台集成 + 智能建议 ✅

**目标**：GitHub / GitLab / Gitee 凭证管理、仓库发现与批量导入、Webhook 自动重分析、LLM 成长建议。

- [x] `RepositoryProviderConfig` 模型（凭证 / Webhook Secret 加密存储）
- [x] `GET/POST/DELETE /providers` 凭证管理
- [x] `GET /repos/discover`：组织/用户仓库发现
- [x] `POST /repos/import`：批量导入为项目并触发分析
- [x] `POST /webhooks/{provider}`：GitHub HMAC-SHA256 / GitLab / Gitee token 校验，push 自动重分析
- [x] `POST /developers/{did}/growth-advice`：基于实测评估生成成长建议
- [x] 前端 `/providers` 平台集成页（凭证 + 发现 + 批量导入）
- [x] 开发者详情页"生成/更新成长建议"

## P3 · 深度分析 ✅

**目标**：静态安全扫描、项目健康度趋势预测。

- [x] `security_scanner.py`：零依赖静态安全扫描（硬编码密钥 / 危险函数 / 危险配置）
- [x] 安全发现合并进项目分析 insights（`skillGroup=security-scan`）
- [x] `GET /projects/{pid}/forecast`：历史快照线性回归趋势预测（评分 / 质量 / 安全 / 技术债）

## P4 · 基础设施 ✅

**目标**：容器化编排、异步任务骨架、Kubernetes 部署。

- [x] `docker-compose.yml`：PostgreSQL + Qdrant + Backend + Frontend
- [x] 前后端 Dockerfile（Next standalone 输出）
- [x] `celery_app.py` + `tasks.py`：Celery 异步任务骨架（可选替换 daemon thread）
- [x] `deploy/k8s/`：backend（含 worker）+ frontend + PostgreSQL / Qdrant StatefulSet
- [x] 端到端联调并修复：project detail 500 / reanalyze run 状态串线 / delete 外键与 JSON LIKE

---

## P5 · 智能预测与推荐 ✅

**目标**：从"分析现状"到"预判未来"，把预测能力落到前端与团队维度。

### 完成清单
- [x] 项目详情页接入 `/forecast` 趋势预测可视化（`ForecastCard` 组件）
- [x] `GET /teams/{tid}/forecast`：团队健康度线性回归预测
- [x] `POST /developers/{did}/career-path`：基于能力差距推荐晋升路径（LLM）
- [x] `POST /teams/{tid}/hiring-advice`：基于团队能力缺口生成招聘建议（LLM）
- [x] 前端：团队卡"生成招聘建议"弹窗（预测 + 建议）、开发者详情"晋升路径推荐"
- [ ] 组织风险预警配置（阈值 + 通知渠道占位）→ 移至 P6 组织预警

## P6 · 规模化与开放平台 🔄

**目标**：支撑多团队多仓库的大规模使用与对外能力开放。

### 待办清单
- [ ] API 开放平台：应用级 Token 管理与调用审计
- [ ] Celery 正式启用：替换 daemon thread，支持横向扩容
- [ ] 监控告警：Prometheus 指标 + 健康/错误率上报
- [ ] 组织风险预警：阈值配置 + 通知渠道（从 P5 移入）
- [ ] 大规模仓库性能优化（增量分析、缓存复用）
- [ ] 行业基准对标数据（评分百分位参照）

---

## 技术债务与维护

- [ ] tree-sitter AST 解析（替代正则 import 提取）
- [ ] Alembic 从 baseline 逐步接管全部 schema 变更
- [ ] `USE_MOCK` 分支收敛（仅保留纯前端演示构建）
- [ ] 升级 CI：pytest + tsc + build 全量门禁
