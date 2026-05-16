import { NextRequest } from "next/server";

// html2canvas 截图时，外部图片 URL 会跨域失败
// 这个代理把图片取回来变成同源响应，截图就能正常包含背景图
// 只允许代理 Pexels / Pixabay 的域名，防止被滥用当开放代理
const ALLOWED_HOSTS = [
  "images.pexels.com",
  "www.pexels.com",
  "pixabay.com",
  "cdn.pixabay.com",
];

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) return new Response("missing url", { status: 400 });

  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return new Response("invalid url", { status: 400 });
  }

  if (!ALLOWED_HOSTS.some((h) => hostname === h || hostname.endsWith("." + h))) {
    return new Response("host not allowed", { status: 403 });
  }

  const res = await fetch(url);
  if (!res.ok) return new Response("upstream error", { status: 502 });

  const buffer      = await res.arrayBuffer();
  const contentType = res.headers.get("content-type") ?? "image/jpeg";

  return new Response(buffer, {
    headers: {
      "Content-Type":  contentType,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
