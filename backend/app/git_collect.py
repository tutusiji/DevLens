"""Git 仓库元数据采集（subprocess 调 git，零依赖）"""
import posixpath
import re
import subprocess
from pathlib import Path, PurePosixPath

CODE_EXT = {
    "ts", "tsx", "js", "jsx", "mjs", "cjs", "java", "kt", "scala", "py",
    "go", "rs", "rb", "php", "c", "cc", "cpp", "h", "hpp", "cs", "swift",
    "dart", "vue", "svelte",
}


def _safe(repo: str, args: list[str]) -> str:
    try:
        r = subprocess.run(
            ["git", "-C", repo] + args,
            capture_output=True, text=True,
        )
        return r.stdout
    except Exception:
        return ""


def collect_author_code(
    repo_path: str,
    author: str,
    max_files: int = 10,
    max_bytes: int = 6000,
) -> dict:
    """采样指定 git 作者实际修改过、且当前仍存在的代码文件。

    ``git log --author`` 按提交作者名称匹配，因参数直接传给 subprocess，
    可安全支持中文或包含空格的作者名。文件按作者变更中的主语言优先级排序，
    再读取工作区当前版本内容供开发者能力评估使用。
    """
    repo = Path(repo_path)
    if not repo.is_dir():
        return {
            "author": author,
            "commits": 0,
            "files": [],
            "samples": [],
            "totalCommits": 0,
        }

    raw_files = _safe(
        repo_path,
        ["log", f"--author={author}", "--name-only", "--pretty=format:", "--"],
    ).splitlines()
    # 保持 git 日志的最近优先顺序，同时过滤非代码文件和重复路径。
    files: list[str] = []
    seen: set[str] = set()
    for raw_path in raw_files:
        path = raw_path.strip()
        if (
            not path
            or path in seen
            or "." not in path
            or path.rsplit(".", 1)[-1].lower() not in CODE_EXT
        ):
            continue
        seen.add(path)
        files.append(path)

    try:
        commits = int(
            _safe(repo_path, ["rev-list", "--count", f"--author={author}", "HEAD"]).strip()
            or "0"
        )
    except ValueError:
        commits = 0

    if not files:
        return {
            "author": author,
            "commits": commits,
            "files": [],
            "samples": [],
            "totalCommits": commits,
        }

    # 没有独立的作者语言统计字段时，以该作者修改过的文件扩展名频次作为
    # 主语言近似；同语言内保持最近提交中出现的文件优先。
    ext_counts: dict[str, int] = {}
    for path in files:
        ext = path.rsplit(".", 1)[-1].lower()
        ext_counts[ext] = ext_counts.get(ext, 0) + 1
    file_order = {path: index for index, path in enumerate(files)}
    files.sort(
        key=lambda path: (
            -ext_counts[path.rsplit(".", 1)[-1].lower()],
            file_order[path],
        )
    )

    selected_files = files[:max_files]
    samples: list[dict] = []
    for relative_path in selected_files:
        try:
            full_path = repo / relative_path
            if not full_path.is_file() or full_path.stat().st_size > 100_000:
                continue
            content = full_path.read_text(encoding="utf-8", errors="ignore")
            if len(content) > max_bytes:
                content = content[:max_bytes] + "\n/* ... truncated */"
            samples.append({"path": relative_path, "content": content})
        except (OSError, ValueError):
            continue

    return {
        "author": author,
        "commits": commits,
        "files": selected_files,
        "samples": samples,
        "totalCommits": commits,
    }


def _merge_contributors(raw: list[tuple[str, str, int]]) -> list[dict]:
    m: dict[str, dict] = {}
    for name, email, commits in raw:
        norm = "".join(c for c in name if c.isalnum()).lower()
        if not norm:
            continue
        if norm in m:
            m[norm]["commits"] += commits
            if email and email not in m[norm]["email"]:
                m[norm]["email"] += " / " + email
        else:
            m[norm] = {"name": name, "email": email or "", "commits": commits}
    return sorted(m.values(), key=lambda x: x["commits"], reverse=True)


