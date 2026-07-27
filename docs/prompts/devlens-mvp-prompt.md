# DevLens 研发棱镜 - 项目生成提示词

> **使用说明**：将本文件全部内容复制粘贴到任意 AI 对话框（ChatGPT / Claude / Gemini / DeepSeek / 通义千问等），AI 会生成一套完整可运行的项目骨架（目录结构 + 数据库 schema + 核心算法代码 + API + 前端页面 + Docker 配置 + README）。本提示词已嵌入经过验证的算法规格，AI 生成的代码会直接对标这些公式，而非泛泛而谈。

---

## 你的角色

你是一位资深的全栈架构师 + AI 工程专家，精通 Python/FastAPI、React/Next.js、向量数据库、LLM 集成和 Git 数据分析。你需要帮我从零生成一个名为 **DevLens（研发棱镜）** 的项目骨架。

## 项目背景与定位

DevLens 是一个**基于 AI 的研发认知系统**，核心是把 Git 仓库转化为"组织能力画像"。它不是代码分析工具，而是把代码世界映射成组织能力的认知系统。

**一句话定位**：从代码数据 → 语义理解 → 开发行为 → 个人能力 → 团队能力 → 组织洞察。

**三位一体评估模型**（产品的灵魂）：
- **项目评估（事）**：代码质量、架构健康度、技术债、活跃度
- **人员评估（人）**：7 维能力向量、成长曲线、协作网络、角色识别
- **团队评估（组织）**：能力聚合、Bus Factor、风险预警、能力缺口

**产品伦理**：这是成长平台而非考核工具，输出建议而非裁决。系统结论用于辅助成长与工程决策，不应脱离业务上下文作为个人绩效裁决。

## MVP 范围（2~4 周出 demo）

**只做这 5 件事**：
1. 输入本地 Git 仓库路径
2. 自动解析 git 历史（commit / blame / 行为）
3. 生成三类评分：项目 / 团队 / 人员
4. 输出 AI 评估报告（LLM 生成）
5. 一个可视化页面（雷达图 + 趋势 + 画像）

**不要做**：登录系统、多项目管理、权限控制、复杂代码图谱、GitLab/GitHub API 远程集成（MVP 阶段只支持本地 repo 路径）。

## 技术栈（强制要求，不要替换）

```
后端：Python 3.11+ / FastAPI / Uvicorn
数据库：PostgreSQL 16（主数据，用 SQLAlchemy 2.0 async + asyncpg）
向量库：Qdrant（代码 embedding 语义检索）
队列：Celery 5 + Redis 7（异步任务，MVP 可降级为 FastAPI BackgroundTasks）
AI：OpenAI SDK + Anthropic SDK（双通道，按任务类型路由）
解析：tree-sitter（多语言 AST）+ subprocess 调 git 命令
部署：Docker Compose（postgres/redis/qdrant/backend/worker/frontend）

前端：Next.js 14+ (App Router) / React 18 / TypeScript
UI：shadcn/ui + Tailwind CSS（暗色主题）
图表：recharts（雷达图/趋势/柱状图/环形评分）
头像：@dicebear/core（开发者头像生成）
```

## 项目目录结构（请严格按此生成）

