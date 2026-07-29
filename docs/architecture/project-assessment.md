# 项目评估模型

## 项目健康度综合评分

```python
def calc_project_health(project_id, period):
    """项目健康度 = 6 个维度的加权综合"""
    return weighted_sum(
        code_quality_index(project_id, period)     * 0.25,
        security_index(project_id, period)         * 0.20,
        tech_debt_index(project_id, period, inv=True) * 0.20,
        test_maturity(project_id, period)          * 0.15,
        contributor_diversity(project_id, period)  * 0.10,
        ci_maturity(project_id, period)            * 0.10,
    )
```

## 各维度指标详解

### 1. 代码质量指数

| 指标 | 计算方式 | 权重 |
|------|---------|------|
| 圈复杂度均值 | tree-sitter AST 分析所有函数 | 0.25 |
| 代码重复率 | 相似代码块占比 | 0.20 |
| 可维护性指数 | SonarQube MI 或等效算法 | 0.25 |
| AI 审查平均分 | LLM 对采样的代码文件评分 | 0.20 |
| Lint 通过率 | 静态分析规则通过率 | 0.10 |

```python
def code_quality_index(project_id, period):
    metrics = get_code_metrics(project_id, period)
    return weighted_sum(
        normalize(metrics.avg_complexity, inverse=True) * 0.25,
        (1 - metrics.duplication_rate) * 100             * 0.20,
        metrics.maintainability_index                    * 0.25,
        metrics.ai_review_avg                            * 0.20,
        metrics.lint_pass_rate * 100                     * 0.10,
    )
```

### 2. 安全评分

| 指标 | 计算方式 | 权重 |
|------|---------|------|
| 漏洞密度 | 安全扫描发现的漏洞 / 千行代码 | 0.30 |
| 依赖风险 | 有已知漏洞的依赖占比 | 0.25 |
| 密钥泄露 | 代码中硬编码的密钥数量 | 0.20 |
| 安全实践 | HTTPS/加密/输入校验等 | 0.15 |
| 修复速度 | 漏洞平均修复时间 | 0.10 |

### 3. 技术债务指数

| 指标 | 计算方式 | 说明 |
|------|---------|------|
| TODO/FIXME 密度 | 每千行代码的 TODO 数量 | 显式债务 |
| 代码腐化率 | 近 3 月复杂度上升的文件占比 | 隐性债务 |
| 依赖过时度 | 过期依赖的版本差距 | 依赖债务 |
| 测试覆盖缺口 | 核心模块的未覆盖比例 | 测试债务 |
| 文档完备度 | 公开 API 的文档覆盖率 | 文档债务 |

```python
def tech_debt_index(project_id, period):
    """技术债务指数（越高表示债务越多）"""
    metrics = get_project_metrics(project_id, period)
    return weighted_sum(
        metrics.todo_density * 10              * 0.20,
        metrics.code_rot_rate * 100            * 0.25,
        metrics.outdated_deps_ratio * 100      * 0.15,
        (1 - metrics.test_coverage) * 100      * 0.25,
        (1 - metrics.doc_coverage) * 100       * 0.15,
    )
```

### 4. 测试成熟度

| 指标 | 计算方式 | 权重 |
|------|---------|------|
| 测试覆盖率 | 代码行覆盖率 | 0.35 |
| 测试密度 | 测试文件数 / 源码文件数 | 0.20 |
| CI 测试稳定性 | 测试通过率 | 0.25 |
| 集成测试比例 | 集成测试 / 总测试数 | 0.20 |

### 5. 贡献者多样性

| 指标 | 计算方式 | 说明 |
|------|---------|------|
| Bus Factor | 覆盖 80% 代码的最少人数 | 越高越好 |
| 贡献均匀度 | Gini 系数（反转） | 越均匀越好 |
| 活跃贡献者数 | 近 3 月有提交的贡献者数 | 活跃度 |

### 6. CI/CD 成熟度

| 指标 | 计算方式 | 说明 |
|------|---------|------|
| 是否有 CI 配置 | 存在 .gitlab-ci.yml 等 | 基础 |
| 构建成功率 | 近 30 天构建通过率 | 稳定性 |
| 部署频率 | 每周部署次数 | 交付能力 |
| Pipeline 阶段数 | CI 阶段完整度 | 成熟度 |

## 风险模块识别

```python
def identify_risk_modules(project_id):
    """识别高风险模块"""
    modules = get_project_modules(project_id)
    risk_modules = []

    for module in modules:
        risk_score = weighted_sum(
            module.complexity / 100             * 0.30,  # 高复杂度
            module.change_frequency_normalized   * 0.25,  # 高频变更
            (1 - module.test_coverage)           * 0.25,  # 低测试覆盖
            module.owner_concentration           * 0.20,  # 高集中度
        )

        if risk_score > 0.6:
            risk_modules.append(RiskModule(
                name=module.name,
                risk_score=risk_score,
                factors={
                    "complexity": module.complexity,
                    "change_freq": module.change_frequency,
                    "test_coverage": module.test_coverage,
                    "ownership": module.owner_concentration,
                },
                recommendation=self._generate_recommendation(module, risk_score),
            ))

    return sorted(risk_modules, key=lambda r: -r.risk_score)
```

## 项目评估报告模板

```json
{
  "project": {
    "name": "api-service",
    "health_score": 78,
    "health_trend": "stable",
    "health_grade": "B+"
  },
  "dimensions": {
    "code_quality": { "score": 82, "trend": "up", "grade": "A-" },
    "security": { "score": 71, "trend": "stable", "grade": "B" },
    "tech_debt": { "score": 65, "trend": "down", "grade": "B-" },
    "test_maturity": { "score": 75, "trend": "up", "grade": "B+" },
    "contributor_diversity": { "score": 68, "trend": "stable", "grade": "B" },
    "ci_maturity": { "score": 85, "trend": "up", "grade": "A" }
  },
  "risk_modules": [
    {
      "name": "payment/core.py",
      "risk_score": 0.82,
      "factors": { "complexity": 85, "test_coverage": 30 },
      "recommendation": "优先补充测试覆盖，考虑重构高复杂度函数"
    }
  ],
  "highlights": [
    "CI/CD 成熟度优秀，构建成功率 98%",
    "代码质量呈上升趋势，近 3 月提升 5 分"
  ],
  "action_items": [
    "payment 模块测试覆盖率仅 30%，建议优先补充",
    "3 个依赖包存在已知漏洞，建议升级"
  ]
}
```
