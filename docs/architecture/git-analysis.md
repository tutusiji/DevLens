# Git 行为分析方案

## 概述

Git 行为分析是本系统的**核心差异化能力**。通过深度解析 Git 历史数据，提取开发者的行为特征，构建能力评估的客观信号。

## 数据采集

### Git 原始数据

```bash
# 提交历史
git log --all --format="%H|%an|%ae|%at|%s" --since="6 months ago"

# 每次提交的 diff 统计
git log --numstat --format="%H" --since="6 months ago"

# 文件归属
git blame --line-porcelain <file>

# Merge Request 数据（通过 GitLab API）
GET /api/v4/projects/{id}/merge_requests?state=merged
GET /api/v4/projects/{id}/merge_requests/{mr_iid}/notes
```

### 数据处理 Pipeline

```
Git Raw Data
    │
    ├──► Commit Parser ──► 提交记录结构化
    ├──► Diff Analyzer ──► AST 级别变更分析
    ├──► Blame Analyzer ──► 文件归属计算
    ├──► MR Analyzer ──► Review 行为分析
    │
    └──► Feature Store ──► 行为特征向量
```

## 四象限分析模型

### 象限 1：提交行为

| 特征 | 算法 | 信号强度 | 用途 |
|------|------|---------|------|
| commit 粒度 | 每次 commit 的平均 diff 行数 | 中 | 工程习惯 |
| 提交频率 | commits / week | 低 | 仅参考 |
| 提交节奏规律性 | 提交时间分布的熵值 | 中 | 工作模式 |
| revert 比例 | revert commits / total commits | **高** | 稳定性信号 |
| hotfix 比例 | hotfix commits / total commits | **高** | 质量信号 |
| 提交消息质量 | LLM 评估 commit message 规范度 | 中 | 工程素养 |

```python
class CommitBehaviorAnalyzer:
    def analyze(self, commits: list[Commit]) -> CommitBehavior:
        return CommitBehavior(
            avg_commit_size=self._avg_diff_size(commits),
            commit_frequency=len(commits) / self._weeks_span(commits),
            rhythm_regularity=self._entropy(self._time_distribution(commits)),
            revert_ratio=self._count_reverts(commits) / len(commits),
            hotfix_ratio=self._count_hotfixes(commits) / len(commits),
            message_quality=self._llm_evaluate_messages(commits),
        )
```

### 象限 2：贡献结构

| 特征 | 算法 | 信号强度 | 用途 |
|------|------|---------|------|
| 文件 ownership | git blame 统计 | **高** | Bus Factor |
| 模块覆盖范围 | 涉及的不同目录/模块数 | 中 | 广度信号 |
| 核心模块参与度 | 核心模块（高频变更模块）的贡献占比 | **高** | 深度信号 |
| 代码存活率 | N 月后仍存在的代码比例 | **极高** | 真实贡献 |
| 新增 vs 修改比 | 新建文件 vs 修改文件的比例 | 中 | 创新 vs 维护 |

```python
def calc_code_survival_rate(project_id, dev_id, months=6):
    """
    代码存活率 — 最难游戏化的指标
    某开发者在 T 时期提交的代码，在 T+6 个月后仍然存在的比例
    """
    commits_at_t = get_commits(project_id, dev_id, period_t)
    lines_introduced = sum(c.lines_added for c in commits_at_t)

    # 通过 git blame 检查这些代码在 T+6 月是否还存在
    current_blame = git_blame_all_files(project_id)
    surviving_lines = count_lines_by_author(current_blame, dev_id, since=period_t)

    return surviving_lines / lines_introduced if lines_introduced > 0 else 0
```

### 象限 3：复杂度贡献

| 特征 | 算法 | 信号强度 | 用途 |
|------|------|---------|------|
| AST 复杂度变化 | tree-sitter diff 前后圈复杂度 | **高** | 技术债信号 |
| 圈复杂度 delta | 函数级别复杂度增减 | **高** | 代码质量 |
| TODO/FIXME 增删比 | 新增 vs 清除的 TODO 数量 | 中 | 技术债意识 |
| 重复代码引入率 | 新增代码中的重复比例 | **高** | 工程质量 |
| 函数长度趋势 | 新增函数的平均行数变化 | 中 | 代码风格 |

