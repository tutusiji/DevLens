"""统一的环境配置盘点扫描引擎。

以 Env Inventory 的扫描与增量 diff 约定为外部接口，同时合并原 Config
Scan 的深度解析能力：PyYAML 扁平化、docker-compose、nginx、连接串结构化
拆解、Spring/通用键路径聚合、指纹去重和密码脱敏。

``scan_repo(repo_path, only_files=None)`` 是唯一对外入口；返回扫描文件数及
可直接持久化到 ``env_inventory_entries`` 的 :class:`RawEntry` 列表。任何密码
仅在函数局部内存中短暂出现，``RawEntry.value`` 与 ``RawEntry`` 的结构化字段
均不包含明文密码。
"""
from __future__ import annotations

import hashlib
import os
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Optional
from urllib.parse import unquote, urlsplit

import yaml

# ============ 文件发现 ============

CONFIG_GLOBS = [
    ".env", ".env.*", "*.env", "env/*", "config/env*",
    "application*.yml", "application*.yaml", "application*.properties",
    "bootstrap*.yml", "bootstrap*.yaml", "bootstrap*.properties",
    "config/*.yml", "config/*.yaml", "config/*.properties",
    "config*.py", "settings*.py", "app/settings*", "config/settings*",
    "next.config.*", "nuxt.config.*", "vue.config.*", "webpack.config.*", "pm2*.json",
    "docker-compose*.yml", "docker-compose*.yaml", "Dockerfile", "k8s/*.yaml",
    "k8s/*.yml", "deploy/*.yml", "deploy/*.yaml", "values*.yaml", "values*.yml",
    "*.conf", "nginx.conf", "*.properties", ".npmrc", ".pypirc", ".gitconfig",
]
EXCLUDE_DIRS = {
    "node_modules", ".venv", "venv", "dist", "build", ".git", ".next", "target",
    "__pycache__", ".idea", ".vscode", "out", "coverage", ".turbo",
}
EXCLUDE_FILE_SUFFIXES = (".lock", ".min.js", ".min.css")
EXCLUDE_FILE_NAMES = {"package-lock.json", "pnpm-lock.yaml", "yarn.lock", "tsbuildinfo"}
MAX_FILE_BYTES = 500 * 1024
SOURCE_DOC_EXTS = {
    ".java", ".kt", ".scala", ".groovy", ".py", ".ts", ".tsx", ".js", ".jsx", ".mjs",
    ".cjs", ".go", ".rs", ".rb", ".php", ".c", ".cc", ".cpp", ".h", ".hpp", ".cs",
    ".swift", ".dart", ".vue", ".svelte", ".md", ".markdown", ".rst", ".adoc", ".sh",
    ".bash", ".zsh", ".bat", ".ps1", ".sql", ".html", ".htm", ".css", ".scss", ".sass",
    ".less", ".svg", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".woff", ".woff2",
    ".ttf", ".eot", ".pdf", ".zip", ".gz", ".tar", ".class", ".jar", ".war", ".pyc",
    ".so", ".dll", ".dylib", ".exe", ".bin",
}
CONFIG_TEXT_EXTS = {
    ".conf", ".cfg", ".ini", ".toml", ".properties", ".yml", ".yaml", ".env", ".json",
    ".xml", ".txt", ".config", ".props",
}
CONTENT_KEYWORD_RE = re.compile(
    r"(host|url|port|username|password|secret|token|key|database|redis|nacos|jdbc)", re.I
)


def _glob_match(pattern: str, path: str) -> bool:
    """仅支持单路径段 ``*`` 的 glob，避免 ``*`` 意外跨目录。"""
    pattern_parts, path_parts = pattern.split("/"), path.split("/")
    if len(pattern_parts) != len(path_parts):
        return False
    for pattern_part, path_part in zip(pattern_parts, path_parts):
        regex = "^" + re.escape(pattern_part).replace(r"\*", ".*") + "$"
        if not re.match(regex, path_part):
            return False
    return True


def _is_excluded(rel_path: str) -> bool:
    parts = rel_path.split("/")
    name = parts[-1] if parts else rel_path
    return (
        any(part in EXCLUDE_DIRS for part in parts)
        or name in EXCLUDE_FILE_NAMES
        or name.endswith(EXCLUDE_FILE_SUFFIXES)
    )


