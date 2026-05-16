import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

const PEXELS_KEY  = process.env.PEXELS_API_KEY!;
const PIXABAY_KEY = process.env.PIXABAY_API_KEY!;

export type VideoResult = {
  id:       string;
  thumbUrl: string; // 封面图，用于结果网格
  videoUrl: string; // .mp4 直链，用于播放
  author:   string;
  source:   "pexels" | "pixabay";
};

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const q      = request.nextUrl.searchParams.get("q") ?? "";
  const source = request.nextUrl.searchParams.get("source") ?? "pexels";

  if (!q.trim()) return NextResponse.json({ videos: [] });

  if (source === "pexels") {
    const res = await fetch(
      `https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&per_page=6&orientation=portrait`,
      { headers: { Authorization: PEXELS_KEY } },
    );
    if (!res.ok) {
      console.error("[api/videos/pexels]", res.status, await res.text());
      return NextResponse.json({ videos: [], error: "Pexels 视频搜索失败" }, { status: 502 });
    }
    const data = (await res.json()) as {
      videos?: {
        id: number;
        image: string;
        video_files: { link: string; quality: string; width: number; height: number }[];
        user: { name: string };
      }[];
    };

    const videos: VideoResult[] = (data.videos ?? []).flatMap((v) => {
      // 优先选竖向（portrait）高清文件
      const file =
        v.video_files.filter((f) => f.height >= f.width).sort((a, b) => b.height - a.height)[0] ??
        v.video_files.sort((a, b) => b.height - a.height)[0];
      if (!file?.link) return [];
      return [{
        id:       String(v.id),
        thumbUrl: v.image,
        videoUrl: file.link,
        author:   v.user.name,
        source:   "pexels",
      }];
    });
    return NextResponse.json({ videos });
  }

  // Pixabay 视频（中文关键词加 lang=zh）
  const hasChinese = /[一-鿿]/.test(q);
  const res = await fetch(
    `https://pixabay.com/api/videos/?key=${PIXABAY_KEY}&q=${encodeURIComponent(q)}&per_page=6${hasChinese ? "&lang=zh" : ""}`,
  );
  if (!res.ok) {
    console.error("[api/videos/pixabay]", res.status, await res.text());
    return NextResponse.json({ videos: [], error: "Pixabay 视频搜索失败" }, { status: 502 });
  }
  const data = (await res.json()) as {
    hits?: {
      id: number;
      videos: {
        large?:  { url: string; thumbnail: string };
        medium?: { url: string; thumbnail: string };
        small?:  { url: string; thumbnail: string };
      };
      user: string;
    }[];
  };

  const videos: VideoResult[] = (data.hits ?? []).flatMap((h) => {
    const v = h.videos.large ?? h.videos.medium ?? h.videos.small;
    if (!v?.url) return [];
    return [{
      id:       String(h.id),
      thumbUrl: v.thumbnail,
      videoUrl: v.url,
      author:   h.user,
      source:   "pixabay",
    }];
  });
  return NextResponse.json({ videos });
}
