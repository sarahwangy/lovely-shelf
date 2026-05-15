"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import type { StatsData } from "@/app/api/stats/route";
import type { BookSummary } from "@/types/book";
import BookDetailModal from "@/components/BookDetailModal";
import NavBar from "@/components/NavBar";

const GENRE_COLORS = [
  "#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd",
  "#818cf8", "#4f46e5", "#7c3aed", "#9333ea",
  "#d946ef", "#ec4899", "#f43f5e", "#fb923c",
  "#facc15", "#4ade80", "#2dd4bf",
];

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalPageId, setModalPageId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => { if (!r.ok) throw new Error("加载失败"); return r.json(); })
      .then(setStats)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (error) return (
    <div className="min-h-screen bg-shelf-50 flex items-center justify-center">
      <p className="text-red-500 text-sm">{error}</p>
    </div>
  );
  if (!stats) return null;

  const thisYearLabel = new Date().getFullYear() + "年";
  const topGenre = stats.topGenres[0]?.name ?? "—";

  return (
    <div className="min-h-screen bg-shelf-50">
      <NavBar />

      <main className="px-6 py-6 space-y-5">

        {/* ── Hero：全宽 ── */}
        <div className="bg-gradient-to-br from-shelf-500 to-shelf-700 rounded-3xl px-8 py-7 text-white shadow-lg flex items-center justify-between">
          <div>
            <p className="text-shelf-200 text-sm mb-1">你的书架</p>
            <p className="text-6xl font-black leading-none mb-1">{stats.total}</p>
            <p className="text-shelf-100 text-base">本书</p>
          </div>
          <div className="flex flex-col gap-2 text-sm text-right">
            <span className="bg-white/20 rounded-full px-4 py-1.5">
              {thisYearLabel}入库 <span className="font-bold">{stats.thisYear.total}</span> 本
            </span>
            <span className="bg-white/20 rounded-full px-4 py-1.5">
              最爱 · <span className="font-bold">{topGenre}</span>
            </span>
          </div>
        </div>

        {/* ── 第一行：环形图（左宽）+ Top 3（右窄）── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* 类型环形图：占 2/3 */}
          <WidgetCard title="📊 类型分布" className="lg:col-span-2">
            {stats.genres.length === 0 ? (
              <p className="text-ink-muted text-sm text-center py-6">暂无数据</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={stats.genres}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={105}
                    paddingAngle={2}
                    onClick={(entry) => router.push(`/dashboard/genre/${encodeURIComponent(entry.name ?? "")}`)}
                    className="cursor-pointer"
                  >
                    {stats.genres.map((_, i) => (
                      <Cell key={i} fill={GENRE_COLORS[i % GENRE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [`${value ?? 0} 本`, String(name ?? "")]}
                    contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}
                  />
                  <Legend formatter={(value) => <span className="text-xs text-ink">{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
            <p className="text-xs text-ink-light text-center mt-1">点击切片查看该类书架</p>
          </WidgetCard>

          {/* Top 3：占 1/3 */}
          {stats.topGenres.length > 0 && (
            <WidgetCard title="🏆 最爱的类型">
              <div className="flex flex-col gap-3">
                {stats.topGenres.map((g, i) => (
                  <button
                    key={g.name}
                    type="button"
                    onClick={() => router.push(`/dashboard/genre/${encodeURIComponent(g.name)}`)}
                    className="bg-shelf-50 hover:bg-shelf-100 rounded-2xl p-4 flex items-center gap-4 transition-colors text-left"
                  >
                    <span className="text-2xl shrink-0">{["🥇", "🥈", "🥉"][i]}</span>
                    <div className="min-w-0">
                      <p className="text-xl font-black text-shelf-600 leading-none">{g.count}</p>
                      <p className="text-sm font-medium text-ink mt-0.5 truncate">{g.name}</p>
                      <p className="text-xs text-ink-muted">{g.percentage}%</p>
                    </div>
                  </button>
                ))}
              </div>
            </WidgetCard>
          )}
        </div>

        {/* ── 第二行：月度趋势（左）+ 热力图（右）── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <WidgetCard title={`📈 ${thisYearLabel}入库趋势`}>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={stats.thisYear.byMonth.map((count, i) => ({ month: `${i + 1}月`, count }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f0ef" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#a8a29e" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#a8a29e" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  formatter={(v) => [`${v ?? 0} 本`]}
                  contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}
                />
                <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </WidgetCard>

          <WidgetCard title="🗓 最近 30 天入库">
            {/* 图例说明 */}
            <div className="flex items-center gap-3 mb-3 text-xs text-ink-muted">
              <span>每格 = 一天</span>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded bg-stone-100" /> 无入库
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded bg-shelf-300" /> 有入库
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded bg-shelf-600" /> 多
              </div>
            </div>
            <HeatmapRow data={stats.recentActivity} />
          </WidgetCard>
        </div>

        {/* ── 第三行：国家分布（左）+ 最近入库（右）── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {stats.countries.length > 0 && (
            <WidgetCard title="🌍 作者来自">
              <div className="flex flex-wrap gap-2">
                {stats.countries.map((c) => (
                  <span key={c.name} className="bg-shelf-50 text-ink text-sm px-3 py-1.5 rounded-full">
                    {c.name} <span className="text-shelf-600 font-semibold">{c.count}</span>
                  </span>
                ))}
              </div>
            </WidgetCard>
          )}

          {stats.latest.length > 0 && (
            <WidgetCard title="🆕 最近入库">
              <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                {stats.latest.map((book) => (
                  <LatestBookCard key={book.pageId} book={book} onBookClick={setModalPageId} />
                ))}
              </div>
            </WidgetCard>
          )}
        </div>

      </main>

      <BookDetailModal pageId={modalPageId} onClose={() => setModalPageId(null)} />
    </div>
  );
}

function WidgetCard({ title, children, className = "" }: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-3xl shadow-sm p-5 ${className}`}>
      <h2 className="text-sm font-semibold text-ink mb-4">{title}</h2>
      {children}
    </div>
  );
}

function HeatmapRow({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex gap-1.5 flex-wrap">
      {data.map(({ date, count }) => {
        const intensity = count / max;
        const bg = count === 0
          ? "bg-stone-100"
          : intensity < 0.4 ? "bg-shelf-200"
          : intensity < 0.7 ? "bg-shelf-400"
          : "bg-shelf-600";
        // title 属性：鼠标悬停时显示日期和入库数
        return (
          <div key={date} title={`${date}：${count} 本`}
            className={`w-8 h-8 rounded-lg ${bg} transition-colors`} />
        );
      })}
    </div>
  );
}

function LatestBookCard({ book, onBookClick }: { book: BookSummary; onBookClick: (id: string) => void }) {
  return (
    <button type="button" onClick={() => onBookClick(book.pageId)} className="shrink-0 w-20 text-left group">
      <div className="w-20 h-28 rounded-xl overflow-hidden bg-stone-100 shadow-sm mb-1.5 group-hover:shadow-md transition-shadow">
        {book.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl bg-shelf-50">📖</div>
        )}
      </div>
      <p className="text-xs text-ink font-medium line-clamp-2 leading-snug">{book.title}</p>
      <p className="text-xs text-ink-muted mt-0.5 truncate">{book.author}</p>
    </button>
  );
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-shelf-50 px-6 py-6 space-y-5 animate-pulse">
      <div className="h-28 bg-shelf-200 rounded-3xl" />
      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 h-72 bg-white rounded-3xl" />
        <div className="h-72 bg-white rounded-3xl" />
      </div>
      <div className="grid grid-cols-2 gap-5">
        <div className="h-52 bg-white rounded-3xl" />
        <div className="h-52 bg-white rounded-3xl" />
      </div>
    </div>
  );
}
