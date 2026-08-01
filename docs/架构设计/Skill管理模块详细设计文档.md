# Skill 管理模块详细设计文档（Skill Manager）

> 版本：v1.0
> 状态：待开发
> 关联文档：[`LLM+Skill三位一体架构方案.md`](./LLM+Skill三位一体架构方案.md)、[`项目评估与AIReview架构设计.md`](./项目评估与AIReview架构设计.md)

---

## 0. 设计目标

解决当前系统两大问题：

1. **Skill Group 硬编码**：`backend/app/analyzer.py` 中的 `SKILL_GROUPS` 字典写死在代码里，新增/修改评估规则必须改代码、重启服务。
2. **评估不可复现**：每次 LLM 分析用的什么规则、哪个版本，没有记录，无法追溯和对比。

本模块把「评估规则」从代码中解放出来，变成**可管理的资产**：

```
团队编码规范（Java规范/前端规范/安全规范...）
        │ ① 导入
        ▼
  Skill Sources（规范文档）—— 可上传/可溯源
        │ ② LLM 抽取 + 人工审核
        ▼
  Skills（规则条目）—— 一条规则一条 Skill
        │ ③ 编组
        ▼
  Skill Groups（评估编组）—— 每次评估选择一组
        │ ④ 注入
        ▼
  LLM 分析（analyzer.py）—— 按组内规则审查
```

---

## 1. 数据模型设计（4 张新表 + 1 张扩展）

### 1.1 skill_sources（规则来源表）

存放导入的编码规范文档。支持 md/txt 文本直接录入，也支持未来扩展 PDF 解析。

```python
class SkillSource(Base):
    __tablename__ = "skill_sources"
    id = Column(String, primary_key=True)          # sk-src-xxx
    name = Column(String, nullable=False)          # 规范名称，如《Java编码规范v3.2》
    doc_type = Column(String, default="markdown")  # markdown|text|pdf
    content = Column(Text, default="")             # 规范全文（md/txt 时直接存文本）
    source_lang = Column(String, default="")       # java|frontend|go|python|all
    description = Column(Text, default="")         # 一句话说明
    status = Column(String, default="imported")    # imported|extracted|failed
    created_by = Column(String, default="")
    created_at = Column(String)
    updated_at = Column(String)
```

### 1.2 skills（规则条目表）

核心表。一条 Skill = 一条可执行的评估规则。

```python
class Skill(Base):
    __tablename__ = "skills"
    id = Column(String, primary_key=True)          # sk-xxx
    source_id = Column(String, ForeignKey("skill_sources.id"), nullable=True)  # 来源（可为空=手工创建）
    name = Column(String, nullable=False)          # 规则名，如「禁止硬编码密钥」
    description = Column(Text, default="")         # 规则说明（展示用）
    category = Column(String, default="quality")   # quality|security|performance|architecture|maintainability|reliability|logic|complexity|configuration|dependency|testing|delivery
    severity = Column(String, default="medium")    # critical|high|medium|low|info
    check_type = Column(String, default="llm")     # llm（LLM 语义审查）|static（静态检测，预留）
    rule_content = Column(Text, nullable=False)    # ★ 规则正文，LLM 评估时注入 prompt
    positive_examples = Column(JSON, default=list) # [{desc, code}] 合规示例（few-shot）
    negative_examples = Column(JSON, default=list) # [{desc, code}] 违规示例（few-shot）
    enabled = Column(Integer, default=1)           # 0|1 启停
    created_by = Column(String, default="")
    created_at = Column(String)
    updated_at = Column(String)
```

### 1.3 skill_groups（评估编组表）

```python
class SkillGroup(Base):
    __tablename__ = "skill_groups"
    id = Column(String, primary_key=True)          # skg-xxx
    name = Column(String, nullable=False)          # 组名，如「Java后端规范组」
    description = Column(Text, default="")
    skill_ids = Column(JSON, default=list)         # [skill_id, ...] 有序
    analysis_type = Column(String, default="repo_analysis")  # repo_analysis|developer_review|team_aggregation
    enabled = Column(Integer, default=1)
    created_at = Column(String)
    updated_at = Column(String)
```

