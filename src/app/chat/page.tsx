"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import NavBar from "@/components/NavBar";

// ── 类型定义 ─────────────────────────────────────────────────────

// 工具调用的进度状态
type ToolEvent = {
  name: string;
  step: number;
  done: boolean;
};

// 界面展示用的消息（比 API 格式简单，只存展示需要的字段）
type DisplayMessage = {
  role: "user" | "assistant";
  content: string;
  imagePreview?: string;  // 用户消息里的图片预览 URL
  toolEvents?: ToolEvent[]; // AI 消息里的工具调用进度
  streaming?: boolean;    // 是否仍在流式输出中
};

// 发给后端的 API 消息格式（Anthropic 协议）
// 用 unknown 而不是 Anthropic.MessageParam，避免把 SDK 引入客户端 bundle
type ApiMessage = {
  role: "user" | "assistant";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: any;
};

// 工具名 → 中文标签
const TOOL_LABELS: Record<string, string> = {
  recognize_book_from_image: "识别封面",
  check_duplicate_in_notion: "查重",
  upload_cover_to_notion:    "上传封面",
  create_notion_page:        "写入书库",
  list_books_by_genre:       "查询书架",
};

// ── 子组件 ───────────────────────────────────────────────────────

// 工具调用状态标签
function ToolChip({ tool }: { tool: ToolEvent }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${
        tool.done
          ? "bg-green-100 text-green-700"
          : "bg-amber-50 text-amber-700 animate-pulse"
      }`}
    >
      {tool.done ? "✓" : "…"}
      {TOOL_LABELS[tool.name] ?? tool.name}
    </span>
  );
}

// Markdown 内联渲染：把 **粗体** 转成 <strong>，[链接](url) 转成 <a>
// 不引入第三方库，只处理这两种最常见的格式
function renderInlineMd(text: string, keyOffset = 0): React.ReactNode {
  const parts: React.ReactNode[] = [];
  // 一个正则同时匹配 **bold** 和 [text](url)
  const regex = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIdx = 0;
  let key = keyOffset;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) parts.push(text.slice(lastIdx, match.index));
    if (match[1] !== undefined) {
      // **粗体**
      parts.push(<strong key={key++} className="font-semibold">{match[1]}</strong>);
    } else {
      // [链接文字](url)
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
          // --- 分隔线 → 视觉横线
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

// 单条消息气泡
function MessageBubble({ msg }: { msg: DisplayMessage }) {
  // 用户消息：右对齐，绿色气泡
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[78%] flex flex-col items-end gap-1">
          {msg.imagePreview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={msg.imagePreview}
              alt="上传的图片"
              className="rounded-2xl rounded-tr-sm max-w-48 max-h-60 object-cover shadow-sm"
            />
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

  // AI 消息：左对齐，白色气泡，可能含工具进度
  return (
    <div className="flex gap-2.5">
      {/* AI 头像 */}
      <div className="w-8 h-8 bg-shelf-500 rounded-full flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
        <span className="text-white text-sm">📚</span>
      </div>

      <div className="max-w-[78%] flex flex-col gap-1.5">
        {/* 工具调用进度（排在文字上方） */}
        {(msg.toolEvents?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {msg.toolEvents!.map((tool, i) => (
              <ToolChip key={i} tool={tool} />
            ))}
          </div>
        )}

        {/* 文字内容（空字符串时不渲染，避免显示空白气泡） */}
        {(msg.content || msg.streaming) && (
          <div className="bg-white px-4 py-2.5 rounded-2xl rounded-tl-sm text-sm text-ink leading-relaxed shadow-xs border border-stone-100">
            {/* 流式中直接显示原始文字（防止半截 ** 被误解析），完成后渲染 Markdown */}
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

// 空状态：没有消息时的引导
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
      <div className="w-16 h-16 bg-shelf-100 rounded-full flex items-center justify-center">
        <span className="text-3xl">📚</span>
      </div>
      <div>
        <p className="font-semibold text-ink mb-1">和书架 AI 聊聊</p>
        <p className="text-sm text-ink-muted">
          上传书封面自动入库，或者问我"给我看看我的回忆录"
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2 mt-1">
        {["给我看看我的励志书", "帮我入库一本书"].map((hint) => (
          <span key={hint} className="text-xs px-3 py-1.5 bg-shelf-100 text-shelf-700 rounded-full">
            {hint}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── 主页面 ───────────────────────────────────────────────────────

export default function ChatPage() {
  const [displayMessages, setDisplayMessages] = useState<DisplayMessage[]>([]);
  // apiMessages 是发给后端的完整对话历史（Anthropic 格式），每轮追加新消息
  const [apiMessages, setApiMessages]         = useState<ApiMessage[]>([]);
  const [input, setInput]                     = useState("");
  const [imageFile, setImageFile]             = useState<File | null>(null);
  const [imagePreview, setImagePreview]       = useState<string | null>(null);
  const [imageLoadError, setImageLoadError]   = useState(false);
  const [converting, setConverting]           = useState(false);
  const [isStreaming, setIsStreaming]         = useState(false);

  const bottomRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 新消息到来时自动滚到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages]);

  // textarea 随内容自动撑高，最高 120px（约 5 行）
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  // 更新最后一条 assistant 消息（用函数式更新避免读到过时 state）
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

  // HEIC → JPEG 转换（和上传页完全一样的三道保险）
  // 必须在前端转好再预览和发送，因为后端 sharp 不支持 HEIC
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
    } catch { /* 方法1失败，继续 */ }

    try {
      const heic2any = (await import("heic2any")).default;
      const result = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
      const jpeg = Array.isArray(result) ? result[0] : result;
      return new File([jpeg], jpegName, { type: "image/jpeg" });
    } catch { /* 方法2失败，继续 */ }

    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width; canvas.height = bitmap.height;
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
      const blob = await new Promise<Blob>((res, rej) =>
        canvas.toBlob((b) => b ? res(b) : rej(new Error("toBlob failed")), "image/jpeg", 0.9)
      );
      return new File([blob], jpegName, { type: "image/jpeg" });
    } catch { /* 三种方法都失败，返回原文件 */ }

    return file;
  };

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.files?.[0];
    if (!raw) return;
    e.target.value = "";

    setConverting(true);
    setImageFile(raw);    // 先占位，让预览区出现 converting 状态
    setImagePreview(null);
    setImageLoadError(false);

    const file = await convertIfHeic(raw);
    setImageFile(file);
    setConverting(false);

    // FileReader 转 data URL 供预览（JPEG 在所有浏览器都能直接显示）
    const reader = new FileReader();
    reader.onload = (evt) => setImagePreview(evt.target?.result as string ?? null);
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageLoadError(false);
    setConverting(false);
  };

  // 发送消息的核心逻辑
  const handleSend = useCallback(async () => {
    const text = input.trim();
    if ((!text && !imageFile) || isStreaming) return;

    // 立刻清空输入区
    setInput("");
    const sentImage   = imageFile;
    const sentPreview = imagePreview;
    clearImage();

    // 用户的展示消息
    const userDisplay: DisplayMessage = {
      role: "user",
      content: text,
      imagePreview: sentPreview ?? undefined,
    };

    // 用户的 API 消息（图片通过 FormData 传，不放在这里）
    const userApiMsg: ApiMessage = {
      role: "user",
      content: text || "请处理这张书封面",
    };

    const nextApiMessages = [...apiMessages, userApiMsg];

    // 先把用户消息和空的 assistant 消息加到界面
    const assistantDisplay: DisplayMessage = {
      role: "assistant",
      content: "",
      toolEvents: [],
      streaming: true,
    };
    setDisplayMessages((prev) => [...prev, userDisplay, assistantDisplay]);
    setIsStreaming(true);

    // 准备 FormData
    const fd = new FormData();
    fd.append("messages", JSON.stringify(nextApiMessages));
    if (sentImage) fd.append("image", sentImage);

    try {
      const response = await fetch("/api/chat", { method: "POST", body: fd });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader  = response.body!.getReader();
      const decoder = new TextDecoder();
      let   buffer  = "";

      // 读取 SSE 流：chunk 可能跨行，用 buffer 拼接
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // 最后一个元素可能是不完整的行，留在 buffer 里等下次拼接
        buffer = lines.pop()!;

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let data: Record<string, unknown>;
          try {
            data = JSON.parse(line.slice(6));
          } catch {
            continue;
          }

          switch (data.type) {
            // 新的文字 token：追加到 assistant 消息内容
            case "text_delta":
              updateLastAssistant((prev) => ({
                ...prev,
                content: prev.content + (data.delta as string),
              }));
              break;

            // 工具开始：加一个"进行中"的工具标签
            case "tool_start":
              updateLastAssistant((prev) => ({
                ...prev,
                toolEvents: [
                  ...(prev.toolEvents ?? []),
                  { name: data.name as string, step: data.step as number, done: false },
                ],
              }));
              break;

            // 工具完成：把对应标签标为 done
            case "tool_end":
              updateLastAssistant((prev) => ({
                ...prev,
                toolEvents: prev.toolEvents?.map((t) =>
                  t.step === (data.step as number) ? { ...t, done: true } : t
                ) ?? [],
              }));
              break;

            // 全部完成：把 newMessages 追加到 apiMessages，供下一轮携带
            case "done":
              setApiMessages([...nextApiMessages, ...(data.newMessages as ApiMessage[])]);
              updateLastAssistant((prev) => ({ ...prev, streaming: false }));
              break;

            // 出错：在 assistant 气泡里显示错误信息
            case "error":
              updateLastAssistant((prev) => ({
                ...prev,
                content: `出错了：${data.message as string}`,
                streaming: false,
              }));
              break;
          }
        }
      }
    } catch (err) {
      updateLastAssistant((prev) => ({
        ...prev,
        content: `网络错误：${(err as Error).message}`,
        streaming: false,
      }));
    } finally {
      setIsStreaming(false);
    }
  }, [input, imageFile, imagePreview, apiMessages, isStreaming, updateLastAssistant]);

  // Enter 发送，Shift+Enter 换行（ChatGPT 的标准行为）
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    // h-dvh：动态视口高度，iOS Safari 键盘弹起时不会被遮住
    // flex-col：NavBar 固定顶部，消息区撑满剩余高度，输入框贴底
    <div className="flex flex-col h-dvh bg-shelf-50">
      <NavBar />

      {/* 消息滚动区
          min-h-full + justify-end：内容短时贴底显示（像 WhatsApp），
          内容长时自然溢出变成可滚动，最新消息始终靠近输入框 */}
      <div className="flex-1 overflow-y-auto">
        {displayMessages.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="px-4 py-4">
            <div className="max-w-2xl mx-auto w-full space-y-4">
              {displayMessages.map((msg, i) => (
                <MessageBubble key={i} msg={msg} />
              ))}
              <div ref={bottomRef} />
            </div>
          </div>
        )}
      </div>

      {/* 输入区：px-6 和 NavBar 对齐，pb-6 留底部呼吸空间 */}
      <div className="bg-white border-t border-stone-100 px-6 pt-3 pb-6">
        <div className="max-w-2xl mx-auto">
          {/* 已选图片预览 */}
          {imageFile && (
            <div className="relative inline-block mb-2">
              <div className="h-16 w-16 rounded-xl border border-stone-200 overflow-hidden bg-shelf-100">
                {converting ? (
                  // HEIC 转换中：显示 loading
                  <div className="h-full w-full flex flex-col items-center justify-center gap-1">
                    <span className="text-base animate-spin">⏳</span>
                    <span className="text-[9px] text-ink-muted">转换中</span>
                  </div>
                ) : imagePreview && !imageLoadError ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imagePreview}
                    alt="待发送图片"
                    className="h-full w-full object-cover"
                    onError={() => setImageLoadError(true)}
                  />
                ) : (
                  // 转换失败时显示文件名占位
                  <div className="h-full w-full flex flex-col items-center justify-center gap-0.5 px-1">
                    <span className="text-xl">📷</span>
                    <span className="text-[9px] text-ink-muted text-center truncate w-full leading-tight">
                      {imageFile.name}
                    </span>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={clearImage}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-stone-600 text-white rounded-full text-xs flex items-center justify-center"
              >
                ✕
              </button>
            </div>
          )}

          <div className="flex items-end gap-2">
            {/* 图片上传按钮：自定义 tooltip（group-hover 无延迟，定位在图标右上角） */}
            <div className="relative group shrink-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isStreaming}
                className="w-10 h-10 flex items-center justify-center rounded-xl text-ink-muted hover:bg-shelf-100 hover:text-shelf-600 transition-colors disabled:opacity-40"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </button>
              {/* opacity-0 → group-hover:opacity-100：hover 时立刻出现，无延迟 */}
              <div className="absolute -top-1 left-full ml-1.5 bg-stone-800 text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10">
                上传图片
              </div>
            </div>

            {/* 文字输入框 */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="和 AI 聊聊你的书架…"
              disabled={isStreaming}
              rows={1}
              className="flex-1 resize-none bg-shelf-50 border border-stone-200 rounded-2xl px-4 py-2.5 text-sm text-ink placeholder-ink-muted focus:outline-none focus:border-shelf-400 focus:bg-white transition-colors disabled:opacity-50"
            />

            {/* 发送按钮 */}
            <button
              type="button"
              onClick={handleSend}
              disabled={isStreaming || converting || (!input.trim() && !imageFile)}
              className="w-9 h-9 flex items-center justify-center bg-shelf-500 hover:bg-shelf-600 disabled:bg-stone-200 text-white rounded-xl transition-colors shrink-0"
            >
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

      {/* 隐藏的文件 input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImagePick}
      />
    </div>
  );
}
