# 组织架构统一团队树 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把固定三层组织架构（large_team→team_space→team_group）重构为统一团队树，创建团队不再强制父级，支持移树。

**Architecture:** `team_spaces` 表升级为唯一组织树（新增可空 `parent_id` 自引用），`ensure_migrate()` 把 `large_teams`(lt-*) 迁为根节点、`team_groups`(g-*) 迁为子节点（保留原 id 作幂等键），`developers.group_id` 并入 `team_id`（单节点归属）。API `POST /team-spaces` 父级可选、新增 `PATCH /team-spaces/{id}` 支持移动（禁环）。前端 provider 加载单棵树并构建索引，侧边栏/管理页树形展示，onboard 单团队选择器。

**Tech Stack:** Python 3.13 / FastAPI / SQLAlchemy 2.0 / PostgreSQL；Next.js 15 / React 19 / TS / HeroUI v3 / Tailwind 4。

## Global Constraints

- 后端无 pytest 基建：每个任务用 curl / psql 验证（已有惯例），不引入测试框架。
- `teams` 分析聚合表（`models.Team`，avg_score/bus_factor/capability）**不改**。
- `team_groups`/`large_teams` 表保留但不读写；前端停止调用 `/large-teams`、`/team-groups`。
- 迁移幂等键 = 原 id（lt-*/g-* 与 team_spaces 的 t*/team-* 不冲突）。
- 所有写操作维持 `require_permission("project:write")`，读操作 `"project:read"`。
- 上线需要：重启后端 `sudo systemctl restart devlens-backend.service` + 前端重新 `pnpm build`（用户明确要求）。
- **前端改动强耦合**：types/api/provider/多页面互相依赖，合并为一个任务（Task 5），以 `pnpm build` 全量通过为准。

---
### Task 1: 模型 + Schema（后端）

**Files:**
- Modify: `backend/app/models.py:22-35`（TeamSpace）
- Modify: `backend/app/schemas.py:320-331`（TeamSpace）、`:333-343`（TeamGroup，保留）

**Interfaces:**
- Produces: `TeamSpace.parent_id: Optional[str]`；schema `TeamSpace{parent_id?, parent_name?, ...}`、`TeamSpaceUpsert{name?, parent_id?, description?, owner_id?, owner_name?}`。

- [ ] **Step 1: 改模型** — `TeamSpace` 把 `large_team_id = Column(String)` 换成：
```python
    parent_id = Column(String, ForeignKey("team_spaces.id"), nullable=True)  # 可选父团队
```

- [ ] **Step 2: 改 schema** — `TeamSpace` 把 `large_team_id: str` 换成：
```python
class TeamSpace(CamelModel):
    id: str
    name: str
    parent_id: Optional[str] = None
    parent_name: Optional[str] = None
    description: Optional[str] = None
    owner_id: Optional[str] = None
    owner_name: Optional[str] = None
    status: str = "active"
    created_at: str = ""
    updated_at: str = ""
    member_ids: list[str] = []
    project_ids: list[str] = []


class TeamSpaceUpsert(CamelModel):
    """POST/PATCH 团队共用；name 在 POST 处理器强制，PATCH 可部分更新。"""
    name: Optional[str] = None
    parent_id: Optional[str] = None
    description: Optional[str] = None
    owner_id: Optional[str] = None
    owner_name: Optional[str] = None
```
（`LargeTeamM`/`TeamGroup` schema 保留定义，供迁移期读取，前端不再引用。）

- [ ] **Step 3: 编译检查**
```bash
cd backend && .venv/bin/python -m py_compile app/models.py app/schemas.py
```

---
### Task 2: 迁移 + Seed（后端）

**Files:**
- Modify: `backend/app/main.py:21`（`ensure_migrate` 加列 + 末尾调 `_ensure_org_tree`）
- Modify: `backend/app/seed.py:90-115`（组织数据块）

