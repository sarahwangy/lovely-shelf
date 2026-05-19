"use client";

import { useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLanguage();

  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-4xl">😵</p>
      <h2 className="text-lg font-semibold text-ink">{t.common.error}</h2>
      <p className="text-sm text-ink-muted">{t.common.errorHint}</p>
      <button
        onClick={reset}
        className="mt-2 px-6 py-2.5 bg-shelf-500 hover:bg-shelf-600 text-white rounded-xl text-sm font-medium transition-colors"
      >
        {t.common.retry}
      </button>
    </div>
  );
}
