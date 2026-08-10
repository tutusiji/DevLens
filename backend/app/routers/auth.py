"""认证 API：登录 / 登出 / 当前用户 / 注册 / 个人中心。

登录成功后返回 JWT（前端存 localStorage，请求带 Authorization: Bearer）。
轻量自用方案：bcrypt 密码 + HS256 JWT；后续可平滑对接 SSO/网关。
"""
import base64
import os
import re
import secrets
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import models
from ..access import DEFAULT_TENANT_ID
from ..auth import (
    COOKIE_NAME,
    create_access_token,
    decode_token,
    hash_password,
    password_policy_error,
    token_from_request,
    verify_password,
)
from ..config import settings
from ..db import get_db
from ..seed import init_tenant_assets

router = APIRouter(tags=["auth"])

# 头像上传落盘目录（运行时按需创建）
UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads" / "avatars"
# 用户名：3-32 位，字母/数字/下划线/连字符；注册后不可改
_USERNAME_RE = re.compile(r"^[A-Za-z0-9_-]{3,32}$")
# DiceBear avataaars HTTP 头像（切换头像用；上传走 /auth/avatar 落盘）
_DICEBEAR_PREFIX = "https://api.dicebear.com/9.x/avataaars/svg"
# 上传头像允许的 MIME -> 扩展名
_AVATAR_MIME_EXT = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
}
_AVATAR_MAX_BYTES = 2 * 1024 * 1024  # 2MB


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    name: str
    email: str
    password: str


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


class UpdateProfileRequest(BaseModel):
    name: str | None = None
    avatar_url: str | None = None


class UploadAvatarRequest(BaseModel):
    avatar: str  # data URI: data:image/...;base64,XXXX


def _user_out(user: models.AccountUser) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "username": user.username,
        "avatarUrl": user.avatar_url,
        "status": user.status,
    }


def _current_user(request: Request, db: Session) -> models.AccountUser:
    """从请求 token 解出当前用户，失败抛 401。"""
    token = token_from_request(request)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未登录")
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="登录已过期或无效")
    user = db.query(models.AccountUser).filter_by(id=payload.get("sub")).first()
    if not user or user.status != "active":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="账号不可用")
    return user


def _make_dicebear_url(username: str) -> str:
    """生成 DiceBear avataaars 头像 URL：seed = username + 随机数（每次不同）。"""
    return f"{_DICEBEAR_PREFIX}?seed={username}{secrets.randbelow(10000)}"


def _save_avatar_file(user_id: str, data_uri: str) -> str:
    """解析 data URI，校验类型/大小，落盘，返回可服务的相对 URL 路径。"""
    # data:image/png;base64,XXXX
    m = re.match(r"data:([^;]+);base64,(.+)", data_uri, re.DOTALL)
    if not m:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="头像格式不正确（需 data URI）")
    mime, b64 = m.group(1), m.group(2)
    if mime not in _AVATAR_MIME_EXT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"仅支持 {'/'.join(_AVATAR_MIME_EXT)} 格式",
        )
    try:
        raw = base64.b64decode(b64)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="头像 base64 解码失败")
    if len(raw) > _AVATAR_MAX_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="头像过大（上限 2MB）")

    ext = _AVATAR_MIME_EXT[mime]
    filename = f"{user_id}_{uuid.uuid4().hex[:8]}.{ext}"
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    (UPLOAD_DIR / filename).write_bytes(raw)
    return f"/api/v1/avatars/{filename}"


# 邮箱格式粗校验（不引入 email-validator 依赖，与现有 login 的轻量风格一致）
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _sanitize_slug(value: str) -> str:
    """把邮箱本地部分清洗为合法 slug 片段（仅小写字母/数字/连字符）。"""
    cleaned = "".join(ch if ch.isalnum() and ch.isascii() else "-" for ch in value.lower())
    cleaned = re.sub(r"-+", "-", cleaned).strip("-")
    return cleaned or "user"