def _file_mtime(path: Path) -> str:
    try:
        return datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat()
    except OSError:
        return ""


def discover_config_files(repo_path: str) -> list[str]:
    """发现候选配置文件，包含显式 glob 和文本关键词补充识别。"""
    root = Path(repo_path)
    if not root.is_dir():
        return []
    found: list[str] = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [name for name in dirnames if name not in EXCLUDE_DIRS]
        for filename in filenames:
            full = Path(dirpath) / filename
            try:
                rel_path = full.relative_to(root).as_posix()
            except ValueError:
                continue
            if _is_excluded(rel_path) or full.stat().st_size > MAX_FILE_BYTES:
                continue
            if any(_glob_match(pattern, rel_path) for pattern in CONFIG_GLOBS):
                found.append(rel_path)
                continue
            if full.suffix.lower() in SOURCE_DOC_EXTS or full.suffix.lower() not in CONFIG_TEXT_EXTS:
                continue
            try:
                content = full.read_text(encoding="utf-8", errors="ignore")
            except OSError:
                continue
            if CONTENT_KEYWORD_RE.search(content):
                found.append(rel_path)
    return sorted(set(found))


# ============ 归属、分类与脱敏 ============

ENV_PATH_RULES = [
    (re.compile(r"(prod|production)", re.I), "prod"),
    (re.compile(r"(gray|grey|pre|canary)", re.I), "gray"),
    (re.compile(r"(test|stag|staging|sit|uat)", re.I), "test"),
    (re.compile(r"(dev|develop|local)", re.I), "dev"),
]
ENV_KEY_SUFFIX_RE = re.compile(r"_(PROD|PRODUCTION|GRAY|GREY|PRE|TEST|STAG|STAGING|SIT|UAT|DEV|DEVELOP|LOCAL)$")
ENV_SUFFIX_MAP = {
    "PROD": "prod", "PRODUCTION": "prod", "GRAY": "gray", "GREY": "gray", "PRE": "gray",
    "TEST": "test", "STAG": "test", "STAGING": "test", "SIT": "test", "UAT": "test",
    "DEV": "dev", "DEVELOP": "dev", "LOCAL": "dev",
}


def detect_env(file_path: str, key: str = "") -> str:
    """以路径为最高优先级，其次大写变量后缀；无明确标识时归到 common。"""
    for pattern, env in ENV_PATH_RULES:
        if pattern.search(file_path):
            return env
    match = ENV_KEY_SUFFIX_RE.search(key.upper())
    if match:
        return ENV_SUFFIX_MAP.get(match.group(1), "common")
    if key.upper().startswith("PROD_"):
        return "prod"
    if key.upper().startswith("TEST_"):
        return "test"
    return "common"


TOOL_KEY_RULES = [
    (re.compile(r"jdbc:mysql|mysql", re.I), "database", "mysql"),
    (re.compile(r"jdbc:postgresql|postgres", re.I), "database", "postgresql"),
    (re.compile(r"jdbc:oracle|oracle", re.I), "database", "oracle"),
    (re.compile(r"mongodb|mongo", re.I), "database", "mongodb"),
    (re.compile(r"redis", re.I), "redis", "redis"),
    (re.compile(r"nacos", re.I), "nacos", "nacos"),
    (re.compile(r"kafka|bootstrap[._-]servers", re.I), "kafka", "kafka"),
    (re.compile(r"rabbitmq|amqp|rocketmq", re.I), "mq", "rabbitmq"),
    (re.compile(r"elasticsearch|elastic", re.I), "es", "elasticsearch"),
    (re.compile(r"minio|oss|s3", re.I), "oss", "minio|oss"),
    (re.compile(r"gateway|zuul|spring\.cloud\.gateway", re.I), "gateway", "gateway"),
]
TOOL_VALUE_RULES = [
    (re.compile(r"jdbc:mysql", re.I), "database", "mysql"),
    (re.compile(r"jdbc:postgresql", re.I), "database", "postgresql"),
    (re.compile(r"mongodb://", re.I), "database", "mongodb"),
    (re.compile(r"redis://", re.I), "redis", "redis"),
    (re.compile(r"nacos://", re.I), "nacos", "nacos"),
    (re.compile(r"amqp://|rabbitmq", re.I), "mq", "rabbitmq"),
    (re.compile(r"kafka://", re.I), "kafka", "kafka"),
    (re.compile(r"elasticsearch://|elastic", re.I), "es", "elasticsearch"),
]


