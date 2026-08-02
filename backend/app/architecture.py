"""项目级代码图谱与架构设计方案提取。

这里刻意把两个概念分开：

* ``build_project_code_graph``：文件/模块级 import 依赖图，只能属于一个项目。
* ``derive_architecture_design``：把项目资产、模块、依赖、风险投影为架构级方案，
  面向技术负责人阅读，不把多个项目的代码模块直接拼在一起。
"""
from datetime import datetime, timezone
import math
import posixpath
from pathlib import PurePosixPath
import re
from typing import Any

from . import models


LAYER_META = {
    "edge": {"label": "接入层", "color": "#5B8FF9", "description": "HTTP、页面、路由与外部入口"},
    "service": {"label": "业务服务层", "color": "#7CB305", "description": "领域逻辑、编排与应用服务"},
    "data": {"label": "数据与集成层", "color": "#F6BD16", "description": "数据访问、缓存、消息与外部集成"},
    "infra": {"label": "基础设施层", "color": "#7262FD", "description": "部署、配置、运行与平台能力"},
}

CODE_FILE_SUFFIXES = {
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".java", ".kt",
    ".go", ".rs", ".rb", ".php", ".cs", ".swift", ".vue", ".svelte",
}
ARCHITECTURE_DESIGN_VERSION = 2
INVALID_MODULE_VALUES = {
    "", ".", "..", "root", "*", "{", "}", "(", ")", "[", "]", "'", '"',
}
INVALID_MODULE_CHARS = re.compile(r"""[{}[\]()*,'"`;\\\s]""")


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _node_label(node_id: str) -> str:
    path = PurePosixPath(node_id)
    return path.name or node_id


def _normalize_module_id(value: object) -> str:
    """规范化项目内模块 ID，拒绝 import 语法残片和明显的外部包 token。"""
    if value is None:
        return ""
    candidate = str(value).strip().replace("\\", "/")
    candidate = posixpath.normpath(candidate)
    while candidate.startswith("./"):
        candidate = candidate[2:]
    if candidate in INVALID_MODULE_VALUES or len(candidate) > 240:
        return ""
    if candidate.startswith(("/", "../", "node:", "http:", "https:")):
        return ""
    if INVALID_MODULE_CHARS.search(candidate):
        return ""
    return candidate


def _is_internal_file_module(value: object) -> bool:
    """import 边只接纳项目内文件路径，外部依赖改由 assets.dependencies 表达。"""
    candidate = _normalize_module_id(value)
    if not candidate:
        return False
    path = PurePosixPath(candidate)
    return "/" in candidate or path.suffix.lower() in CODE_FILE_SUFFIXES


def _layer_for(path: str) -> str:
    lowered = path.lower().replace("\\", "/").strip("/")
    filename = PurePosixPath(lowered).name
    # 这些目录也会以裸节点（如 ``deploy``）出现于风险模块或资产中。
    if (
        lowered in {"deploy", "deployment", "infra", "infrastructure", "config", "configs",
                    "k8s", "helm", "terraform", "docker", "compose", "scripts", ".github",
                    "ci", "cd"}
        or any(token in lowered for token in (
            "dockerfile", "docker-compose", "/deploy", "/deployment", "/infra", "/config",
            "/k8s", "/helm", "/terraform", "/.github/", "/scripts/", "/ci/", "/cd/",
        ))
    ):
        return "infra"
    if any(token in lowered for token in (
        "api/", "/api/", "route.", "/routes/", "/controller", "/handler", "/page.", "/view",
    )):
        return "edge"
    if any(token in lowered for token in (
        "repo", "/repository", "/dao", "/model", "/entity", "/schema",
        "db/", "/database", "/store", "/cache", "/mq", "/kafka", "/client",
    )):
        return "data"
    if filename in {"main.py", "main.ts", "main.tsx", "app.py", "app.ts", "app.tsx"}:
        return "edge"
    return "service"


def _layout(items: list[str]) -> dict[str, tuple[int, int]]:
    """圆形布局，保证图谱仅在项目范围内稳定展示。"""
    if not items:
        return {}
    positions: dict[str, tuple[int, int]] = {}
    for index, item in enumerate(items):
        angle = 2 * math.pi * index / max(1, len(items))
        positions[item] = (
            round(50 + 34 * math.cos(angle)),
            round(50 + 34 * math.sin(angle)),
        )
    return positions