**Interfaces:**
- Consumes: `models.TeamSpace.parent_id`（Task 1）
- Produces: `_ensure_org_tree(db)` —— 幂等迁移；seed 树结构（lt-* 根 → t* 空间 → g-* 小组叶）。

- [ ] **Step 1: `ensure_migrate` 加列** — 在 `ensure_migrate()` 的 `with engine.connect() as conn:` 块内追加：
```python
        cols = [c["name"] for c in insp.get_columns("team_spaces")]
        if "parent_id" not in cols:
            conn.execute(text("ALTER TABLE team_spaces ADD COLUMN parent_id VARCHAR"))
            conn.commit()
```

- [ ] **Step 2: 新增 `_ensure_org_tree`** — 在 `main.py` 定义，并在 `lifespan` 里 `ensure_migrate()` 之后调用一次：
```python
def _ensure_org_tree():
    """组织三表合一：large_teams→根，team_groups→子，developers.group_id→team_id。幂等（按 id）。"""
    from . import models
    from .db import SessionLocal
    with SessionLocal() as db:
        for lt in db.query(models.LargeTeam).all():
            if db.query(models.TeamSpace).filter_by(id=lt.id).first():
                continue
            db.add(models.TeamSpace(
                id=lt.id, name=lt.name, description=lt.description, parent_id=None,
                status="active", created_at="", updated_at="", member_ids=[], project_ids=[],
                tenant_id=lt.tenant_id,
            ))
        db.commit()
        for g in db.query(models.TeamGroup).all():
            if db.query(models.TeamSpace).filter_by(id=g.id).first():
                continue
            db.add(models.TeamSpace(
                id=g.id, name=g.name, description="", parent_id=g.team_id,
                owner_id=g.lead_id, owner_name=g.lead_name,
                status="active", created_at="", updated_at="",
                member_ids=g.member_ids or [], project_ids=g.project_ids or [],
                tenant_id=g.tenant_id,
            ))
        db.commit()
        for d in db.query(models.Developer).all():
            if d.group_id:
                group = db.query(models.TeamSpace).filter_by(id=d.group_id).first()
                d.team_id = d.group_id
                d.team = group.name if group else d.team
                d.group_id = None
        db.commit()
```

- [ ] **Step 3: 重写 seed 组织数据** — `seed.py` 删除 `LargeTeam`/`TeamGroup` 两段，`TeamSpace` 改为树结构（根 = lt-*，叶 = g-*）：
```python
    # ---- 组织团队树（team_spaces 一体；根 lt-*，叶 g-*）----
    db.add_all([
        models.TeamSpace(id="lt-tech", name="技术研发中心", description="负责全公司技术基础设施与产品研发", parent_id=None, status="active", created_at="", updated_at="", member_ids=[], project_ids=[]),
        models.TeamSpace(id="lt-data", name="数据智能中心", description="负责数据平台、算法与智能化能力", parent_id=None, status="active", created_at="", updated_at="", member_ids=[], project_ids=[]),
        models.TeamSpace(id="t1", name="平台架构组", parent_id="lt-tech", description="负责账户、权限、消息等平台基础能力。", owner_id="d1", owner_name="陈思", status="active", created_at="2025-03-12", updated_at="今天 10:32", member_ids=["d1"], project_ids=["p1", "p8"]),
        models.TeamSpace(id="t2", name="业务中台组", parent_id="lt-tech", description="负责订单、库存及业务交易核心链路。", owner_id="d2", owner_name="林涛", status="active", created_at="2025-03-18", updated_at="今天 09:12", member_ids=["d2", "d6"], project_ids=["p2"]),
        models.TeamSpace(id="t3", name="前端体验组", parent_id="lt-tech", description="负责内容体验、设计系统与用户端工程。", owner_id="d3", owner_name="王琳", status="active", created_at="2025-04-02", updated_at="昨天", member_ids=["d3", "d7"], project_ids=["p5"]),
        models.TeamSpace(id="t5", name="基础架构组", parent_id="lt-tech", description="负责交付平台、稳定性和基础设施。", owner_id="d5", owner_name="刘洋", status="active", created_at="2025-04-22", updated_at="昨天", member_ids=["d5"], project_ids=["p7"]),
        models.TeamSpace(id="t4", name="数据智能组", parent_id="lt-data", description="负责数据平台、模型服务和智能化能力。", owner_id="d4", owner_name="赵磊", status="active", created_at="2025-04-10", updated_at="3 小时前", member_ids=["d4", "d8"], project_ids=["p3", "p4", "p6"]),
        models.TeamSpace(id="t6", name="安全合规组", parent_id="lt-tech", description="负责安全基线、风险治理与合规审查。", status="active", created_at="2025-05-08", updated_at="2 天前", member_ids=[], project_ids=[]),
        models.TeamSpace(id="g-platform-core", name="核心服务小组", parent_id="t1", owner_id="d1", owner_name="陈思", status="active", created_at="", updated_at="", member_ids=["d1"], project_ids=["p1", "p8"]),
        models.TeamSpace(id="g-business-order", name="交易服务小组", parent_id="t2", owner_id="d2", owner_name="林涛", status="active", created_at="", updated_at="", member_ids=["d2", "d6"], project_ids=["p2"]),
        models.TeamSpace(id="g-frontend-content", name="内容体验小组", parent_id="t3", owner_id="d3", owner_name="王琳", status="active", created_at="", updated_at="", member_ids=["d3", "d7"], project_ids=["p5"]),
    ])
    db.commit()
```
同时更新 Developers 块：带小组的成员 `team="核心服务小组"`、`team_id="g-platform-core"` 等（去掉 `group_id` 字段）。