### 1.4 skill_group_runs（评估运行记录表）

记录「哪次分析用了哪个组、组内规则的版本快照」——保证可复现。

```python
class SkillGroupRun(Base):
    __tablename__ = "skill_group_runs"
    id = Column(String, primary_key=True)          # skgr-xxx
    run_id = Column(String, ForeignKey("analysis_runs.id"), nullable=True)  # 关联分析运行
    project_id = Column(String, ForeignKey("projects.id"), nullable=True)
    group_id = Column(String, ForeignKey("skill_groups.id"))
    group_snapshot = Column(JSON)                  # {group_name, skill_ids:[...], rules:[{id,name,category,severity,rule_content}]} 快照
    trigger = Column(String, default="manual")     # manual|auto
    created_at = Column(String)
```

### 1.5 analysis_runs 扩展（迁移）

给现有 `analysis_runs` 表加一列，不新建表：

```sql
ALTER TABLE analysis_runs ADD COLUMN skill_group_id VARCHAR;
```

---

## 2. API 设计

全部挂 `/api/v1` 前缀，沿用现有 `routers/` 结构，新增 `backend/app/routers/skills.py`。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/skill-sources` | 规范来源列表 |
| POST | `/skill-sources` | 创建规范来源（body: name, docType, content, sourceLang, description） |
| GET | `/skill-sources/{id}` | 规范详情 |
| DELETE | `/skill-sources/{id}` | 删除（级联不删 skills，仅置 source_id 为 null） |
| POST | `/skill-sources/{id}/extract` | ★ LLM 抽取：调 LLM 从 content 生成 skills 草稿并入库（status=extracted） |
| GET | `/skills` | 规则列表（支持 ?sourceId= / ?category= / ?enabled= 过滤） |
| POST | `/skills` | 创建规则（手工） |
| PATCH | `/skills/{id}` | 更新规则（含 enabled 启停） |
| DELETE | `/skills/{id}` | 删除规则 |
| GET | `/skill-groups` | 编组列表 |
| POST | `/skill-groups` | 创建编组（body: name, description, skillIds, analysisType） |
| PATCH | `/skill-groups/{id}` | 更新编组（改名/换规则/启停） |
| DELETE | `/skill-groups/{id}` | 删除编组 |
| GET | `/skill-groups/{id}/preview` | 组内规则预览（返回组 + 规则明细，用于评估前确认） |
| POST | `/analysis-runs/{run_id}/bind-group` | 给一次分析运行绑定 Skill Group（body: groupId） |

> 设计约束：**不新增 `/analyze` 重载**。现有 `POST /projects` 触发分析时自动绑定默认组（第一个 enabled 的 repo_analysis 组）；手动绑定通过 bind-group 端点。前端接入页可选组。

---

## 3. LLM 抽取流程（规范 → Skills）

### 3.1 触发时机

用户上传/录入规范文档后，点击「AI 抽取」按钮 → `POST /skill-sources/{id}/extract`。

### 3.2 抽取 Prompt

复用现有 `backend/app/llm.py` 的 `chat_json`（DeepSeek，Anthropic 兼容端点）。Prompt 模板：

```text
你是资深代码规范专家。下面是一份编码规范文档，请抽取其中的【可自动审查规则】，
输出严格 JSON（不要 markdown 代码块、不要解释）。

要求：
1. 只抽取"能在代码审查中客观判断"的规则（命名、异常处理、事务、SQL、安全、性能等）；
   跳过纯流程/管理类条款（如"代码需经过评审"）。
2. 每条规则输出字段：
   - name: 规则名（≤30字）
   - category: quality|security|performance|architecture|maintainability|reliability|logic|complexity|configuration|dependency|testing|delivery 之一
   - severity: critical|high|medium|low|info
   - ruleContent: 规则正文（可直接作为 LLM 审查指令的完整句子，≤200字）
   - positiveExample: {desc, code} 合规示例（如无则 code 为空字符串）
   - negativeExample: {desc, code} 违规示例
3. 抽取 5~30 条，宁缺毋滥。

规范文档：
{source_content}

