# 项目环境配置盘点（Env Inventory）详细设计文档

> 版本：v1.0
> 状态：待开发
> 关联文档：[`Skill管理模块详细设计文档.md`](./Skill管理模块详细设计文档.md)

---

## 0. 设计目标

DevLens 已能分析项目代码质量/安全/技术债，但缺少**基础设施配置视角**：每个项目到底依赖哪些中间件（数据库/Redis/Nacos/MQ/OSS），各自的环境地址、账号、配置在哪个文件里、什么时候变的，完全没有沉淀。

本模块把「散落在配置文件里的环境信息」自动盘点到一张清单上：

```
项目仓库（.env / application-*.yml / config.py / bootstrap.yml / docker-compose.yml ...）
        │ ① 扫描（全量 or 增量）
        ▼
  Env Inventory 清单（结构化条目）
        │ ② 分类归纳
        ▼
  按环境（dev/test/prod/gray/common）× 工具类型（database/redis/nacos/mq/...）
        │ ③ 展示 + 溯源
        ▼
  每个条目带：来源文件 + 行号 + 更新时间 + 值（密码脱敏）
```

核心能力：**数据不是死的**——支持「按此历史更新」（增量重扫）与「全量再次更新」（全量重建）两种触发，每次扫描记录来源文件与时间戳。

---

## 1. 数据模型设计（2 张新表）

### 1.1 env_inventory_scans（扫描记录表）

每次扫描一条记录，区分全量/增量。

```python
class EnvInventoryScan(Base):
    __tablename__ = "env_inventory_scans"
    id = Column(String, primary_key=True)          # einv-scan-xxx
    project_id = Column(String, ForeignKey("projects.id"))
    scan_type = Column(String, default="full")     # full（全量）| incremental（按此历史更新）
    status = Column(String, default="scanning")    # scanning|completed|failed
    trigger = Column(String, default="manual")     # manual|auto
    started_at = Column(String)
    finished_at = Column(String)
    files_scanned = Column(Integer, default=0)     # 本次扫描的配置文件数
    entries_found = Column(Integer, default=0)     # 本次发现的条目数
    added = Column(Integer, default=0)             # 增量：新增条目数
    changed = Column(Integer, default=0)           # 增量：变更条目数
    removed = Column(Integer, default=0)           # 增量：失效条目数
    unchanged = Column(Integer, default=0)         # 增量：无变化条目数
    message = Column(Text, default="")
```

### 1.2 env_inventory_entries（配置条目表，核心表）

一条记录 = 一个配置项（含环境、工具类型、来源文件、更新时间）。

```python
class EnvInventoryEntry(Base):
    __tablename__ = "env_inventory_entries"
    id = Column(String, primary_key=True)          # einv-xxx
    project_id = Column(String, ForeignKey("projects.id"))
    scan_id = Column(String, ForeignKey("env_inventory_scans.id"), nullable=True)
    # ---- 分类维度 ----
    env = Column(String, default="common")         # dev|test|prod|gray|common（环境归属）
    tool_type = Column(String, default="other")    # database|redis|nacos|mq|oss|gateway|es|kafka|third_party|other
    tool_name = Column(String, default="")         # 工具/服务名，如 mysql / redis / nacos / user-center
    # ---- 配置内容 ----
    key = Column(String, default="")               # 配置键，如 spring.datasource.url / REDIS_HOST
    value = Column(Text, default="")               # 配置值（密码类已脱敏存储）
    is_secret = Column(Integer, default=0)         # 0|1 是否敏感字段（password/secret/token/key）
    # ---- 溯源 ----
    source_file = Column(String, default="")       # 来源文件路径（相对仓库根）
    source_line = Column(Integer, default=0)       # 来源行号
    file_mtime = Column(String, default="")        # 源文件最后修改时间（ISO）
    first_seen_at = Column(String, default="")     # 首次发现时间
    updated_at = Column(String, default="")        # 最近更新时间（本次扫描时间）
    status = Column(String, default="active")      # active|added|changed|removed（增量对比用）
    previous_value = Column(Text, default="")      # 增量扫描前的旧值（changed 时记录）
```

> 设计决策：**不按「一个文件一条记录」建模**，而是拆到「一个 key 一条记录」粒度，才能支持跨文件合并展示、增量 diff、敏感字段单独脱敏。

---

## 2. 扫描引擎设计（核心算法）

### 2.1 配置文件识别（全量扫描）

按项目语言/框架识别候选配置文件（相对仓库根路径匹配）：