- [ ] **Step 4: 编译 + 幂等验证**
```bash
cd backend && .venv/bin/python -m py_compile app/main.py app/seed.py
# 起 8001 临时实例跑一次 → 停 → 再起跑一次，确认 team_spaces 无重复行
psql devlens -c "SELECT count(*) FROM team_spaces;"
```

---
### Task 3: API（后端）

**Files:**
- Modify: `backend/app/routers/teams.py:46-88`（team-spaces GET/POST）、`:14-19`（large-teams）、`:54-62,91-112`（team-groups GET/POST）

**Interfaces:**
- Consumes: `schemas.TeamSpace`、`schemas.TeamSpaceUpsert`（Task 1）
- Produces: `GET /team-spaces`（含 parentId/parentName）、`POST /team-spaces`（parentId 可选，201）、`PATCH /team-spaces/{id}`（编辑+移树+禁环）、`GET /large-teams`→[]、`GET/POST /team-groups`→[]。

- [ ] **Step 1: GET /team-spaces 返回树信息**
```python
@router.get("/team-spaces", response_model=list[schemas.TeamSpace])
def team_spaces(db: Session = Depends(get_db), ctx: TenantContext = Depends(require_permission("project:read"))):
    spaces = db.query(models.TeamSpace).filter_by(tenant_id=ctx.tenant_id).all()
    names = {s.id: s.name for s in spaces}
    out = []
    for s in spaces:
        d = {c.name: getattr(s, c.name) for c in models.TeamSpace.__table__.columns}
        d["parent_name"] = names.get(s.parent_id)
        out.append(d)
    return out
```

- [ ] **Step 2: POST /team-spaces 父级可选**
```python
@router.post("/team-spaces", response_model=schemas.TeamSpace, status_code=status.HTTP_201_CREATED)
def create_team_space(body: schemas.TeamSpaceUpsert, db: Session = Depends(get_db),
                      ctx: TenantContext = Depends(require_permission("project:write"))):
    if not body.name or not body.name.strip():
        raise HTTPException(status_code=422, detail="团队名称不能为空")
    parent_id = body.parent_id
    if parent_id:
        parent = db.query(models.TeamSpace).filter_by(id=parent_id, tenant_id=ctx.tenant_id).first()
        if not parent:
            raise HTTPException(status_code=404, detail="父团队不存在")
    space = models.TeamSpace(
        id=f"team-{uuid.uuid4().hex[:6]}", tenant_id=ctx.tenant_id, parent_id=parent_id,
        name=body.name.strip(), description=body.description,
        owner_id=body.owner_id, owner_name=body.owner_name, status="active",
        created_at="刚刚", updated_at="刚刚",
        member_ids=[body.owner_id] if body.owner_id else [], project_ids=[],
    )
    db.add(space); db.commit(); db.refresh(space)
    return space
```