```
devlens/
├── README.md
├── docker-compose.yml
├── docker-compose.dev.yml
├── Makefile                          # make dev / make up / make down
├── .env.example
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── alembic/
│   │   └── versions/                 # 生成初始迁移文件
│   └── app/
│       ├── __init__.py
│       ├── main.py                   # FastAPI 入口
│       ├── config.py                 # Pydantic Settings
│       ├── database.py               # async engine + session
│       ├── deps.py                   # 依赖注入
│       ├── api/
│       │   ├── __init__.py
│       │   └── v1/
│       │       ├── __init__.py
│       │       ├── router.py         # 汇总路由
│       │       ├── projects.py       # 项目 CRUD + analyze 触发
│       │       ├── developers.py     # 开发者画像查询
│       │       ├── teams.py          # 团队能力查询
│       │       ├── assessments.py    # 评估报告查询
│       │       └── health.py         # 健康检查
│       ├── models/                   # SQLAlchemy ORM（见下方 schema）
│       │   ├── __init__.py
│       │   ├── project.py
│       │   ├── people.py
│       │   ├── assessment.py
│       │   └── code_graph.py
│       ├── schemas/                  # Pydantic 请求/响应模型
│       │   ├── __init__.py
│       │   ├── project.py
│       │   ├── developer.py
│       │   └── team.py
│       ├── services/                 # 核心业务逻辑（见下方算法）
│       │   ├── __init__.py
│       │   ├── git_analyzer.py
│       │   ├── identity_matcher.py
│       │   ├── developer_profiler.py
│       │   ├── team_analyzer.py
│       │   ├── code_graph.py
│       │   ├── ai_reviewer.py
│       │   ├── doc_generator.py
│       │   ├── llm_client.py
│       │   ├── vector_store.py
│       │   └── pipeline.py           # 编排器：串联整个分析流程
│       ├── workers/
│       │   ├── __init__.py
│       │   ├── celery_app.py
│       │   └── tasks.py              # 异步任务：run_project_analysis
│       └── core/
│           ├── __init__.py
│           ├── logging.py
│           └── exceptions.py
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── next.config.mjs
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── postcss.config.mjs
│   ├── components.json               # shadcn/ui 配置
│   ├── app/
│   │   ├── layout.tsx                # 根布局 + 侧边栏
│   │   ├── globals.css               # 暗色主题
│   │   ├── page.tsx                  # 决策总览（三位一体卡片）
│   │   ├── projects/
│   │   │   ├── page.tsx              # 项目列表
│   │   │   └── [id]/page.tsx         # 项目详情
│   │   ├── developers/
│   │   │   ├── page.tsx              # 开发者列表
│   │   │   └── [id]/page.tsx         # 开发者画像（7维雷达）
│   │   ├── teams/
│   │   │   └── page.tsx              # 团队能力分析
│   │   └── onboard/
│   │       └── page.tsx              # 接入项目（输入 repo 路径）
│   ├── components/
│   │   ├── ui/                       # shadcn 基础组件
│   │   ├── app-shell.tsx             # 侧边栏布局
│   │   ├── charts.tsx                # recharts 封装
│   │   └── widgets.tsx               # StatCard/ScoreRing/PageHeader
│   └── lib/
│       ├── api.ts                    # 后端 API 客户端
│       ├── types.ts                  # TS 类型定义
│       └── utils.ts
└── docs/
    └── architecture.md
```

## 数据库 Schema（10 张表，请生成完整 SQLAlchemy 模型 + Alembic 迁移）

### 1. projects（项目表）
```
id: UUID PK
name: str
repo_path: str              # 本地仓库路径
default_branch: str = "main"
status: enum(pending/analyzing/completed/failed)
git_url: str | null         # 可选，未来扩展
created_at, updated_at
```

### 2. project_snapshots（项目快照，每次分析一条）

项目评估的详细分层、Skill Group、洞察治理与数据契约以 [`项目评估与AIReview架构设计.md`](../架构设计/项目评估与AIReview架构设计.md) 为准。项目健康度层、专项分析层和呈现/治理层不可混用；`metadata` 必须保留评分拆解、分析版本、覆盖范围、证据引用和置信度，不能只保存 LLM 总结文本。

```
id: UUID PK
project_id: FK -> projects
snapshot_date: datetime
health_score: float         # 综合健康度 0-100
quality_score, security_score, tech_debt_score, activity_score: float
commit_count, contributor_count: int
metadata: JSON              # 详细指标快照
```

### 3. people（人员表，组织内真实人员）
```
id: UUID PK
name: str
employee_id: str | null
department_id: FK -> departments | null
avatar_seed: str            # DiceBear 头像种子
created_at, updated_at
```

### 4. git_identities（Git 身份表，仓库里的 author）
```
id: UUID PK
name: str
email: str
is_bot: bool = false        # bot 检测（如 dependabot）
matched_person_id: FK -> people | null
match_confidence: float
match_method: str | null    # email/employee_id/pinyin/fuzzy
```

### 5. identity_mappings（身份映射审计）
```
id: UUID PK
git_identity_id: FK -> git_identities
person_id: FK -> people
confidence: float
method: str
created_at
```

### 6. departments（部门表，树形结构）
```
id: UUID PK
name: str
parent_id: FK -> departments | null
path: str                   # 物化路径 /root/parent/child
created_at, updated_at
```