| 类型 | 文件模式（glob） |
|------|------------------|
| 通用 env | `.env*`、`*.env`、`env/*`、`config/env*` |
| Java/Spring | `application*.yml`、`application*.yaml`、`application*.properties`、`bootstrap*.yml`、`bootstrap*.properties`、`config/*.yml` |
| Python | `config*.py`、`settings*.py`、`app/settings*`、`config/settings*` |
| Node/TS | `next.config.*`、`nuxt.config.*`、`vue.config.*`、`webpack.config.*`、`pm2*.json` |
| 部署编排 | `docker-compose*.yml`、`docker-compose*.yaml`、`Dockerfile`、`k8s/*.yaml`、`deploy/*.yml` |
| 其他 | `*.conf`、`nginx.conf`、`*.properties`、`.npmrc`、`.pypirc`、`.gitconfig` |

排除：`node_modules/`、`.venv/`、`dist/`、`build/`、`*.lock`、`package-lock.json`、`pnpm-lock.yaml`。

**判断配置文件的补充规则**：
- 文件内匹配到 `(host|url|port|username|password|secret|token|key|database|redis|nacos|jdbc)` 关键字（大小写不敏感）→ 视为配置文件
- 单文件超过 500KB 跳过

### 2.2 条目提取（正则为主，LLM 增强可选）

**正则提取（快、零成本，P0 必做）**：

```python
# 模式 1：KEY=value（.env 风格）
(?m)^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+?)\s*$

# 模式 2：key: value（yaml 风格，支持嵌套前缀）
(?m)^\s*([A-Za-z0-9_\-\.]+)\s*:\s*(.+?)\s*$

# 模式 3：URL 内嵌（jdbc/mongodb/redis 等）
(?i)((?:jdbc|mongodb|redis|amqp|http|https)://[^\s'"]+)
```

**环境归属判定（env 字段）**：
1. 文件路径含 `dev`/`test`/`prod`/`gray`（如 `application-prod.yml`）→ 对应环境
2. 文件路径含 `local` → dev；`stag`/`sit`/`uat` → test
3. 通用文件（`.env`、`application.yml`、`config.py`）→ common（通用），其中 key 含环境后缀（如 `DB_HOST_PROD`）→ 取后缀环境
4. 兜底 → common

**工具类型判定（tool_type / tool_name）**：

```python
RULES = [
    (r"(?i)jdbc:mysql|mysql",            "database", "mysql"),
    (r"(?i)jdbc:postgresql|postgres",    "database", "postgresql"),
    (r"(?i)jdbc:oracle|oracle",          "database", "oracle"),
    (r"(?i)mongodb",                     "database", "mongodb"),
    (r"(?i)redis",                       "redis",    "redis"),
    (r"(?i)nacos",                       "nacos",    "nacos"),
    (r"(?i)kafka|bootstrap\.servers",    "kafka",    "kafka"),
    (r"(?i)rabbitmq|amqp",               "mq",       "rabbitmq"),
    (r"(?i)elasticsearch",               "es",       "elasticsearch"),
    (r"(?i)minio|oss|s3",                "oss",      "minio|oss"),
    (r"(?i)gateway|zuul|spring\.cloud\.gateway", "gateway", "gateway"),
]
# 逐个尝试；均不命中 → tool_type="other", tool_name=key 的第一段
# 对 value 与 key 同时匹配（key 优先）
```

**密码脱敏（is_secret）**：
- key 含 `password|passwd|secret|token|api[_-]?key|pwd`（忽略大小写）→ `is_secret=1`
- value 中 URL 的 userinfo 段（`user:pass@host`）→ 保留 user，pass 替换为 `***`
- 脱敏后存储：`mysql://root:***@127.0.0.1:3306/db`；纯密码字段 → `***`（保留前 2 位便于识别，如 `ab***`）

### 2.3 两种扫描模式（★ 核心区别）

**全量再次更新（scan_type=full）**：
1. 重新遍历仓库全部文件 → 识别配置文件 → 提取条目
2. 删除该项目旧条目，重建全部新条目（status=active）
3. 记录 `files_scanned` / `entries_found`
4. 用于：首次扫描、怀疑历史数据不完整、大版本变更后

**按此历史更新（scan_type=incremental）**：
1. 取该项目**最近一次成功扫描**的 `source_file` 去重集合（历史来源文件清单）
2. 仅重扫这些文件（+ 新增的同类配置文件，可选）
3. 与现有条目 diff：
   - 文件删除/条目消失 → 标记 `status=removed`
   - key 相同、value 变化 → 标记 `status=changed`，`previous_value` 存旧值
   - 新出现的 key → 标记 `status=added`
   - 无变化 → 保持 `active`
