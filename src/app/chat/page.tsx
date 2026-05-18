"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import NavBar from "@/components/NavBar";
import { useLanguage } from "@/contexts/LanguageContext";

// ── 类型定义 ─────────────────────────────────────────────────────

type ToolEvent = {
  name: string;
  step: number;
  done: boolean;
};

type DisplayMessage = {
  role: "user" | "assistant";
  content: string;
  imagePreview?: string;
  toolEvents?: ToolEvent[];
  streaming?: boolean;
};

type ApiMessage = {
  role: "user" | "assistant";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: any;
};

// ── 常量 ─────────────────────────────────────────────────────────

const TOOL_LABELS: Record<string, string> = {
  recognize_book_from_image: "识别封面",
  check_duplicate_in_notion: "查重",
  upload_cover_to_notion:    "上传封面",
  create_notion_page:        "写入书库",
  list_books_by_genre:       "查询书架",
};

const HINTS = [
  "给我看看我的励志书",
  "给我看看我的回忆录",
  "书架里有哪些心理相关的书？",
  "给我看看我的儿童读物",
  "给我看看我的历史书",
  "展示书架里的优美语句",
  "我有哪些旅行类书籍？",
  "帮我入库一本书",
];

// 初始种子语录（页面加载时立即显示，不消耗 API）
// 点"换一句"后由 Claude 动态生成，无限不重复
const SEED_QUOTES = [
  { zh: "你值得被温柔对待，包括被你自己。",         en: "You deserve to be treated gently — especially by yourself." },
  { zh: "休息不是懒惰，是对自己的温柔。",           en: "Rest is not laziness. It's kindness toward yourself." },
  { zh: "不完美的你，已经足够值得被爱了。",         en: "Imperfect as you are, you are already worthy of love." },
  { zh: "阅读是最安静的旅行。",                     en: "Reading is the quietest kind of travel." },
  { zh: "你的感受是真实的，允许它存在。",           en: "Your feelings are real. Let them be." },
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 5)  return "Good night";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

// ── 侧边栏子组件 ─────────────────────────────────────────────────

// 跳动的心 + ECG 心电图动画
function HeartbeatWidget() {
  return (
    <div className="flex flex-col items-center gap-3">
      <style>{`
        @keyframes heartbeat {
          0%, 100% { transform: scale(1); }
          14%       { transform: scale(1.28); }
          28%       { transform: scale(1); }
          42%       { transform: scale(1.14); }
          70%       { transform: scale(1); }
        }
        @keyframes ecg-draw {
          0%   { stroke-dashoffset: 230; opacity: 0; }
          8%   { opacity: 1; }
          75%  { stroke-dashoffset: 0; opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 0; }
        }
      `}</style>

      {/* 跳动的心 */}
      <span
        className="text-4xl select-none"
        style={{ display: "inline-block", animation: "heartbeat 1.4s ease-in-out infinite" }}
      >
        ❤️
      </span>

      {/* ECG 心电图线条 */}
      <svg viewBox="0 0 200 50" className="w-full max-w-[180px] text-red-400" fill="none">
        <path
          d="M0,25 H55 L63,25 L68,5 L75,45 L81,18 L86,25 H200"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            strokeDasharray: 230,
            animation: "ecg-draw 1.4s ease-in-out infinite",
          }}
        />
      </svg>
    </div>
  );
}

