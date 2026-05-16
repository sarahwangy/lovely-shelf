import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { NOTION_FIELDS } from "@/lib/notion-fields";
import type { BookSummary } from "@/types/book";

const NOTION_TOKEN = process.env.NOTION_TOKEN!;
const DATABASE_ID = process.env.NOTION_DATABASE_ID!;

// 统计数据结构（前端 Dashboard 用）
export type StatsData = {
  total: number;
  genres: { name: string; count: number; percentage: number }[];
  topGenres: { name: string; count: number; percentage: number }[];
  countries: { name: string; count: number }[];
  authors: { name: string; count: number }[];       // 出现最多的作者（热词云用）
  thisYear: { total: number; byMonth: number[] };   // byMonth[0] = 1月，byMonth[11] = 12月
  recentActivity: { date: string; count: number }[]; // 最近 30 天每日入库数
  latest: BookSummary[];                             // 最近 5 本入库
};

// 内存缓存：60 秒内复用上次的计算结果，避免每次进 Dashboard 都全量拉 Notion
// 行业常见做法：简单的"memoize with TTL"，生产环境可换成 Redis
let cache: { data: StatsData; expiresAt: number } | null = null;

// 全量拉取 Notion 数据库的所有页面（处理分页）
async function fetchAllPages() {
  const pages: {
    id: string;
    created_time: string;
    properties: Record<string, {
      title?: { plain_text: string }[];
      rich_text?: { plain_text: string }[];
      select?: { name: string } | null;
      multi_select?: { name: string }[];
      files?: { file?: { url: string }; external?: { url: string } }[];
    }>;
  }[] = [];

  let cursor: string | undefined;

  do {
    const body: Record<string, unknown> = {
      page_size: 100,
      sorts: [{ timestamp: "created_time", direction: "descending" }],
    };
    if (cursor) body.start_cursor = cursor;

    const res = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`Notion 查询失败：${await res.text()}`);

    const data = await res.json() as {
      results: typeof pages;
      has_more: boolean;
      next_cursor: string | null;
    };

    pages.push(...data.results);
    cursor = data.has_more && data.next_cursor ? data.next_cursor : undefined;
  } while (cursor);

  return pages;
}

function computeStats(pages: Awaited<ReturnType<typeof fetchAllPages>>): StatsData {
  const total = pages.length;
  const thisYear = new Date().getFullYear();
  const today = new Date();

  // 按类型统计
  const genreMap   = new Map<string, number>();
  // 按国家统计
  const countryMap = new Map<string, number>();
  // 按作者统计（热词云用）
  const authorMap  = new Map<string, number>();
  // 今年每月入库数（index 0 = 1月）
  const byMonth = Array(12).fill(0);
  // 最近 30 天每日入库（key = "YYYY-MM-DD"）
  const dailyMap = new Map<string, number>();

  for (const page of pages) {
    const props = page.properties;

    // 类型标签（multi_select）
    const genres = props[NOTION_FIELDS.genres]?.multi_select ?? [];
    for (const g of genres) {
      genreMap.set(g.name, (genreMap.get(g.name) ?? 0) + 1);
    }

    // 国家（select）
    const country = props[NOTION_FIELDS.country]?.select?.name;
    if (country) countryMap.set(country, (countryMap.get(country) ?? 0) + 1);

    // 作者（rich_text，取第一段）
    const author = props[NOTION_FIELDS.author]?.rich_text?.[0]?.plain_text?.trim();
    if (author) authorMap.set(author, (authorMap.get(author) ?? 0) + 1);

    // 入库时间
    const created = new Date(page.created_time);
    if (created.getFullYear() === thisYear) {
      byMonth[created.getMonth()]++;
    }

    // 最近 30 天
    const diffDays = Math.floor((today.getTime() - created.getTime()) / 86400000);
    if (diffDays < 30) {
      const dateKey = created.toISOString().slice(0, 10);
      dailyMap.set(dateKey, (dailyMap.get(dateKey) ?? 0) + 1);
    }
  }

  // 类型排序（多 → 少）
  const genres = [...genreMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({
      name,
      count,
      percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    }));

  // 国家排序
  const countries = [...countryMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  // 作者排序：取出现最多的前 20 位
  const authors = [...authorMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name, count]) => ({ name, count }));

  // 最近 30 天：补全所有日期（没有入库的天补 0）
  const recentActivity = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (29 - i));
    const dateKey = d.toISOString().slice(0, 10);
    return { date: dateKey, count: dailyMap.get(dateKey) ?? 0 };
  });

  // 最近 5 本（已按 created_time desc 排序，直接取前 5）
  const latest: BookSummary[] = pages.slice(0, 5).map((page) => {
    const props = page.properties;
    const coverFile = props[NOTION_FIELDS.cover]?.files?.[0];
    return {
      pageId: page.id,
      title: props[NOTION_FIELDS.title]?.title?.[0]?.plain_text ?? "(未知书名)",
      author: props[NOTION_FIELDS.author]?.rich_text?.[0]?.plain_text ?? "",
      coverUrl: coverFile?.file?.url ?? coverFile?.external?.url ?? null,
      notionUrl: `https://notion.so/${page.id.replace(/-/g, "")}`,
    };
  });

  return {
    total,
    genres,
    topGenres: genres.slice(0, 3),
    countries,
    authors,
    thisYear: { total: byMonth.reduce((s, n) => s + n, 0), byMonth },
    recentActivity,
    latest,
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  // 缓存未过期时直接返回
  if (cache && cache.expiresAt > Date.now()) {
    return NextResponse.json(cache.data);
  }

  try {
    const pages = await fetchAllPages();
    const data = computeStats(pages);
    cache = { data, expiresAt: Date.now() + 60_000 }; // 60 秒缓存
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