### 7. project_memberships（人-项目-角色关联）
```
id: UUID PK
project_id: FK -> projects
person_id: FK -> people
role: str                   # owner/core/contributor/reviewer
contribution_ratio: float   # 0-1，贡献占比
joined_at, left_at: datetime | null
```

### 8. dev_skill_vectors（开发者能力向量，核心表）
```
id: UUID PK
person_id: FK -> people
project_id: FK -> projects | null    # null 表示跨项目综合
snapshot_date: datetime
code_quality: float        # 7 维能力，每维 0-100
architecture: float
stability: float
efficiency: float
collaboration: float
security_aware: float
growth_velocity: float
composite_score: float     # 6 维均值（growth_velocity 不计入综合）
raw_signals: JSON          # 原始信号，用于可解释性
```

### 9. team_capabilities（团队能力快照）
```
id: UUID PK
department_id: FK -> departments
project_id: FK -> projects | null
snapshot_date: datetime
avg_vector: JSON           # 6 维均值
variance: JSON             # 6 维方差
coverage: JSON             # 6 维覆盖率（>60分占比）
bus_factor: int            # 关键人流失阈值
collab_efficiency: float
risk_flags: JSON           # 风险列表
```

### 10. code_graph_nodes / code_graph_edges（代码图谱）
```
nodes: id, project_id, node_type(file/module/class/function), name, path, language, complexity, metadata(JSON)
edges: id, project_id, source_id, target_id, edge_type(import/call/contain), weight
```

## 核心算法（已验证，请严格按这些公式实现）

### 算法 1：开发者 7 维能力模型（developer_profiler.py）

这是产品的核心壁垒。7 个维度，每维 0-100 分，由原始信号加权计算：

```python
@dataclass
class SkillVector:
    code_quality: float       # 代码质量
    architecture: float       # 架构能力
    stability: float          # 稳定性
    efficiency: float         # 交付效率
    collaboration: float      # 协作能力
    security_aware: float     # 安全意识
    growth_velocity: float    # 成长速度（不计入综合分）
    composite_score: float = 0.0  # 前6维均值

    def __post_init__(self):
        dims = [self.code_quality, self.architecture, self.stability,
                self.efficiency, self.collaboration, self.security_aware]
        self.composite_score = sum(dims) / len(dims)

# 各维度加权公式（s 是原始信号 dict，默认值 50）：
code_quality      = ai_review_score*0.35 + lint_pass_rate*0.15 + (100-bug_introduction_rate)*0.30 + code_survival_rate*0.20
architecture      = cross_module_contribution*0.25 + refactor_quality_score*0.25 + api_design_score*0.20 + complexity_reduction*0.30
stability         = bug_fix_ratio*0.25 + (100-revert_ratio)*0.25 + (100-hotfix_ratio)*0.25 + test_coverage_delta*0.25
efficiency        = issue_close_speed*0.30 + pr_merge_speed*0.20 + commit_rhythm_regularity*0.20 + task_throughput*0.30
collaboration     = review_depth*0.30 + review_participation_rate*0.25 + network_centrality*0.25 + documentation_contribution*0.20
security_aware    = (100-vulnerability_introduction_rate)*0.40 + vulnerability_fix_rate*0.30 + security_review_participation*0.30

# 成长速度：用历史 composite_score 做线性回归斜率
def calc_growth_velocity(historical_scores: list[float]) -> float:
    if len(historical_scores) < 2:
        return 0.0
    n = len(historical_scores)
    x_mean = (n - 1) / 2
    y_mean = sum(historical_scores) / n
    numerator = sum((i - x_mean) * (y - y_mean) for i, y in enumerate(historical_scores))
    denominator = sum((i - x_mean) ** 2 for i in range(n))
    return numerator / denominator if denominator > 0 else 0.0
```

### 算法 2：团队能力聚合（team_analyzer.py）

把成员的能力向量聚合成团队能力，6 个维度（不含 growth_velocity）：