def classify_tool(key: str, value: str) -> tuple[str, str]:
    for pattern, tool_type, tool_name in TOOL_KEY_RULES:
        if pattern.search(key):
            return tool_type, tool_name
    for pattern, tool_type, tool_name in TOOL_VALUE_RULES:
        if pattern.search(value):
            return tool_type, tool_name
    first = re.split(r"[._-]", key, 1)[0]
    return "other", first.lower() if first else ""


SECRET_WORDS = {
    "password", "passwd", "secret", "pwd", "credential", "credentials", "passphrase", "token",
    "apikey", "accesskey", "privatekey", "secretkey", "authkey",
}
FLAG_PREFIXES = {"enable", "is", "has", "show", "use", "with", "need", "require", "allow", "support", "check", "verify"}
SECRET_COMPOUND_RE = re.compile(
    r"^(api[_-]?key|access[_-]?key|private[_-]?key|secret[_-]?key|client[_-]?secret|"
    r"auth[_-]?token|access[_-]?token|refresh[_-]?token|secret[_-]?id|app[_-]?secret|app[_-]?key)$",
    re.I,
)


def is_secret_key(key: str) -> bool:
    if not key:
        return False
    last_segment = key.rsplit(".", 1)[-1].lower()
    parts = re.split(r"[_-]", last_segment)
    if len(parts) > 1 and parts[0] in FLAG_PREFIXES:
        return False
    return any(part in SECRET_WORDS for part in parts) or bool(SECRET_COMPOUND_RE.match(last_segment))


def mask_password(password: str) -> str:
    """返回不可逆的展示掩码；长密码额外携带长度以辅助识别变更。"""
    if not password:
        return ""
    length = len(password)
    if length <= 2:
        return "****"
    if length > 8:
        return f"{password[0]}***{password[-1]}(len={length})"
    return f"{password[0]}{'*' * max(2, length - 2)}{password[-1]}"


def _mask_url_password(value: str) -> str:
    """仅替换 URL userinfo 的密码，不暴露任意长度的原文。"""
    def replace(match: re.Match[str]) -> str:
        return f"{match.group(1)}:{mask_password(match.group(2))}@{match.group(3)}"

    # 密码合法地允许包含 @，故密码段需贪婪匹配至最后一个 @（host 起点）。
    return re.sub(r"(://[^:/\s]+):(.+)@([^/\s]+)", replace, value, count=1)


def mask_value(value: str, secret_key: bool, userinfo: bool = False) -> str:
    """兼容旧扫描器调用的通用脱敏入口。"""
    if not value:
        return value
    if userinfo or re.search(r"://[^:/\s]+:[^@\s]+@", value):
        return _mask_url_password(value)
    return mask_password(value) if secret_key else value


RELEVANT_RE = re.compile(
    r"\b(host|url|port|username|password|passwd|secret|token|database|datasource|redis|nacos|jdbc|"
    r"bootstrap|kafka|rabbit|amqp|mongo|elastic|minio|oss|s3|gateway|endpoint|address)\b", re.I
)


def is_relevant(key: str, value: str, secret: bool, tool_type: str) -> bool:
    return secret or tool_type != "other" or bool(RELEVANT_RE.search(key) or RELEVANT_RE.search(value))


# ============ 原始输入与解析器 ============

@dataclass
class ParsedEntry:
    name: str
    raw_key: str
    value: str
    line_no: int = 0
    detail: dict[str, Any] = field(default_factory=dict)


@dataclass
class RawEntry:
    env: str
    tool_type: str
    tool_name: str
    key: str
    value: str
    is_secret: int
    source_file: str
    source_line: int
    file_mtime: str
    host: str = ""
    port: str = ""
    username: str = ""
    database: str = ""
    fingerprint: str = ""
    detail: dict[str, Any] = field(default_factory=dict)
    raw_value: str = ""  # 仅保留 API 兼容；扫描器不会把密码明文写入这里。