- [ ] **Step 3: PATCH /team-spaces/{id} 编辑+移树+禁环**
```python
@router.patch("/team-spaces/{space_id}", response_model=schemas.TeamSpace)
def update_team_space(space_id: str, body: schemas.TeamSpaceUpsert, db: Session = Depends(get_db),
                      ctx: TenantContext = Depends(require_permission("project:write"))):
    space = db.query(models.TeamSpace).filter_by(id=space_id, tenant_id=ctx.tenant_id).first()
    if not space:
        raise HTTPException(status_code=404, detail="团队不存在")
    if body.name is not None:
        if not body.name.strip():
            raise HTTPException(status_code=422, detail="团队名称不能为空")
        space.name = body.name.strip()
    if body.description is not None:
        space.description = body.description
    if body.owner_id is not None:
        space.owner_id = body.owner_id
        space.owner_name = body.owner_name
    if body.parent_id is not None:
        new_parent = body.parent_id
        if new_parent == space.id:
            raise HTTPException(status_code=422, detail="父团队不能是自己")
        if new_parent:
            parent = db.query(models.TeamSpace).filter_by(id=new_parent, tenant_id=ctx.tenant_id).first()
            if not parent:
                raise HTTPException(status_code=404, detail="父团队不存在")
            # 禁环：沿新父向上走，若遇到 space 自身则成环
            cur = parent
            while cur:
                if cur.id == space.id:
                    raise HTTPException(status_code=422, detail="父团队不能是自身的子团队")
                cur = db.query(models.TeamSpace).filter_by(id=cur.parent_id, tenant_id=ctx.tenant_id).first() if cur.parent_id else None
        space.parent_id = new_parent
    space.updated_at = "刚刚"
    db.commit(); db.refresh(space)
    return space
```

- [ ] **Step 4: 废弃 large-teams / team-groups** — 三个函数体返回 `[]`（签名保留）：
```python
@router.get("/large-teams", response_model=list[schemas.LargeTeamM])
def large_teams(db: Session = Depends(get_db), ctx: TenantContext = Depends(require_permission("project:read"))):
    return []
```
`GET /team-groups`、`POST /team-groups` 同理返回 `[]`（保留 `team_id` Query 参数签名）。

- [ ] **Step 5: curl 验证**（起 8001 临时实例）
```bash
CTX=(-H "X-DevLens-User-Id: usr-local-admin" -H "X-DevLens-Tenant-Id: tenant-test")
# 创建无父团队（根）→ 201
curl -s -X POST http://127.0.0.1:8001/api/v1/team-spaces -H 'Content-Type: application/json' "${CTX[@]}" -d '{"name":"测试根团队"}' -w "\nHTTP:%{http_code}\n"
# 带父级 → 201
curl -s -X POST http://127.0.0.1:8001/api/v1/team-spaces -H 'Content-Type: application/json' "${CTX[@]}" -d '{"name":"测试子团队","parentId":"t1"}'
# PATCH 禁环：把 t1（有孙 g-platform-core）移到 g-platform-core 下 → 期望 422
curl -s -X PATCH http://127.0.0.1:8001/api/v1/team-spaces/t1 -H 'Content-Type: application/json' "${CTX[@]}" -d '{"parentId":"g-platform-core"}' -w "\nHTTP:%{http_code}\n"
# GET 确认 parentName 与树信息
curl -s http://127.0.0.1:8001/api/v1/team-spaces "${CTX[@]}" | head -c 400
```

---
### Task 4: overview_service 适配（后端）

