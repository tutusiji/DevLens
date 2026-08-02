# 多租户、能力评估与报告导出运行指南

本版本把 DevLens 的三个核心数据闭环升级为可售化能力：

1. **规则即资产**：角色关联 Skill Group；实测评估读取该组已启用规则，并把本次实际投入的规则全文冻结到 `developer_evaluations.rule_snapshot`。
2. **项目组合决策**：每个成功的项目分析都会写入 `project_assessment_snapshots`；已有项目首次访问组合对比时会从旧的 `debt_trend` 建立 `legacy_baseline` 快照，避免趋势图没有历史点。
3. **租户隔离与 RBAC**：团队/组织、项目、仓库、开发者、Skill Source / Skill / Skill Group、能力角色及评估记录均带有 `tenant_id`。请求上下文必须对应一个有效的租户成员关系。

## 数据迁移

应用启动时 `backend/app/main.py` 会执行增量迁移：

- 创建 `tenants`、`account_users`、`tenant_memberships`、`project_assessment_snapshots`、`report_exports`；
- 为既有业务表补充 `tenant_id`，并把历史数据回填至 `tenant-default`；
- 为既有评估记录补 `project_id`、`rule_snapshot`；
- 将早期 `capability_roles.key` 全局唯一约束升级为 `(tenant_id, key)`，使每个客户可维护自己的一套角色阈值。

首次启动会创建本地工作区：

| 字段 | 值 |
| --- | --- |
| Tenant | `tenant-default` / `local` |
| User | `usr-local-admin` / `local-admin@devlens.local` |
| Role | `owner` |

## 认证接入

DevLens **不保存密码或外部 SSO Token**。生产环境由 API Gateway / SSO 在经过认证后注入以下可信头：

```http
X-DevLens-User-Id: usr-...
X-DevLens-Tenant-Id: tenant-...
```

上线时必须关闭本地回退身份：

```bash
export DEVLENS_ALLOW_LOCAL_ADMIN=false
```

本地开发默认允许无头请求回退为 `tenant-default` 的 owner，以保证现有单机工作流可继续运行。前端代理会将上述两个头透传到 FastAPI；若需在浏览器中模拟某位成员，可设置：

```js
localStorage.setItem('devlens-user-id', 'usr-...')
localStorage.setItem('devlens-tenant-id', 'tenant-...')
```

## RBAC 权限矩阵

| 角色 | 能力 |
| --- | --- |
| `owner` / `admin` | 所有操作：项目接入、规则与标准管理、成员授权、实测、报告导出 |
| `evaluator` | 读取项目/人员/规则，执行实测，查看组合趋势，导出报告 |
| `analyst` | 只读评估/趋势与导出报告，不可触发实测 |
| `viewer` | 只读项目、人员、规则、评估和趋势，不可导出或写入 |

成员管理 API（仅 `owner` / `admin`）：

```text
GET    /api/v1/auth/me
GET    /api/v1/tenants/current/members
POST   /api/v1/tenants/current/members
PATCH  /api/v1/tenants/current/members/{membership_id}
DELETE /api/v1/tenants/current/members/{membership_id}
POST   /api/v1/tenants
```

## 评估、趋势与报告 API

### 开发者能力实测

```text
POST /api/v1/developers/{developer_id}/evaluations
GET  /api/v1/developers/{developer_id}/evaluations/latest
GET  /api/v1/developers/{developer_id}/evaluations/{evaluation_id}
GET  /api/v1/developers/{developer_id}/evaluations/{evaluation_id}/report?format=html|pdf
```

触发评估时 `repo_path` 必须与**当前租户已接入仓库**的 `repositories.path` 完全匹配，不能传任意本地路径。后端按照：

```text
developer.role_type
  → capability_roles.skill_group_id
  → 已启用 Skill 规则
  → git author 提交及代码样本
  → LLM 各维 0–100 评分
  → capability_standards 12 职级阈值
  → achieved_level / best_level / gaps
```

执行，并把规则快照保存到评估记录，以便报告审计和规则版本追溯。

### 项目组合

```text
GET /api/v1/project-comparisons?project_ids=p1,p2
GET /api/v1/projects/{project_id}/trend
GET /api/v1/reports/project-comparison?project_ids=p1,p2&format=html|pdf
GET /api/v1/report-exports
```

- `project_ids` 为空时导出/对比当前租户全部项目。
- `score_delta` 对比最近两个评分历史快照。
- 报告导出记录会写入 `report_exports`，记录类型、格式、主体 ID、发起人和时间；报告内容动态生成，不重复存储含代码证据的敏感正文。

## PDF 运行条件

PDF 由服务器上的 headless Chrome 通过本地 HTML 渲染生成，默认路径为：

```text
/usr/bin/google-chrome
```

如安装路径不同，配置：

```bash
export DEVLENS_CHROME_BINARY=/path/to/google-chrome
```

Chrome 不可用时，HTML 导出仍可使用，PDF 接口返回 `503`。HTML 使用打印样式，可直接在客户浏览器中另存为 PDF。

## 验证命令

```bash
cd /home/tutuos/CodeLab/devlens

# 后端模型、评估判定、Prompt 与 Git 采样
backend/.venv/bin/python backend/scripts/verify_evaluations.py

# 前端类型与生产构建
cd frontend
pnpm exec tsc --noEmit
pnpm build
```
