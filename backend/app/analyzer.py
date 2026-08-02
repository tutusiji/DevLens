"""分析流程：clone -> git 采集 -> LLM 分析 -> 入库

analyze_repository 由 POST /projects 触发，background=True 时在线程中跑，
前端轮询 GET /analysis-runs/{run_id} 看进度。
"""
import os
import subprocess
import threading
import uuid
from datetime import datetime, timezone

from .config import settings
from .db import SessionLocal
from . import models
from .git_collect import collect_git_meta, sample_core_files
from .llm import chat_json

REVIEW_CATEGORIES = [
    "quality", "security", "performance", "maintainability", "architecture",
    "reliability", "logic", "complexity", "configuration", "dependency", "testing", "delivery",
]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _update_run(db, project_id: str, status: str, progress: int, stage: str, message: str) -> None:
    run = (
        db.query(models.AnalysisRun)
        .filter_by(project_id=project_id)
        .order_by(models.AnalysisRun.id.desc())
        .first()
    )
    if run:
        run.status = status
        run.progress = progress
        run.stage = stage
        run.message = message
        run.updated_at = _now()
        db.commit()


def ensure_repo(repo_target: str, name: str, branch: str) -> str:
    if os.path.isdir(os.path.join(repo_target, ".git")):
        return repo_target
    cache = settings.repos_cache
    os.makedirs(cache, exist_ok=True)
    local = os.path.join(cache, name)
    subprocess.run(["rm", "-rf", local], check=False)
    subprocess.run(
        ["git", "clone", "--quiet", repo_target, local],
        check=True, timeout=180,
    )
    return local


def _to_int(v, default=0):
    if isinstance(v, (int, float)):
        return int(v)
    try:
        return int(v)
    except (TypeError, ValueError):
        try:
            return int(float(v))
        except (TypeError, ValueError):
            return default


def _to_float(v, default=0.0):
    if isinstance(v, (int, float)):
        return float(v)
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def _git_stats(meta: dict, name: str) -> str:
    return (
        f"仓库: {name}\n"
        f"分支: {meta['branch']} @ {meta['commitShort']} ({meta['commitMessage']})\n"
        f"总 commits: {meta['totalCommits']}\n"
        f"文件数: {meta['fileCount']} (代码文件 {len(meta['codeFiles'])})\n"
        f"贡献者: {len(meta['contributors'])} 人\n"
        f"核心贡献者: {', '.join(c['name'] + '(' + str(c['commits']) + ')' for c in meta['contributors'][:5])}\n"
        f"语言: {', '.join(l['lang'] + ':' + str(l['count']) for l in meta['languages'][:5])}\n"
        "模块:\n  "
        + "\n  ".join(
            f"{m['name']}(文件{m['fileCount']}/commits{m['commits']}/复杂度{m['complexity']}/主owner {m['topOwner']} {m['topOwnerOwnership']}%)"
            for m in meta["modules"][:8]
        )
    )


SKILL_GROUPS = {
    "security": {
        "focus": "安全审计 Skill Group：聚焦安全漏洞/密钥泄露/权限/配置安全/依赖风险。category 用 security|configuration|dependency。输出 2-4 条安全相关 insights。",
        "extra": "",
    },
    "quality": {
        "focus": "代码质量 Skill Group：聚焦代码质量/复杂度/性能/逻辑/可维护性/测试/架构/可靠性。category 用 quality|complexity|performance|logic|maintainability|testing|architecture|reliability。输出 3-5 条 insights + moduleRisks + fixPriorities + 5 维 dimensions。",
        "extra": ',"moduleRisks":[{"name","path","score","severity":"critical|high|medium|low","issueCount","complexity","debtLoad","owner","ownership","categories":[{"category","count"}]}],"fixPriorities":[{"module","title","severity","priority":"P0|P1|P2|P3","effort","impact","expectedGain","status"}],"dimensions":[{"label","score","benchmark","trend":"up|down|stable","description"}]',
    },
}