**Files:**
- Modify: `backend/app/overview_service.py:28-30`（trinity-matrix 团队源，必要时）

**Interfaces:**
- Consumes: `models.TeamSpace`（现含叶节点）
- Produces: 无 API 变化；trinity-matrix rows 现含原小组叶节点（有成员者）。

- [ ] **Step 1: 核对并微调** — trinity-matrix 的 teams 用 `[t for t in ... if t.member_ids]`，已把根节点（无直属成员）排除、小组叶节点纳入；`dev_team` 用 `d.team_id or d.team` 与迁移后叶 team_id 匹配。**通常无需改代码**，验证：
```bash
curl -s http://127.0.0.1:8001/api/v1/trinity-matrix "${CTX[@]}" | head -c 300
```
若 rows 出现根节点或超过 8 条，在 filter 后追加 `.sort(key=len(member_ids), reverse=True)[:8]`（现有逻辑已有）。确有问题再加 `and t.parent_id is not None` 排除根。

---
### Task 5: 前端统一团队树改造（强耦合，一次做完）

> 前端 types/api/mock/provider/页面互相依赖，本任务整体以 `pnpm build` 全量通过 + 浏览器手动验证为交付。

**Files:**
- Modify: `frontend/lib/types.ts:161-190`、`frontend/lib/api.ts:431-442`、`frontend/lib/mock-data.ts`
- Modify: `frontend/components/team-space-provider.tsx`
- Modify: `frontend/components/app-shell.tsx:98-100,259-288`
- Modify: `frontend/app/team-spaces/page.tsx`
- Modify: `frontend/app/onboard/page.tsx:108-144,240-252`
- Modify: `frontend/app/developers/page.tsx:332`

**Interfaces:**
- Consumes: Task 1-3 的 `GET/POST/PATCH /team-spaces`（含 parentId/parentName）
- Produces: `TeamSpace{..., parentId?, parentName?}`；`api.createTeamSpace({name, parentId?, ...})`、`api.updateTeamSpace(id, patch)`；provider 暴露 `spaces/teamsTree/teamIndex/activeTeamSpaceId/setActiveTeamSpaceId/createTeamSpace/updateTeamSpace/moveTeam`；移除 `largeTeams`/`teamGroups`/`activeLargeTeamId`/`visibleSpaces`/`createTeamGroup` 概念。

- [ ] **Step 1: types.ts** — `TeamSpace` 换为（`LargeTeam`/`TeamGroup` 接口删除）：
```ts
export interface TeamSpace {
  id: string;
  name: string;
  parentId?: string | null;
  parentName?: string;
  description?: string;
  ownerId?: string;
  ownerName?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  memberIds: string[];
  projectIds: string[];
}
```

- [ ] **Step 2: api.ts** — 替换 team 相关函数：
```ts
createTeamSpace: (body: { name: string; parentId?: string | null; description?: string; ownerId?: string; ownerName?: string }) =>
  USE_MOCK
    ? mockDelay({ id: `team-${Date.now()}`, status: 'active' as const, createdAt: '刚刚', updatedAt: '刚刚', parentId: body.parentId ?? null, memberIds: body.ownerId ? [body.ownerId] : [], projectIds: [], ...body } as TeamSpace)
    : fetchAPI<TeamSpace>('/team-spaces', { method: 'POST', body: JSON.stringify(body) }),
updateTeamSpace: (id: string, patch: Partial<TeamSpace>) =>
  USE_MOCK ? mockDelay(patch as TeamSpace) : fetchAPI<TeamSpace>(`/team-spaces/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