// 随机正能量语录卡：初始显示种子语录，点"换一句"调 Claude API 动态生成
function QuoteWidget() {
  const [quote, setQuote] = useState(
    () => SEED_QUOTES[Math.floor(Math.random() * SEED_QUOTES.length)]
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function nextQuote() {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch("/api/daily-quote");
      const data = (await res.json()) as { zh?: string; en?: string; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "生成失败");
      setQuote({ zh: data.zh!, en: data.en! });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-shelf-50 rounded-2xl p-4 flex flex-col gap-3">
      <p className="text-xs font-medium text-ink-muted tracking-wide uppercase">Daily Spark</p>

      {loading ? (
        <div className="flex flex-col gap-2 animate-pulse">
          <div className="h-4 bg-stone-200 rounded-lg w-full" />
          <div className="h-3 bg-stone-100 rounded-lg w-4/5" />
        </div>
      ) : (
        <div>
          <p className="text-sm font-medium text-ink leading-relaxed mb-1">{quote.zh}</p>
          <p className="text-xs text-ink-muted leading-relaxed italic">{quote.en}</p>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        type="button"
        onClick={nextQuote}
        disabled={loading}
        className="self-start text-xs text-shelf-500 hover:text-shelf-600 disabled:opacity-40 font-medium flex items-center gap-1 transition-colors"
      >
        <svg
          viewBox="0 0 24 24"
          className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
          fill="none" stroke="currentColor" strokeWidth="2.2"
          strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="23 4 23 10 17 10"/>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>
        {loading ? "生成中…" : "换一句"}
      </button>
    </div>
  );
}

// 左侧边栏：打招呼 + 心电图 + 语录
function ChatSidebar() {
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(" ")[0] ?? "朋友";
  const greeting  = getGreeting();

  return (
    <aside className="hidden md:flex flex-col w-72 shrink-0 border-r border-stone-100 bg-white p-6 gap-7 overflow-y-auto">
      {/* 打招呼 */}
      <div>
        <p className="text-xs text-ink-muted mb-2 font-medium">👋 你好！</p>
        <h2 className="text-2xl font-bold text-ink leading-tight">{greeting},</h2>
        <h2 className="text-2xl font-bold text-shelf-500 leading-tight">{firstName}</h2>
      </div>

      {/* 跳动的心电图 */}
      <HeartbeatWidget />

      {/* 正能量语录 */}
      <QuoteWidget />
    </aside>
  );
}

// ── 聊天子组件 ───────────────────────────────────────────────────

function ToolChip({ tool }: { tool: ToolEvent }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${
      tool.done ? "bg-green-100 text-green-700" : "bg-amber-50 text-amber-700 animate-pulse"
    }`}>
      {tool.done ? "✓" : "…"}
      {TOOL_LABELS[tool.name] ?? tool.name}
    </span>
  );
}

function renderInlineMd(text: string, keyOffset = 0): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIdx = 0;
  let key = keyOffset;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) parts.push(text.slice(lastIdx, match.index));
    if (match[1] !== undefined) {
      parts.push(<strong key={key++} className="font-semibold">{match[1]}</strong>);
    } else {
      parts.push(
        <a key={key++} href={match[3]} target="_blank" rel="noopener noreferrer"
          className="text-shelf-600 underline underline-offset-2 hover:text-shelf-700 break-all">
          {match[2]}
        </a>
      );
    }
    lastIdx = regex.lastIndex;
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return parts.length === 0 ? text : <>{parts}</>;
}

function MarkdownText({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) =>
        line.trim() === "---" ? (
          <hr key={i} className="border-stone-200 my-1.5" />
        ) : (
          <span key={i}>
            {renderInlineMd(line, i * 100)}
            {i < lines.length - 1 && <br />}
          </span>
        )
      )}
    </>
  );
}

function MessageBubble({ msg }: { msg: DisplayMessage }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[78%] flex flex-col items-end gap-1">
          {msg.imagePreview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={msg.imagePreview} alt="上传的图片"
              className="rounded-2xl rounded-tr-sm max-w-48 max-h-60 object-cover shadow-sm" />
          )}
          {msg.content && (
            <div className="bg-shelf-500 text-white px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm leading-relaxed">
              {msg.content}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2.5">
      <div className="w-8 h-8 bg-shelf-500 rounded-full flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
        <span className="text-white text-sm">📚</span>
      </div>
      <div className="max-w-[78%] flex flex-col gap-1.5">
        {(msg.toolEvents?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {msg.toolEvents!.map((tool, i) => <ToolChip key={i} tool={tool} />)}
          </div>
        )}
        {(msg.content || msg.streaming) && (
          <div className="bg-white px-4 py-2.5 rounded-2xl rounded-tl-sm text-sm text-ink leading-relaxed shadow-xs border border-stone-100">
            {msg.streaming ? msg.content : <MarkdownText text={msg.content} />}
            {msg.streaming && (
              <span className="inline-block w-0.5 h-4 bg-shelf-500 ml-0.5 animate-pulse align-middle" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ onSelect }: { onSelect: (hint: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 px-6 text-center">
      <div className="w-16 h-16 bg-shelf-100 rounded-full flex items-center justify-center">
        <span className="text-3xl">📚</span>
      </div>
      <div>
        <p className="text-xl font-bold text-ink mb-1.5">和书架 AI 聊聊</p>
        <p className="text-sm text-ink-muted leading-relaxed">
          上传书封面自动入库，或直接问我关于书架的问题
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2 mt-1 max-w-sm">
        {HINTS.map((hint) => (
          <button key={hint} type="button" onClick={() => onSelect(hint)}
            className="text-sm px-3.5 py-1.5 bg-shelf-100 text-shelf-700 rounded-full hover:bg-shelf-200 transition-colors">
            {hint}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── 主页面 ───────────────────────────────────────────────────────

export default function ChatPage() {
  const { t } = useLanguage();
  const [displayMessages, setDisplayMessages] = useState<DisplayMessage[]>([]);
  const [apiMessages, setApiMessages]         = useState<ApiMessage[]>([]);
  const [input, setInput]                     = useState("");
  const [imageFile, setImageFile]             = useState<File | null>(null);
  const [imagePreview, setImagePreview]       = useState<string | null>(null);
  const [imageLoadError, setImageLoadError]   = useState(false);
  const [converting, setConverting]           = useState(false);
  const [isStreaming, setIsStreaming]         = useState(false);

  const bottomRef    = useRef<HTMLDivElement>(null);
  const textareaRef  = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  const updateLastAssistant = useCallback((patch: (prev: DisplayMessage) => DisplayMessage) => {
    setDisplayMessages((prev) => {
      if (prev.length === 0) return prev;
      const updated = [...prev];
      const last = updated[updated.length - 1];
      if (last.role !== "assistant") return prev;
      updated[updated.length - 1] = patch(last);
      return updated;
    });
  }, []);

  // HEIC → JPEG 转换（三道保险）
  const convertIfHeic = async (file: File): Promise<File> => {
    const name = file.name.toLowerCase();
    const isHeic = file.type === "image/heic" || file.type === "image/heif"
      || name.endsWith(".heic") || name.endsWith(".heif");
    if (!isHeic) return file;
    const jpegName = file.name.replace(/\.heic$/i, ".jpg").replace(/\.heif$/i, ".jpg");
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const libheif = (await import("libheif-js/wasm-bundle")).default as any;
      const ab = await file.arrayBuffer();
      const data = new libheif.HeifDecoder().decode(new Uint8Array(ab));
      if (!data?.length) throw new Error("no images");
      const img = data[0];
      const canvas = document.createElement("canvas");
      canvas.width = img.get_width(); canvas.height = img.get_height();
      const ctx = canvas.getContext("2d")!;
      const imageData = ctx.createImageData(canvas.width, canvas.height);
      await new Promise<void>((res, rej) =>
        img.display(imageData, (r: ImageData | null) => r ? res() : rej(new Error("display failed")))
      );
      ctx.putImageData(imageData, 0, 0);
      const blob = await new Promise<Blob>((res, rej) =>
        canvas.toBlob((b) => b ? res(b) : rej(new Error("toBlob failed")), "image/jpeg", 0.9)
      );
      return new File([blob], jpegName, { type: "image/jpeg" });
    } catch { /* 方法1失败 */ }
    try {
      const heic2any = (await import("heic2any")).default;
      const result = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
      const jpeg = Array.isArray(result) ? result[0] : result;
      return new File([jpeg], jpegName, { type: "image/jpeg" });
    } catch { /* 方法2失败 */ }
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width; canvas.height = bitmap.height;
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
      const blob = await new Promise<Blob>((res, rej) =>
        canvas.toBlob((b) => b ? res(b) : rej(new Error("toBlob failed")), "image/jpeg", 0.9)
      );
      return new File([blob], jpegName, { type: "image/jpeg" });
    } catch { /* 三种都失败 */ }
    return file;
  };

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.files?.[0];
    if (!raw) return;
    e.target.value = "";
    setConverting(true); setImageFile(raw); setImagePreview(null); setImageLoadError(false);
    const file = await convertIfHeic(raw);
    setImageFile(file); setConverting(false);
    const reader = new FileReader();
    reader.onload = (evt) => setImagePreview(evt.target?.result as string ?? null);
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImageFile(null); setImagePreview(null); setImageLoadError(false); setConverting(false);
  };

  const handleSend = useCallback(async (directText?: string) => {
    const text = (directText ?? input).trim();
    if ((!text && !imageFile) || isStreaming) return;

    setInput("");
    const sentImage   = imageFile;
    const sentPreview = imagePreview;
    clearImage();

    const userDisplay: DisplayMessage  = { role: "user", content: text, imagePreview: sentPreview ?? undefined };
    const userApiMsg:  ApiMessage       = { role: "user", content: text || "请处理这张书封面" };
    const nextApiMessages               = [...apiMessages, userApiMsg];
    const assistantDisplay: DisplayMessage = { role: "assistant", content: "", toolEvents: [], streaming: true };

    setDisplayMessages((prev) => [...prev, userDisplay, assistantDisplay]);
    setIsStreaming(true);

    const fd = new FormData();
    fd.append("messages", JSON.stringify(nextApiMessages));
    if (sentImage) fd.append("image", sentImage);

    try {
      const response = await fetch("/api/chat", { method: "POST", body: fd });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader  = response.body!.getReader();
      const decoder = new TextDecoder();
      let   buffer  = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop()!;

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let data: Record<string, unknown>;
          try { data = JSON.parse(line.slice(6)); } catch { continue; }

          switch (data.type) {
            case "text_delta":
              updateLastAssistant((prev) => ({ ...prev, content: prev.content + (data.delta as string) }));
              break;
            case "tool_start":
              updateLastAssistant((prev) => ({
                ...prev,
                toolEvents: [...(prev.toolEvents ?? []), { name: data.name as string, step: data.step as number, done: false }],
              }));
              break;
            case "tool_end":
              updateLastAssistant((prev) => ({
                ...prev,
                toolEvents: prev.toolEvents?.map((t) => t.step === (data.step as number) ? { ...t, done: true } : t) ?? [],
              }));
              break;
            case "done":
              setApiMessages([...nextApiMessages, ...(data.newMessages as ApiMessage[])]);
              updateLastAssistant((prev) => ({ ...prev, streaming: false }));
              break;
            case "error":
              updateLastAssistant((prev) => ({ ...prev, content: `出错了：${data.message as string}`, streaming: false }));
              break;
          }
        }
      }
    } catch (err) {
      updateLastAssistant((prev) => ({ ...prev, content: `网络错误：${(err as Error).message}`, streaming: false }));
    } finally {
      setIsStreaming(false);
    }
  }, [input, imageFile, imagePreview, apiMessages, isStreaming, updateLastAssistant]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div className="flex flex-col h-dvh bg-shelf-50">
      <NavBar />

      {/* 主体区：左侧边栏 + 右侧聊天区 */}
      <div className="flex flex-1 min-h-0">

        {/* ── 左侧边栏（桌面端显示）── */}
        <ChatSidebar />

        {/* ── 右侧聊天区 ── */}
        <div className="flex flex-col flex-1 min-h-0">

          {/* 消息滚动区 */}
          <div className="flex-1 overflow-y-auto">
            {displayMessages.length === 0 ? (
              <EmptyState onSelect={(hint) => handleSend(hint)} />
            ) : (
              <div className="px-4 py-4">
                <div className="max-w-2xl mx-auto w-full space-y-4">
                  {displayMessages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
                  <div ref={bottomRef} />
                </div>
              </div>
            )}
          </div>

          {/* 输入区 */}
          <div className="bg-white border-t border-stone-100 px-5 pt-3 pb-6 shrink-0">
            <div className="max-w-2xl mx-auto">
              {/* 图片预览 */}
              {imageFile && (
                <div className="relative inline-block mb-2">
                  <div className="h-16 w-16 rounded-xl border border-stone-200 overflow-hidden bg-shelf-100">
                    {converting ? (
                      <div className="h-full w-full flex flex-col items-center justify-center gap-1">
                        <span className="text-base animate-spin">⏳</span>
                        <span className="text-[9px] text-ink-muted">转换中</span>
                      </div>
                    ) : imagePreview && !imageLoadError ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imagePreview} alt="待发送图片" className="h-full w-full object-cover"
                        onError={() => setImageLoadError(true)} />
                    ) : (
                      <div className="h-full w-full flex flex-col items-center justify-center gap-0.5 px-1">
                        <span className="text-xl">📷</span>
                        <span className="text-[9px] text-ink-muted text-center truncate w-full leading-tight">{imageFile.name}</span>
                      </div>
                    )}
                  </div>
                  <button type="button" onClick={clearImage}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-stone-600 text-white rounded-full text-xs flex items-center justify-center">
                    ✕
                  </button>
                </div>
              )}

              <div className="flex items-end gap-2">
                {/* 图片上传按钮 */}
                <div className="relative group shrink-0">
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isStreaming}
                    className="w-10 h-10 flex items-center justify-center rounded-xl text-ink-muted hover:bg-shelf-100 hover:text-shelf-600 transition-colors disabled:opacity-40">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                  </button>
                  <div className="absolute -top-1 left-full ml-1.5 bg-stone-800 text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10">
                    上传图片
                  </div>
                </div>

                {/* 文字输入框 */}
                <textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown} placeholder={t.chat.placeholder} disabled={isStreaming} rows={1}
                  className="flex-1 resize-none bg-shelf-50 border border-stone-200 rounded-2xl px-4 py-2.5 text-sm text-ink placeholder-ink-muted focus:outline-none focus:border-shelf-400 focus:bg-white transition-colors disabled:opacity-50" />

                {/* 发送按钮 */}
                <button type="button" onClick={() => handleSend()}
                  disabled={isStreaming || converting || (!input.trim() && !imageFile)}
                  className="w-9 h-9 flex items-center justify-center bg-shelf-500 hover:bg-shelf-600 disabled:bg-stone-200 text-white rounded-xl transition-colors shrink-0">
                  {isStreaming ? (
                    <span className="text-base animate-spin">⏳</span>
                  ) : (
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />
    </div>
  );
}