def _load_group_rules(
    db,
    group_id: str | None,
    tenant_id: str | None = None,
) -> dict | None:
    """从数据库加载 Skill Group + 组内 rules（无则返回 None）"""
    if not group_id:
        return None
    group_query = db.query(models.SkillGroup).filter_by(id=group_id)
    if tenant_id:
        group_query = group_query.filter_by(tenant_id=tenant_id)
    group = group_query.first()
    if not group:
        return None
    skills_query = db.query(models.Skill).filter(
        models.Skill.id.in_(group.skill_ids or []),
        models.Skill.enabled == 1,
    )
    if tenant_id:
        skills_query = skills_query.filter(models.Skill.tenant_id == tenant_id)
    skills = skills_query.all()
    return {
        "group_name": group.name,
        "group_id": group.id,
        "skill_ids": list(group.skill_ids or []),
        "skills": [
            {
                "id": s.id, "name": s.name, "category": s.category,
                "severity": s.severity, "rule_content": s.rule_content,
                "positive_examples": s.positive_examples or [],
                "negative_examples": s.negative_examples or [],
            }
            for s in skills
        ],
    }


def _skill_prompt(skill: str, git_stats: str, code: str, rules: list[dict] | None = None) -> str:
    cfg = SKILL_GROUPS[skill]  # 保留内置 focus 作为兜底
    rules_section = ""
    if rules:
        lines = [f"- [{r['severity']}] {r['name']}：{r['rule_content']}" for r in rules]
        rules_section = "\n".join(["", "★ 本组审查规则（必须逐条检查）：", *lines])
    return f"""你是资深代码架构师，执行 {cfg["focus"]}
{rules_section}

{git_stats}

抽样核心代码:
{code}

输出严格 JSON（不要 markdown 代码块、不要解释）：
{{"dimensionScore":number,"aiInsights":[{{"title","module","category","severity":"critical|high|medium|low|info","riskScore","confidence","status":"open","filePath","symbol","startLine","endLine","evidence","codeExcerpt","impact","action","verification"}}]{cfg["extra"]}}}

category 枚举: {'|'.join(REVIEW_CATEGORIES)}
dimensionScore: 必须是纯数字 0-100（如 75），禁止描述文字。
只输出 JSON 对象。"""


def _llm_analyze(meta: dict, samples: list[dict], name: str, group: dict | None = None) -> dict:
    git_stats = _git_stats(meta, name)
    code = "\n\n".join(f"--- {s['path']} ---\n{s['content']}" for s in samples)
    # 自定义组规则注入两个 prompt（内置 security/quality 始终兜底）
    rules = group.get("skills") if group else None
    # 多 Skill Group 独立调用（架构 P1：可独立编排/增量运行）
    sec = chat_json([{"role": "user", "content": _skill_prompt("security", git_stats, code, rules)}], 12000)
    qual = chat_json([{"role": "user", "content": _skill_prompt("quality", git_stats, code, rules)}], 12000)
    # 聚合 insights + 标注 skillGroup
    insights = []
    for ins in sec.get("aiInsights", []):
        ins["skillGroup"] = "security"
        insights.append(ins)
    for ins in qual.get("aiInsights", []):
        ins["skillGroup"] = "quality"
        insights.append(ins)
    # 去重（filePath + category 语义指纹）
    seen, deduped = set(), []
    for ins in insights:
        key = (ins.get("filePath", ""), ins.get("category", ""))
        if key not in seen:
            seen.add(key)
            deduped.append(ins)
    sec_score = _to_int(sec.get("dimensionScore"), 75)
    qual_score = _to_int(qual.get("dimensionScore"), 75)
    return {
        "score": round((sec_score + qual_score) / 2),
        "quality": qual_score,
        "security": sec_score,
        "debt": 100 - qual_score,
        "summary": f"安全 {sec_score} / 质量 {qual_score}（多 Skill Group 聚合）",
        "dimensions": qual.get("dimensions") or [
            {"label": "代码质量", "score": qual_score, "benchmark": 78, "trend": "stable", "description": "质量 Skill Group"},
            {"label": "安全性", "score": sec_score, "benchmark": 75, "trend": "stable", "description": "安全 Skill Group"},
            {"label": "测试覆盖", "score": max(0, qual_score - 10), "benchmark": 68, "trend": "stable", "description": "测试维度"},
            {"label": "技术债", "score": qual_score, "benchmark": 72, "trend": "stable", "description": "技术债"},
            {"label": "交付稳定性", "score": min(100, qual_score + 5), "benchmark": 80, "trend": "stable", "description": "交付稳定性"},
        ],
        "aiInsights": deduped,
        "moduleRisks": qual.get("moduleRisks", []),
        "fixPriorities": qual.get("fixPriorities", []),
    }


