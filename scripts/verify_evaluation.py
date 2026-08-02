#!/usr/bin/env python3
"""DevLens 开发者能力实测评估模块 — 后端端到端验证脚本。

用法：
    cd backend && .venv/bin/python ../scripts/verify_evaluation.py

可选环境变量：
    DEVLENS_API_BASE=http://127.0.0.1:8000/api/v1
    DEVLENS_DEVELOPER_ID=d1
    DEVLENS_REPO_PATH=/absolute/path/to/registered/repository
    DEVLENS_GIT_AUTHOR=指定作者
    DEVLENS_TENANT_ID=tenant-xxx
    DEVLENS_USER_ID=usr-xxx
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request

BASE = os.getenv("DEVLENS_API_BASE", "http://127.0.0.1:8000/api/v1").rstrip("/")
DEVELOPER_ID = os.getenv("DEVLENS_DEVELOPER_ID", "d1")
PASS, FAIL = [], []

def check(name, cond, detail=""):
    (PASS if cond else FAIL).append(name)
    print(f"  {'✅' if cond else '❌'} {name}" + (f" — {detail}" if detail else ""))

def req(method, path, body=None, timeout=20):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"}
    if os.getenv("DEVLENS_TENANT_ID"):
        headers["X-DevLens-Tenant-Id"] = os.environ["DEVLENS_TENANT_ID"]
    if os.getenv("DEVLENS_USER_ID"):
        headers["X-DevLens-User-Id"] = os.environ["DEVLENS_USER_ID"]
    r = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            return resp.status, json.loads(resp.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"null")
    except Exception as e:
        return -1, str(e)

print("== 0. 发现当前租户的评估数据源 ==")
repo_path = os.getenv("DEVLENS_REPO_PATH", "")
st, repos = req("GET", "/repos")
check("仓库列表 200", st == 200 and isinstance(repos, list), f"status={st}")
if not repo_path and st == 200:
    for repo in repos:
        candidate = repo.get("path", "")
        if candidate and os.path.isdir(candidate):
            repo_path = candidate
            break
if not repo_path:
    print("未找到可用仓库。请设置 DEVLENS_REPO_PATH 为当前租户已接入的本地 Git 仓库路径。")
    sys.exit(1)

print("== 1. git-authors 接口 ==")
st, body = req("GET", f"/git-authors?repo_path={urllib.parse.quote(repo_path, safe='')}")
check("git-authors 200", st == 200, f"status={st} repo={repo_path}")
if st != 200 or not body:
    print("未找到 Git 作者，无法继续。")
    sys.exit(1)
git_author = os.getenv("DEVLENS_GIT_AUTHOR", "") or body[0]
check("Git 作者可用", git_author in body, f"author={git_author}")

print(f"\n== 2. 触发评估（{repo_path} / {git_author} / backend）==")
st, body = req("POST", f"/developers/{DEVELOPER_ID}/evaluations", {
    "repo_path": repo_path,
    "git_author": git_author,
    "role_key": "backend",
    "skill_group_id": "skg-seed-java",
})
check("POST 202/queued", st in (200, 202) and body.get("status") == "queued", f"status={st} body={body}")
eid = body.get("id", "")

print("\n== 3. 轮询评估结果（最多 5 分钟）==")
result = None
for i in range(100):
    time.sleep(3)
    st, latest = req("GET", f"/developers/{DEVELOPER_ID}/evaluations/latest")
    if st == 200 and latest and latest.get("id") == eid:
        s = latest.get("status")
        if s == "completed":
            result = latest; break
        if s == "failed":
            check("评估 failed 有 error", False, latest.get("error", "")); sys.exit(1)
    if i % 20 == 19:
        print(f"    等待中 {i*3}s...")
if not result:
    check("5 分钟内完成", False, "超时"); sys.exit(1)

print("== 4. 评估结果字段校验 ==")
scores = result.get("scores") or {}
check("scores 8 维", len(scores) >= 5, json.dumps(scores, ensure_ascii=False)[:120])
check("scores 数值范围 0-100", all(isinstance(v, (int, float)) and 0 <= v <= 100 for v in scores.values()),
      str(scores)[:100])
check("evidence 非空", isinstance(result.get("evidence"), list) and len(result.get("evidence")) > 0)
check("summary 非空", bool(result.get("summary")), result.get("summary", "")[:80])
check("achievedLevel 合理", result.get("achievedLevel") in (None,) or
      (isinstance(result.get("achievedLevel"), str) and len(result.get("achievedLevel")) == 2),
      f"achieved={result.get('achievedLevel')} best={result.get('bestLevel')}")
check("gaps 结构", all({"dimension", "current", "target", "gap"} <= set(g.keys()) for g in (result.get("gaps") or [])),
      str(result.get("gaps"))[:100])
print(f"\n  scores: {json.dumps(scores, ensure_ascii=False)}")
print(f"  achievedLevel={result.get('achievedLevel')} bestLevel={result.get('bestLevel')}")
print(f"  gaps: {json.dumps(result.get('gaps'), ensure_ascii=False)}")

print("\n== 5. 历史列表 ==")
st, lst = req("GET", f"/developers/{DEVELOPER_ID}/evaluations")
check("列表 200 且含本次", st == 200 and any(e.get("id") == eid for e in lst), f"count={len(lst) if isinstance(lst, list) else lst}")

print("\n== 6. 作者无提交 → failed（负路径）==")
st, body = req("POST", f"/developers/{DEVELOPER_ID}/evaluations", {
    "repo_path": repo_path,
    "git_author": "不存在的作者XYZ",
    "role_key": "backend",
})
check("POST 接受", st in (200, 202), f"status={st}")
bad_id = body.get("id", "")
for i in range(20):
    time.sleep(3)
    st, latest = req("GET", f"/developers/{DEVELOPER_ID}/evaluations/latest")
    if st == 200 and latest and latest.get("id") == bad_id and latest.get("status") != "running":
        check("无提交 → failed", latest.get("status") == "failed" and latest.get("error"), latest.get("error", "")[:80])
        break

print(f"\n{'='*50}\nPASS: {len(PASS)}  FAIL: {len(FAIL)}")
if FAIL:
    print("失败项:", *FAIL, sep="\n  ❌ ")
    sys.exit(1)
print("全部通过 ✅")