4. 记录 `added/changed/removed/unchanged` 统计
5. 用于：日常增量刷新、怀疑配置漂移（只关注已知文件）

**UI 语义**：
- 「按此历史更新」= incremental（轻量、快、基于上次的来源文件清单）
- 「全量再次更新」= full（重量、慢、重建）

---

## 3. API 设计

新增 `backend/app/routers/env_inventory.py`，挂 `/api/v1`。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/projects/{pid}/env-inventory` | 条目列表（?env= / ?toolType= / ?status= / ?q= 过滤） |
| GET | `/projects/{pid}/env-inventory/summary` | 概览：各环境×工具统计、最近扫描时间、条目总数 |
| POST | `/projects/{pid}/env-inventory/scan` | 触发扫描（body: `{scanType: "full"\|"incremental"}`），同步执行返回 scan 结果 |
| GET | `/projects/{pid}/env-inventory/scans` | 扫描历史（倒序，含统计） |
| GET | `/projects/{pid}/env-inventory/scans/{scan_id}` | 单次扫描详情（含该次条目变化） |
| PATCH | `/projects/{pid}/env-inventory/entries/{eid}` | 更新条目（仅 status 备注类，P0 可留空实现） |

> 设计约束：扫描**同步执行**（小仓库 <5s），不做异步任务；大仓库耗时由前端 loading 态承接。返回 `EnvInventoryScan` 对象含统计。

---

## 4. 前端设计

### 4.1 入口与路由

- **入口**：项目详情页 `/projects/[id]` 顶部 Segmented tab 增加「环境盘点」（icon: `Server` 或 `DatabaseZap`）
- **路由**：`frontend/app/projects/[id]/env/page.tsx`（独立页，从详情页跳转）；或详情页内嵌 tab（P0 用内嵌 tab 减少路由改动，若结构复杂则独立页）

> 建议：**独立路由** `/projects/[id]/env`，项目详情页 tab 切换跳转。理由：盘点页面内容重（表格+分组+操作），内嵌会让详情页过载。

### 4.2 页面结构

```
┌─────────────────────────────────────────────────────────┐
│ PageHeader: 环境配置盘点 · {项目名}                       │
│  [按此历史更新] [全量再次更新]        [最近扫描: 5分钟前]   │
├─────────────────────────────────────────────────────────┤
│ 概览卡片：Database 3 · Redis 2 · Nacos 2 · MQ 1 · 其他 5 │
│          （按 toolType 计数，Badge 点击过滤）              │
├─────────────────────────────────────────────────────────┤
│ Segmented: [全部] [dev] [test] [prod] [gray] [common]   │
├─────────────────────────────────────────────────────────┤
│ 条目表格（按 env → tool_type → source_file 分组）         │
│ ┌──────────┬─────────┬──────────┬────────┬───────────┐  │
│ │ 工具      │ key     │ value    │ 来源文件│ 更新时间    │  │
│ │ mysql    │ url     │ jdbc:... │ appl.. │ 2026-08-01│  │
│ │ (dev)    │ password│ ab***    │ -prod  │            │  │
│ └──────────┴─────────┴──────────┴────────┴───────────┘  │
│ 状态徽标：active(正常)/added(新增)/changed(变更)/removed(失效) │
├─────────────────────────────────────────────────────────┤
│ 底部：扫描历史（时间线：全量/增量 + 统计 + 状态）           │
└─────────────────────────────────────────────────────────┘
```

### 4.3 关键交互

1. **「按此历史更新」**：POST scan `{scanType:"incremental"}` → loading 态 → 完成后刷新列表 + toast「增量扫描完成：新增 1 / 变更 2 / 失效 0」
2. **「全量再次更新」**：POST scan `{scanType:"full"}` → 二次确认弹窗（「将重建全部配置条目，确定？」）→ loading → 刷新 + toast
3. **敏感字段**：value 列默认显示 `***`，点击「眼睛」图标显示明文（仅当 is_secret=1；明文从 `GET /env-inventory` 的 `value` 返回，前端切换显示）
4. **分组**：默认按 `env` → `tool_type` 分组折叠；支持按 toolType 过滤（概览 Badge 点击）
5. **扫描历史**：倒序时间线，显示 scan_type（全量/增量徽标）、状态、统计、时长

### 4.4 类型定义（frontend/lib/types.ts 增加）

```typescript
export type EnvName = 'dev' | 'test' | 'prod' | 'gray' | 'common';
export type EnvToolType = 'database' | 'redis' | 'nacos' | 'mq' | 'kafka' | 'es' | 'oss' | 'gateway' | 'third_party' | 'other';
export type EnvEntryStatus = 'active' | 'added' | 'changed' | 'removed';