def _discover_assets(repo_path: str, meta: dict) -> dict:
    """仓库发现：识别框架/依赖/配置/部署资产"""
    import json as _json
    from pathlib import Path

    assets = {"frameworks": [], "dependencies": [], "configs": [], "deployments": []}
    files = meta["files"]

    def read(f):
        try:
            return (Path(repo_path) / f).read_text(encoding="utf-8", errors="ignore")
        except Exception:
            return ""

    if "package.json" in files:
        try:
            pkg = _json.loads(read("package.json"))
            deps = {**(pkg.get("dependencies") or {}), **(pkg.get("devDependencies") or {})}
            assets["dependencies"].append({"manager": "npm", "count": len(deps)})
            for fw in ["react", "vue", "next", "express", "fastify", "nest", "angular", "svelte", "tailwindcss"]:
                if fw in deps:
                    assets["frameworks"].append({"name": fw, "version": deps[fw]})
        except Exception:
            pass
    if "pom.xml" in files:
        c = read("pom.xml")
        assets["dependencies"].append({"manager": "maven"})
        if "spring" in c.lower():
            assets["frameworks"].append({"name": "spring-boot", "version": ""})
    if "requirements.txt" in files or "pyproject.toml" in files:
        f = "requirements.txt" if "requirements.txt" in files else "pyproject.toml"
        assets["dependencies"].append({"manager": "pip", "file": f})
        c = read(f)
        for fw in ["fastapi", "flask", "django", "pandas", "numpy"]:
            if fw in c.lower():
                assets["frameworks"].append({"name": fw, "version": ""})
    if "go.mod" in files:
        assets["dependencies"].append({"manager": "go"})
    for f in files:
        low = f.lower()
        if low.endswith("dockerfile") or "docker-compose" in low:
            assets["deployments"].append({"name": f, "type": "docker"})
        elif low.endswith((".yaml", ".yml")) and any(k in low for k in ["deploy", "k8s", "helm", "values", "nginx", "service"]):
            assets["deployments"].append({"name": f, "type": "config"})
        elif low.startswith(".env") or ("config" in low and low.endswith((".yaml", ".yml", ".json", ".toml"))):
            assets["configs"].append({"name": f})
    return assets


def _build_identity_matches(project_id: str, meta: dict, db) -> None:
    """从 git contributors 生成身份匹配（git 作者 -> 组织人员）"""
    project = db.query(models.Project).filter_by(id=project_id).first()
    tenant_id = project.tenant_id if project else "tenant-default"
    db.query(models.IdentityMatch).filter_by(
        project_id=project_id, tenant_id=tenant_id,
    ).delete()
    for c in meta["contributors"][:10]:
        name = c["name"]
        email = c["email"].split(" / ")[0] if c["email"] else ""
        dev = db.query(models.Developer).filter(
            models.Developer.name == name,
            models.Developer.tenant_id == tenant_id,
        ).first()
        if dev:
            db.add(models.IdentityMatch(
                id=f"im-{project_id}-{abs(hash(name)) % 100000}",
                project_id=project_id, git_name=name, git_email=email,
                person_name=dev.name, department=dev.team, confidence=0.95, method="exact",
                tenant_id=tenant_id,
            ))
        else:
            db.add(models.IdentityMatch(
                id=f"im-{project_id}-{abs(hash(name)) % 100000}",
                project_id=project_id, git_name=name, git_email=email,
                person_name=name, department="未匹配", confidence=0.5, method="fuzzy",
                tenant_id=tenant_id,
            ))