def _entry(name: str, raw_key: str, value: Any, line_no: int = 0, **extra: Any) -> ParsedEntry:
    detail = dict(extra.pop("detail", {}) or {})
    if extra.get("service"):
        detail["service"] = str(extra["service"])
    if extra.get("image"):
        detail["image"] = str(extra["image"])
    return ParsedEntry(name=name, raw_key=raw_key, value="" if value is None else str(value), line_no=line_no, detail=detail)


def parse_env_file(content: str) -> list[ParsedEntry]:
    entries: list[ParsedEntry] = []
    for line_no, line in enumerate(content.splitlines(), 1):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if stripped.startswith("export "):
            stripped = stripped[7:].lstrip()
        if "=" not in stripped:
            continue
        key, _, value = stripped.partition("=")
        key, value = key.strip(), _strip_quotes(value.strip())
        if key:
            entries.append(_entry(key, key, value, line_no))
    return entries


def parse_properties(content: str) -> list[ParsedEntry]:
    entries: list[ParsedEntry] = []
    for line_no, line in enumerate(content.splitlines(), 1):
        stripped = line.strip()
        if not stripped or stripped.startswith(("#", "!")):
            continue
        indexes = [index for index in (stripped.find("="), stripped.find(":")) if index >= 0]
        if not indexes:
            continue
        index = min(indexes)
        key, value = stripped[:index].strip(), stripped[index + 1:].strip()
        if key:
            entries.append(_entry(key, key, _strip_quotes(value), line_no))
    return entries


def _find_line_no(content: str, raw_key: str) -> int:
    """为 PyYAML 扁平条目补最佳来源行号；找不到时用 0 表示未知。"""
    leaf = raw_key.rsplit(".", 1)[-1]
    leaf = re.sub(r"\[\d+\]$", "", leaf)
    pattern = re.compile(rf"^\s*{re.escape(leaf)}\s*[:=]", re.I)
    for line_no, line in enumerate(content.splitlines(), 1):
        if pattern.search(line):
            return line_no
    return 0


def _flatten_yaml(obj: Any, prefix: str, output: list[ParsedEntry], content: str) -> None:
    if isinstance(obj, dict):
        for key, value in obj.items():
            nested_key = f"{prefix}.{key}" if prefix else str(key)
            _flatten_yaml(value, nested_key, output, content)
    elif isinstance(obj, list):
        for index, value in enumerate(obj):
            _flatten_yaml(value, f"{prefix}[{index}]", output, content)
    elif prefix:
        output.append(_entry(prefix, prefix, obj, _find_line_no(content, prefix)))


def parse_yaml(content: str) -> list[ParsedEntry]:
    """通过 ``yaml.safe_load`` 解析并扁平化为 ``a.b.c`` 键路径。"""
    try:
        data = yaml.safe_load(content)
    except yaml.YAMLError:
        return []
    output: list[ParsedEntry] = []
    _flatten_yaml(data, "", output, content)
    return output


def parse_docker_compose(content: str) -> list[ParsedEntry]:
    """解析 compose service 的 environment（map/list）及 image 辅助元数据。"""
    try:
        data = yaml.safe_load(content)
    except yaml.YAMLError:
        return []
    if not isinstance(data, dict) or not isinstance(data.get("services"), dict):
        return []
    output: list[ParsedEntry] = []
    for service, service_config in data["services"].items():
        if not isinstance(service_config, dict):
            continue
        image = str(service_config.get("image") or "")
        environment = service_config.get("environment") or {}
        pairs: list[tuple[str, str]] = []
        if isinstance(environment, dict):
            pairs = [(str(key), "" if value is None else str(value)) for key, value in environment.items()]
        elif isinstance(environment, list):
            for item in environment:
                text = str(item)
                if "=" in text:
                    key, _, value = text.partition("=")
                    pairs.append((key.strip(), value.strip()))
                elif text.strip():
                    pairs.append((text.strip(), ""))
        for key, value in pairs:
            output.append(_entry(
                key, f"services.{service}.environment.{key}", value,
                _find_line_no(content, key), service=str(service), image=image,
            ))
    return output


def parse_nginx(content: str) -> list[ParsedEntry]:
    output: list[ParsedEntry] = []
    for line_no, line in enumerate(content.splitlines(), 1):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        match = re.search(r"proxy_pass\s+https?://([^/;\s]+)", stripped)
        if match:
            hostport = match.group(1)
            output.append(_entry("proxy_pass", f"proxy_pass:{hostport}", hostport, line_no))
    return output


