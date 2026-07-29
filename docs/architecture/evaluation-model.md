# 评价模型设计

## 7 维能力模型

```
                 代码质量
                   ▲
                  / \
                 /   \
    安全意识 ◄──/     \──► 架构能力
               /       \
              /    ●    \        ● = 当前能力
             /   / \     \       ○ = 团队平均
            /  /     \    \
  协作能力 ◄─/─────────\─► 交付效率
              \         /
               \       /
    稳定性   ◄──\     /
                 \   /
                  \ /
                   ▼
               成长速度
```

### 维度定义

| 维度 | 英文键 | 含义 | 分值范围 |
|------|--------|------|---------|
| 代码质量 | code_quality | 可读性、命名规范、结构合理性 | 0-100 |
| 架构能力 | architecture | 设计合理性、模块划分、SOLID 遵循 | 0-100 |
| 稳定性 | stability | bug 率、revert 率、hotfix 率 | 0-100 |
| 交付效率 | efficiency | 交付速度、issue 关闭速度 | 0-100 |
| 协作能力 | collaboration | Review 参与度、协作网络密度 | 0-100 |
| 安全意识 | security_aware | 安全漏洞引入/修复比 | 0-100 |
| 成长速度 | growth_velocity | 能力向量的时间导数 | -∞ ~ +∞ |

## 加权公式

### code_quality（代码质量）

```python
def calc_code_quality(dev_id, period):
    return weighted_sum(
        ai_review_score(dev_id, period)            * 0.35,
        lint_pass_rate(dev_id, period)             * 0.15,
        bug_introduction_rate(dev_id, period, inv) * 0.30,
        code_survival_rate(dev_id, period, months=6) * 0.20
    )
```

信号来源：
- **AI 审查分** (0.35) — LLM 对每次 PR 的多维度评分均值
- **Lint 通过率** (0.15) — ESLint/SonarQube 规则通过率
- **Bug 引入率** (0.30) — 反向指标，引入 bug 越少分越高
- **代码存活率** (0.20) — 6 个月后仍存在的代码比例

### architecture（架构能力）

```python
def calc_architecture(dev_id, period):
    return weighted_sum(
        cross_module_contribution(dev_id)   * 0.25,
        refactor_quality_score(dev_id)      * 0.25,
        api_design_score(dev_id)            * 0.20,
        complexity_reduction(dev_id)        * 0.30
    )
```

信号来源：
- **跨模块贡献** (0.25) — 涉及多个模块的 PR 比例
- **重构质量** (0.25) — 重构后复杂度降低的幅度
- **API 设计** (0.20) — LLM 对 API 设计的评估分
- **复杂度降低** (0.30) — 圈复杂度降低的贡献量

### stability（稳定性）

```python
def calc_stability(dev_id, period):
    return weighted_sum(
        bug_fix_ratio(dev_id)                * 0.25,
        invert(revert_ratio(dev_id))         * 0.25,
        invert(hotfix_ratio(dev_id))         * 0.25,
        test_coverage_delta(dev_id)          * 0.25
    )
```

信号来源：
- **Bug 修复占比** (0.25) — 修复 bug vs 引入 bug 的比例
- **Revert 率** (0.25) — 反向，revert 越少越稳定
- **Hotfix 率** (0.25) — 反向，紧急修复越少越好
- **测试覆盖变化** (0.25) — 测试覆盖率的增减

### efficiency（交付效率）

```python
def calc_efficiency(dev_id, period):
    return weighted_sum(
        issue_close_speed(dev_id)            * 0.30,
        pr_merge_speed(dev_id)               * 0.20,
        commit_rhythm_regularity(dev_id)     * 0.20,
        task_throughput(dev_id)              * 0.30
    )
```

### collaboration（协作能力）

```python
def calc_collaboration(dev_id, period):
    return weighted_sum(
        review_depth(dev_id)                 * 0.30,
        review_participation_rate(dev_id)    * 0.25,
        co_commit_network_centrality(dev_id) * 0.25,
        documentation_contribution(dev_id)   * 0.20
    )
```

### security_aware（安全意识）

```python
def calc_security_aware(dev_id, period):
    return weighted_sum(
        invert(vulnerability_introduction_rate(dev_id)) * 0.40,
        vulnerability_fix_rate(dev_id)                   * 0.30,
        security_review_participation(dev_id)            * 0.30
    )
```

### growth_velocity（成长速度）

```python
def calc_growth_velocity(dev_id, periods):
    """
    成长速度 = 能力向量的时间导数
    对最近 N 个周期的综合分做线性回归，取斜率
    """
    scores = [calc_composite(dev_id, t) for t in periods]
    slope, _ = linear_regression(range(len(scores)), scores)
    return slope  # 正值=成长中，负值=退化中
```

## 项目健康度模型

```python
def calc_project_health(project_id, period):
    return weighted_sum(
        code_quality_index(project_id)     * 0.25,
        security_index(project_id)         * 0.20,
        tech_debt_index(project_id, inv)   * 0.20,
        test_maturity(project_id)          * 0.15,
        contributor_diversity(project_id)  * 0.10,
        ci_maturity(project_id)            * 0.10
    )
```

## 评分校准

### 项目难度系数

不同项目复杂度不同，需要系数校正：

```python
difficulty_coefficients = {
    "core_infrastructure": 1.3,   # 核心基础设施
    "business_logic":      1.0,   # 业务逻辑（基准）
    "tooling_devops":      1.1,   # 工具链/DevOps
    "legacy_maintenance":  1.2,   # 遗留系统维护
    "documentation":       0.7,   # 文档
    "prototype_poc":       0.8,   # 原型/POC
}
```

### 任务类型权重

```python
task_type_weights = {
    "new_feature":    1.0,
    "refactor":       1.2,
    "bug_fix":        0.8,    # 量小但价值高
    "hotfix":         1.3,    # 紧急修复压力大
    "infra_devops":   1.1,
    "documentation":  0.6,
    "test_writing":   0.7,
}
```

## 反博弈机制

为防止指标被游戏化：

1. **复合指标** — 单一维度由多个信号加权，无法通过刷单一指标提升
2. **代码存活率** — 无法通过临时提交伪造
3. **AI 语义分析** — 评估代码真实质量，而非行数
4. **代码原创度** — Embedding 检测复制粘贴
5. **异常检测** — 统计异常自动标记
6. **趋势而非快照** — 关注变化方向，而非绝对值