```python
DIMENSIONS = ["code_quality", "architecture", "stability", "efficiency", "collaboration", "security_aware"]

# 1. 均值向量：每维取成员均值
# 2. 方差向量：每维方差（衡量团队平衡度）
# 3. 覆盖率：每维 >=60 分的成员占比（阈值 60）
# 4. Bus Factor：按综合分降序累加，累计达到总分 80% 所需人数
def estimate_bus_factor(vectors):
    scores = sorted([composite_score(v) for v in vectors], reverse=True)
    total = sum(scores)
    if total == 0: return len(vectors)
    cumulative = 0
    for i, score in enumerate(scores):
        cumulative += score
        if cumulative >= total * 0.8:
            return i + 1
    return len(vectors)

# 5. 风险检测：
#    - 覆盖率 < 30% → skill_gap 风险（<20% high，否则 medium）
#    - 方差 > 400（即标准差>20）→ high_variance 风险
```

### 算法 3：Git 行为分析（git_analyzer.py）

通过 subprocess 调 git 命令解析本地仓库：

```python
# git log 解析（--numstat 拿行级增删）：
git log --all --since="6 months ago" --format="%H|%an|%ae|%at|%s" --numstat

# 解析出每个 commit：hash/author_name/author_email/timestamp/message/files_changed/lines_added/lines_deleted

# git blame 解析（拿文件归属）：
git blame --line-porcelain <file>
# 解析 author 行，统计 {file: {author: line_count}}

# 行为指标计算：
# - commit_frequency：commits 数 / 周数
# - rhythm_regularity（节奏规律性）：commit 时间的 24 小时分布熵，归一化到 0-1
#   entropy = -sum(p * log2(p)) for p in hour_distribution
#   regularity = 1 - (entropy / log2(24))   # 越规律越接近 1
# - revert_ratio：含 revert/rollback/undo 的 commit 占比
# - hotfix_ratio：含 hotfix/urgent/emergency/critical fix 的 commit 占比

# 源文件遍历（排除 node_modules/.git/__pycache__/dist/build/vendor）：
# 支持扩展名：.py .ts .tsx .js .jsx .go .java .rs
```

### 算法 4：身份匹配（identity_matcher.py）

4 级匹配策略，把 Git author 映射到组织内人员：

```python
# Level 1: email 精确匹配（confidence 1.0）
# Level 2: employee_id 匹配（confidence 0.9）
# Level 3: 拼音匹配（pypinyin，name 拼音 vs git author name，confidence 0.75）
# Level 4: 模糊匹配（Levenshtein 距离，相似度 > 0.85，confidence 0.6）
# 低于 0.6 不匹配，标记为 unmatched

# Bot 检测：author name/email 含 bot/dependabot/renovate/github-actions 等
```

### 算法 5：LLM 客户端（llm_client.py）

按任务类型路由到不同模型：

```python
class TaskType(Enum):
    CODE_REVIEW       # -> Anthropic Claude Sonnet
    SECURITY_AUDIT    # -> OpenAI GPT-4o
    DOC_GENERATION    # -> Anthropic Claude Sonnet
    COMMENT_EVALUATION # -> OpenAI GPT-4o-mini
    MULTIMODAL        # -> OpenAI GPT-4o

# 统一封装，支持自定义 base_url（接兼容 API）
# 含 token 用量统计
```

### 算法 6：AI 代码审查（ai_reviewer.py）

项目级 AI Review、RAG 上下文、洞察去重与整改治理的完整约束以 [`项目评估与AIReview架构设计.md`](../架构设计/项目评估与AIReview架构设计.md) 为准。

```python
# 输入：PR diff 或单文件代码
# 上下文：从 Qdrant 向量检索相关代码片段（RAG）
# LLM 输出 5 维度评分 + issues 列表 + summary（JSON 结构化输出）
# 5 维度：code_quality / design / security / performance / maintainability
# 每条项目级 issue 必须包含证据位置、类别/子类别、严重性、置信度、状态、去重指纹、检测来源、修复建议与验证方式
# 洞察必须可关联整改项；证据不足时降级为待确认，不能仅凭 LLM 文案决定项目评分
# prompt 用中文，含容错 JSON 解析
```

### 算法 7：Pipeline 编排器（pipeline.py，MVP 核心）

这是整个系统的主流程，串起所有服务。**这是 MVP 最关键的部分，请完整实现，不要留 TODO**：