@router.post("/auth/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    """邮箱 + 密码登录，返回 JWT 与用户/租户上下文。"""
    email = body.email.strip().lower()
    user = db.query(models.AccountUser).filter_by(email=email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="邮箱或密码错误")
    if user.status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="账号已禁用")

    memberships = (
        db.query(models.TenantMembership)
        .filter_by(user_id=user.id)
        .order_by(models.TenantMembership.created_at)
        .all()
    )
    if not memberships:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="该账号未加入任何租户，请联系管理员")
    # 默认租户：优先级 DEFAULT_TENANT_ID > 第一个加入的租户
    chosen = next((m for m in memberships if m.tenant_id == DEFAULT_TENANT_ID), memberships[0])
    tenant = db.query(models.Tenant).filter_by(id=chosen.tenant_id).first()
    if not tenant or tenant.status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="默认租户不可用")

    token = create_access_token(user.id, chosen.tenant_id, chosen.role)
    tenants = [
        {
            "id": m.tenant_id,
            "role": m.role,
            "name": (db.query(models.Tenant).filter_by(id=m.tenant_id).first() or models.Tenant()).name,
        }
        for m in memberships
    ]
    return {
        "token": token,
        "user": _user_out(user),
        "tenant": {"id": tenant.id, "name": tenant.name, "slug": tenant.slug},
        "role": chosen.role,
        "tenants": tenants,
    }


@router.post("/auth/demo-login")
def demo_login(db: Session = Depends(get_db)):
    """一键Demo体验：以 viewer 角色进入测试租户（tenant-test）。

    测试租户预置了完整的演示数据，访客可查看但不可修改。
    若Demo用户不存在则自动创建。
    """
    from ..access import ensure_bootstrap_tenant
    from ..seed import SEED_TENANT_ID

    # 确保测试租户存在
    ensure_bootstrap_tenant(db)
    tenant = db.query(models.Tenant).filter_by(id=SEED_TENANT_ID).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="测试租户不存在",
        )

    # Demo 用户：固定邮箱，每次重置密码（不影响体验，因为免密登录）
    demo_email = "demo@devlens.local"
    demo_username = "demo-viewer"
    user = db.query(models.AccountUser).filter_by(email=demo_email).first()
    now = _now()
    if not user:
        user = models.AccountUser(
            id=f"usr-demo-{uuid.uuid4().hex[:8]}",
            email=demo_email,
            name="Demo 体验者",
            username=demo_username,
            avatar_url=_make_dicebear_url(demo_username),
            password_hash=hash_password(secrets.token_urlsafe(32)),  # 随机密码，不对外
            status="active",
            created_at=now,
            updated_at=now,
        )
        db.add(user)
        db.flush()

    # 确保用户在测试租户有 viewer 角色
    membership = db.query(models.TenantMembership).filter_by(
        tenant_id=SEED_TENANT_ID, user_id=user.id,
    ).first()
    if not membership:
        membership = models.TenantMembership(
            id=f"tmem-demo-{uuid.uuid4().hex[:8]}",
            tenant_id=SEED_TENANT_ID,
            user_id=user.id,
            role="viewer",
            created_at=now,
            updated_at=now,
        )
        db.add(membership)
    elif membership.role != "viewer":
        # 固定为 viewer 角色，防止权限提升
        membership.role = "viewer"
        membership.updated_at = now

    db.commit()

    token = create_access_token(user.id, SEED_TENANT_ID, "viewer")
    tenants = [
        {
            "id": SEED_TENANT_ID,
            "role": "viewer",
            "name": tenant.name,
        }
    ]
    return {
        "token": token,
        "user": _user_out(user),
        "tenant": {"id": tenant.id, "name": tenant.name, "slug": tenant.slug},
        "role": "viewer",
        "tenants": tenants,
        "is_demo": True,
        "demo_hint": "演示账号，仅可查看，不可修改数据",
    }


@router.post("/auth/register", status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    """开放自助注册：创建账号 + 个人工作区(tenant) + owner 身份，签发 JWT。

    注册即获得一个独立租户的 owner，与 ``POST /tenants``（管理员建租户）落地
    的资产一致（能力角色/职级标准/环境盘点默认规则），首次进入各模块即非空。
    返回结构与 login 完全相同，前端可直接复用登录态落地逻辑。
    """
    email = body.email.strip().lower()
    if not _EMAIL_RE.match(email):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="邮箱格式不正确")
    if db.query(models.AccountUser).filter_by(email=email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="该邮箱已注册")
    policy_err = password_policy_error(body.password)
    if policy_err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=policy_err)

    username = body.username.strip()
    if not _USERNAME_RE.match(username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户名需 3-32 位，仅含字母、数字、下划线或连字符",
        )
    if db.query(models.AccountUser).filter_by(username=username).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="该用户名已被占用")

    name = body.name.strip() or username
    now = _now()

    user = models.AccountUser(
        id=f"usr-{uuid.uuid4().hex[:12]}",
        email=email,
        name=name,
        username=username,
        avatar_url=_make_dicebear_url(username),
        password_hash=hash_password(body.password),
        status="active",
        created_at=now,
        updated_at=now,
    )
    db.add(user)
    db.flush()

    # 个人工作区 slug：邮箱本地部分清洗 + 随机后缀防碰撞
    base_slug = f"{_sanitize_slug(email.split('@', 1)[0])}-{uuid.uuid4().hex[:6]}"
    tenant = models.Tenant(
        id=f"tenant-{uuid.uuid4().hex[:12]}",
        name=f"{name}的工作区",
        slug=base_slug,
        status="active",
        created_at=now,
        updated_at=now,
    )
    db.add(tenant)
    db.add(models.TenantMembership(
        id=f"tmem-{uuid.uuid4().hex[:12]}",
        tenant_id=tenant.id,
        user_id=user.id,
        role="owner",
        created_at=now,
        updated_at=now,
    ))
    init_tenant_assets(db, tenant.id, now)
    db.commit()
    db.refresh(tenant)

    token = create_access_token(user.id, tenant.id, "owner")
    tenants = [{"id": tenant.id, "role": "owner", "name": tenant.name}]
    return {
        "token": token,
        "user": _user_out(user),
        "tenant": {"id": tenant.id, "name": tenant.name, "slug": tenant.slug},
        "role": "owner",
        "tenants": tenants,
    }


@router.get("/auth/me")
def me(request: Request, db: Session = Depends(get_db)):
    """根据当前 token 返回用户信息与租户列表（前端刷新恢复会话用）。"""
    token = token_from_request(request)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未登录")
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="登录已过期或无效")
    user = db.query(models.AccountUser).filter_by(id=payload.get("sub")).first()
    if not user or user.status != "active":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="账号不可用")
    memberships = (
        db.query(models.TenantMembership)
        .filter_by(user_id=user.id)
        .order_by(models.TenantMembership.created_at)
        .all()
    )
    tenants = [
        {
            "id": m.tenant_id,
            "role": m.role,
            "name": (db.query(models.Tenant).filter_by(id=m.tenant_id).first() or models.Tenant()).name,
        }
        for m in memberships
    ]
    current_tenant_id = payload.get("tenant")
    return {
        "user": _user_out(user),
        "tenant": {"id": current_tenant_id},
        "role": payload.get("role"),
        "tenants": tenants,
    }


@router.post("/auth/logout")
def logout():
    """登出（无状态 JWT；前端负责清除本地 token）。"""
    return {"ok": True}


@router.post("/auth/change-password")
def change_password(
    body: ChangePasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """修改当前用户密码。"""
    token = token_from_request(request)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未登录")
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="登录已过期或无效")
    user = db.query(models.AccountUser).filter_by(id=payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")
    if not verify_password(body.old_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="原密码错误")
    policy_err = password_policy_error(body.new_password)
    if policy_err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=policy_err)
    user.password_hash = hash_password(body.new_password)
    user.updated_at = _now()
    db.commit()
    return {"ok": True}


@router.patch("/auth/me")
def update_profile(
    body: UpdateProfileRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """更新个人资料：昵称(name) 与 头像 URL。

    - 用户名/邮箱不可改（忽略传入）。
    - avatar_url 仅允许 DiceBear 切换（上传走 /auth/avatar 落盘）。
    """
    user = _current_user(request, db)
    if body.name is not None:
        name = body.name.strip()
        if not name:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="昵称不能为空")
        if len(name) > 32:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="昵称最多 32 个字符")
        user.name = name
    if body.avatar_url is not None:
        url = body.avatar_url.strip()
        if not url.startswith(_DICEBEAR_PREFIX):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="头像地址无效",
            )
        user.avatar_url = url
    user.updated_at = _now()
    db.commit()
    db.refresh(user)
    return {"user": _user_out(user)}


@router.post("/auth/avatar")
def upload_avatar(
    body: UploadAvatarRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """上传头像：接收 data URI，落盘后更新 avatar_url，返回新用户资料。"""
    user = _current_user(request, db)
    user.avatar_url = _save_avatar_file(user.id, body.avatar)
    user.updated_at = _now()
    db.commit()
    db.refresh(user)
    return {"user": _user_out(user)}


@router.get("/avatars/{filename}")
def serve_avatar(filename: str):
    """公开提供头像文件（uuid 文件名不可猜；<img src> 无需带 token）。"""
    # 仅允许 basename，防目录穿越
    safe = os.path.basename(filename)
    if safe != filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="头像不存在")
    file_path = UPLOAD_DIR / safe
    if not file_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="头像不存在")
    return FileResponse(file_path)


# ============ 个人中心：综合数据 ============

def _find_my_developer(user: models.AccountUser, tenant_id: str, db: Session) -> models.Developer | None:
    """通过邮箱/用户名匹配，找到当前登录用户对应的开发者画像。

    匹配优先级：
    1. Developer.username 精确匹配 AccountUser.username（最可靠）
    2. IdentityMatch.git_email == user.email → 取 person_name 匹配 Developer.name
    3. Developer.name 直接匹配 user.name（兜底，可能重复，取首个）
    """
    # 1. 按 username 精确匹配
    if user.username:
        dev = db.query(models.Developer).filter_by(
            username=user.username, tenant_id=tenant_id,
        ).first()
        if dev:
            return dev

    # 2. 通过邮箱在身份匹配中找对应人
    matches = db.query(models.IdentityMatch).filter_by(
        git_email=user.email, tenant_id=tenant_id,
    ).all()
    if matches:
        names = [m.person_name for m in matches if m.person_name]
        if names:
            dev = db.query(models.Developer).filter(
                models.Developer.tenant_id == tenant_id,
                models.Developer.name.in_(names),
            ).first()
            if dev:
                return dev

    # 3. 兜底：按昵称直接匹配（可能有多条，取 commits 最多的）
    dev = (
        db.query(models.Developer)
        .filter_by(name=user.name, tenant_id=tenant_id)
        .order_by(models.Developer.commits.desc())
        .first()
    )
    return dev


@router.get("/auth/me/profile")
def my_profile(
    request: Request,
    db: Session = Depends(get_db),
):
    """个人中心综合数据：账号信息 + 开发者画像 + 最新评估 + 参与项目 + 所在团队。

    开发者画像通过邮箱/用户名匹配关联；若当前租户下没有匹配到的开发者，
    developer / evaluation / projects / teams 均返回空，前端展示「尚未关联档案」引导。
    """
    from ..capability import ROLE_NAMES

    user = _current_user(request, db)
    # 从 token 解 tenant_id（与 access.py 保持一致的 header 优先策略）
    from ..auth import decode_token
    token = token_from_request(request)
    payload = decode_token(token) if token else {}
    h_tid = request.headers.get("X-DevLens-Tenant-Id") or request.headers.get("x-devlens-tenant-id")
    tenant_id = h_tid or payload.get("tenant") or "tenant-default"

    result = {
        "user": _user_out(user),
        "tenantId": tenant_id,
        "developer": None,
        "latestEvaluation": None,
        "projects": [],
        "teams": [],
    }

    dev = _find_my_developer(user, tenant_id, db)
    if not dev:
        return result

    # 开发者画像（精简字段，够个人中心用）
    result["developer"] = {
        "id": dev.id,
        "name": dev.name,
        "username": dev.username,
        "role": dev.role,
        "roleType": dev.role_type,
        "roleLabel": ROLE_NAMES.get(dev.role_type, dev.role_type) if dev.role_type else dev.role,
        "level": dev.level,
        "overall": dev.overall,
        "commits": dev.commits,
        "reviews": dev.reviews,
        "langs": dev.langs or [],
        "tags": dev.tags or [],
    }

    # 最新一次评估
    latest_eval = (
        db.query(models.DeveloperEvaluation)
        .filter_by(developer_id=dev.id, tenant_id=tenant_id, status="completed")
        .order_by(models.DeveloperEvaluation.created_at.desc())
        .first()
    )
    if latest_eval:
        eval_role = latest_eval.role_key or ""
        result["latestEvaluation"] = {
            "id": latest_eval.id,
            "roleKey": eval_role,
            "roleLabel": ROLE_NAMES.get(eval_role, eval_role),
            "scores": latest_eval.scores or {},
            "achievedLevel": latest_eval.achieved_level,
            "bestLevel": latest_eval.best_level,
            "gaps": latest_eval.gaps or [],
            "summary": latest_eval.summary,
            "projectId": latest_eval.project_id,
            "createdAt": latest_eval.created_at,
        }

    # 参与的项目：从项目的 contributor_list 中反查
    projects: list[dict] = []
    all_projects = db.query(models.Project).filter_by(tenant_id=tenant_id).all()
    for p in all_projects:
        contributors = p.contributor_list or []
        match = next(
            (c for c in contributors
             if str(c.get("username") or "").lower() == (dev.username or "").lower()
             or str(c.get("name") or "") == dev.name),
            None,
        )
        if match:
            projects.append({
                "id": p.id,
                "name": p.name,
                "language": p.language,
                "score": p.score,
                "status": p.status,
                "commits": int(match.get("commits", 0) or 0),
                "lastAnalyzed": p.last_analyzed,
            })
    # 按提交数降序
    projects.sort(key=lambda x: x["commits"], reverse=True)
    result["projects"] = projects

    # 所在团队：Developer.team_id 指向 TeamSpace（组织树节点，FK -> team_spaces.id），
    # 而团队聚合统计（members/avgScore/busFactor/riskCount）在 Team 表。两者通过名称关联。
    teams: list[dict] = []
    team_name = dev.team
    if not team_name and dev.team_id:
        ts = db.query(models.TeamSpace).filter_by(id=dev.team_id, tenant_id=tenant_id).first()
        team_name = ts.name if ts else None
    if team_name:
        t = db.query(models.Team).filter_by(name=team_name, tenant_id=tenant_id).first()
        if t:
            teams.append({
                "id": t.id,
                "name": t.name,
                "members": t.members,
                "avgScore": t.avg_score,
                "busFactor": t.bus_factor,
                "riskCount": t.risk_count,
            })
    result["teams"] = teams

    return result
