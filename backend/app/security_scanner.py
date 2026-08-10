"""静态安全扫描：在 clone 后的代码库中识别可解释的安全风险。

零依赖、基于文件内容的模式匹配，不引入 tree-sitter / semgrep 等重量级依赖。
覆盖三类最常见问题：
- 硬编码密钥 / 凭证（Token、Password、API Key）
- 危险函数调用（eval/exec/shell 拼接/SQL 拼接等）
- 明显可被利用的配置（DEBUG=True、CORS 放开等）

输出与 AI Review 的 Insight 形状一致，可直接并入项目分析结果。
"""
import re
from pathlib import Path

# 常见密钥/凭证环境变量与赋值模式
SECRET_PATTERNS = [
    (re.compile(r'(?:api[_-]?key|access[_-]?key|secret[_-]?key|token)\s*[:=]\s*["\'][A-Za-z0-9_\-]{16,}["\']', re.I), "疑似硬编码密钥"),
    (re.compile(r'password\s*[:=]\s*["\'][^"\']{6,}["\']', re.I), "疑似硬编码密码"),
    (re.compile(r'(?:sk|ghp|glpat|ghs)_[A-Za-z0-9]{20,}', re.I), "疑似泄露的 API Token"),
    (re.compile(r'BEGIN (?:RSA|OPENSSH|EC) PRIVATE KEY'), "疑似泄露的私钥"),
]

# 危险函数/调用模式
DANGEROUS_PATTERNS = [
    (re.compile(r'\beval\s*\(', re.I), "使用 eval 执行动态代码"),
    (re.compile(r'\bexec\s*\(|child_process\.exec\b', re.I), "执行系统命令"),
    (re.compile(r'os\.system\s*\(', re.I), "os.system 执行 shell 命令"),
    (re.compile(r'subprocess\.(?:call|run|Popen)\([^)]*shell\s*=\s*True', re.I), "shell=True 存在命令注入风险"),
    (re.compile(r'(?:execute|executemany)\s*\(\s*f["\']|\.format\([^)]*\)\s*\)\s*;?\s*$|%s?["\'].*execute', re.I), "疑似 SQL 拼接"),
    (re.compile(r'innerHTML\s*=.*(?:user|input|query|name)', re.I), "innerHTML 注入（XSS）"),
]

# 危险配置
CONFIG_PATTERNS = [
    (re.compile(r'DEBUG\s*=\s*True', re.I), "生产环境开启 DEBUG"),
    (re.compile(r'CORS_ALLOW_ALL_ORIGINS\s*=\s*True', re.I), "CORS 允许所有来源"),
    (re.compile(r"Access-Control-Allow-Origin:\s*\*", re.I), "CORS 响应头放开"),
    (re.compile(r'ALLOWED_HOSTS\s*=\s*\[?\s*["\']\*["\']', re.I), "ALLOWED_HOSTS 允许任意域名"),
]

# 常见硬编码密钥环境变量名
SECRET_ENV_NAMES = {
    "password", "passwd", "pwd", "secret", "token", "apikey", "api_key",
    "access_key", "secret_key", "private_key", "client_secret",
}


def _scan_file(path: Path, relative: str, max_bytes: int = 200_000) -> list[dict]:
    """扫描单个文件，返回风险命中列表。"""
    try:
        if path.stat().st_size > max_bytes:
            return []
        content = path.read_text(encoding="utf-8", errors="ignore")
    except (OSError, ValueError):
        return []

    findings: list[dict] = []
    lowered = content.lower()
    # 跳过纯 .env.example / 文档 / 锁文件中的占位值
    if any(k in relative.lower() for k in (".example", ".sample", ".md", ".lock", ".json", "readme")):
        pass

    for pattern, title in SECRET_PATTERNS:
        m = pattern.search(content)
        if m:
            line_no = content[: m.start()].count("\n") + 1
            findings.append({
                "category": "security",
                "severity": "critical" if "private key" in title.lower() else "high",
                "title": title,
                "evidence": f"{relative}:{line_no}",
                "file_path": relative,
                "start_line": line_no,
            })

    for pattern, title in DANGEROUS_PATTERNS:
        m = pattern.search(content)
        if m:
            line_no = content[: m.start()].count("\n") + 1
            findings.append({
                "category": "security",
                "severity": "high",
                "title": title,
                "evidence": f"{relative}:{line_no}",
                "file_path": relative,
                "start_line": line_no,
            })

    # 环境变量赋值：KEY=value 且 KEY 属于敏感名且值非占位
    for line_no, line in enumerate(content.splitlines(), 1):
        m = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([\"']?[^\s\"']+[\"']?)$", line.strip())
        if not m:
            continue
        key, value = m.group(1), m.group(2).strip("'\"")
        if key.lower() in SECRET_ENV_NAMES and len(value) >= 8 and value not in {"changeme", "password", "secret", "12345678"}:
            findings.append({
                "category": "security",
                "severity": "medium",
                "title": f"环境变量 {key} 疑似硬编码",
                "evidence": f"{relative}:{line_no}",
                "file_path": relative,
                "start_line": line_no,
            })
            break

    for pattern, title in CONFIG_PATTERNS:
        m = pattern.search(content)
        if m:
            line_no = content[: m.start()].count("\n") + 1
            findings.append({
                "category": "configuration",
                "severity": "medium",
                "title": title,
                "evidence": f"{relative}:{line_no}",
                "file_path": relative,
                "start_line": line_no,
            })
    return findings


def scan_repository(repo_path: str, meta: dict, max_files: int = 200) -> list[dict]:
    """扫描仓库中的安全风险，返回 findings（与 Insight 形状兼容）。"""
    code_files = meta.get("codeFiles") or []
    findings: list[dict] = []
    scanned = 0
    for f in code_files:
        if scanned >= max_files:
            break
        full = Path(repo_path) / f
        if not full.is_file():
            continue
        findings.extend(_scan_file(full, f))
        scanned += 1
    # 按严重级别排序，最多返回 20 条，避免刷屏
    severity_rank = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    findings.sort(key=lambda x: severity_rank.get(x.get("severity"), 9))
    return findings[:20]