def _persist(db, project_id: str, name: str, meta: dict, result: dict, repo_path: str) -> None:
    db.query(models.Insight).filter_by(project_id=project_id).delete()
    db.query(models.ModuleRisk).filter_by(project_id=project_id).delete()
    db.query(models.FixPriority).filter_by(project_id=project_id).delete()

    top = meta["contributors"][0] if meta["contributors"] else {}
    second = meta["contributors"][1] if len(meta["contributors"]) > 1 else {}
    last_date = meta["recentCommits"][0]["date"][:10] if meta["recentCommits"] else "2026-07-31"

    for i, ins in enumerate(result.get("aiInsights", [])):
        sev = ins.get("severity", "medium")
        db.add(models.Insight(
            id=f"ins-{project_id}-{i+1}", project_id=project_id,
            title=ins.get("title", ""), module=ins.get("module", ""),
            type=ins.get("category", "quality"), category=ins.get("category", "quality"),
            severity=sev,
            level="critical" if sev == "critical" else ("warning" if sev == "high" else "info"),
            risk_score=_to_int(ins.get("riskScore"), 50), confidence=_to_float(ins.get("confidence"), 0.8),
            status=ins.get("status", "open"),
            file_path=ins.get("filePath", ""), symbol=ins.get("symbol", ""),
            start_line=ins.get("startLine"), end_line=ins.get("endLine"),
            source="AI Review + Git Analysis", first_seen_at=last_date, last_seen_at=last_date,
            assignee=top.get("name"),
            evidence=ins.get("evidence", ""), code_excerpt=ins.get("codeExcerpt"),
            impact=ins.get("impact", ""), action=ins.get("action", ""), verification=ins.get("verification", ""),
            skill_group=ins.get("skillGroup"),
        ))

    for i, m in enumerate(result.get("moduleRisks", [])):
        db.add(models.ModuleRisk(
            id=f"mod-{project_id}-{i+1}", project_id=project_id,
            name=m.get("name", ""), path=m.get("path", ""),
            score=_to_int(m.get("score"), 50), severity=m.get("severity", "medium"),
            critical_count=_to_int(m.get("issueCount"), 0) if m.get("severity") == "critical" else 0,
            issue_count=_to_int(m.get("issueCount"), 0), complexity=_to_int(m.get("complexity"), 50),
            debt_load=_to_int(m.get("debtLoad"), 10), owner=m.get("owner") or top.get("name", ""),
            backup_owner=second.get("name"), ownership=_to_int(m.get("ownership"), 50),
            last_changed=last_date, categories=m.get("categories", []),
        ))

    for i, f in enumerate(result.get("fixPriorities", [])):
        db.add(models.FixPriority(
            id=f"fix-{project_id}-{i+1}", project_id=project_id,
            module=f.get("module", ""), title=f.get("title", ""),
            severity=f.get("severity", "medium"), priority=f.get("priority", "P2"),
            debt=round(_to_int(f.get("expectedGain"), 1) * 3), effort=f.get("effort", ""),
            impact=f.get("impact", ""), expected_gain=_to_int(f.get("expectedGain"), 1),
            status=f.get("status", "open"), assignee=top.get("name"),
        ))

    p = db.query(models.Project).get(project_id)
    if not p:
        return
    lang = meta["languages"][0]["lang"] if meta["languages"] else "unknown"
    insights = result.get("aiInsights", [])
    debt = result.get("debt", 30)
    review_summary = {
        "total": len(insights),
        "critical": sum(1 for i in insights if i.get("severity") == "critical"),
        "open": sum(1 for i in insights if i.get("status") == "open"),
        "newSinceLastScan": sum(1 for i in insights if i.get("status") == "open"),
        "inProgress": sum(1 for i in insights if i.get("status") == "in_progress"),
        "resolved": sum(1 for i in insights if i.get("status") == "resolved"),
    }
    p.language = lang
    p.score = result.get("score", 75)
    p.quality = result.get("quality", 75)
    p.security = result.get("security", 75)
    p.debt = debt
    p.status = "completed"
    p.commits = meta["totalCommits"]
    p.contributors = len(meta["contributors"])
    p.last_analyzed = "刚刚"
    p.dimensions = result.get("dimensions", [])
    p.contributor_list = [
        {
            "name": c["name"],
            "username": c["email"].split("@")[0] if c.get("email") else c["name"],
            "commits": c["commits"],
            "reviews": round(c["commits"] * 0.3),
            "ownership": min(85, round(c["commits"] / max(1, meta["totalCommits"]) * 200)) or (40 if c == top else 10),
        }
        for c in meta["contributors"][:8]
    ]
    p.debt_trend = [
        {"month": m, "debt": max(10, debt - i * 2), "complexity": max(20, 60 - i * 3)}
        for i, m in enumerate(["2月", "3月", "4月", "5月", "6月", "7月"])
    ]
    p.review_summary = review_summary
    p.analysis_meta = {
        "branch": meta["branch"], "commit": meta["commitShort"],
        "analysisVersion": f"{settings.llm_model} · {datetime.now().strftime('%Y-%m')}",
        "scannedAt": datetime.now().strftime("%Y-%m-%d"),
        "coverage": min(99, round(len(meta["codeFiles"]) / max(1, meta["fileCount"]) * 100)),
        "filesScanned": len(meta["codeFiles"]), "confidence": 0.85,
    }
    p.assets = _discover_assets(repo_path, meta)
    p.graph_edges = meta.get("dependencies", [])
    # 架构设计方案是项目级工件：只基于本项目的模块、依赖、资产和风险提取，
    # 避免全局图谱混合多个仓库的代码上下文。
    from .architecture import derive_architecture_design
    p.architecture_design = derive_architecture_design(p)
    # 每一次成功分析固化不可变评分快照；项目页当前分值只是最新视图，
    # 横向对比/趋势报表以快照为准。
    latest_run = (
        db.query(models.AnalysisRun)
        .filter_by(project_id=project_id)
        .order_by(models.AnalysisRun.updated_at.desc())
        .first()
    )
    db.add(models.ProjectAssessmentSnapshot(
        id=f"psnap-{uuid.uuid4().hex[:12]}",
        tenant_id=p.tenant_id or "tenant-default",
        project_id=p.id,
        analysis_run_id=latest_run.id if latest_run else None,
        score=p.score or 0,
        quality=p.quality or 0,
        security=p.security or 0,
        debt=p.debt or 0,
        contributors=p.contributors or 0,
        commits=p.commits or 0,
        recorded_at=_now(),
        source="analysis",
    ))
    db.commit()
    _build_identity_matches(project_id, meta, db)
    db.commit()


