# Engineering Intelligence System — 文档中心

> 工程智能评估系统：AI 驱动的项目评估、开发者画像、团队能力分析平台

## 📖 文档索引

### 架构设计

| 文档 | 说明 | 状态 |
|------|------|------|
| [系统架构总览](architecture/system-overview.md) | 三体系架构、分层设计、数据流 | ✅ |
| [数据模型](architecture/data-model.md) | 数据库表结构、ER 图、字段说明 | ✅ |
| [API 规范](architecture/api-spec.md) | RESTful API 接口设计 | ✅ |
| [评价模型](architecture/evaluation-model.md) | 7 维能力模型、加权公式、评分算法 | ✅ |
| [Git 行为分析](architecture/git-analysis.md) | Git 4 象限分析、信号矩阵 | ✅ |
| [身份匹配引擎](architecture/identity-matching.md) | 4 级匹配策略、算法设计 | ✅ |
| [代码图谱](architecture/code-graph.md) | tree-sitter + LLM + Qdrant 方案 | ✅ |
| [团队分析模型](architecture/team-analysis.md) | 聚合模型、风险指标、增长分析 | ✅ |
| [项目评估模型](architecture/project-assessment.md) | 健康度模型、指标体系 | ✅ |

### 指南

| 文档 | 说明 | 状态 |
|------|------|------|
| [快速开始](guides/getting-started.md) | 从 clone 到运行 | ✅ |
| [部署指南](guides/deployment.md) | 开发/生产部署 | ✅ |
| [配置说明](guides/configuration.md) | 环境变量、参数调优 | ✅ |

### 规划

| 文档 | 说明 | 状态 |
|------|------|------|
| [开发路线图](roadmap.md) | 4 阶段实施计划 | ✅ |

## 产品定位

**成长平台**，而非考核工具。评估是手段，成长是目的。

- 个人数据默认最小化暴露
- 输出「建议」而非「裁决」
- 定位为辅助决策，不是 KPI 工具

## 核心用户旅程

```
1. 输入 GitLab 仓库地址 + Access Token
2. 系统自动发现项目 & 组织架构
3. 自动完成身份匹配（Git 账号 ↔ 真实人员）
4. 后台异步分析（代码质量、Git 行为、安全扫描）
5. 生成三维度报告：项目评估 × 开发者画像 × 团队分析
6. 持续跟踪趋势变化
```
