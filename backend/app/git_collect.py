"""Git 仓库元数据采集（subprocess 调 git，零依赖）"""
import re
import subprocess
from pathlib import Path

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
    """正则解析 import/require/from import，生成模块依赖边（替代 tree-sitter，Python 3.14 兼容）"""
    import re
    from pathlib import Path

    edges: set[tuple[str, str]] = set()

    def mod_of(filepath: str) -> str:
        return filepath.split("/")[0] if "/" in filepath else "root"

    for f in files:
        if not f.endswith((".ts", ".tsx", ".js", ".jsx", ".py")):
            continue
        try:
            content = (Path(repo_path) / f).read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        src = mod_of(f)
        targets: set[str] = set()
        # JS/TS: import/export ... from './...'
        for m in re.finditer(r"""(?:import|export)[^'"]*['"](\.{1,2}[^'"]+)['"]""", content):
            targets.add((m.group(1).lstrip("./") or src).split("/")[0])
        # JS require('./...')
        for m in re.finditer(r"""require\(['"](\.{1,2}[^'"]+)['"]\)""", content):
            targets.add((m.group(1).lstrip("./") or src).split("/")[0])
        # Python: from xxx import / import xxx
        for m in re.finditer(r"^(?:from\s+(\S+)\s+)?import\s+(\S+)", content, re.M):
            mod = (m.group(1) or m.group(2)).split(".")[0]
            if mod:
                targets.add(mod)
        for t in targets:
            if t and t != src:
                edges.add((src, t))
    return [{"source": s, "target": t} for s, t in edges]


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