输出 JSON schema:
{"skills":[{"name":string,"category":string,"severity":string,"ruleContent":string,
"positiveExample":{"desc":string,"code":string},"negativeExample":{"desc":string,"code":string}}]}
```

### 3.3 抽取结果处理

- 成功：批量写入 `skills` 表（source_id 关联、check_type=llm、enabled=1），`skill_sources.status = 'extracted'`。
- 失败：status='failed'，message 记录错误，不影响已有数据。
- 抽取结果**默认不自动加入任何组**——用户需在编组页勾选（人工审核环节）。

---

## 4. analyzer.py 改造方案

### 4.1 现状问题

`SKILL_GROUPS` 硬编码字典 + `_skill_prompt()` 只有 focus 一句话，无规则细节。

### 4.2 改造后

```python
def _load_group_rules(db, group_id: str | None) -> dict | None:
    """从数据库加载 Skill Group + 组内 rules（无则返回 None）"""
    if not group_id:
        return None
    group = db.query(models.SkillGroup).filter_by(id=group_id).first()
    if not group:
        return None
    skills = db.query(models.Skill).filter(
        models.Skill.id.in_(group.skill_ids or []),
        models.Skill.enabled == 1,
    ).all()
    return {
        "group_name": group.name,
        "group_id": group.id,
        "skills": [
            {
                "id": s.id, "name": s.name, "category": s.category,
                "severity": s.severity, "rule_content": s.rule_content,
                "positive_examples": s.positive_examples or [],
                "negative_examples": s.negative_examples or [],
            }
            for s in skills
        ],
    }

def _skill_prompt(skill: str, git_stats: str, code: str, rules: list[dict] | None = None) -> str:
    cfg = SKILL_GROUPS[skill]  # 保留内置 focus 作为兜底
    rules_section = ""
    if rules:
        lines = []
        for r in rules:
            lines.append(f"- [{r['severity']}] {r['name']}：{r['rule_content']}")
        rules_section = "\n".join(["", "★ 本组审查规则（必须逐条检查）：", *lines])
    return f"""你是资深代码架构师，执行 {cfg["focus"]}
{rules_section}

{git_stats}

抽样核心代码:
{code}

输出严格 JSON（不要 markdown 代码块、不要解释）：
{{"dimensionScore":number,"aiInsights":[...]}}
...
"""
```

### 4.3 分析流程变化（_analyze）

```python
def _analyze(project_id, repo_target, name, branch, group_id=None):
    db = SessionLocal()
    try:
        ...
        # 加载规则（入参 group_id > 最近一次绑定的 group > 默认组）
        group = None
        if group_id:
            group = _load_group_rules(db, group_id)
        elif <analysis_runs.skill_group_id 有值>:
            group = _load_group_rules(db, <该值>)
        else:
            default = db.query(models.SkillGroup).filter_by(
                enabled=1, analysis_type="repo_analysis").first()
            if default:
                group = _load_group_rules(db, default.id)

        # 多 Skill Group 调用：内置 security/quality 兜底 + 自定义组规则注入
        sec = chat_json([..._skill_prompt("security", ..., rules=group or None)...])
        qual = chat_json([..._skill_prompt("quality", ..., rules=group or None)...])

        # 记录 SkillGroupRun（快照，保证可复现）
        db.add(models.SkillGroupRun(...))
        ...
