"use client";

// useMediaSearch：通用媒体搜索自定义 Hook
//
// 什么是自定义 Hook？
// React 内置了 useState / useEffect 等 Hook。自定义 Hook 就是
// 你自己写的、以 "use" 开头的函数，里面可以调用其他 Hook。
// 好处：把"状态 + 副作用"打包成一个可复用的单元，组件里只需要
// 调用一次 Hook，不用重复写相同的 state 和 fetch 逻辑。
//
// 这个 Hook 被图片搜索、视频搜索、音乐搜索三处共用，
// 区别只是 endpoint / responseKey / source 参数不同。

import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

export function useMediaSearch<T>(
  endpoint:      string,        // API 路径，如 "/api/images"
  responseKey:   string,        // 响应 JSON 中结果数组的 key，如 "images"
  emptyErrorMsg: string,        // 搜索结果为空时显示的提示文字
  source?:       string,        // 可选的来源参数，如 "pixabay"
) {
  const { t } = useLanguage();

  const [query,     setQuery]     = useState("");
  const [results,   setResults]   = useState<T[]>([]);
  const [searching, setSearching] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setSearching(true);
    setError(null);
    setResults([]);

    try {
      // source 有值时拼入 URL，音乐搜索不需要 source 参数
      const url = source
        ? `${endpoint}?q=${encodeURIComponent(query)}&source=${source}`
        : `${endpoint}?q=${encodeURIComponent(query)}`;

      const res  = await fetch(url);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (await res.json()) as Record<string, any>;

      if (!res.ok || data.error) {
        setError(data.error ?? t.quoteStudio.searchFailed);
        return;
      }

      const items: T[] = data[responseKey] ?? [];
      setResults(items);
      if (items.length === 0) setError(emptyErrorMsg);
    } catch {
      setError(t.upload.networkError);
    } finally {
      setSearching(false);
    }
  }

  return { query, setQuery, results, searching, error, handleSearch };
}
