"""DeepSeek LLM 客户端（Anthropic 兼容端点，复用本机 COPILOT_PROVIDER_* 配置）"""
import json
import re

import httpx

from .config import settings


def chat(messages: list[dict], max_tokens: int = 8192) -> str:
    if not settings.llm_api_key:
        raise RuntimeError("COPILOT_PROVIDER_API_KEY 未设置")
    res = httpx.post(
        f"{settings.llm_base_url}/v1/messages",
        headers={
            "x-api-key": settings.llm_api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={"model": settings.llm_model, "max_tokens": max_tokens, "messages": messages},
        timeout=180,
    )
    res.raise_for_status()
    data = res.json()
    return "".join(
        c.get("text", "")
        for c in data.get("content", [])
        if c.get("type") == "text"
    )


def chat_json(messages: list[dict], max_tokens: int = 8192) -> dict:
    text = chat(messages, max_tokens)
    m = re.search(r"\{[\s\S]*\}", text)
    if not m:
        raise ValueError("LLM 响应未包含 JSON:\n" + text[:400])
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError:
        fixed = re.sub(r",(\s*[}\]])", r"\1", m.group(0))
        return json.loads(fixed)