def parse_file(rel_path: str, content: str) -> list[ParsedEntry]:
    name = Path(rel_path).name.lower()
    if name == ".env" or name.startswith(".env") or name.endswith(".env"):
        return parse_env_file(content)
    if name.startswith("docker-compose"):
        return parse_docker_compose(content)
    if name.endswith(".properties"):
        return parse_properties(content)
    if name.endswith((".yml", ".yaml", ".json")):
        return parse_yaml(content)
    if name.endswith(".conf") or name == "nginx.conf":
        return parse_nginx(content)
    # .ini/.cfg/.npmrc 等键值配置也能按 properties 读取。
    return parse_properties(content)


# ============ 结构化连接信息抽取 ============

_URL_SCHEME_TOOL = {
    "mysql": "mysql", "postgresql": "postgresql", "postgres": "postgresql",
    "redis": "redis", "rediss": "redis", "mongodb": "mongo", "mongo": "mongo",
    "kafka": "kafka", "rabbitmq": "rabbitmq", "amqp": "rabbitmq",
}
_URL_RE = re.compile(r"^(jdbc:)?(mysql|postgresql|postgres|redis|rediss|mongodb|mongo|kafka|rabbitmq|amqp)://", re.I)
_GENERIC_FIELD_RES = [
    (re.compile(r"^(.*)_URL$"), "url"), (re.compile(r"^(.*)_HOST$"), "host"),
    (re.compile(r"^(.*)_PORT$"), "port"), (re.compile(r"^(.*)_USERNAME$"), "username"),
    (re.compile(r"^(.*)_USER$"), "username"), (re.compile(r"^(.*)_PASSWORD$"), "password"),
    (re.compile(r"^(.*)_PASS$"), "password"), (re.compile(r"^(.*)_PWD$"), "password"),
    (re.compile(r"^(.*)_DATABASE$"), "database"), (re.compile(r"^(.*)_DB$"), "database"),
    (re.compile(r"^(.*)_SERVER_ADDR$"), "hostport"),
    (re.compile(r"^(.*)_BOOTSTRAP_SERVERS$"), "hostport"), (re.compile(r"^(.*)_SERVERS$"), "hostport"),
]
_PREFIX_TOOL = {
    "REDIS": "redis", "MYSQL": "mysql", "POSTGRES": "postgresql", "POSTGRESQL": "postgresql",
    "MONGO": "mongo", "MONGODB": "mongo", "NACOS": "nacos", "KAFKA": "kafka",
    "RABBITMQ": "rabbitmq", "AMQP": "rabbitmq", "ELASTICSEARCH": "elasticsearch", "ES": "elasticsearch",
    "ROCKETMQ": "rocketmq",
}
_SPRING_FIELD_MAP = {
    "url": "url", "uri": "url", "host": "host", "port": "port", "username": "username",
    "user": "username", "name": "username", "password": "password", "pwd": "password",
    "database": "database", "db": "database", "server-addr": "hostport", "server_addr": "hostport",
    "server-address": "hostport", "bootstrap-servers": "hostport", "bootstrap_servers": "hostport",
    "uris": "hostport", "namespace": "detail.namespace", "group": "detail.group",
}
_IMAGE_TOOL = [
    ("postgres", "postgresql"), ("mysql", "mysql"), ("redis", "redis"), ("mongo", "mongo"),
    ("nacos", "nacos"), ("kafka", "kafka"), ("rabbitmq", "rabbitmq"), ("rocketmq", "rocketmq"),
    ("elasticsearch", "elasticsearch"),
]
STRUCTURED_TOOL_META = {
    "mysql": ("database", "mysql"), "postgresql": ("database", "postgresql"),
    "mongo": ("database", "mongodb"), "redis": ("redis", "redis"), "nacos": ("nacos", "nacos"),
    "kafka": ("kafka", "kafka"), "rabbitmq": ("mq", "rabbitmq"), "rocketmq": ("mq", "rocketmq"),
    "elasticsearch": ("es", "elasticsearch"), "other": ("other", ""),
}


def _strip_quotes(value: str) -> str:
    value = value.strip()
    return value[1:-1] if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"') else value