def _parse_imports(repo_path: str, files: list[str]) -> list[dict]:
    """解析仓库**内部**模块依赖边。

    图谱的节点必须是项目相对路径，而不是 ``axios``、``React`` 或 Python 标准库等
    外部包名。此前的粗粒度实现会把 import 语句中的 token 直接放入图谱，既产生
    ``axios,`` 一类脏节点，也无法回溯到实际文件。这里仅在导入目标可解析为本仓库
    已扫描代码文件时记录依赖边。

    这仍是零依赖的轻量级正则解析，不试图替代语言 AST；其设计目标是稳定、可解释的
    项目代码图谱，而不是覆盖每一种动态加载语法。
    """
    graph_extensions = (".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py")
    code_files = {
        posixpath.normpath(filepath).lstrip("./")
        for filepath in files
        if filepath.lower().endswith(graph_extensions)
    }
    if not code_files:
        return []

    extension_candidates = (".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py")
    edges: set[tuple[str, str]] = set()

    def clean_path(value: str) -> str:
        return posixpath.normpath(value.replace("\\", "/")).lstrip("./")

    def resolve_relative(source: str, reference: str) -> str | None:
        """按 Node 风格解析相对 import，只接受仓库内的已知代码文件。"""
        candidate = clean_path(posixpath.join(posixpath.dirname(source), reference))
        possibilities = [candidate]
        if not PurePosixPath(candidate).suffix:
            possibilities.extend(f"{candidate}{ext}" for ext in extension_candidates)
            possibilities.extend(
                posixpath.join(candidate, f"index{ext}") for ext in extension_candidates
            )
        for possibility in possibilities:
            if possibility in code_files:
                return possibility
        return None

    module_to_file: dict[str, str] = {}
    for filepath in code_files:
        path = PurePosixPath(filepath)
        without_suffix = str(path.with_suffix(""))
        # ``pkg/__init__.py`` 代表 ``pkg``；其他文件按其 Python 模块路径映射。
        if path.stem == "__init__":
            module = ".".join(path.parts[:-1])
        else:
            module = without_suffix.replace("/", ".")
        if module:
            module_to_file.setdefault(module, filepath)

    def resolve_python(source: str, raw_module: str) -> str | None:
        """仅将能映射回当前仓库文件的 Python import 记录为内部依赖。"""
        raw_module = raw_module.strip()
        if not raw_module:
            return None
        if raw_module.startswith("."):
            dot_count = len(raw_module) - len(raw_module.lstrip("."))
            remainder = raw_module[dot_count:]
            source_path = PurePosixPath(source)
            package = list(source_path.parent.parts)
            if source_path.stem == "__init__":
                package = list(source_path.parts[:-1])
            # 一个点表示当前包；每多一个点上移一级。
            if dot_count > 1:
                package = package[:max(0, len(package) - (dot_count - 1))]
            module = ".".join(part for part in [*package, remainder] if part)
        else:
            module = raw_module
        if module in module_to_file:
            return module_to_file[module]
        # ``from package import thing`` 可能仅显式导入包本身。
        return module_to_file.get(f"{module}.__init__")

    for source in sorted(code_files):
        try:
            content = (Path(repo_path) / source).read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        targets: set[str] = set()

        if source.endswith((".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs")):
            # JS/TS: import/export ... from './...' 和 import './...'
            for match in re.finditer(
                r"""(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"](\.{1,2}/[^'"]+)['"]""",
                content,
            ):
                target = resolve_relative(source, match.group(1))
                if target:
                    targets.add(target)
            # JS require('./...')
            for match in re.finditer(r"""require\(\s*['"](\.{1,2}/[^'"]+)['"]\s*\)""", content):
                target = resolve_relative(source, match.group(1))
                if target:
                    targets.add(target)

        if source.endswith(".py"):
            # Python: ``from .foo import bar`` / ``from app.foo import bar`` / ``import app.foo``.
            for match in re.finditer(
                r"^\s*from\s+([.\w]+)\s+import\s+",
                content,
                re.MULTILINE,
            ):
                target = resolve_python(source, match.group(1))
                if target:
                    targets.add(target)
            for match in re.finditer(r"^\s*import\s+([A-Za-z_][\w.]*)", content, re.MULTILINE):
                target = resolve_python(source, match.group(1))
                if target:
                    targets.add(target)

        for target in targets:
            if target != source:
                edges.add((source, target))
    return [{"source": source, "target": target} for source, target in sorted(edges)]


