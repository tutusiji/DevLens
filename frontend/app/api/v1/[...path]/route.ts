/**
 * Next.js API 代理路由：/api/v1/* -> FastAPI(8000)
 * 这样 FastAPI 无需公网穿透，浏览器请求经 Next.js(devlens dev, 已穿透7200) 转发
 */
import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:8000';

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const target = `${BACKEND}/api/v1/${path.join('/')}${req.nextUrl.search}`;
  const identityHeaders: Record<string, string> = {};
  for (const header of ['x-devlens-user-id', 'x-devlens-tenant-id']) {
    const value = req.headers.get(header);
    if (value) identityHeaders[header] = value;
  }
  const init: RequestInit = {
    method: req.method,
    headers: {
      'content-type': req.headers.get('content-type') || 'application/json',
      ...identityHeaders,
    },
  };
  // 透传认证头（JWT Bearer），否则后端收不到登录态
  const auth = req.headers.get('authorization');
  if (auth) init.headers = { ...init.headers, authorization: auth };
  const cookie = req.headers.get('cookie');
  if (cookie) init.headers = { ...init.headers, cookie };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.text();
  }
  try {
    const res = await fetch(target, init);
    const headers = new Headers();
    res.headers.forEach((v, k) => {
      if (!['transfer-encoding', 'content-encoding'].includes(k.toLowerCase())) headers.set(k, v);
    });
    return new NextResponse(res.body, { status: res.status, headers });
  } catch (e) {
    return NextResponse.json({ error: 'backend unavailable', detail: String(e) }, { status: 502 });
  }
}

export const GET = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => proxy(req, ctx);
export const POST = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => proxy(req, ctx);
export const PATCH = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => proxy(req, ctx);
export const PUT = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => proxy(req, ctx);
export const DELETE = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => proxy(req, ctx);