def _split_hostport(value: str) -> tuple[str, str]:
    value = _strip_quotes(value).split(",", 1)[0].strip()
    if "://" in value:
        value = value.split("://", 1)[1]
    value = value.split("/", 1)[0].split("?", 1)[0]
    if value.startswith("[") and "]" in value:  # IPv6 [::1]:6379
        host, _, rest = value.partition("]")
        return host[1:], rest.lstrip(":")
    if ":" in value:
        host, _, port = value.rpartition(":")
        return host.strip(), port.strip()
    return value.strip(), ""


def _parse_conn_url(value: str) -> dict[str, str] | None:
    """拆解 jdbc/mysql/postgresql/redis 等连接串，失败时不生成半残条目。"""
    value = _strip_quotes(value)
    match = _URL_RE.match(value)
    if not match:
        return None
    tool = _URL_SCHEME_TOOL[match.group(2).lower()]
    url = value[5:] if value.lower().startswith("jdbc:") else value
    try:
        parts = urlsplit(url)
        host, port = (parts.hostname or "").strip(), str(parts.port) if parts.port else ""
    except ValueError:
        return None
    if not host or "@" in host or " " in host:
        return None
    database = parts.path.lstrip("/").split("?", 1)[0].split("/", 1)[0] if parts.path else ""
    return {
        "tool_type": tool, "host": host, "port": port,
        "username": unquote(parts.username) if parts.username else "",
        "password": unquote(parts.password) if parts.password else "",
        "database": database,
    }


def fingerprint(tool_type: str, env: str, host: str, port: str, database: str, source_file: str) -> str:
    raw = f"{tool_type}|{env}|{host}|{port}|{database}|{source_file}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]


def _set_nested(group: dict[str, Any], field_name: str, value: str) -> None:
    if "." in field_name:
        root, rest = field_name.split(".", 1)
        group.setdefault(root, {})
        if isinstance(group[root], dict):
            group[root][rest] = value
    else:
        group[field_name] = value


def _classify_spring(key_lower: str) -> tuple[str, str, str] | None:
    field_name = _SPRING_FIELD_MAP.get(key_lower.rsplit(".", 1)[-1])
    if not field_name:
        return None
    if key_lower.startswith("spring.datasource."):
        return "spring.datasource", field_name, ""
    if key_lower.startswith(("spring.redis.", "spring.data.redis.")):
        return "spring.redis", field_name, "redis"
    if key_lower.startswith(("spring.cloud.nacos.", "nacos.")):
        return "spring.cloud.nacos", field_name, "nacos"
    if key_lower.startswith("spring.kafka."):
        return "spring.kafka", field_name, "kafka"
    if key_lower.startswith(("spring.elasticsearch.", "elasticsearch.")):
        return "spring.elasticsearch", field_name, "elasticsearch"
    return None


def _classify_generic(name: str) -> tuple[str, str] | None:
    for regex, field_name in _GENERIC_FIELD_RES:
        match = regex.match(name.upper())
        if match:
            return match.group(1), field_name
    return None


def _tool_from_image(image: str) -> str | None:
    lowercase = image.lower()
    return next((tool for keyword, tool in _IMAGE_TOOL if keyword in lowercase), None)


def _group_to_item(source_file: str, env: str, group: dict[str, Any]) -> dict[str, Any] | None:
    host, port = group.get("host") or "", group.get("port") or ""
    if group.get("hostport") and not host:
        host, port = _split_hostport(str(group["hostport"]))
    if group.get("url"):
        parsed = _parse_conn_url(str(group["url"]))
        if parsed:
            host, port = parsed["host"] or host, parsed["port"] or port
            for field_name in ("database", "username", "password"):
                if parsed[field_name]:
                    group.setdefault(field_name, parsed[field_name])
            group["tool_type"] = parsed["tool_type"]
    if not host:
        return None
    return {
        "tool_type": group.get("tool_type") or "other", "env": env, "host": host, "port": port,
        "username": group.get("username") or "", "password": group.get("password") or "",
        "database": group.get("database") or "", "source_file": source_file,
        "raw_key": group.get("raw_key") or "", "line_no": group.get("line_no") or 0,
        "detail": group.get("detail") or {}, "source_value": group.get("url") or group.get("hostport") or "",
        "consumed_keys": set(group.get("consumed_keys") or set()),
    }