```python
def calc_complexity_delta(project_id, dev_id, period):
    """
    使用 tree-sitter 计算每次提交的复杂度变化
    """
    commits = get_commits(project_id, dev_id, period)
    deltas = []

    for commit in commits:
        before_tree = parse_ast(commit.parent)
        after_tree = parse_ast(commit)

        before_complexity = calc_cyclomatic_complexity(before_tree)
        after_complexity = calc_cyclomatic_complexity(after_tree)

        deltas.append(after_complexity - before_complexity)

    return {
        "total_delta": sum(deltas),
        "avg_delta": mean(deltas),
        "improvements": sum(1 for d in deltas if d < 0),
        "degradations": sum(1 for d in deltas if d > 0),
    }
```

### 象限 4：Review 行为

| 特征 | 算法 | 信号强度 | 用途 |
|------|------|---------|------|
| review 深度 | 评论字数 / 是否只是 approve | **高** | 协作质量 |
| review latency | 从 MR 创建到首次 review 的时间 | 中 | 响应速度 |
| review 评论质量 | LLM 评估评论的技术价值 | **高** | 技术判断力 |
| 被 review 通过率 | MR 首次 review 就通过的比例 | 中 | 代码质量 |
| review 参与率 | 参与 review 的 MR 数 / 总 MR 数 | 中 | 团队参与度 |

```python
class ReviewBehaviorAnalyzer:
    def analyze(self, merge_requests: list, dev_id: str):
        reviews_given = [r for mr in merge_requests for r in mr.reviews if r.author == dev_id]
        mrs_authored = [mr for mr in merge_requests if mr.author == dev_id]

        return ReviewBehavior(
            review_depth=self._avg_comment_length(reviews_given),
            review_quality=self._llm_evaluate_comments(reviews_given),
            review_latency=mean([r.first_review_time - mr.created_at for mr in mrs_authored]),
            first_pass_rate=sum(1 for mr in mrs_authored if mr.first_pass) / len(mrs_authored),
            participation_rate=len(set(r.mr_id for r in reviews_given)) / len(merge_requests),
        )
```

## 信号强度矩阵

```
┌─────────────────────────────────────────────────────────────┐
│                    信号强度说明                               │
├──────────┬──────────────────────────────────────────────────┤
│ 极高     │ 代码存活率 — 几乎不可能游戏化                      │
│ 高       │ revert率, 复杂度变化, review质量 — 需要技术能力伪造 │
│ 中       │ 提交粒度, 模块覆盖 — 有参考价值但需上下文           │
│ 低       │ 提交频率 — 仅作辅助                               │
└──────────┴──────────────────────────────────────────────────┘
```

## 协作网络分析

通过 co-commit 数据构建协作网络：

```python
def build_collaboration_network(project_id, period):
    """
    构建开发者协作网络图
    节点 = 开发者
    边 = 共同修改过相同文件的次数
    """
    commits = get_commits(project_id, period)
    edges = {}

    for commit in commits:
        author = commit.author
        # 查找 MR 中的 reviewer 和 co-authors
        collaborators = get_mr_collaborators(commit)
        for collab in collaborators:
            edge_key = tuple(sorted([author, collab]))
            edges[edge_key] = edges.get(edge_key, 0) + 1

    return NetworkGraph(
        nodes=get_unique_authors(commits),
        edges=[Edge(src, tgt, weight) for (src, tgt), weight in edges.items()]
    )
```

## Bus Factor 计算

```python
def calc_bus_factor(project_id):
    """
    Bus Factor: 覆盖 80% 代码所需的最少人数
    """
    blame_stats = git_blame_all_files(project_id)
    author_lines = {author: lines for author, lines in blame_stats.items()}

    total_lines = sum(author_lines.values())
    threshold = total_lines * 0.8

    # 按贡献量降序排列，累计到 80%
    sorted_authors = sorted(author_lines.items(), key=lambda x: -x[1])
    cumulative = 0
    bus_factor = 0
    for author, lines in sorted_authors:
        cumulative += lines
        bus_factor += 1
        if cumulative >= threshold:
            break

    return bus_factor
```
