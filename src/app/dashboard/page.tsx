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
import { useLanguage } from "@/contexts/LanguageContext";
import { translateTerm } from "@/lib/i18n/termMap";
import { GENRE_COLORS, BAR_PRIMARY_COLOR, WORD_CLOUD_COLORS } from "@/lib/colors";

const TERM_CACHE_KEY = "lovely-shelf-term-cache";

function loadTermCache(): Record<string, string> {
  try {
    const raw = localStorage.getItem(TERM_CACHE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch { return {}; }
}

function saveTermCache(cache: Record<string, string>) {
  try { localStorage.setItem(TERM_CACHE_KEY, JSON.stringify(cache)); } catch { /* ignore */ }
}

export default function DashboardPage() {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const [stats,         setStats]         = useState<StatsData | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [modalPageId,   setModalPageId]   = useState<string | null>(null);
  // 静态表里没有的词，由 Claude 翻译后存这里
  const [termOverrides, setTermOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => { if (!r.ok) throw new Error("加载失败"); return r.json(); })
      .then(setStats)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // 切换到英文模式且数据已加载时，翻译静态表里没有的词
  useEffect(() => {
    if (lang !== "en" || !stats) return;

    const allTerms = [
      ...stats.genres.map(g => ({ text: g.name, type: "genre" as const })),
      ...stats.topGenres.map(g => ({ text: g.name, type: "genre" as const })),
      ...stats.countries.map(c => ({ text: c.name, type: "country" as const })),
    ];

    // 过滤出静态表里没有的词
    const unknown = allTerms.filter(
      ({ text, type }) => !translateTerm(text, type, "en").match(/^[A-Za-z]/)
    );
    if (unknown.length === 0) return;

    const cache = loadTermCache();
    const uncached = unknown.filter(({ text }) => !cache[text]);

    if (uncached.length > 0) {
      fetch("/api/translate-term", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ terms: uncached.map(u => u.text) }),
      })
        .then((r) => r.json())
        .then((data: { translations: Record<string, string> }) => {
          const merged = { ...cache, ...data.translations };
          saveTermCache(merged);
          setTermOverrides(merged);
        })
        .catch(() => { /* 翻译失败静默处理，显示中文原文 */ });
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTermOverrides(cache);
    }
  }, [lang, stats]);

  // 优先用动态翻译，找不到再用静态表，最后兜底显示原文
  function tx(name: string, type: "genre" | "country") {
    if (lang !== "en") return name;
    return termOverrides[name] ?? translateTerm(name, type, lang);
  }

  if (loading) return <DashboardSkeleton />;
  if (error) return (
    <div className="min-h-screen bg-shelf-50 flex items-center justify-center">
      <p className="text-red-500 text-sm">{t.common.error}</p>
    </div>
  );
  if (!stats) return null;

  const thisYear = new Date().getFullYear();
  const topGenre = stats.topGenres[0] ? tx(stats.topGenres[0].name, "genre") : "—";

  const displayGenres = stats.genres.map(g => ({
    ...g,
    displayName: tx(g.name, "genre"),
  }));
  const displayTopGenres = stats.topGenres.map(g => ({
    ...g,
    displayName: tx(g.name, "genre"),
  }));
  const displayCountries = stats.countries.map(c => ({
    ...c,
    displayName: tx(c.name, "country"),
  }));

  return (
    <div className="min-h-screen bg-shelf-50">
      <NavBar />

      <main className="px-6 py-6 space-y-5">

        {/* ── Hero：全宽 ── */}
        <div className="bg-gradient-to-br from-shelf-500 to-shelf-700 rounded-3xl px-8 py-7 text-white shadow-lg flex items-center justify-between">
          <div>
            <p className="text-shelf-200 text-sm mb-1">{t.dashboard.title}</p>
            <p className="text-6xl font-black leading-none mb-1">{stats.total}</p>
            <p className="text-shelf-100 text-base">{t.dashboard.books}</p>
          </div>
          <div className="flex flex-col gap-2 text-sm text-right">
            <span className="bg-white/20 rounded-full px-4 py-1.5">
              {t.dashboard.thisYearStat(thisYear, stats.thisYear.total)}
            </span>
            <span className="bg-white/20 rounded-full px-4 py-1.5">
              {t.dashboard.topFav} <span className="font-bold">{topGenre}</span>
            </span>
          </div>
        </div>

        {/* ── 第一行：环形图（左宽）+ Top 3（右窄）── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* 类型环形图：占 2/3 */}
          <WidgetCard title={`📊 ${t.dashboard.genreChart}`} className="lg:col-span-2">
            {displayGenres.length === 0 ? (
              <p className="text-ink-muted text-sm text-center py-6">{t.dashboard.noData}</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={displayGenres}
                    dataKey="count"
                    nameKey="displayName"
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={105}
                    paddingAngle={2}
                    onClick={(entry) => router.push(`/dashboard/genre/${encodeURIComponent(entry.name ?? "")}`)}
                    className="cursor-pointer"
                  >
                    {displayGenres.map((_, i) => (
                      <Cell key={i} fill={GENRE_COLORS[i % GENRE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [t.dashboard.booksUnit(Number(value ?? 0)), String(name ?? "")]}
                    contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}
                  />
                  <Legend formatter={(value) => <span className="text-xs text-ink">{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
            <p className="text-xs text-ink-light text-center mt-1">{t.dashboard.clickSlice}</p>
          </WidgetCard>

          {/* Top 3：占 1/3 */}
          {displayTopGenres.length > 0 && (
            <WidgetCard title={`🏆 ${t.dashboard.topGenres}`}>
              <div className="flex flex-col gap-3">
                {displayTopGenres.map((g, i) => (
                  <button
                    key={g.name}
                    type="button"
                    onClick={() => router.push(`/dashboard/genre/${encodeURIComponent(g.name)}`)}
                    className="bg-shelf-50 hover:bg-shelf-100 rounded-2xl p-4 flex items-center gap-4 transition-colors text-left"
                  >
                    <span className="text-2xl shrink-0">{["🥇", "🥈", "🥉"][i]}</span>
                    <div className="min-w-0">
                      <p className="text-xl font-black text-shelf-600 leading-none">{g.count}</p>
                      <p className="text-sm font-medium text-ink mt-0.5 truncate">{g.displayName}</p>
                      <p className="text-xs text-ink-muted">{g.percentage}%</p>
                    </div>
                  </button>
                ))}
              </div>
            </WidgetCard>
          )}
        </div>

        {/* ── 热词云图（全宽，类型 + 国家 + 作者综合）── */}
        <WidgetCard title={`☁️ ${t.dashboard.wordCloud}`}>
          <WordCloud
            genres={stats.genres}
            countries={stats.countries}
            authors={stats.authors}
            termOverrides={termOverrides}
          />
        </WidgetCard>

        {/* ── 第二行：月度趋势（左）+ 热力图（右）── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <WidgetCard title={`📈 ${t.dashboard.trend(thisYear)}`}>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={stats.thisYear.byMonth.map((count, i) => ({ month: t.dashboard.months[i], count }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f0ef" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#a8a29e" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#a8a29e" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  formatter={(v) => [t.dashboard.booksUnit(Number(v ?? 0))]}
                  contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}
                />
                <Bar dataKey="count" fill={BAR_PRIMARY_COLOR} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </WidgetCard>

          <WidgetCard title={`🗓 ${t.dashboard.last30Days}`}>
            {/* 图例说明 */}
            <div className="flex items-center gap-3 mb-3 text-xs text-ink-muted">
              <span>{t.dashboard.heatmapCell}</span>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded bg-stone-100" /> {t.dashboard.noEntry}
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded bg-shelf-300" /> {t.dashboard.hasEntry}
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded bg-shelf-600" /> {t.dashboard.many}
              </div>
            </div>
            <HeatmapRow data={stats.recentActivity} />
          </WidgetCard>
        </div>

        {/* ── 第三行：国家分布（左）+ 最近入库（右）── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {displayCountries.length > 0 && (
            <WidgetCard title={`🌍 ${t.dashboard.authorFrom}`}>
              <div className="flex flex-wrap gap-2">
                {displayCountries.map((c) => (
                  <span key={c.name} className="bg-shelf-50 text-ink text-sm px-3 py-1.5 rounded-full">
                    {c.displayName} <span className="text-shelf-600 font-semibold">{c.count}</span>
                  </span>
                ))}
              </div>
            </WidgetCard>
          )}

          {stats.latest.length > 0 && (
            <WidgetCard title={`🆕 ${t.dashboard.recentActivity}`}>
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
  const { t } = useLanguage();
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
        return (
          <div key={date} className="relative group">
            <div className={`w-8 h-8 rounded-lg ${bg} transition-colors cursor-default`} />
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-ink text-white text-[10px] rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              {date}{count > 0 ? `：${t.dashboard.booksUnit(count)}` : ""}
            </span>
          </div>
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

// 词云：把类型、国家、作者名合并为一个词表，字体大小按出现次数缩放
function WordCloud({
  genres,
  countries,
  authors,
  termOverrides,
}: {
  genres:        { name: string; count: number }[];
  countries:     { name: string; count: number }[];
  authors:       { name: string; count: number }[];
  termOverrides: Record<string, string>;
}) {
  const { t, lang } = useLanguage();
  type WordEntry = { name: string; count: number; cat: "genre" | "country" | "author" };

  function tx(name: string, type: "genre" | "country") {
    if (lang !== "en") return name;
    return termOverrides[name] ?? translateTerm(name, type, lang);
  }

  const words: WordEntry[] = [
    ...genres.map(w    => ({ ...w, name: tx(w.name, "genre"),   cat: "genre"   as const })),
    ...countries.map(w => ({ ...w, name: tx(w.name, "country"), cat: "country" as const })),
    ...authors.map(w   => ({ ...w, cat: "author"  as const })),
  ];

  if (words.length === 0) {
    return <p className="text-ink-muted text-sm text-center py-6">{t.dashboard.noData}</p>;
  }

  const maxCount = Math.max(...words.map(w => w.count));
  const minCount = Math.min(...words.map(w => w.count));
  const range    = maxCount - minCount || 1;

  const legend: { cat: WordEntry["cat"]; label: string }[] = [
    { cat: "genre",   label: t.dashboard.wordCloudGenre },
    { cat: "country", label: t.dashboard.wordCloudCountry },
    { cat: "author",  label: t.dashboard.wordCloudAuthor },
  ];

  return (
    <div>
      {/* 图例 */}
      <div className="flex items-center gap-4 mb-4 text-xs text-ink-muted">
        {legend.map(({ cat, label }) => (
          <span key={cat} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: WORD_CLOUD_COLORS[cat][0] }} />
            {label}
          </span>
        ))}
      </div>

      {/* 词云正文：flex-wrap 居中排列，字体大小 12–30px */}
      <div className="flex flex-wrap gap-x-5 gap-y-3 justify-center items-center py-2 min-h-[120px]">
        {words.map((word, i) => {
          const normalized = (word.count - minCount) / range;
          const fontSize   = 12 + normalized * 18;           // 12px 最小，30px 最大
          const opacity    = 0.55 + normalized * 0.45;       // 少的词稍淡
          const palette    = WORD_CLOUD_COLORS[word.cat];
          const color      = palette[i % palette.length];
          return (
            <span
              key={`${word.cat}-${word.name}`}
              style={{ fontSize: `${fontSize}px`, color, opacity }}
              className="font-semibold cursor-default hover:opacity-100 transition-opacity leading-snug"
              title={`${word.name}：${t.dashboard.booksUnit(word.count)}`}
            >
              {word.name}
            </span>
          );
        })}
      </div>
    </div>
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