def _add_to_group(group: dict[str, Any], field_name: str, parsed: ParsedEntry) -> None:
    _set_nested(group, field_name, parsed.value)
    group.setdefault("raw_key", parsed.raw_key)
    group["line_no"] = group.get("line_no") or parsed.line_no
    group.setdefault("consumed_keys", set()).add(parsed.name)
    if parsed.detail:
        group.setdefault("detail", {}).update(parsed.detail)


def _extract_items(source_file: str, entries: list[ParsedEntry]) -> tuple[list[dict[str, Any]], set[str]]:
    """组合相邻连接键为一条配置项，并返回已被组合消费的原始键名。"""
    items: list[dict[str, Any]] = []
    consumed_indices: set[int] = set()
    consumed_names: set[str] = set()

    spring_groups: dict[tuple[str, str], dict[str, Any]] = {}
    for index, parsed in enumerate(entries):
        classification = _classify_spring(parsed.name.lower())
        if not classification:
            continue
        prefix, field_name, tool_type = classification
        env = detect_env(source_file, parsed.name)
        group = spring_groups.setdefault((prefix, env), {"tool_type": tool_type})
        _add_to_group(group, field_name, parsed)
        consumed_indices.add(index)
    for (_, env), group in spring_groups.items():
        group.setdefault("tool_type", "mysql")
        item = _group_to_item(source_file, env, group)
        if item:
            items.append(item)
            consumed_names.update(item["consumed_keys"])

    generic_groups: dict[tuple[str, str, str], dict[str, Any]] = {}
    for index, parsed in enumerate(entries):
        if index in consumed_indices:
            continue
        # proxy_pass 的 ``_pass`` 后缀不是密码字段，应留给 nginx 专用解析分支。
        if parsed.name == "proxy_pass":
            continue
        classification = _classify_generic(parsed.name)
        if not classification:
            continue
        prefix, field_name = classification
        env = detect_env(source_file, parsed.name)
        tool_type = _PREFIX_TOOL.get(prefix, "mysql")
        group = generic_groups.setdefault((tool_type, prefix, env), {"tool_type": tool_type})
        _add_to_group(group, field_name, parsed)
        image = str(parsed.detail.get("image") or "")
        if image:
            group.setdefault("image_tool", _tool_from_image(image))
        consumed_indices.add(index)
    for (tool_type, _, env), group in generic_groups.items():
        if tool_type == "mysql" and group.get("image_tool") and not group.get("url"):
            group["tool_type"] = group["image_tool"]
        item = _group_to_item(source_file, env, group)
        if item:
            items.append(item)
            consumed_names.update(item["consumed_keys"])

    for index, parsed in enumerate(entries):
        if index in consumed_indices:
            continue
        env = detect_env(source_file, parsed.name)
        if parsed.name == "proxy_pass":
            host, port = _split_hostport(parsed.value)
            if host:
                items.append({
                    "tool_type": "other", "env": env, "host": host, "port": port, "username": "",
                    "password": "", "database": "", "source_file": source_file, "raw_key": parsed.raw_key,
                    "line_no": parsed.line_no, "detail": parsed.detail, "source_value": parsed.value,
                    "consumed_keys": {parsed.name},
                })
                consumed_names.add(parsed.name)
            continue
        structured = _parse_conn_url(parsed.value)
        if structured:
            items.append({
                **structured, "env": env, "source_file": source_file, "raw_key": parsed.raw_key,
                "line_no": parsed.line_no, "detail": parsed.detail, "source_value": parsed.value,
                "consumed_keys": {parsed.name},
            })
            consumed_names.add(parsed.name)
    return items, consumed_names