```
删除 `getLargeTeams`、`getTeamGroups`、`createTeamGroup` 与顶部相关 import。

- [ ] **Step 3: mock-data.ts** — `teamSpaces` 换成含 `parentId` 的树数据（根 lt-* / 空间 t* / 叶 g-*）；删除 `teamGroups`、`largeTeams` 数组与导出。

- [ ] **Step 4: team-space-provider.tsx** — 重写为单棵树：
```tsx
export function TeamSpaceProvider({ children }: { children: React.ReactNode }) {
  const [spaces, setSpaces] = React.useState<TeamSpace[]>([]);
  const [activeTeamSpaceId, setActiveTeamSpaceIdState] = React.useState<string | null>(null);
  React.useEffect(() => {
    api.getTeamSpaces().then((s) => {
      setSpaces(s);
      const saved = window.localStorage.getItem(STORAGE_KEY_TEAM);
      setActiveTeamSpaceIdState(saved && s.some((x) => x.id === saved) ? saved : (s.find((x) => !x.parentId)?.id ?? s[0]?.id ?? null));
    }).catch(() => {});
  }, []);
  const teamsTree = React.useMemo(() => {
    const byId = new Map<string, TeamSpace & { children: TeamSpace[] }>();
    for (const s of spaces) byId.set(s.id, { ...s, children: [] });
    const roots: (TeamSpace & { children: TeamSpace[] })[] = [];
    for (const s of spaces) {
      const node = byId.get(s.id)!;
      const parent = s.parentId ? byId.get(s.parentId) : undefined;
      if (parent) parent.children.push(node); else roots.push(node);
    }
    return roots;
  }, [spaces]);
  const teamIndex = React.useMemo(() => new Map(spaces.map((s) => [s.id, s])), [spaces]);
  const createTeamSpace = React.useCallback(async (draft: Parameters<typeof api.createTeamSpace>[0]) => {
    const space = await api.createTeamSpace(draft);
    setSpaces((c) => [...c, space]);
    setActiveTeamSpaceIdState(space.id); window.localStorage.setItem(STORAGE_KEY_TEAM, space.id);
    return space;
  }, []);
  const updateTeamSpace = React.useCallback(async (id: string, patch: Partial<TeamSpace>) => {
    const updated = await api.updateTeamSpace(id, patch);
    setSpaces((c) => c.map((s) => s.id === id ? updated : s));
    return updated;
  }, []);
  const moveTeam = React.useCallback((id: string, parentId: string | null) => updateTeamSpace(id, { parentId }), [updateTeamSpace]);
  const setActiveTeamSpaceId = React.useCallback((id: string) => { setActiveTeamSpaceIdState(id); window.localStorage.setItem(STORAGE_KEY_TEAM, id); }, []);
  const activeTeamSpace = spaces.find((s) => s.id === activeTeamSpaceId) || null;
  const value = React.useMemo(() => ({
    spaces, teamsTree, teamIndex, activeTeamSpaceId, activeTeamSpace,
    setActiveTeamSpaceId, createTeamSpace, updateTeamSpace, moveTeam,
  }), [spaces, teamsTree, teamIndex, activeTeamSpaceId, activeTeamSpace, setActiveTeamSpaceId, createTeamSpace, updateTeamSpace, moveTeam]);
  return <TeamSpaceContext.Provider value={value}>{children}</TeamSpaceContext.Provider>;
}
```
`TeamSpaceContextValue` 接口同步改为上述字段；删除 `STORAGE_KEY_LARGE`、`groups`、`largeTeams`、`visibleSpaces`、`setActiveLargeTeamId`。

- [ ] **Step 5: team-spaces/page.tsx** — 表格列表改为递归树 + 创建表单父级可选 + 编辑可移动：
```tsx
function TeamNode({ team, depth, onSelect }: { team: TeamSpace & { children: TeamSpace[] }; depth: number; onSelect: (t: TeamSpace) => void }) {
  const [open, setOpen] = React.useState(depth === 0);
  return <div>
    <div className="flex items-center gap-2 rounded-lg border border-border/60 p-2.5 hover:bg-muted/40" style={{ marginLeft: depth * 20 }} onClick={() => onSelect(team)}>
      {team.children.length ? <button onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>{open ? '▼' : '▶'}</button> : <span className="w-4" />}
      <Building2 className="h-4 w-4 text-primary" />
      <span className="text-sm font-medium">{team.name}</span>
      <Badge variant="outline">{team.memberIds.length} 人</Badge>
      <span className="text-xs text-muted-foreground">{team.projectIds.length} 项目</span>
    </div>
    {open && team.children.map((c) => <TeamNode key={c.id} team={c} depth={depth + 1} onSelect={onSelect} />)}
  </div>;
}
```
- `CreateSpaceSheet`：`largeTeams`/`activeLargeTeamId` 改为 `teamsTree` 扁平化的父级下拉（`<option value="">无父团队（根）</option>`），提交 `createTeamSpace({ name, parentId: parentId || null, description, ownerId, ownerName })`。
- `SpaceSheet`："小组"区块展示 `team.children`；编辑表单加"父团队"下拉，保存调 `moveTeam(space.id, parentId)`（改父）或 `updateTeamSpace`（改名称/描述/负责人）。
- 删 `largeTeams`、`groups`、`activeLargeTeamId` 引用；`groups.filter(g => g.teamId === space.id)` 替换为 `teamIndex.get(space.id)?.children ?? []`（子团队数）。
- 顶部 `PageHeader`/`FilterBar`/表格行的"小组"列改为"子团队"计数。

- [ ] **Step 6: app-shell.tsx** — 侧边栏大团队切换器改为团队树浏览：
```tsx
{activeTeamSpace ? (
  <div className="px-3 py-2">
    <div className="truncate text-sm font-semibold">{activeTeamSpace.name}</div>
    <div className="text-xs text-muted-foreground">{teamIndex.get(activeTeamSpace.parentId ?? '')?.name || '根团队'}</div>
  </div>
) : null}
{teamsTree.map((root) => <TreeItem key={root.id} node={root} depth={0} onSelect={(id) => setActiveTeamSpaceId(id)} />)}
```
定义局部递归 `TreeItem`；删除 `largeTeams`、`activeLargeTeam`、`setActiveLargeTeamId`、`visibleSpaces` 引用。

- [ ] **Step 7: onboard/page.tsx** — 两段式"大团队+团队空间"合并为单个团队选择：
```tsx
<label htmlFor="teamId" className="text-sm font-medium">所属团队 <span className="text-destructive">*</span></label>
<select id="teamId" required value={form.teamId} onChange={(e) => setForm({ ...form, teamId: e.target.value })}>
  <option value="">请选择团队</option>
  {flatten(teamsTree).map((t) => <option key={t.id} value={t.id}>{t.parentName ? `${t.parentName} / ${t.name}` : t.name}</option>)}