```python
class AnalysisPipeline:
    """端到端分析流水线，MVP 用同步 pipeline 模拟（不做复杂 multi-agent）"""

    async def run(self, project_id: UUID, repo_path: str):
        # 阶段 1: Git 数据采集
        #   - GitAnalyzer(repo_path).get_commits(since_months=6)
        #   - GitAnalyzer.get_blame_stats()
        #   - GitAnalyzer.analyze_behavior(commits)
        #   - 更新 project.status = "analyzing"

        # 阶段 2: 身份匹配
        #   - 提取所有 git_identities
        #   - IdentityMatcher 4 级匹配到 people 表
        #   - 自动创建未匹配的 people 记录

        # 阶段 3: 代码解析（tree-sitter）
        #   - CodeGraph.build(repo_path) 构建 AST 图谱
        #   - 提取 file/module/class/function 节点 + import/call 边

        # 阶段 4: 向量化入 Qdrant
        #   - 按函数/类 chunk 切分
        #   - embedding 入库（payload 含 author/file/commit）
        #   - 增量更新：只处理 diff（MVP 可先全量）

        # 阶段 5: 个人能力建模
        #   - 每个开发者聚合 signals（git 行为 + blame + AI review）
        #   - DeveloperProfiler.calc_skill_vector(signals)
        #   - 写入 dev_skill_vectors 表

        # 阶段 6: 团队能力聚合
        #   - 按部门/项目分组
        #   - TeamAnalyzer.calculate_team_capability(member_vectors)
        #   - 写入 team_capabilities 表

        # 阶段 7: 项目快照
        #   - 编排 Project Intelligence Skill Group，聚合确定性指标、专项分析和已去重洞察
        #   - 写入评分拆解、资产摘要、分析/规则/模型版本、置信度与可追溯证据
        #   - 写入 project_snapshots
        #   - 更新 project.status = "completed"

        # 阶段 8: AI 报告生成（可选，LLM 生成总结）
        #   - AIReviewer 基于项目快照和证据生成项目评估报告，不可用文案覆盖原始评分
        #   - 生成洞察聚合、整改优先级和风险治理摘要
        #   - DocGenerator 生成模块文档
```

## API 设计（RESTful，全部 /api/v1 前缀）

```
# 项目
POST   /projects              # 创建项目（输入 repo_path）
GET    /projects              # 项目列表
GET    /projects/{id}         # 项目详情
POST   /projects/{id}/analyze # 触发分析（异步，返回 task_id）
GET    /projects/{id}/status  # 查询分析进度
DELETE /projects/{id}         # 删除项目

# 开发者
GET    /developers            # 开发者列表（支持 project_id 过滤）
GET    /developers/{id}       # 开发者画像（含 7 维向量）
GET    /developers/{id}/history  # 能力历史曲线

# 团队
GET    /teams                 # 团队列表
GET    /teams/{dept_id}       # 团队能力详情（含 Bus Factor）
GET    /teams/{dept_id}/history  # 团队能力历史

# 评估报告
GET    /assessments/dashboard    # 总览（三位一体矩阵）
GET    /assessments/project/{id} # 项目评估报告
GET    /assessments/developer/{id}  # 开发者评估
GET    /assessments/team/{id}    # 团队评估

# 健康
GET    /health               # 服务健康检查
```

## 前端页面设计（8 个页面，shadcn/ui 暗色主题）

### 1. `/` 决策总览（首页）
- 顶部三支柱卡片：项目评估 / 开发者画像 / 团队分析（点击跳转）
- 统计卡：项目数 / 开发者数 / 团队数 / 平均健康度
- 健康度趋势图（recharts AreaChart）
- 风险预警列表（skill_gap / high_variance）
- 三位一体矩阵（团队 × 项目 交叉热力图）

### 2. `/projects` 项目列表
- 项目卡片网格：每个卡片含健康度环形评分 + 质量/安全/技术债进度条
- "接入项目"按钮跳转 /onboard

### 3. `/projects/[id]` 项目详情
- 综合评分环（ScoreRing SVG）
- 5 维证据卡：代码质量 / 安全 / 测试 / 技术债 / 交付稳定性
- AI Review 洞察卡（展示 LLM 审查结果）
- 技术债趋势 + 修复优先级列表

