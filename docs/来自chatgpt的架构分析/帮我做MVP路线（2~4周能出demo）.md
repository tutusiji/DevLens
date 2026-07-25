好，这里我不给你空话，直接给你一条**2~4周能跑出Demo的MVP路线**，目标是：

> ✅ 能接入一个GitHub仓库  
> ✅ 自动生成代码语义文档（类似 deepwiki）  
> ✅ 能分析PR / commit  
> ✅ 输出一个“开发者画像（简版）”  
> ✅ 有一个前端可视化页面

---

# 一、MVP目标（强约束范围）

先**砍掉复杂度**，只做最小闭环：

```text
Repo → 代码解析 → 向量化 → PR分析 → 简单画像 → 可视化
```

---

## ❌ 本阶段不要做：

- 复杂评分模型（先不用权重体系）

- 团队建模

- 安全扫描（可后加）

- 多仓库支持

---

# 二、整体架构（MVP版）

```text
GitHub Repo
   ↓
[Ingest Service]
   ↓
代码解析（tree-sitter）
   ↓
Embedding → Qdrant
   ↓
AI分析（PR / 文件）
   ↓
PostgreSQL（结构化结果）
   ↓
API（NestJS）
   ↓
React 可视化
```

---

# 三、技术栈（直接定）

你不用纠结，直接用这套：

```yaml
Backend:
  NestJS

AI Worker:
  Python (FastAPI)

Parsing:
  tree-sitter

Vector DB:
  Qdrant

DB:
  PostgreSQL

Queue:
  BullMQ

Frontend:
  React + ECharts
```

---

# 四、4周拆解（可以压到2周）

---

# 🚀 Week 1：代码语义层（最关键基础）

## 目标：

👉 把 repo 变成“可检索知识库”

---

## 任务：

### 1. Git 仓库拉取

- 支持输入 GitHub URL

- clone 到本地

---

### 2. 代码解析（tree-sitter）

粒度：

- 文件

- 函数（重点）

输出结构：

```json
{
  "file": "src/user.ts",
  "function": "getUser",
  "code": "...",
  "start_line": 10
}
```

---

### 3. embedding（核心）

模型：

- bge-m3（推荐）

---

### 4. 入库（Qdrant）

payload：

```json
{
  "repo": "xxx",
  "file": "xxx",
  "author": "xxx"
}
```

---

## ✅ Week1结果：

👉 你可以做到：

- “这个函数在哪？”

- “相关代码有哪些？”

👉 已经有 deepwiki 的基础能力

---

# 🚀 Week 2：PR / Commit 分析

## 目标：

👉 让系统“理解代码变化”

---

## 任务：

### 1. Git diff 解析

拿到：

- 修改文件

- diff内容

---

### 2. 向量检索上下文（关键）

根据 diff：

- 查相关函数

- 查上下文代码

---

### 3. AI分析（核心）

输入：

```text
PR diff + 相关代码
```

输出：

```json
{
  "summary": "...",
  "risk": "medium",
  "tags": ["bugfix", "refactor"]
}
```

---

👉 Prompt 重点：

- 变更类型（feature / fix / refactor）

- 复杂度

- 影响范围

---

## ✅ Week2结果：

👉 你可以做到：

- 自动生成 PR 总结

- 给 PR 打标签

- 初步风险判断

---

# 🚀 Week 3：开发者画像（简版）

## 目标：

👉 做出“人”的分析（核心卖点）

---

## 数据来源：

- commit

- PR

- AI分析结果

---

## 你先做“标签模型”（不要评分）

例如：

```json
{
  "dev": "alice",
  "tags": ["frontend", "bugfix-heavy", "low-risk"],
  "activity": 120,
  "main_files": ["ui/", "components/"]
}
```

---

## 标签怎么来？

基于：

- 修改路径（frontend/backend）

- PR类型（AI判断）

- 风险分布

---

## 可视化：

👉 雷达图（简单版）：

- 活跃度

- 复杂度

- 风险

- 覆盖范围

---

## ✅ Week3结果：

👉 你可以展示：

- “这个人主要在做什么”

- “偏业务还是偏底层”

---

# 🚀 Week 4：前端可视化（Demo成型）

## 页面结构：

---

## 1️⃣ Repo Overview

- 文件结构

- 代码文档（AI生成）

---

## 2️⃣ PR分析页

- PR列表

- AI总结

- 风险标签

---

## 3️⃣ 开发者画像 ⭐

- 雷达图

- 标签云

- 贡献分布

---

## 技术：

- React

- ECharts（雷达图）

---

## ✅ Week4结果：

👉 一个完整Demo：

- 输入 repo

- 自动分析

- 展示结果

---

# 五、核心数据结构（必须提前定）

---

## 1️⃣ 向量表（Qdrant）

```json
{
  "id": "...",
  "vector": [...],
  "payload": {
    "file": "",
    "function": "",
    "repo": ""
  }
}
```

---

## 2️⃣ PR分析表（PostgreSQL）

```sql
pr_analysis
- id
- repo
- pr_id
- summary
- risk
- tags
```

---

## 3️⃣ 开发者表

```sql
developer_profile
- name
- tags (json)
- activity
```

---

# 六、MVP关键亮点（你Demo必须体现）

---

## ⭐1. “代码问答能力”

👉 Demo现场：

问：

> 这个模块干嘛的？

👉 用向量检索 + LLM回答

---

## ⭐2. PR自动总结

👉 展示：

- summary

- risk

---

## ⭐3. 开发者画像（最吸引人）

👉 展示：

- 标签

- 雷达图

---

# 七、你真正的工作重点（别分散）

---

## 🔥 只抓3件事：

### 1. 向量化代码（基础）

### 2. PR语义分析（亮点）

### 3. 开发者标签（差异）

---

# 八、2周极速版本（如果你要更快）

砍掉：

- tree-sitter（直接按文件切）

- Neo4j（不要）

- 队列（同步跑）

👉 你可以：

**7天出一个能演示的版本**

---

# 九、最后给你一句判断标准

你的MVP是否成功，只看这3点：

---

### ✔ 能不能回答：

> “这个仓库主要在干嘛？”

---

### ✔ 能不能判断：

> “这个PR风险大不大？”

---

### ✔ 能不能描述：

> “这个开发者主要在做什么？”

---

---

如果你要下一步，我可以直接帮你：

- 👉 写一版 **PR分析 Prompt（可直接用）**

- 👉 或设计 **开发者标签体系（第一版）**

- 👉 或给你一个 **项目目录结构（NestJS + Python）**

这三样会直接决定你Demo的完成度。
