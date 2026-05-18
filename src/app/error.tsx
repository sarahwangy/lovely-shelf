"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-4xl">😵</p>
      <h2 className="text-lg font-semibold text-ink">页面出了点问题</h2>
      <p className="text-sm text-ink-muted">别担心，你的书架数据都在。</p>
      <button
        onClick={reset}
        className="mt-2 px-6 py-2.5 bg-shelf-500 hover:bg-shelf-600 text-white rounded-xl text-sm font-medium transition-colors"
      >
        重新加载
      </button>
    </div>
  );
}
