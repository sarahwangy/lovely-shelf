import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

// .env.local 里需要：PEXELS_API_KEY 和 PIXABAY_API_KEY
const PEXELS_KEY  = process.env.PEXELS_API_KEY!;
const PIXABAY_KEY = process.env.PIXABAY_API_KEY!;

export type ImageResult = {
  id:       string;
  thumbUrl: string; // 缩略图，用于搜索结果网格
  fullUrl:  string; // 高清图，用于卡片背景
  author:   string;
  source:   "pexels" | "pixabay";
};

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const q      = request.nextUrl.searchParams.get("q") ?? "";
  const source = request.nextUrl.searchParams.get("source") ?? "pexels";

  if (!q.trim()) return NextResponse.json({ images: [] });

  if (source === "pexels") {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=12&orientation=portrait`,
      { headers: { Authorization: PEXELS_KEY } },
    );
    if (!res.ok) {
      console.error("[api/images/pexels]", res.status, await res.text());
      return NextResponse.json({ images: [], error: "Pexels 搜索失败" }, { status: 502 });
    }

    const data = (await res.json()) as {
      photos?: { id: number; src: { medium: string; large2x: string }; photographer: string }[];
    };

    const images: ImageResult[] = (data.photos ?? []).map((p) => ({
      id:       String(p.id),
      thumbUrl: p.src.medium,
      fullUrl:  p.src.large2x,  // large2x 比 large 更清晰
      author:   p.photographer,
      source:   "pexels",
    }));
    return NextResponse.json({ images });
  }

  // Pixabay：检测中文关键词，加 lang=zh 提升命中率
  const hasChinese = /[一-鿿]/.test(q);
  const pixabayUrl = `https://pixabay.com/api/?key=${PIXABAY_KEY}&q=${encodeURIComponent(q)}&image_type=photo&per_page=12&orientation=vertical${hasChinese ? "&lang=zh" : ""}`;
  const res = await fetch(pixabayUrl);
  if (!res.ok) {
    console.error("[api/images/pixabay]", res.status, await res.text());
    return NextResponse.json({ images: [], error: "Pixabay 搜索失败" }, { status: 502 });
  }

  const data = (await res.json()) as {
    hits?: { id: number; webformatURL: string; largeImageURL: string; user: string }[];
  };

  const images: ImageResult[] = (data.hits ?? []).map((h) => ({
    id:       String(h.id),
    thumbUrl: h.webformatURL,
    fullUrl:  h.largeImageURL,
    author:   h.user,
    source:   "pixabay",
  }));
  return NextResponse.json({ images });
}
