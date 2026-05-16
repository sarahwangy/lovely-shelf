import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

// 只允许代理 Jamendo 域下的音频（含所有子域名，如 prod-1.storage.jamendo.com）
function isJamendoUrl(hostname: string) {
  return hostname === "jamendo.com" || hostname.endsWith(".jamendo.com");
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return new NextResponse(null, { status: 401 });

  const raw = request.nextUrl.searchParams.get("url") ?? "";
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return new NextResponse("invalid url", { status: 400 });
  }

  if (!isJamendoUrl(parsed.hostname)) {
    return new NextResponse("url not allowed", { status: 403 });
  }

  // 服务端 fetch 不受浏览器 CORS 限制，拿到音频后原样转发给浏览器
  const upstream = await fetch(raw);
  if (!upstream.ok) return new NextResponse(null, { status: upstream.status });

  const headers = new Headers();
  headers.set("Content-Type", upstream.headers.get("Content-Type") ?? "audio/mpeg");
  headers.set("Access-Control-Allow-Origin", "*"); // 同源转发，允许 AudioContext 读取
  // 允许 Range 请求（浏览器 audio 元素需要）
  const contentLength = upstream.headers.get("Content-Length");
  if (contentLength) headers.set("Content-Length", contentLength);

  return new NextResponse(upstream.body, { headers });
}