def _module_index(project: models.Project) -> dict[str, Any]:
    index: dict[str, Any] = {}
    for module in project.module_risks or []:
        for key in (module.name, module.path):
            normalized = _normalize_module_id(key)
            if normalized:
                index[normalized] = module
    return index


def build_project_code_graph(project: models.Project) -> dict[str, Any]:
    """从单个项目的风险模块与 import 依赖构建项目级代码图谱。

    ``Project.graph_edges`` 仅接受项目内文件路径。历史版本的解析结果可能带有外部
    package 或 import 语法碎片，本函数会在读时清洗，避免旧数据污染产品展示；重新
    执行分析后会由 ``git_collect._parse_imports`` 落下更精确的文件级边。
    """
    module_by_key = _module_index(project)
    raw_edges = project.graph_edges or []

    normalized_edges: list[tuple[str, str]] = []
    for edge in raw_edges:
        source = _normalize_module_id(edge.get("source"))
        target = _normalize_module_id(edge.get("target"))
        if (
            source
            and target
            and source != target
            and _is_internal_file_module(source)
            and _is_internal_file_module(target)
        ):
            normalized_edges.append((source, target))

    # 风险模块来自项目分析结果，即使暂无静态 import 也可作为项目图谱中的孤立节点。
    node_ids: list[str] = []
    seen: set[str] = set()

    def add_node(value: object) -> None:
        node_id = _normalize_module_id(value)
        if node_id and node_id not in seen:
            seen.add(node_id)
            node_ids.append(node_id)

    for module in project.module_risks or []:
        add_node(module.path or module.name)
    for source, target in normalized_edges:
        add_node(source)
        add_node(target)

    # 先展示风险模块，再按路径稳定补全静态依赖；限制规模避免大仓库页面过载。
    node_ids = node_ids[:80]
    node_id_set = set(node_ids)
    positions = _layout(node_ids)
    nodes = []
    for node_id in node_ids:
        module = module_by_key.get(node_id)
        layer = _layer_for(node_id)
        risk_score = int(getattr(module, "score", 0) or 0)
        issue_count = int(getattr(module, "issue_count", 0) or 0)
        health = max(0, min(100, 100 - risk_score)) if module else 75
        x, y = positions[node_id]
        nodes.append({
            "id": node_id,
            "label": _node_label(node_id),
            "layer": layer,
            "x": x,
            "y": y,
            "loc": f"{issue_count} 项问题" if module else "依赖模块",
            "health": health,
            "path": getattr(module, "path", "") or node_id,
            "issue_count": issue_count,
        })

    edges = []
    edge_seen: set[tuple[str, str]] = set()
    for source, target in sorted(normalized_edges):
        key = (source, target)
        if source in node_id_set and target in node_id_set and source != target and key not in edge_seen:
            edge_seen.add(key)
            edges.append({"source": source, "target": target})

    meta = project.analysis_meta or {}
    return {
        "project_id": project.id,
        "project_name": project.name,
        "branch": meta.get("branch", ""),
        "commit": meta.get("commit", ""),
        "generated_at": meta.get("scannedAt", "") or now(),
        "nodes": nodes,
        "edges": edges,
        "stats": {
            "moduleCount": len(nodes),
            "edgeCount": len(edges),
            "avgHealth": round(sum(node["health"] for node in nodes) / len(nodes)) if nodes else 0,
            "riskModuleCount": sum(1 for node in nodes if node["issue_count"] > 0),
        },
    }


