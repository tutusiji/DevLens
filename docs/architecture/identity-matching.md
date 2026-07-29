# 身份匹配引擎设计

## 问题定义

Git 世界中的身份（commit author）与组织中的真实人员往往不一致：

```
Git 世界                          组织世界
─────────                        ─────────
"zhangsan"             ───?───   张三（研发二组）
"z.san"                ───?───   张三（研发二组）  ← 同一个人的不同别名
"zs"                   ───?───   赵四（研发一组）  ← 缩写冲突
"a@company.com"        ───?───   张三（已离职）    ← 账号未清理
"dependabot[bot]"      ───?───   （非人类）        ← 机器人
```

## 四级匹配策略

### Level 1: 精确匹配（置信度 95-99%）

```python
def match_by_email(git_identity, people_list):
    """企业邮箱精确匹配 — 最可靠"""
    for person in people_list:
        if git_identity.git_email and person.email:
            if git_identity.git_email.lower() == person.email.lower():
                return MatchResult(person, confidence=0.99, method="email_exact")
    return None

def match_by_gitlab_id(git_identity, people_list):
    """GitLab user ID 匹配"""
    for person in people_list:
        if git_identity.git_username and person.employee_id:
            if git_identity.git_username == person.employee_id:
                return MatchResult(person, confidence=0.95, method="gitlab_id")
    return None
```

### Level 2: 拼音匹配（置信度 85-90%）

适用于中国企业，开发者常用拼音作为 Git username：

```python
from pypinyin import pinyin, Style

def match_by_pinyin(git_identity, people_list):
    """拼音反查匹配"""
    git_name = (git_identity.git_name or "").lower().replace(" ", "")

    for person in people_list:
        # "张三" → "zhangsan"
        person_pinyin = "".join(
            [p[0] for p in pinyin(person.name, style=Style.NORMAL)]
        ).lower()

        if git_name == person_pinyin:
            return MatchResult(person, confidence=0.90, method="pinyin")

        # 处理带分隔符: "zhang.san" → "zhangsan"
        if "." in git_name:
            normalized = git_name.replace(".", "")
            if normalized == person_pinyin:
                return MatchResult(person, confidence=0.88, method="pinyin_dot")

        # 处理首字母缩写: "zs" → 尝试匹配
        if len(git_name) <= 4:
            initials = "".join(
                [p[0][0] for p in pinyin(person.name, style=Style.FIRST_LETTER)]
            ).lower()
            if git_name == initials and len(git_name) >= 2:
                return MatchResult(person, confidence=0.70, method="initials")

    return None
```

### Level 3: 模糊匹配（置信度 60-85%）

```python
from fuzzywuzzy import fuzz

def match_by_fuzzy(git_identity, people_list):
    """模糊匹配 — 兜底策略"""
    candidates = []
    git_name = (git_identity.git_name or "").lower()

    for person in people_list:
        # 姓名直接比较
        score = fuzz.ratio(git_name, person.name.lower())
        if score > 75:
            candidates.append(MatchResult(person, confidence=score/100, method="fuzzy_name"))

        # 邮箱前缀比较
        if git_identity.git_email and person.email:
            email_prefix = git_identity.git_email.split("@")[0]
            person_prefix = person.email.split("@")[0]
            email_score = fuzz.ratio(email_prefix, person_prefix)
            if email_score > 80:
                candidates.append(MatchResult(person, confidence=email_score/100*0.9, method="fuzzy_email"))

    return max(candidates, key=lambda x: x.confidence) if candidates else None
```

### Level 4: 无法匹配

标记为 "unmatched"，进入人工审核队列。

## 匹配引擎主流程

```python
class IdentityMatcher:
    def match_all(self, git_identities, org_people):
        results = []
        remaining_people = list(org_people)

        for git_id in git_identities:
            # 0. 跳过机器人
            if self._is_bot(git_id):
                results.append(MatchResult(None, method="bot_skipped"))
                continue

            # 1. 已存在的确认映射
            existing = self._check_existing_mapping(git_id)
            if existing:
                results.append(existing)
                continue

            # 2. 多级匹配策略（按优先级）
            match = (
                self._match_by_email(git_id, remaining_people)
                or self._match_by_gitlab_id(git_id, remaining_people)
                or self._match_by_pinyin(git_id, remaining_people)
                or self._match_by_fuzzy(git_id, remaining_people)
            )

            if match:
                match.needs_review = match.confidence < 0.8
                results.append(match)
            else:
                results.append(MatchResult(None, confidence=0, method="unmatched"))

        return results
```

## 机器人识别

```python
BOT_PATTERNS = [
    "bot", "ci", "cd", "jenkins", "github-actions",
    "dependabot", "renovate", "noreply", "automated",
    "pipeline", "deploy", "release-bot"
]

def is_bot(git_identity) -> bool:
    name = (git_identity.git_name or "").lower()
    email = (git_identity.git_email or "").lower()
    return any(p in name or p in email for p in BOT_PATTERNS)
```

## 别名链（Alias Chain）

同一个开发者可能在不同时期使用不同的 Git 身份：

```python
class AliasChainBuilder:
    """
    通过以下信号建立别名链：
    1. 相同邮箱不同名字 → 同一人
    2. 相同名字不同邮箱 → 可能是同一人（需确认）
    3. 人工标注的别名关系
    """
    def build_chains(self, git_identities):
        chains = {}
        # 按邮箱分组
        by_email = group_by(git_identities, key=lambda x: x.git_email)
        for email, identities in by_email.items():
            if email:
                chain_id = generate_id()
                for identity in identities:
                    chains[identity.id] = chain_id

        return chains
```

## 人工审核 UI 设计

```
自动匹配结果 (18/23 已匹配)

┌──────────────────────────────────────────────────────────────┐
│ ✅ zhangsan <zhangsan@company.com>  →  张三 (后端组)  99%    │
│ ✅ lisi <lisi@company.com>          →  李四 (后端组)  95%    │
│ ⚠️ ww_dev <ww@old.com>              →  王五? (后端组) 72%    │
│    [确认] [修改为 ▼] [跳过]                                   │
│ ⚠️ z.san                            →  张三? (后端组) 70%    │
│    提示: 与 zhangsan 邮箱相同，可能是同一人                    │
│    [合并到 张三] [作为独立人员]                                │
│ ❌ bot_user <bot@ci.com>            →  跳过 (机器人)          │
│ ❌ temp_2024 <temp@company.com>     →  未匹配                │
│    [手动关联 ▼]                                               │
└──────────────────────────────────────────────────────────────┘
```
