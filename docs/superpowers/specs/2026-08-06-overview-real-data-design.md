# Overview 概览页真实化 — 设计文档

日期：2026-08-06
状态：已批准（用户确认设计）

## 1. 背景与目标

Overview 首页 4 个接口目前返回硬编码演示数据（`backend/app/routers/overview.py`）：

| 接口 | 现状 | 行号 |
|---|---|---|
| `GET /api/v1/trinity-matrix` | 硬编码"平台架构组/陈思/订单系统"矩阵 | overview.py:36 |
| `GET /api/v1/health-trend` | 硬编码 2月-7月 六组假数据 | overview.py:51 |
| `GET /api/v1/risk-alerts` | 硬编码 5 条假告警 | overview.py:63 |
| `GET /api/v1/data-sources` | 硬编码 GitLab/MR/Issue/CI/SonarQube 概念列表 | overview.py:74 |

目标：这 4 组接口全部改为从数据库真实数据计算，空库/新租户时优雅降级（返回空结构而非崩溃），
前端图表对空数组安全。

已确认决策：
- 本轮只做 Overview 真实化，不包含文档对齐、RAG/任务队列工程化。
- data-sources 卡片改为展示系统真实集成（Git/LLM/Qdrant/Env 扫描/Skill 规则），
  不再展示 GitLab/SonarQube 等未接入的概念数据源。

## 2. 代码组织

新建 `backend/app/overview_service.py`，把计算抽为 4 个纯函数；`overview.py` 只保留路由 + 权限校验。

```python
# overview_service.py 签名（全部 tenant 隔离，空库返回空结构）
def compute_trinity_matrix(db, tenant_id: str) -> dict: ...   # {rows, cols, cells}
def compute_health_trend(db, tenant_id: str) -> list[dict]: ... # [{month, quality, security, health}]
def compute_risk_alerts(db, tenant_id: str) -> list[dict]: ...  # [{id, type, level, title, description, time, action}]
def compute_data_sources(db, tenant_id: str) -> list[dict]: ... # [{name, coverage, status}]
```

理由：与现有 `portfolio.py` 的 `ensure_*` helper 风格一致；每个函数可独立单测；
空库降级集中处理；避免 overview.py 膨胀到 400+ 行。

## 3. 各接口算法

### 3.1 trinity-matrix（真实团队×项目覆盖矩阵）

- `rows` = 租户下有成员的团队名（`team_spaces`，有 `member_ids` 的），按成员数降序取前 8。
- `cols` = 租户项目名（`projects`），按 commits 降序取前 8。
- `cells[i][j]` = 团队 i × 项目 j 的交集，来源优先级：
  1. `Developer.project_contributions`（真实跨团队贡献，含 project_id/commits/ownership）建 team→project 邻接；
  2. 无贡献数据时回退 `TeamSpace.project_ids`（所属团队）与 `Project.team_id`。
- cell 内容：`{score: 项目.score, members: 该团队贡献该项目的开发者数, owner: 该团队对该项目 ownership/overall 最高的开发者名（回退 team.owner_name）}`。
- 无交集 → `None`。
- 空库 → `{rows: [], cols: [], cells: []}`。

### 3.2 health-trend（真实月度健康趋势）

- 数据源 `project_assessment_snapshots`（与 `portfolio.py` 同表）。
- 按月聚合：`month = recorded_at[:7]`（`YYYY-MM`），取最近 6 个月，逐月对 quality/security 做项目均值。
- `health = snapshot.score`（综合健康分）；quality/security 直接取快照字段。
- 无快照的月份跳过；整表空 → `[]`。
- 兜底：复用 `portfolio.py` 的 `ensure_project_baseline_snapshots` 思路，保证至少当前月有基线点。

### 3.3 risk-alerts（真实风险预警，按严重度取前 8）

| type | 来源条件 | level 映射 |
|---|---|---|
| `bus_factor` | ModuleRisk.ownership ≥ 60 且 backup_owner 为空 | critical→high |
| `critical_risk` | ModuleRisk.severity = critical | high→medium |
| `tech_debt` | FixPriority.priority = P0 且 status = open | medium→low |
| `skill_gap` | CapabilityGap（current 明显低于 target）或 DeveloperEvaluation.gaps 中 gap ≥ 20 | 按缺口幅度 |

- `description`/`action` 从数据字段拼装（模块名、缺口维度、backup 缺失、P0 标题等）。
- `time` 优先取关联时间戳（evaluation.updated_at / project.last_analyzed），无则"最近"。
- 全部按租户隔离；无数据 → `[]`。

### 3.4 data-sources（真实集成状态）

| name | connected 判定 | coverage |
|---|---|---|
| Git 仓库 | ≥1 条 repo 记录 | synced 仓库数 / 项目数 |
| LLM 分析 | `settings.llm_api_key` 非空 | 已分析项目（score 非空）占比 |
| 向量库 Qdrant | 实时探活 `get_qdrant().get_collections()` 成功 | 有 qdrant collection 的项目占比 |
| Env 扫描 | ≥1 次 `env_inventory_scans` 记录 | 已扫描项目占比 |
| Skill 规则 | ≥1 条 enabled skill | enabled skill / 租户 skill 总数 |

- status ∈ `connected | partial | disconnected`（coverage>0 但部分 → partial）。
- Qdrant 探活必须 try/except，失败 → disconnected，不抛错。

## 4. 空库降级

所有接口在数据缺失时返回最小可用结构，不抛 500：
- trinity-matrix → `{rows:[], cols:[], cells:[]}`
- health-trend / risk-alerts / data-sources → `[]`
- 前端对空数组安全（Recharts 空数据不渲染图表，见 §6）。

## 5. 测试

- 单测 `backend/tests/test_overview_service.py`（如已有测试目录则加入）：
  - 各函数在空租户返回空结构；
  - seed 数据下 trinity-matrix 生成合理行列、cell 字段非空；
  - health-trend 按月聚合正确、health=score；
  - risk-alerts 覆盖 4 种类型、按 severity 排序；
  - data-sources 在无 key / Qdrant 不可达时状态正确。
- 若无测试基建，先确认现状再决定单测 vs 手动 curl 验证。

## 6. 前端适配

- 验证 `frontend/app/page.tsx` 对空数组的渲染（Recharts 空数据不崩）。
- 必要时补空态文案；改动最小化，仅当现有代码确实会崩。

## 7. 验收标准

1. `GET /api/v1/trinity-matrix` 返回基于 seed 数据的真实矩阵，无硬编码团队名/人名。
2. `GET /api/v1/health-trend` 返回基于 `project_assessment_snapshots` 的月度聚合，health 取自 score。
3. `GET /api/v1/risk-alerts` 返回基于 ModuleRisk/FixPriority/CapabilityGap/DeveloperEvaluation 的真实告警。
4. `GET /api/v1/data-sources` 返回 Git/LLM/Qdrant/Env/Skill 真实集成状态，无 GitLab/SonarQube 字样。
5. 空租户下 4 接口全部返回空结构，HTTP 200。
6. 前端概览页正常渲染，无 console 报错。