def derive_architecture_design(project: models.Project) -> dict[str, Any]:
    """从已经落库的项目分析资产生成架构方案，不需要额外 LLM 调用。"""
    code_graph = build_project_code_graph(project)
    assets = project.assets or {}
    components = []
    for node in code_graph["nodes"][:32]:
        layer = node["layer"]
        components.append({
            "id": node["id"],
            "name": node["label"],
            "layer": layer,
            "layer_label": LAYER_META[layer]["label"],
            "description": node["path"],
            "health": node["health"],
            "issue_count": node["issue_count"],
        })

    # 没有可解析代码模块时，使用已识别技术资产构成最小、可解释的架构方案。
    if not components:
        for category, layer in (
            ("frameworks", "edge"),
            ("dependencies", "service"),
            ("configs", "infra"),
            ("deployments", "infra"),
        ):
            for index, asset in enumerate((assets.get(category) or [])[:8]):
                name = str(asset.get("name") or asset.get("manager") or f"{category}-{index + 1}")
                component_id = f"asset:{category}:{index}"
                components.append({
                    "id": component_id,
                    "name": name,
                    "layer": layer,
                    "layer_label": LAYER_META[layer]["label"],
                    "description": category,
                    "health": 75,
                    "issue_count": 0,
                })

    component_ids = {component["id"] for component in components}
    relations = [
        edge for edge in code_graph["edges"]
        if edge["source"] in component_ids and edge["target"] in component_ids
    ][:80]

    layer_components: dict[str, list[dict]] = {key: [] for key in LAYER_META}
    for component in components:
        layer_components[component["layer"]].append(component)
    layers = [
        {
            "key": key,
            "label": meta["label"],
            "description": meta["description"],
            "color": meta["color"],
            "component_count": len(layer_components[key]),
            "components": [item["name"] for item in layer_components[key][:6]],
        }
        for key, meta in LAYER_META.items()
        if layer_components[key]
    ]

    frameworks = assets.get("frameworks") or []
    framework_names = [
        str(item.get("name") or item.get("manager") or "")
        for item in frameworks
        if item.get("name") or item.get("manager")
    ]
    deployments = assets.get("deployments") or []
    dependencies = assets.get("dependencies") or []
    critical_risks = [
        module for module in (project.module_risks or [])
        if module.severity in {"critical", "high"}
    ][:5]
    decisions = [
        {
            "title": "应用技术基座",
            "value": "、".join(framework_names) or project.language or "待识别",
            "evidence": "来自项目依赖与框架资产扫描",
        },
        {
            "title": "运行与部署形态",
            "value": "、".join(str(item.get("type") or item.get("name") or "") for item in deployments[:4]) or "待补充部署资产",
            "evidence": "来自 Docker、部署与配置文件扫描",
        },
        {
            "title": "依赖治理范围",
            "value": f"{len(dependencies)} 类依赖资产 · {code_graph['stats']['edgeCount']} 条模块依赖",
            "evidence": "来自依赖清单与静态 import 解析",
        },
    ]
    risks = [
        {
            "name": risk.name,
            "path": risk.path,
            "severity": risk.severity,
            "score": risk.score,
            "issue_count": risk.issue_count,
            "owner": risk.owner or "未分配",
        }
        for risk in critical_risks
    ]
    meta = project.analysis_meta or {}
    has_asset_evidence = any(bool(value) for value in assets.values()) if isinstance(assets, dict) else bool(assets)
    has_evidence = bool(components or has_asset_evidence or project.module_risks or project.graph_edges)
    analysis_status = "ready" if has_evidence else "pending"
    overview = (
        f"{project.name} 当前识别为 {project.language or '多语言'} 项目，"
        f"由 {len(components)} 个可识别架构组件和 {len(relations)} 条组件关系构成。"
        if has_evidence
        else f"{project.name} 尚未产出可用于架构提取的代码、依赖或部署资产；请先完成项目分析。"
    )
    principles = [
        "按接入、业务服务、数据集成、基础设施分层展示，避免跨层依赖失控。",
        "架构方案依据已接入仓库的代码、依赖、部署资产和风险模块自动提取。",
        "每次项目分析后更新方案快照；方案结论必须可追溯到对应分支与 Commit。",
    ]
    return {
        "extraction_version": ARCHITECTURE_DESIGN_VERSION,
        "project_id": project.id,
        "project_name": project.name,
        "language": project.language or "",
        "analysis_status": analysis_status,
        "branch": meta.get("branch", ""),
        "commit": meta.get("commit", ""),
        "generated_at": now(),
        "overview": overview,
        "principles": principles,
        "layers": layers,
        "components": components,
        "relations": relations,
        "decisions": decisions,
        "risks": risks,
    }