export interface EnvInventoryEntry {
  id: string;
  projectId: string;
  scanId?: string;
  env: EnvName;
  toolType: EnvToolType;
  toolName: string;
  key: string;
  value: string;
  isSecret: number;
  sourceFile: string;
  sourceLine: number;
  fileMtime?: string;
  firstSeenAt?: string;
  updatedAt: string;
  status: EnvEntryStatus;
  previousValue?: string;
}

export interface EnvInventoryScan {
  id: string;
  projectId: string;
  scanType: 'full' | 'incremental';
  status: 'scanning' | 'completed' | 'failed';
  trigger: string;
  startedAt: string;
  finishedAt?: string;
  filesScanned: number;
  entriesFound: number;
  added: number;
  changed: number;
  removed: number;
  unchanged: number;
  message?: string;
}

export interface EnvInventorySummary {
  projectId: string;
  total: number;
  byEnv: Record<EnvName, number>;
  byToolType: Record<EnvToolType, number>;
  lastScanAt?: string;
  lastScanType?: 'full' | 'incremental';
}
```

### 4.5 API 客户端（frontend/lib/api.ts 增加）

```typescript
getEnvInventory: (pid, params?) => ...
getEnvInventorySummary: (pid) => ...
scanEnvInventory: (pid, scanType: 'full'|'incremental') => ...
getEnvInventoryScans: (pid) => ...
```

---

## 5. 与现有代码衔接

- `backend/app/models.py`：新增 2 张表（追加到文件末尾）
- `backend/app/schemas.py`：新增 Pydantic 模型（CamelModel）
- `backend/app/routers/env_inventory.py`：新增路由文件
- `backend/app/main.py`：注册 router
- `backend/app/env_scanner.py`：**新增**扫描引擎模块（纯函数，便于测试）
- `frontend/lib/types.ts` / `frontend/lib/api.ts`：类型 + API
- `frontend/app/projects/[id]/page.tsx`：详情页顶部 tab 增加「环境盘点」跳转
- `frontend/app/projects/[id]/env/page.tsx`：**新增**盘点页
- `frontend/components/app-shell.tsx`：无需改（从项目详情进入）

---

## 6. Seed 数据（可选）

`seed.py` 增加 `seed_env_inventory()`：对现有 seed 项目（如 p1 用户中心）造一份示例清单（2 环境 × 3 工具类型 × 若干条目），保证前端有数据可看。仅当 `env_inventory_entries` 表为空时执行。

---

## 7. 验收标准

### 后端
- [ ] `models.py` 新表 + `main.py` 注册 router，uvicorn 启动无错
- [ ] `POST /projects/{pid}/env-inventory/scan {scanType:"full"}`：对真实仓库（如 /home/tutuos/CodeLab/calendar-task-manager）扫描出条目，数据库可见
- [ ] 密码字段 is_secret=1 且 value 脱敏（`***`）
- [ ] 增量扫描：修改一个配置文件的值 → 再跑 incremental → 该条目 status=changed 且 previous_value 正确；新增 key → added；删除 key → removed
- [ ] `GET .../summary` 统计正确
- [ ] 不存在的项目 → 404

### 前端
- [ ] `pnpm build` 通过
- [ ] 项目详情页 tab 有「环境盘点」入口，跳转正确
- [ ] 盘点页：概览 Badge + 环境 Segmented + 分组表格 + 扫描历史渲染正常
- [ ] 「按此历史更新」与「全量再次更新」两个按钮行为区分（incremental vs full）
- [ ] 敏感字段眼睛切换显示明文

### 回归
- [ ] Skill 管理模块不受影响（/skills 页正常）
- [ ] 项目详情原 tab 正常

---

## 8. 开发顺序建议

1. `models.py` 2 张新表
2. `env_scanner.py` 扫描引擎（文件识别 → 正则提取 → 环境/工具判定 → 脱敏）
3. `schemas.py` + `routers/env_inventory.py` + `main.py` 注册
4. 增量 diff 逻辑（incremental 模式）
5. `seed.py` seed_env_inventory
6. 前端 types + api
7. 前端盘点页 + 详情页 tab 入口
8. build + 联调验证（真实仓库扫描 + 增量对比）
