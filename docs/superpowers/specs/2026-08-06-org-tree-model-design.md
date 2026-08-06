# 组织架构统一团队树 — 设计文档

日期：2026-08-06
状态：已批准（用户确认设计）

## 1. 背景与目标

### 现状问题

组织架构是固定三层模型，创建团队被强制要求先有上级：

```
大团队 (large_teams)   ← 仅 seed，无创建 UI
  └── 团队空间 (team_spaces)   ← 创建时【必选】大团队
        └── 小组 (team_groups)  ← 创建时必挂团队空间
```

用户反馈（2026-08-06）：
1. **无法创建团队**：新建团队空间时"归属大团队"是必填项，但 `tenant-default`（admin 默认租户）没有大团队数据，
   下拉框为空 → HTML required 拦截提交 → 无法创建。
2. **模型本身不合理**：团队既能向上归属更大的团队、又能向下包含小团队，创建时不该被迫有默认上级或默认下级。

### 目标

把组织架构重构为**统一团队树**：

- 一个 `team` 实体（复用 `team_spaces` 表），`parent_id` 自引用、可空。
- 任意深度嵌套：根团队 → 子团队 → 孙团队……
- 创建团队只需填名称；父级可选（`parent_id` 为空 = 根团队）。
- 开发者归属**单个团队节点**（最具体的那个；原"小组"升级为叶团队）。
- 支持把团队移动到另一个父节点下（组织调整）。

## 2. 已确认决策

| 决策点 | 结论 |
|---|---|
| 模型形态 | 统一团队树（一个 team 实体 + parent_id 自引用），非固定层级 |
| 本轮范围 | 后端模型+迁移+API + 前端树 UI 全做 |
| 开发者归属 | 单节点归属：每个开发者属于一个团队节点；原 group_id 废弃 |
| 移动团队 | PATCH 支持改 parent_id（支持移动）；校验属本租户、非自身、无环 |
| 边界 | `teams` 分析聚合表（Team model、avg_score/bus_factor）不动 |

## 3. 数据模型

`team_spaces` 表升级为统一组织树：

```python
class TeamSpace(Base):
    __tablename__ = "team_spaces"
    id = Column(String, primary_key=True)
    tenant_id = Column(String, default="tenant-default", index=True)
    parent_id = Column(String, ForeignKey("team_spaces.id"), nullable=True)  # 新增：可选父团队
    name = Column(String, nullable=False)
    description = Column(Text)
    owner_id = Column(String)
    owner_name = Column(String)
    status = Column(String, default="active")
    created_at = Column(String)
    updated_at = Column(String)
    member_ids = Column(JSON, default=list)   # 直属成员
    project_ids = Column(JSON, default=list)  # 直属项目
```

- `large_teams`、`team_groups` 表废弃（数据迁入 `team_spaces`，表保留但不再读写）。
- `developers.group_id` 列废弃；`developers.team_id` 指向任意团队节点（迁移后为叶团队）。
- `projects.team_id` 不变；`projects.group` 展示字段保留。

## 4. 数据迁移（`ensure_migrate` 幂等，启动时执行）

1. `large_teams` 每行 → `team_spaces` 新行：`parent_id=None`（根节点），保留 name/description。
2. `team_groups` 每行 → `team_spaces` 新行：`parent_id=原 team_id`（子节点）。
3. `developers`：有 `group_id` 的 → `team_id` 改为该 group 对应的新团队节点 id，清空 `group_id`；
   无 `group_id` 的保留原 `team_id`。
4. 幂等：`large_teams`(lt-*) 与 `team_groups`(g-*) 的 id 和 `team_spaces`(t1/team-*) 不冲突，
   迁移时**保留原 id**，以「`team_spaces` 中已存在该 id」为幂等键，不重复插入。
5. `member_ids`/`project_ids` 缓存在迁移时按原归属重建。

## 5. 后端 API（routers/teams.py）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/team-spaces` | 返回全部组织节点（含 `parentId`、`parentName`），前端建树 |
| POST | `/team-spaces` | `{name*, parentId?, description?, ownerId?, ownerName?}` — **父级可选**，修复无法创建 |
| PATCH | `/team-spaces/{id}` | 改 `name/description/ownerId/ownerName/parentId` — 支持移动 |
| GET | `/team-spaces/{id}/subtree` | （可选）返回某节点子树 |

- 校验（POST/PATCH）：`parentId` 属当前租户、非自身；PATCH 改 parent 时禁止成环（新父不是自身的后代）。
- 权限：维持 `require_permission("project:write")` 写、`"project:read"` 读。
- `GET /large-teams`、`GET/POST /team-groups`：废弃，返回空列表（前端更新后不再调用）。
- 注意：`GET /teams`（分析聚合）与 `models.Team` 不动。

## 6. 前端改造

### types.ts / api.ts / mock-data.ts
- `TeamSpace` 增加 `parentId?`/`parentName?`；`LargeTeam`、`TeamGroup` 类型废弃（或保留不引用）。
- `api.createTeamSpace` 类型加 `parentId?`；新增 `updateTeamSpace(id, {parentId?, ...})` 支持移动。
- 删除 `getLargeTeams`/`getTeamGroups` 调用。

### team-space-provider.tsx
- 加载单棵树（flat list），构建 `tree`（children 索引）+ `teamIndex`（id→节点）。
- 移除 `largeTeams`、`activeLargeTeamId`、`visibleSpaces`（按 largeTeamId 过滤）概念；
  `activeTeamSpaceId` = 当前选中节点；新增 `moveTeam(id, newParentId)`。

### app-shell.tsx（侧边栏）
- 大团队切换器 → 团队树浏览（渲染根 → 子节点，选中节点设为 active）。

### team-spaces/page.tsx
- 表格列表 → **递归树渲染**（展开/折叠）。
- 创建表单：名称必填，父级**可选**（树选择器，"无父团队"=根）。
- 编辑支持更换父级（移动）。

### onboard/page.tsx
- 两段式"大团队 + 团队空间" → 单个团队树选择器（显示路径，如"技术研发中心 / 平台架构组"）。

### developers/page.tsx
- `dev.groupId` 徽标逻辑 → 显示叶团队名（`dev.team`）。

## 7. 验证

1. 启动后端，`ensure_migrate` 后 seed 树正确：根（技术研发中心/数据智能中心）→ 团队空间 → 小组三级都成为 `team_spaces` 节点，parent 关系正确。
2. `POST /team-spaces` 不带 `parentId` → 创建成功（根团队）；带 `parentId` → 挂到指定父下。
3. `PATCH /team-spaces/{id}` 移树：新 parent 生效；尝试把节点移到自己的后代 → 409/422 拒绝。
4. 前端：树展开/折叠、创建（无父级）、移动、onboard 单选择器、开发者页叶团队名，均正常。
5. 空租户（tenant-default）下创建团队不再被必填大团队阻塞。
6. 分析 `GET /teams`（teams 页）不受影响。

## 8. 备注

- 后端无 pytest 基建，验证按 §7 用 curl + 浏览器手动。
- `team_groups`/`large_teams` 表保留但不读写（避免删表风险），前端停止调用对应 API。
