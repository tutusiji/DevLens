/**
 * DeepSeek LLM 客户端（Anthropic 兼容端点）
 * 读取本机环境变量 COPILOT_PROVIDER_* 配置（deepseek-v4-pro）
 * 零依赖，用 node 22 内置 fetch
 */

const BASE_URL =
  process.env.COPILOT_PROVIDER_BASE_URL || 'https://api.deepseek.com/anthropic';
const API_KEY = process.env.COPILOT_PROVIDER_API_KEY || '';
const MODEL = process.env.COPILOT_MODEL || 'deepseek-v4-pro';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** 调用 deepseek-v4-pro（Anthropic Messages 格式），返回文本（跳过 thinking） */
export async function chat(
  messages: ChatMessage[],
  maxTokens = 8192,
): Promise<string> {
  if (!API_KEY) throw new Error('COPILOT_PROVIDER_API_KEY 未设置');
  const res = await fetch(`${BASE_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, messages }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LLM API ${res.status}: ${errText.slice(0, 400)}`);
  }
  const data = await res.json();
  const text = (data.content || [])
    .filter((c: { type: string }) => c.type === 'text')
    .map((c: { text: string }) => c.text)
    .join('');
  return text;
}

/** 调用 LLM 并解析 JSON 输出（容错：提取首个 {...}，修复尾逗号） */
export async function chatJSON<T = unknown>(
  messages: ChatMessage[],
  maxTokens = 8192,
): Promise<T> {
  const text = await chat(messages, maxTokens);
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('LLM 响应未包含 JSON:\n' + text.slice(0, 400));
  }
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    const fixed = match[0].replace(/,(\s*[}\]])/g, '$1');
    return JSON.parse(fixed) as T;
  }
}

export const llmModel = MODEL;
