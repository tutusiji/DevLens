"""git 作者与组织人员的身份匹配引擎。

支持邮箱、工号、姓名精确匹配与拼音模糊匹配，返回置信度和方法。
"""
from dataclasses import dataclass
from typing import Any


try:
    from pypinyin import lazy_pinyin
except ImportError:  # pragma: no cover - 未安装时降级
    lazy_pinyin = None


@dataclass(frozen=True)
class IdentityMatchResult:
    person_name: str
    developer_id: str | None
    department: str
    confidence: float
    method: str


def _to_pinyin(value: str) -> str:
    if lazy_pinyin:
        return ''.join(lazy_pinyin(value)).lower()
    return value.lower()


def _pinyin_initials(value: str) -> str:
    if lazy_pinyin:
        initials = [p[0] for p in lazy_pinyin(value) if p]
        return ''.join(initials).lower()
    return value.lower()


def _normalize(value: str) -> str:
    return ''.join(value.lower().split())


def _employee_id_in_email(email: str, employee_id: str) -> bool:
    local = (email or '').split('@')[0]
    return bool(employee_id) and employee_id.lower() in local.lower()


def _employee_id_in_name(name: str, employee_id: str) -> bool:
    return bool(employee_id) and employee_id.lower() in name.lower()


def match_git_contributor(
    git_name: str,
    git_email: str,
    developers: list[Any],
    users: list[Any],
) -> IdentityMatchResult:
    """为单个 git 作者寻找最佳匹配。"""
    tenant_devs = {d.id: d for d in developers}
    user_emails = {getattr(u, 'email', None): u for u in users if getattr(u, 'email', None)}
    git_email_lower = (git_email or '').lower().strip()
    git_name_norm = _normalize(git_name)
    git_name_pinyin = _to_pinyin(git_name)
    git_name_initials = _pinyin_initials(git_name)

    # 1. 邮箱精确匹配 Developer.email / AccountUser.email
    if git_email_lower:
        for dev in developers:
            dev_email = (getattr(dev, 'email', '') or '').lower().strip()
            if dev_email and dev_email == git_email_lower:
                return IdentityMatchResult(
                    person_name=dev.name,
                    developer_id=dev.id,
                    department=getattr(dev, 'team', '') or '未分配',
                    confidence=0.98,
                    method='email',
                )
        user = user_emails.get(git_email_lower)
        if user:
            # 通过用户邮箱反查开发者：优先按 username/name 匹配
            for dev in developers:
                if getattr(dev, 'username', None) == getattr(user, 'username', None):
                    return IdentityMatchResult(
                        person_name=dev.name,
                        developer_id=dev.id,
                        department=getattr(dev, 'team', '') or '未分配',
                        confidence=0.95,
                        method='email',
                    )
            for dev in developers:
                if _normalize(dev.name) == _normalize(getattr(user, 'name', '') or ''):
                    return IdentityMatchResult(
                        person_name=dev.name,
                        developer_id=dev.id,
                        department=getattr(dev, 'team', '') or '未分配',
                        confidence=0.93,
                        method='email',
                    )

    # 2. 工号精确匹配
    for dev in developers:
        emp_id = getattr(dev, 'employee_id', None)
        if not emp_id:
            continue
        if _employee_id_in_email(git_email, emp_id) or _employee_id_in_name(git_name, emp_id):
            return IdentityMatchResult(
                person_name=dev.name,
                developer_id=dev.id,
                department=getattr(dev, 'team', '') or '未分配',
                confidence=0.96,
                method='employee_id',
            )

    # 3. 姓名精确匹配
    for dev in developers:
        if _normalize(dev.name) == git_name_norm:
            return IdentityMatchResult(
                person_name=dev.name,
                developer_id=dev.id,
                department=getattr(dev, 'team', '') or '未分配',
                confidence=0.95,
                method='exact',
            )

    # 4. 拼音模糊匹配
    candidates = []
    for dev in developers:
        dev_name = dev.name
        dev_pinyin = _to_pinyin(dev_name)
        dev_initials = _pinyin_initials(dev_name)
        if dev_pinyin == git_name_pinyin or dev_initials == git_name_initials:
            candidates.append((dev, 0.88))
        elif git_name_pinyin in dev_pinyin or dev_pinyin in git_name_pinyin:
            candidates.append((dev, 0.78))
        elif git_name_initials and dev_initials and (git_name_initials in dev_initials or dev_initials in git_name_initials):
            candidates.append((dev, 0.72))

    if candidates:
        # 拼音相同情况下，优先 commits 高的开发者（如数据可用）
        candidates.sort(key=lambda x: (x[1], getattr(x[0], 'commits', 0)), reverse=True)
        dev, conf = candidates[0]
        return IdentityMatchResult(
            person_name=dev.name,
            developer_id=dev.id,
            department=getattr(dev, 'team', '') or '未分配',
            confidence=conf,
            method='pinyin',
        )

    # 兜底
    return IdentityMatchResult(
        person_name=git_name,
        developer_id=None,
        department='未匹配',
        confidence=0.5,
        method='fuzzy',
    )
