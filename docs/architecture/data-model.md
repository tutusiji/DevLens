# 数据模型设计

## ER 关系总览

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────┐
│ departments │◄────│     people      │────►│ git_identities│
│  (组织树)    │ 1:N │   (真实人员)     │ 1:N │  (Git身份)    │
└──────┬──────┘     └────────┬────────┘     └──────┬───────┘
       │                     │                      │
       │              ┌──────▼──────┐        ┌──────▼───────┐
       │              │ identity_   │        │   projects   │
       │              │ mappings    │        │   (项目)      │
       │              │ (身份映射)   │        └──────┬───────┘
       │              └─────────────┘               │
       │                                            │
       │     ┌──────────────────┐    ┌──────────────▼──────┐
       │     │ team_            │    │ project_            │
       └────►│ capabilities     │    │ memberships         │
             │ (团队能力)        │    │ (项目参与关系)       │
             └──────────────────┘    └──────────────┬──────┘
                                                    │
                                           ┌────────▼────────┐
                                           │ dev_skill_       │
                                           │ vectors           │
                                           │ (开发者能力快照)  │
                                           └──────────────────┘
```

## 表结构详细设计

### projects — 项目表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID (PK) | 主键 |
| gitlab_url | TEXT NOT NULL | GitLab 仓库地址 |
| gitlab_id | INTEGER | GitLab project ID |
| name | TEXT | 项目名称 |
| description | TEXT | 项目描述 |
| default_branch | TEXT DEFAULT 'main' | 默认分支 |
| languages | JSONB | 语言构成 {"python": 60, "go": 40} |
| status | TEXT DEFAULT 'active' | active / archived / analyzing |
| analysis_scope | JSONB | 分析范围配置 (branches, time_range) |
| created_at | TIMESTAMPTZ | 创建时间 |
| last_analyzed | TIMESTAMPTZ | 最后分析时间 |
| analysis_progress | JSONB | 分析进度（当前阶段、百分比） |

### project_snapshots — 项目周期快照

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID (PK) | 主键 |
| project_id | UUID (FK → projects) | 关联项目 |
| period | DATE | 快照周期（周/月） |
| health_score | FLOAT | 综合健康度 0-100 |
| quality_score | FLOAT | 代码质量分 |
| security_score | FLOAT | 安全评分 |
| tech_debt_score | FLOAT | 技术债务指数 |
| commit_count | INTEGER | 周期内提交数 |
| contributor_count | INTEGER | 活跃贡献者数 |
| complexity_avg | FLOAT | 平均复杂度 |
| code_churn_rate | FLOAT | 代码变动率 |
| raw_metrics | JSONB | 原始指标全量存储 |

### git_identities — Git 原始身份

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID (PK) | 主键 |
| project_id | UUID (FK → projects) | 所属项目 |
| git_name | TEXT | commit 中的 author name |
| git_email | TEXT | commit 中的 author email |
| git_username | TEXT | GitLab username |
| commit_count | INTEGER DEFAULT 0 | 总提交数 |
| first_seen | TIMESTAMPTZ | 首次出现 |
| last_seen | TIMESTAMPTZ | 最后出现 |
| is_bot | BOOLEAN DEFAULT FALSE | 是否机器人账号 |

**唯一约束**: (project_id, git_email)

### people — 真实人员

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID (PK) | 主键 |
| name | TEXT NOT NULL | 真实姓名 |
| email | TEXT | 企业邮箱 |
| employee_id | TEXT | 工号 |
| department_id | UUID (FK → departments) | 所属部门 |
| role | TEXT | 职位 (developer / lead / manager) |
| level | TEXT | 职级 |
| joined_at | DATE | 入职日期 |
| status | TEXT DEFAULT 'active' | active / resigned |
| avatar_url | TEXT | 头像 |
| created_at | TIMESTAMPTZ | 创建时间 |

### identity_mappings — 身份映射

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID (PK) | 主键 |
| git_identity_id | UUID (FK → git_identities) | Git 身份 |
| person_id | UUID (FK → people) | 真实人员 |
| confidence | FLOAT | 匹配置信度 0-1 |
| match_method | TEXT | email / username / pinyin / fuzzy / manual |
| status | TEXT DEFAULT 'confirmed' | confirmed / pending / rejected |
| reviewed_by | UUID | 审核人 |
| reviewed_at | TIMESTAMPTZ | 审核时间 |

### departments — 组织架构（树形）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID (PK) | 主键 |
| name | TEXT NOT NULL | 部门名称 |
| parent_id | UUID (FK → departments) | 上级部门（自引用） |
| gitlab_group_id | INTEGER | 关联 GitLab Group ID |
| leader_id | UUID (FK → people) | 部门负责人 |
| level | INTEGER | 层级深度 |
| path | TEXT | 物化路径 /company/eng/backend |
| member_count | INTEGER | 成员数 |
| created_at | TIMESTAMPTZ | 创建时间 |

### dev_skill_vectors — 开发者能力向量

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID (PK) | 主键 |
| person_id | UUID (FK → people) | 关联人员 |
| project_id | UUID (FK → projects, nullable) | 关联项目（NULL=全局） |
| period | DATE | 快照周期 |
| code_quality | FLOAT | 代码质量 0-100 |
| architecture | FLOAT | 架构能力 0-100 |
| stability | FLOAT | 稳定性 0-100 |
| efficiency | FLOAT | 交付效率 0-100 |
| collaboration | FLOAT | 协作能力 0-100 |
| security_aware | FLOAT | 安全意识 0-100 |
| growth_velocity | FLOAT | 成长速度（向量导数） |
| composite_score | FLOAT | 综合分 |
| raw_signals | JSONB | 原始信号明细 |

### team_capabilities — 团队能力快照

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID (PK) | 主键 |
| department_id | UUID (FK → departments) | 关联部门 |
| period | DATE | 快照周期 |
| member_count | INTEGER | 成员数 |
| avg_vector | JSONB | 平均能力向量 |
| variance | JSONB | 能力方差 |
| coverage | JSONB | 能力覆盖率 |
| bus_factor | INTEGER | Bus Factor |
| risk_flags | JSONB | 风险标记列表 |
| growth_trend | JSONB | 增长趋势数据 |

### project_memberships — 项目参与关系

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID (PK) | 主键 |
| person_id | UUID (FK → people) | 关联人员 |
| project_id | UUID (FK → projects) | 关联项目 |
| role | TEXT | owner / maintainer / contributor |
| contribution_pct | FLOAT | 贡献占比 |
| active_period | DATERANGE | 活跃时间段 |

### code_graph_nodes — 代码图谱节点

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID (PK) | 主键 |
| project_id | UUID (FK → projects) | 所属项目 |
| node_type | TEXT | module / class / function |
| name | TEXT | 节点名称 |
| file_path | TEXT | 文件路径 |
| line_start | INTEGER | 起始行 |
| line_end | INTEGER | 结束行 |
| description | TEXT | LLM 生成的描述 |
| embedding_id | TEXT | Qdrant 中的向量 ID |
| metrics | JSONB | 复杂度、行数等指标 |

### code_graph_edges — 代码图谱边

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID (PK) | 主键 |
| source_node_id | UUID (FK → code_graph_nodes) | 源节点 |
| target_node_id | UUID (FK → code_graph_nodes) | 目标节点 |
| edge_type | TEXT | import / call / inherit / implement |
| weight | FLOAT | 关系强度 |