```

**要点**：
- 内置 `security`/`quality` 两个 SKILL_GROUPS 保留作兜底（即使没有配置任何自定义组，系统仍能工作）。
- 自定义组规则以 `rules_section` 形式注入两个 prompt，要求 LLM「逐条检查」。
- 每次分析写 `skill_group_runs` 快照（组名 + 规则 id + 规则全文），后续可追溯「这次分析是按什么规则评的」。
- `POST /projects` 入参增加可选 `skillGroupId`。

---

## 5. 前端设计（/skills 页面）

### 5.1 页面结构（3 个 tab）

| Tab | 内容 |
|-----|------|
| **编组管理** | 组卡片列表（名称/规则数/启用状态）+「新建组」+ 组内规则抽屉 |
| **规则库** | 规则表格（名称/分类/严重级/来源/启停开关）+ 过滤 + 新建/编辑规则弹窗 |
| **规范来源** | 来源列表 +「导入规范」弹窗（名称/语言/内容文本域）+ 「AI 抽取」按钮 |

### 5.2 路由与文件

- 路由：`frontend/app/skills/page.tsx`（单页三 tab，不做多级路由）
- 组件复用：`Card/Button/Input/Badge/Table/Segmented/Sheet`（已有 `components/ui/`）
- 新增组件（如需要）：`frontend/components/skill-group-drawer.tsx`（组内规则抽屉）
- API 客户端：`frontend/lib/api.ts` 增加 `getSkillSources/createSkillSource/extractSkills/getSkills/createSkill/updateSkill/getSkillGroups/createSkillGroup/updateSkillGroup/getSkillGroupPreview/bindGroup`
- 类型：`frontend/lib/types.ts` 增加 `SkillSource/Skill/SkillGroup/SkillGroupRun/ExtractResult`

### 5.3 侧边栏入口

`frontend/components/app-shell.tsx` 导航数组新增「Skill 管理」项（icon: `BookOpenCheck` 或 `ShieldCheck`，路径 `/skills`）。

### 5.4 关键交互

1. **导入规范**：弹窗表单 → POST /skill-sources → 列表出现新来源。
2. **AI 抽取**：来源行「AI 抽取」按钮 → POST /skill-sources/{id}/extract → loading 态 → 完成后 toast「抽取 N 条规则」→ 切到规则库 tab 可审核。
3. **新建组**：弹窗选规则（多选 checkbox 列表，按 category 分组显示）→ POST /skill-groups。
4. **编辑组**：抽屉展示组内规则（名称/严重级/内容预览），可移除规则、可调顺序。
5. **规则启停**：表格行内 Switch（启用/停用）→ PATCH /skills/{id} {enabled}。

---

## 6. Seed 数据

`backend/app/seed.py` 增加 `seed_skills()`，在启动 lifespan 中调用（仅当 skills 表为空时）：

- 2 个示例来源：《示例-Java编码规范》《示例-前端编码规范》
- 6~8 条示例 Skill（如「禁止硬编码密钥」「循环复杂度≤10」「事务必须显式提交/回滚」「禁止 console.log 提交」「SQL 禁止字符串拼接」「日志必须包含上下文」）
- 2 个示例组：「Java 后端规范组」（4 条规则）、「前端规范组」（3 条规则）
- 组内规则保持 enabled=1，保证开箱即用

---

## 7. 验收标准

### 后端

- [ ] `uvicorn` 启动无报错，`Base.metadata.create_all` 建出新 4 张表
- [ ] `GET /api/v1/skill-groups` 返回 seed 的 2 个组
- [ ] `POST /api/v1/skill-sources` + `POST /api/v1/skill-sources/{id}/extract` 能真实调通 LLM 并写入 skills（用 seed 来源内容做验证）
- [ ] `POST /api/v1/projects` 带 `skillGroupId` 触发分析，`skill_group_runs` 表生成快照记录
- [ ] insights 表 `skill_group` 字段照常写入

### 前端

- [ ] `pnpm build` 通过
- [ ] `/skills` 页面三 tab 可切换，mock 数据渲染正常
- [ ] 导入规范 → AI 抽取 → 新建组 全链路可用（mock 模式）
- [ ] 侧边栏出现「Skill 管理」入口

### 回归

- [ ] 不配置任何自定义组时，原有分析流程（内置 security/quality）不受影响
- [ ] 现有页面（首页/项目/开发者/团队）无回归

---

## 8. 开发顺序建议

1. `models.py` + 4 张表 + `analysis_runs.skill_group_id` 迁移
2. `schemas.py` 增加 Pydantic 模型
3. `routers/skills.py` 全部 API + `main.py` 注册
4. `analyzer.py` 改造（加载规则 + 注入 prompt + SkillGroupRun 快照）
5. `seed.py` 增加 seed_skills
6. 前端 `types.ts` + `api.ts`
7. 前端 `/skills` 页面 + 侧边栏入口
8. build + 联调验证