def _analyze(project_id: str, repo_target: str, name: str, branch: str, group_id: str | None = None) -> None:
    db = SessionLocal()
    try:
        _update_run(db, project_id, "cloning", 10, "git_collect", "克隆仓库")
        repo_path = ensure_repo(repo_target, name, branch)
        _update_run(db, project_id, "analyzing", 30, "git_collect", "采集 git 元数据")
        meta = collect_git_meta(repo_path)
        _update_run(db, project_id, "analyzing", 50, "code_parse", "LLM 分析代码")
        samples = sample_core_files(repo_path, meta)
        # RAG：索引代码 chunk 到 Qdrant（语义检索基础设施）
        try:
            from .rag import index_code_chunks
            n = index_code_chunks(project_id, samples)
            print(f"  RAG 索引 {n} 个 chunk")
        except Exception as e:
            print(f"  RAG 索引跳过: {e}")

        # 加载 Skill Group 规则：入参 group_id > 本次运行绑定的 group > 默认组
        group = None
        if group_id:
            group = _load_group_rules(db, group_id)
        else:
            run = (
                db.query(models.AnalysisRun)
                .filter_by(project_id=project_id)
                .order_by(models.AnalysisRun.id.desc())
                .first()
            )
            if run and run.skill_group_id:
                group = _load_group_rules(db, run.skill_group_id)
            else:
                default = db.query(models.SkillGroup).filter_by(
                    enabled=1, analysis_type="repo_analysis").first()
                if default:
                    group = _load_group_rules(db, default.id)

        result = _llm_analyze(meta, samples, name, group)

        # 记录 SkillGroupRun 快照（保证可复现：组名 + 规则 id + 规则全文）
        if group:
            db.add(models.SkillGroupRun(
                id=f"skgr-{project_id}-{abs(hash(name)) % 100000}",
                project_id=project_id,
                group_id=group["group_id"],
                group_snapshot={
                    "group_name": group["group_name"],
                    "skill_ids": group["skill_ids"],
                    "rules": [
                        {"id": r["id"], "name": r["name"], "category": r["category"],
                         "severity": r["severity"], "rule_content": r["rule_content"]}
                        for r in group["skills"]
                    ],
                },
                trigger="auto",
                created_at=_now(),
            ))
            db.commit()

        _update_run(db, project_id, "analyzing", 80, "project_snapshot", "生成报告入库")
        _persist(db, project_id, name, meta, result, repo_path)
        _update_run(db, project_id, "completed", 100, "report", "分析完成")
        print(f"✓ 分析完成 {project_id} ({name})")
    except Exception as e:
        _update_run(db, project_id, "failed", 0, "error", str(e)[:200])
        print(f"✗ 分析失败 {project_id}: {e}")
    finally:
        db.close()


def analyze_repository(project_id: str, repo_target: str, name: str, branch: str = "", background: bool = False, group_id: str | None = None) -> None:
    if background:
        threading.Thread(target=_analyze, args=(project_id, repo_target, name, branch, group_id), daemon=True).start()
    else:
        _analyze(project_id, repo_target, name, branch, group_id)