def _dedup_items(items: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    """按 ``tool+env+host+port+database+source_file`` 指纹去重并合并附加字段。"""
    deduped: dict[str, dict[str, Any]] = {}
    for item in items:
        item = dict(item)
        item["fingerprint"] = fingerprint(
            item["tool_type"], item["env"], item["host"], item["port"], item["database"], item["source_file"]
        )
        existing = deduped.get(item["fingerprint"])
        if not existing:
            deduped[item["fingerprint"]] = item
            continue
        for field_name in ("username", "password", "database", "source_value"):
            if not existing.get(field_name) and item.get(field_name):
                existing[field_name] = item[field_name]
        existing.setdefault("detail", {}).update(item.get("detail") or {})
        existing.setdefault("consumed_keys", set()).update(item.get("consumed_keys") or set())
    return list(deduped.values())


def _structured_value(item: dict[str, Any]) -> str:
    """生成可展示/可 diff 的脱敏值，确保不落盘密码明文。"""
    source_value = str(item.get("source_value") or "")
    password = str(item.get("password") or "")
    if source_value and "://" in source_value:
        return _mask_url_password(source_value) if password else source_value
    endpoint = item["host"] + (f":{item['port']}" if item.get("port") else "")
    parts = [endpoint]
    if item.get("database"):
        parts.append(f"db={item['database']}")
    if item.get("username"):
        parts.append(f"user={item['username']}")
    if password:
        parts.append(f"password={mask_password(password)}")
    return " · ".join(parts)


def _raw_from_structured(item: dict[str, Any], file_mtime: str) -> RawEntry:
    raw_tool = item["tool_type"]
    tool_type, tool_name = STRUCTURED_TOOL_META.get(raw_tool, ("other", raw_tool))
    password = str(item.get("password") or "")
    return RawEntry(
        env=item["env"], tool_type=tool_type, tool_name=tool_name, key=item["raw_key"],
        value=_structured_value(item), is_secret=1 if password else 0, source_file=item["source_file"],
        source_line=int(item.get("line_no") or 0), file_mtime=file_mtime, host=item["host"],
        port=item["port"], username=item.get("username") or "", database=item.get("database") or "",
        fingerprint=item["fingerprint"], detail=item.get("detail") or {}, raw_value="",
    )


def _legacy_entry(parsed: ParsedEntry, rel_path: str, file_mtime: str) -> RawEntry | None:
    """保留未被结构化聚合的 Env Inventory 条目，避免丢失 token/gateway 等配置。"""
    tool_type, tool_name = classify_tool(parsed.name, parsed.value)
    secret = is_secret_key(parsed.name)
    if not is_relevant(parsed.name, parsed.value, secret, tool_type):
        return None
    masked = mask_value(parsed.value, secret)
    legacy_fingerprint = hashlib.sha1(
        f"legacy|{rel_path}|{parsed.name}|{parsed.line_no}".encode("utf-8")
    ).hexdigest()[:16]
    return RawEntry(
        env=detect_env(rel_path, parsed.name), tool_type=tool_type, tool_name=tool_name, key=parsed.raw_key,
        value=masked, is_secret=1 if secret else 0, source_file=rel_path, source_line=parsed.line_no,
        file_mtime=file_mtime, fingerprint=legacy_fingerprint, detail=parsed.detail, raw_value="",
    )


def extract_entries(content: str, rel_path: str, file_mtime: str) -> list[RawEntry]:
    """解析单文件，优先输出去重后的结构化连接条目，再补未消费的常规配置项。"""
    parsed_entries = parse_file(rel_path, content)
    structured_items, consumed_names = _extract_items(rel_path, parsed_entries)
    output = [_raw_from_structured(item, file_mtime) for item in _dedup_items(structured_items)]
    for parsed in parsed_entries:
        if parsed.name in consumed_names:
            continue
        legacy = _legacy_entry(parsed, rel_path, file_mtime)
        if legacy:
            output.append(legacy)
    # 一个文件中相同 key 取最后一个，结构化条目按 fingerprint 保留。
    deduped: dict[tuple[str, str, int, str], RawEntry] = {}
    for entry in output:
        deduped[(entry.source_file, entry.key, entry.source_line, entry.fingerprint)] = entry
    return list(deduped.values())


def scan_repo(repo_path: str, only_files: Optional[set[str]] = None) -> tuple[int, list[RawEntry]]:
    """扫描仓库；增量模式仅重扫 ``only_files`` 中仍存在的相对路径。"""
    root = Path(repo_path)
    if not root.is_dir():
        return 0, []
    if only_files is None:
        targets = discover_config_files(repo_path)
    else:
        targets = sorted(path for path in only_files if (root / path).is_file())

    entries: list[RawEntry] = []
    scanned = 0
    for rel_path in targets:
        full = root / rel_path
        try:
            if full.stat().st_size > MAX_FILE_BYTES:
                continue
            content = full.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        scanned += 1
        entries.extend(extract_entries(content, rel_path, _file_mtime(full)))
    return scanned, entries
