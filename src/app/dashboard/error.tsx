"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[DashboardError]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-4xl">📊</p>
      <h2 className="text-lg font-semibold text-ink">看板加载失败</h2>
      <p className="text-sm text-ink-muted">可能是 Notion 连接超时，稍后再试试。</p>
      <button
        onClick={reset}
        className="mt-2 px-6 py-2.5 bg-shelf-500 hover:bg-shelf-600 text-white rounded-xl text-sm font-medium transition-colors"
      >
        重新加载
      </button>
    </div>
  );
}
