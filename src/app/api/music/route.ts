import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

// 需要在 .env.local 里添加：JAMENDO_CLIENT_ID=你的client_id
// 免费注册：https://devportal.jamendo.com/
const JAMENDO_CLIENT_ID = process.env.JAMENDO_CLIENT_ID!;

export type MusicResult = {
  id:         string;
  title:      string;
  duration:   number;   // 秒
  previewUrl: string;   // MP3 直链，可直接播放 / 混入录制
  author:     string;
};

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  if (!JAMENDO_CLIENT_ID) {
    return NextResponse.json({ music: [], error: "未配置 JAMENDO_CLIENT_ID，请在 .env.local 里添加" }, { status: 500 });
  }

  const q = request.nextUrl.searchParams.get("q") ?? "";
  if (!q.trim()) return NextResponse.json({ music: [] });

  // Jamendo 音乐搜索 API：免费版权音乐，按关键词搜索曲目
  // audioformat=mp32 → 返回 128kbps MP3 直链（适合浏览器播放）
  const url = new URL("https://api.jamendo.com/v3.0/tracks/");
  url.searchParams.set("client_id",   JAMENDO_CLIENT_ID);
  url.searchParams.set("format",      "json");
  url.searchParams.set("limit",       "8");
  url.searchParams.set("search",      q);
  url.searchParams.set("audioformat", "mp32");
  url.searchParams.set("include",     "musicinfo");

  const res = await fetch(url.toString());

  if (!res.ok) {
    console.error("[api/music/jamendo]", res.status, await res.text());
    return NextResponse.json({ music: [], error: `Jamendo 搜索失败（${res.status}）` }, { status: 502 });
  }

  const data = (await res.json()) as {
    results?: {
      id:          string;
      name:        string;
      duration:    number;
      audio:       string;   // MP3 直链
      artist_name: string;
    }[];
  };

  const music: MusicResult[] = (data.results ?? []).flatMap((t) => {
    if (!t.audio) return [];
    return [{
      id:         t.id,
      title:      t.name || "(未命名)",
      duration:   t.duration ?? 0,
      previewUrl: t.audio,
      author:     t.artist_name || "",
    }];
  });

  return NextResponse.json({ music });
}