### 4. `/developers` 开发者列表
- 开发者卡片墙：DiceBear 头像 + 综合评分环 + 标签（如"核心模块贡献者""偏后端架构"）

### 5. `/developers/[id]` 开发者画像（核心页面）
- 头像 + 综合评分环 + 角色标签
- **7 维能力雷达图**（self vs team 均值对比，recharts RadarChart）
- 成长曲线（composite_score 历史趋势，LinearChart）
- 行为证据卡（commit 频率 / 节奏熵 / revert 比例 / hotfix 比例）
- 协作网络图（SVG 力导向图）
- 发展计划建议（LLM 生成）

### 6. `/teams` 团队分析
- 4 团队卡片墙：每卡含 7 维能力雷达 + Bus Factor
- 能力缺口矩阵表（维度 × current/target/差距/动作/负责人）
- 风险闭环列表

### 7. `/onboard` 接入项目
- 表单：项目名 + 本地 repo 路径 + 默认分支
- 提交后调用 POST /projects，跳转项目详情页显示分析进度

### 8. `/settings` 设置（可选，MVP 可简化）
- LLM 配置（OpenAI/Anthropic API Key + base_url）
- 分析参数（时间窗口 / 身份匹配阈值）
- 头像风格选择

## Docker Compose 配置

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: devlens
      POSTGRES_USER: devlens
      POSTGRES_PASSWORD: devlens
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  qdrant:
    image: qdrant/qdrant:latest
    ports: ["6333:6333"]
    volumes: ["qdrant_data:/qdrant/storage"]

  backend:
    build: ./backend
    ports: ["8000:8000"]
    env_file: .env
    depends_on: [postgres, redis, qdrant]
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

  worker:
    build: ./backend
    env_file: .env
    depends_on: [postgres, redis, qdrant]
    command: celery -A app.workers.celery_app worker --loglevel=info

  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    depends_on: [backend]
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8000

volumes:
  pgdata:
  qdrant_data:
```

## 输出要求

请按以下顺序生成完整内容，**每个文件都生成可运行的代码，不要用 TODO 占位**（除了明确标注"未来扩展"的部分）：

1. **README.md**：项目介绍、架构图（文字版）、快速启动指南（make dev）、API 文档速览
2. **后端完整代码**：
   - `requirements.txt`（锁定版本）
   - `app/main.py`、`config.py`、`database.py`、`deps.py`
   - `app/models/` 4 个文件（10 张表完整 ORM）
   - `app/schemas/` 3 个文件（Pydantic 模型）
   - `app/api/v1/` 6 个路由文件（完整实现，assessments 不能是空壳）
   - `app/services/` 10 个服务文件（**算法 1~7 严格按公式实现，pipeline.py 必须完整串通**）
   - `app/workers/` celery 配置 + 任务
   - `alembic/` 初始迁移
   - `Dockerfile`
3. **前端完整代码**：
   - `package.json`、配置文件
   - `app/` 8 个页面（用 recharts 画雷达图/趋势图，用 DiceBear 生成头像）
   - `components/` 布局 + 图表封装 + shadcn 基础组件
   - `lib/api.ts`（真实调用后端 API，不要用 mock）
4. **Docker Compose + Makefile + .env.example**
5. **docs/architecture.md**：架构说明文档

## 重要约束（务必遵守）

1. **算法实现必须严格按上面的公式**，7 维能力模型的加权系数、Bus Factor 的 80% 阈值、节奏熵的归一化方式都不能改
2. **pipeline.py 必须完整实现 8 个阶段**，不能留 TODO，这是 MVP 能跑起来的关键
3. **assessments API 必须返回真实数据**（从 dev_skill_vectors 和 team_capabilities 表查），不能返回空壳 `{"scores": {}}`
4. **前端必须真实调用后端 API**，不能用 mock 数据，API 客户端用 fetch 封装
5. **数据库必须有 Alembic 迁移文件**，不能只靠 `create_all`
6. **暗色主题**：globals.css 写死 `color-scheme: dark`
7. **代码注释用中文**，变量名用英文
8. **所有评分 0-100 浮点数**，所有比率 0-1 浮点数

## 开始生成

请从 README.md 开始，按顺序输出所有文件。如果输出长度受限，请明确告诉我"接下来输出 X 文件"，让我回复"继续"来分段生成。