def collect_git_meta(repo_path: str) -> dict:
    branch = _safe(repo_path, ["branch", "--show-current"]).strip() or "main"
    head = _safe(repo_path, ["log", "-1", "--pretty=format:%H|%h|%s"]).split("|")
    commit_sha = head[0] if head and head[0] else ""
    commit_short = head[1] if len(head) > 1 else ""
    commit_msg = "|".join(head[2:]) if len(head) > 2 else ""
    try:
        total = int(_safe(repo_path, ["rev-list", "--count", "HEAD"]).strip() or "0")
    except ValueError:
        total = 0

    # 贡献者
    shortlog = _safe(repo_path, ["shortlog", "-sn", "--all"]).strip().split("\n")
    raw: list[tuple[str, str, int]] = []
    for line in shortlog:
        line = line.strip()
        if not line:
            continue
        parts = line.split(None, 1)
        if len(parts) == 2 and parts[0].isdigit():
            raw.append((parts[1], "", int(parts[0])))
    emails: dict[str, str] = {}
    for line in _safe(repo_path, ["log", "--all", "--pretty=format:%an|%ae"]).split("\n"):
        if "|" in line:
            n, e = line.split("|", 1)
            emails.setdefault(n.strip(), e.strip())
    raw = [(n, emails.get(n, ""), c) for n, _, c in raw]
    contributors = _merge_contributors(raw)

    # 文件
    files = [f for f in _safe(repo_path, ["ls-files"]).split("\n") if f]
    code_files = [f for f in files if "." in f and f.rsplit(".", 1)[-1].lower() in CODE_EXT]

    # 语言
    lang: dict[str, int] = {}
    for f in files:
        if "." in f:
            ext = f.rsplit(".", 1)[-1].lower()
            lang[ext] = lang.get(ext, 0) + 1
    languages = sorted(
        [{"lang": k, "count": v} for k, v in lang.items()],
        key=lambda x: x["count"], reverse=True,
    )

    # 模块（顶层目录）
    top_dirs = sorted({f.split("/")[0] for f in files if "/" in f and not f.startswith(".")})
    modules = []
    for d in top_dirs:
        dfiles = [f for f in files if f.startswith(d + "/")]
        code_count = sum(1 for f in dfiles if "." in f and f.rsplit(".", 1)[-1].lower() in CODE_EXT)
        if code_count == 0 and len(dfiles) < 5:
            continue
        mod_commits = len([l for l in _safe(repo_path, ["log", "--oneline", "--", f"./{d}"]).split("\n") if l.strip()])
        owners_raw = [l.strip() for l in _safe(repo_path, ["log", "--pretty=format:%an", "--", f"./{d}"]).split("\n") if l.strip()]
        omap: dict[str, int] = {}
        oorig: dict[str, str] = {}
        for n in owners_raw:
            norm = "".join(c for c in n if c.isalnum()).lower()
            omap[norm] = omap.get(norm, 0) + 1
            oorig.setdefault(norm, n)
        owners = sorted(
            [{"name": oorig[k], "commits": v} for k, v in omap.items()],
            key=lambda x: x["commits"], reverse=True,
        )
        total_o = sum(o["commits"] for o in owners) or 1
        top_owner = owners[0]["name"] if owners else ""
        top_own = round(owners[0]["commits"] / total_o * 100) if owners else 0
        modules.append({
            "name": d, "path": d, "fileCount": len(dfiles), "commits": mod_commits,
            "owners": owners[:5], "topOwner": top_owner, "topOwnerOwnership": top_own,
            "complexity": min(100, round(code_count / 150 * 100)), "codeFileCount": code_count,
        })
    modules.sort(key=lambda x: x["commits"], reverse=True)

    # recent commits
    recent = []
    for line in _safe(repo_path, ["log", "-10", "--pretty=format:%h|%an|%aI|%s"]).split("\n"):
        if not line.strip():
            continue
        parts = line.split("|", 3)
        if len(parts) >= 4:
            recent.append({"sha": parts[0], "author": parts[1], "date": parts[2], "message": parts[3]})

    return {
        "branch": branch, "commitSha": commit_sha, "commitShort": commit_short,
        "commitMessage": commit_msg, "totalCommits": total,
        "contributors": contributors, "files": files, "fileCount": len(files),
        "codeFiles": code_files, "languages": languages, "modules": modules,
        "recentCommits": recent,
        "dependencies": _parse_imports(repo_path, files),
    }


def sample_core_files(repo_path: str, meta: dict, max_files: int = 12, max_bytes: int = 6000) -> list[dict]:
    samples: list[dict] = []
    top_modules = [m for m in meta["modules"] if m["codeFileCount"] > 0][:5]
    seen: set[str] = set()
    for mod in top_modules:
        mod_files = [f for f in meta["codeFiles"] if f.startswith(mod["name"] + "/")]
        mod_files.sort(key=lambda f: (-1 if re.search(r"core|main|src|service|util|api|config", f) else 0, len(f)))
        for f in mod_files[:3]:
            if f in seen:
                continue
            seen.add(f)
            try:
                full = Path(repo_path) / f
                if full.stat().st_size > 100_000:
                    continue
                content = full.read_text(encoding="utf-8", errors="ignore")
                if len(content) > max_bytes:
                    content = content[:max_bytes] + "\n/* ... truncated */"
                samples.append({"path": f, "content": content})
                if len(samples) >= max_files:
                    return samples
            except Exception:
                continue
    return samples