</select>
```
删除 `largeTeamId` 状态、级联 `useEffect`、`spaces`/`largeTeams`/`activeLargeTeamId` 引用；`availableSpaces` 逻辑移除。

- [ ] **Step 8: developers/page.tsx** — `dev.groupId && <Badge>` 逻辑删除，只显示叶团队：
```tsx
<span>{dev.role}</span><span>·</span><span>{dev.team}</span>
```
移除 `teamGroups` import/使用（`dev.team` 迁移后已是叶团队名）。

- [ ] **Step 9: 编译 + 浏览器验证**
```bash
cd frontend && pnpm build 2>&1 | tail -15
```
（无类型错误）→ 浏览器验证：创建根团队成功、创建子团队成功、树展开/折叠、编辑移树生效、侧边栏树浏览、onboard 单选择、开发者页叶团队名。

---
### Task 6: 构建 + 上线

**Files:** 无代码改动。

- [ ] **Step 1: 前端重新编译**（用户明确要求）：
```bash
cd frontend && pnpm build 2>&1 | tail -15
```

- [ ] **Step 2: 重启后端 + 生产前端**：
```bash
sudo systemctl restart devlens-backend.service
sudo systemctl restart devlens-frontend.service   # 生产 next start :3800
```

- [ ] **Step 3: 线上冒烟** — 浏览器打开 https://souxy.com:7200 团队空间页，确认树 UI、创建（根/子）、移动可用；`curl` 带租户头确认 `/api/v1/team-spaces` 返回树。
