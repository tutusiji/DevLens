# 团队分析模型

## 团队能力推导

### 核心公式

```
团队能力 ≠ 成员能力的简单平均

TeamCapability = WeightedAggregation(MemberSkills) × CollaborationEfficiency × StructureHealth
```

### 聚合算法

```python
class TeamCapabilityCalculator:
    def calculate(self, department_id, member_vectors, collab_network):
        # 1. 基础聚合：加权平均
        avg_vector = self._weighted_average(member_vectors)

        # 2. 能力方差：衡量团队均衡度
        variance = self._calc_variance(member_vectors)

        # 3. 能力覆盖率：检查是否有短板
        coverage = self._calc_coverage(member_vectors)

        # 4. 协作效率：从协作网络推导
        collab_efficiency = self._calc_collab_efficiency(collab_network)

        # 5. 结构健康度
        structure_health = self._calc_structure_health(member_vectors)

        return TeamCapability(
            avg_vector=avg_vector,
            variance=variance,
            coverage=coverage,
            collab_efficiency=collab_efficiency,
            structure_health=structure_health,
            bus_factor=self._calc_bus_factor(member_vectors),
        )
```

## 风险指标体系

### 1. 单点风险 (Single Point of Failure)

```python
def detect_single_point_risk(project_id, team_members):
    """检测关键人风险"""
    risks = []

    for module in get_project_modules(project_id):
        ownership = calc_module_ownership(module)

        # 如果一个人拥有 >60% 的核心模块代码
        for person, pct in ownership.items():
            if pct > 0.6 and module.is_core:
                risks.append(Risk(
                    type="single_point",
                    severity="high" if pct > 0.8 else "medium",
                    person=person,
                    module=module.name,
                    ownership_pct=pct,
                    recommendation=f"需要至少 1 人 backup {module.name}"
                ))

    return risks
```

### 2. 技术债务趋势

```python
def analyze_tech_debt_trend(project_id, periods):
    """技术债务趋势分析"""
    debt_scores = [calc_tech_debt_score(project_id, p) for p in periods]
    slope, _ = linear_regression(range(len(debt_scores)), debt_scores)

    if slope > 5:
        return TrendStatus("accelerating", severity="high")
    elif slope > 0:
        return TrendStatus("growing", severity="medium")
    elif slope < -2:
        return TrendStatus("improving", severity="info")
    else:
        return TrendStatus("stable", severity="info")
```

### 3. 交付稳定性

```python
def calc_delivery_stability(team_id, periods):
    """交付稳定性 = 交付量的变异系数（CV）"""
    throughputs = [calc_throughput(team_id, p) for p in periods]
    cv = std(throughputs) / mean(throughputs) if mean(throughputs) > 0 else 0

    if cv < 0.2:
        return "highly_stable"
    elif cv < 0.4:
        return "stable"
    elif cv < 0.6:
        return "variable"
    else:
        return "unstable"
```

### 4. 人员流失预警

```python
def detect_attrition_risk(person_id, recent_periods):
    """通过行为变化预测流失风险"""
    signals = {
        "commit_frequency_decline": calc_trend_slope(
            [get_commit_count(person_id, p) for p in recent_periods]
        ),
        "review_participation_decline": calc_trend_slope(
            [get_review_count(person_id, p) for p in recent_periods]
        ),
        "code_quality_decline": calc_trend_slope(
            [get_quality_score(person_id, p) for p in recent_periods]
        ),
    }

    risk_score = sum(1 for v in signals.values() if v < -0.1) / len(signals)

    if risk_score > 0.6:
        return AttritionRisk("high", signals)
    elif risk_score > 0.3:
        return AttritionRisk("medium", signals)
    return AttritionRisk("low", signals)
```

## 招聘建议生成

```python
def generate_hiring_suggestions(department_id):
    """基于团队能力缺口生成招聘建议"""
    team_cap = get_team_capability(department_id)
    coverage = team_cap.coverage

    suggestions = []

    # 检查每个维度的覆盖率
    dimension_names = {
        "code_quality": "代码质量专家",
        "architecture": "架构师",
        "stability": "质量工程师",
        "efficiency": "DevOps 工程师",
        "collaboration": "Tech Lead",
        "security_aware": "安全工程师",
    }

    for dim, role in dimension_names.items():
        coverage_pct = coverage.get(dim, 0)
        if coverage_pct < 0.3:
            suggestions.append(HiringSuggestion(
                role=role,
                reason=f"团队在「{dim}」维度覆盖率仅 {coverage_pct:.0%}",
                priority="high" if coverage_pct < 0.2 else "medium",
                required_skills=self._infer_skills(dim),
            ))

    return sorted(suggestions, key=lambda s: s.priority == "high", reverse=True)
```

## 梯队分析

```python
def analyze_team_ladder(department_id):
    """团队梯队分析"""
    members = get_department_members(department_id)
    vectors = [get_latest_skill_vector(m.id) for m in members]

    tiers = {"senior": [], "mid": [], "junior": []}

    for member, vector in zip(members, vectors):
        composite = calc_composite(vector)
        if composite >= 80:
            tiers["senior"].append(member)
        elif composite >= 60:
            tiers["mid"].append(member)
        else:
            tiers["junior"].append(member)

    # 健康梯队比例: senior 20-30%, mid 40-50%, junior 20-30%
    total = len(members)
    ratios = {tier: len(members) / total for tier, members in tiers.items()}

    return LadderAnalysis(
        tiers=tiers,
        ratios=ratios,
        health=self._evaluate_ladder_health(ratios),
        mentoring_pairs=self._detect_mentoring_pairs(department_id),
    )
```

## 增长趋势分析

```python
def calc_team_growth_trend(department_id, periods):
    """团队能力增长趋势"""
    snapshots = [get_team_capability(department_id, p) for p in periods]

    trends = {}
    dimensions = ["code_quality", "architecture", "stability",
                  "efficiency", "collaboration", "security_aware"]

    for dim in dimensions:
        values = [s.avg_vector[dim] for s in snapshots]
        slope, r_squared = linear_regression(range(len(values)), values)

        trends[dim] = DimensionTrend(
            slope=slope,
            direction="up" if slope > 1 else ("down" if slope < -1 else "flat"),
            r_squared=r_squared,
            values=values,
        )

    return TeamGrowthTrend(
        dimension_trends=trends,
        overall_direction=self._overall_direction(trends),
        strongest_growth=max(trends.items(), key=lambda x: x[1].slope),
        weakest_growth=min(trends.items(), key=lambda x: x[1].slope),
    )
```
