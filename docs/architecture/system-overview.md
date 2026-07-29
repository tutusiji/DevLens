# 系统架构总览

## 三大核心体系

```
                    ┌─────────────┐
                    │  项目评估    │
                    │  (事)       │
                    └──────┬──────┘
                           │
              项目质量反映开发者水平
              开发者能力决定项目上限
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          │         共享数据底座             │
          │    Git · Code · Review · CI     │
          │                │                │
          │                │                │
   ┌──────▼──────┐        │        ┌───────▼─────┐
   │  开发者画像  │        │        │  团队分析    │
   │  (人)       │        │        │  (组织)      │
   └──────┬──────┘        │        └───────┬─────┘
          │               │                │
          │     个人聚合为团队画像           │
          │     团队环境影响个人成长         │
          └───────────────┼────────────────┘
                          │
                    ┌─────▼─────┐
                    │  关联洞察  │
                    │  (衍生)   │
                    └───────────┘
```

## 系统分层

### 1. 产品输出层

三个核心面板 + 关联洞察引擎：

- **项目评估报告** — 健康度评分、技术债指数、风险模块、安全评分
- **开发者画像** — 能力雷达图、成长曲线、强项短板、团队定位
- **团队分析** — 能力结构、风险点、招聘建议、梯队分析

### 2. 分析引擎层

三大 Service 独立运行，共享 Feature Store：

| 引擎 | 职责 | 核心输出 |
|------|------|---------|
| 代码质量 & AI 审查 | 静态分析 + LLM Review + 安全扫描 | 质量分、安全分、问题列表 |
| Git 行为建模 | 提交行为 + 贡献结构 + 复杂度 + Review | 行为特征向量 |
| 能力建模 & 评估 | 个人向量 + 团队聚合 + 风险指标 | 7 维能力模型、团队画像 |

### 3. 特征层 (Feature Store)

从原始数据中提取的结构化特征，供各引擎消费：

- **实时特征**：commit_count_7d, lines_changed_7d, active_modules
- **日级特征**：code_quality_score, complexity_delta, review_participation
- **周级特征**：skill_vector (7 维), growth_velocity, bus_factor
- **月级特征**：team_capability_map, project_health_score, tech_debt_trend

### 4. 数据采集层

```
Git Repo ──┐
CI/CD ─────┤
SonarQ ────┤──► Collector ──► Data Lake ──► Feature Store
Jira ──────┤    (采集器)     (原始存储)    (特征仓库)
LLM Review─┘
```

数据来源：
- **Git 数据**（核心）— commit / author / diff / blame / PR / review
- **CI/CD 数据** — 构建失败率、单测覆盖率变化
- **代码质量工具** — ESLint / SonarQube / CodeQL
- **AI 审查数据** — LLM code review 结果、安全扫描
- **项目管理数据** — Jira / issue 流转
- **运行数据**（可选）— 错误率、性能指标

### 5. 基础设施层

| 组件 | 技术 | 用途 |
|------|------|------|
| 关系数据库 | PostgreSQL | 结构化数据存储 |
| 缓存/队列 | Redis | 缓存 + Celery Broker |
| 向量数据库 | Qdrant | 代码 Embedding + 语义搜索 |
| 任务调度 | Celery | 异步分析任务 |
| 容器编排 | Docker Compose | 服务部署 |

## 数据流全景

```
Git Commit ──┐
PR/MR ───────┤
CI Build ────┼──► 采集 ──► 指标计算 ──► 三个 Service 各自消费
Code Scan ───┤                              │
Review ──────┤                    ┌─────────┼─────────┐
Org Chart ───┘                    ▼         ▼         ▼
                              项目评估  开发者画像  团队分析
                                  │         │         │
                                  └─────────┼─────────┘
                                            ▼
                                       关联洞察引擎
                                            │
                                  ┌─────────┼─────────┐
                                  ▼         ▼         ▼
                               报告生成  预警推送  成长建议
```

## 接入流程

```
用户输入 GitLab URL + Token
        │
        ▼
  连接验证 & 权限检测
        │
        ▼
  自动发现 Groups / Projects / Members
        │
        ▼
  用户选择分析目标
        │
        ▼
  组织架构自动匹配（GitLab Groups → 部门树）
        │
        ▼
  身份匹配（Git Identity ↔ People）
        │
        ▼
  异步分析 Pipeline（Git 数据 / 代码分析 / AI 审查）
        │
        ▼
  特征计算 → 模型推理 → 报告生成
```
