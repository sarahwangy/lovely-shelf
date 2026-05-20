"use client";
// "use client" 告诉 Next.js：这个组件在浏览器里运行
// 因为需要用户交互（拖拽、点击、状态变化），服务端无法处理这些

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { BookInfo, BookSummary } from "@/types/book";
import NavBar from "@/components/NavBar";
import { useLanguage } from "@/contexts/LanguageContext";
import { convertIfHeic } from "@/lib/heic-converter";

// 每张图片在处理过程中的完整状态
type FileItem = {
  id: string;           // 唯一 ID，用来更新单张图的状态
  file: File;           // 原始文件对象
  previewUrl: string;   // 用 URL.createObjectURL 生成的本地预览地址
  status: "pending" | "processing" | "success" | "error";
  bookInfo?: BookInfo;
  pageUrl?: string;
  error?: string;
};

// 存入 localStorage 的结果格式，result 页面读这个
export type ProcessResult = {
  filename: string;
  previewUrl: string;
  status: "success" | "duplicate" | "error"; // duplicate = 书库已有，跳过写入
  bookInfo?: BookInfo;
  pageUrl?: string;
  error?: string;
  // 入库成功后后端返回的同类书统计，用于结果页"第 X 本 XX 类"提示
  stats?: {
    primaryGenre: string;
    countInGenre: number;
  };
  // 同类书推荐列表
  recommendations?: BookSummary[];
};

export default function Home() {
  const { t } = useLanguage();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<FileItem[]>([]);
  const [processing, setProcessing] = useState(false);
  // currentIndex 记录当前处理到第几张（用于显示进度文字）
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  // converting：HEIC 转换期间为 true，用于显示"正在处理 HEIC..."提示
  const [converting, setConverting] = useState(false);

  // 更新单个 item 的状态（不影响其他 item）
  // 这里用函数式更新是行业惯例：避免读到过时的 state
  const updateItem = useCallback((id: string, patch: Partial<FileItem>) => {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, ...patch } : item));
  }, []);

  // 把选中的 File 对象转成 FileItem，生成预览 URL
  // 改成 async：HEIC 转换是异步的，要等转完再生成预览
  const addFiles = useCallback(async (files: FileList | File[]) => {
    // 有 HEIC 文件时，转换期间显示 loading 提示（heic2any 约 1-2 秒）
    setConverting(true);
    const converted = await Promise.all(Array.from(files).map(convertIfHeic));
    setConverting(false);
    const newItems: FileItem[] = converted.map((file) => {
      const n = file.name.toLowerCase();
      const isStillHeic = n.endsWith(".heic") || n.endsWith(".heif");
      return {
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        file,
        // 转换成功 → 正常预览；仍是 HEIC → 空字符串，用占位卡替代破图
        previewUrl: isStillHeic ? "" : URL.createObjectURL(file),
        status: "pending",
      };
    });
    setItems((prev) => [...prev, ...newItems]);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = ""; // 重置 input，允许重复选同一文件
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  // 拖拽事件：dragover 要 preventDefault 才能触发 drop
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = () => setIsDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
  };

  // 核心流程：逐张调用 /api/process
  const handleProcess = async () => {
    if (items.length === 0 || processing) return;
    setProcessing(true);

    const pendingItems = items.filter((i) => i.status === "pending");
    // 用固定长度数组保证结果顺序和原始文件顺序一致
    const collectedResults: ProcessResult[] = new Array(pendingItems.length);
    let completedCount = 0;

    // 单张处理逻辑，抽成函数方便并发调用
    const processOne = async (item: FileItem, resultIndex: number) => {
      updateItem(item.id, { status: "processing" });

      // 如果文件还是 HEIC，说明前端 heic2any 转换失败，直接告知用户，不发给后端
      // （后端 Vercel 环境的 sharp 也没有 HEVC codec，发过去也会报同样的错）
      const name = item.file.name.toLowerCase();
      if (name.endsWith(".heic") || name.endsWith(".heif") || item.file.type === "image/heic" || item.file.type === "image/heif") {
        const msg = t.upload.heicError;
        updateItem(item.id, { status: "error", error: msg });
        collectedResults[resultIndex] = { filename: item.file.name, previewUrl: item.previewUrl, status: "error", error: msg };
        completedCount += 1;
        setCurrentIndex(completedCount);
        return;
      }

      try {
        const formData = new FormData();
        formData.append("image", item.file);
        // NEXT_PUBLIC_USE_AGENT=true → 走新 Agent 流程；默认走旧固定流程
        // NEXT_PUBLIC_ 前缀让环境变量在浏览器里也能读到（Next.js 约定）
        const endpoint = process.env.NEXT_PUBLIC_USE_AGENT === "true" ? "/api/agent" : "/api/process";
        const res = await fetch(endpoint, { method: "POST", body: formData });
        const data = await res.json();

        if (data.success && data.isDuplicate) {
          // 重复：书库已有，跳过写入
          updateItem(item.id, { status: "success", bookInfo: data.bookInfo, pageUrl: data.pageUrl });
          collectedResults[resultIndex] = {
            filename: item.file.name,
            previewUrl: item.previewUrl,
            status: "duplicate",
            bookInfo: data.bookInfo,
            pageUrl: data.pageUrl,
          };
        } else if (data.success) {
          updateItem(item.id, { status: "success", bookInfo: data.bookInfo, pageUrl: data.pageUrl });
          collectedResults[resultIndex] = {
            filename: item.file.name,
            previewUrl: item.previewUrl,
            status: "success",
            bookInfo: data.bookInfo,
            pageUrl: data.pageUrl,
            stats: data.stats ?? undefined,
            recommendations: data.recommendations ?? undefined,
          };
        } else {
          updateItem(item.id, { status: "error", error: data.error });
          collectedResults[resultIndex] = {
            filename: item.file.name,
            previewUrl: item.previewUrl,
            status: "error",
            error: data.error,
          };
        }
      } catch {
        updateItem(item.id, { status: "error", error: t.upload.networkError });
        collectedResults[resultIndex] = {
          filename: item.file.name,
          previewUrl: item.previewUrl,
          status: "error",
          error: t.upload.networkError,
        };
      }
      // 完成一张就更新计数，多个并发任务各自触发，互不干扰
      completedCount += 1;
      setCurrentIndex(completedCount);
    };

    // 分批并发：每批最多 3 张同时跑，一批全部完成再开下一批
    // 为什么是 3：Claude API 有并发限制，太多同时请求会触发 429 限流
    const BATCH_SIZE = 3;
    for (let i = 0; i < pendingItems.length; i += BATCH_SIZE) {
      const batch = pendingItems.slice(i, i + BATCH_SIZE);
      // Promise.all 让这批图片同时发出请求，等所有都完成再继续
      await Promise.all(batch.map((item, batchIdx) => processOne(item, i + batchIdx)));
    }

    setProcessing(false);
    // localStorage 是浏览器本地存储，刷新不丢，但关闭浏览器会清空
    localStorage.setItem("lovely-shelf-results", JSON.stringify(collectedResults));
    router.push("/result");
  };

  // currentIndex 现在代表"已完成张数"，进度 = 已完成 / 总数
  const progress = processing && items.length > 0
    ? Math.round((currentIndex / items.length) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-shelf-50">
      <NavBar />

      <main className="max-w-xl mx-auto px-4 py-10">
        {/* Hero */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-ink mb-2">{t.upload.title}</h1>
          <p className="text-ink-muted text-sm">{t.upload.subtitle}</p>
        </div>

        {/* ── HEIC 转换中提示 ── */}
        {converting && (
          <div className="bg-shelf-50 border border-shelf-200 rounded-2xl p-4 mb-4 flex items-center gap-3">
            <div className="w-8 h-8 bg-shelf-100 rounded-full flex items-center justify-center animate-spin text-lg shrink-0">
              ⏳
            </div>
            <div>
              <p className="text-sm font-medium text-ink">{t.upload.heicProcessing}</p>
              <p className="text-xs text-ink-muted">{t.upload.heicHint}</p>
            </div>
          </div>
        )}

        {/* ── Drop Zone（没有文件时显示）── */}
        {items.length === 0 && (
          <div
            className={`drop-zone-pattern border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 mb-4
              ${isDragOver
                ? "border-shelf-500 bg-shelf-100"
                : "border-shelf-300 hover:border-shelf-500 hover:bg-shelf-50"
              }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="w-16 h-16 bg-shelf-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <span className="text-3xl">📷</span>
            </div>
            <p className="font-semibold text-ink mb-1">{t.upload.dragHint}</p>
            <p className="text-ink-light text-sm mb-5">{t.upload.supportHint}</p>
            <span className="inline-flex items-center gap-2 bg-shelf-500 hover:bg-shelf-600 text-white text-sm font-medium px-5 py-2.5 rounded-full transition-colors shadow-sm">
              {t.upload.selectBtn}
            </span>
          </div>
        )}

        {/* ── 已选文件：缩略图网格 ── */}
        {items.length > 0 && !processing && (
          <>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-ink">
                {t.upload.selected(items.length)}
              </span>
              <button
                onClick={() => setItems([])}
                className="text-xs text-ink-muted hover:text-red-500 transition-colors"
              >
                🗑 {t.upload.clear}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6">
              {items.map((item) => (
                <div key={item.id} className="relative group rounded-xl overflow-hidden aspect-[3/4] bg-stone-100 shadow-sm">
                  {item.previewUrl ? (
                    // 正常预览（JPG/PNG/转换成功的 HEIC）
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.previewUrl} alt={item.file.name} className="w-full h-full object-cover" />
                  ) : (
                    // HEIC 转换失败时的占位：不显示破图，显示书本图标
                    <div className="w-full h-full flex flex-col items-center justify-center bg-shelf-50 gap-2">
                      <span className="text-4xl">📷</span>
                      <span className="text-xs text-shelf-500 font-medium">HEIC</span>
                    </div>
                  )}
                  {/* hover 时显示删除按钮 */}
                  <button
                    onClick={() => removeItem(item.id)}
                    className="absolute top-2 right-2 w-6 h-6 bg-black/60 rounded-full text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  >
                    ✕
                  </button>
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/50 to-transparent p-2">
                    <p className="text-white text-xs truncate">{item.file.name}</p>
                  </div>
                </div>
              ))}

              {/* 继续添加按钮 */}
              <div
                className="rounded-xl border-2 border-dashed border-shelf-200 aspect-[3/4] flex flex-col items-center justify-center cursor-pointer hover:border-shelf-400 hover:bg-shelf-50 transition-all"
                onClick={() => fileInputRef.current?.click()}
              >
                <span className="text-shelf-400 text-4xl leading-none mb-1">+</span>
                <span className="text-xs text-shelf-400">{t.upload.addMore}</span>
              </div>
            </div>

            {/* CTA 按钮 */}
            <button
              onClick={handleProcess}
              className="w-full bg-shelf-500 hover:bg-shelf-600 active:bg-shelf-700 text-white font-semibold py-4 rounded-2xl transition-colors shadow-md text-base"
            >
              {t.upload.scanBtn(items.length)}
            </button>
            <p className="text-center text-xs text-ink-light mt-3">{t.upload.scanHint}</p>
          </>
        )}

        {/* ── 处理中状态 ── */}
        {processing && (
          <>
            <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-5 mb-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-shelf-100 rounded-full flex items-center justify-center animate-spin text-xl">
                  ⏳
                </div>
                <div>
                  <p className="font-semibold text-ink text-sm">
                    {t.upload.completed(currentIndex, items.length)}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {items.filter(i => i.status === "processing").length > 1
                      ? t.upload.batchProcessing(items.filter(i => i.status === "processing").length)
                      : items.find(i => i.status === "processing")?.file.name}
                  </p>
                </div>
              </div>
              {/* 进度条 */}
              <div className="w-full bg-shelf-100 rounded-full h-2">
                <div
                  className="bg-shelf-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* 每张图的状态列表 */}
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 border
                    ${item.status === "success" ? "bg-green-50 border-green-100" :
                      item.status === "error" ? "bg-red-50 border-red-100" :
                      item.status === "processing" ? "bg-shelf-50 border-shelf-200" :
                      "bg-white border-stone-100"
                    }`}
                >
                  <span>
                    {item.status === "success" ? "✅" :
                     item.status === "error" ? "❌" :
                     item.status === "processing" ? "⏳" : "⬜"}
                  </span>
                  <span className="text-sm text-ink flex-1 truncate">{item.file.name}</span>
                  <span className="text-xs font-medium text-ink-muted">
                    {item.status === "success" ? t.upload.done :
                     item.status === "error" ? t.upload.failed :
                     item.status === "processing" ? t.upload.processing : t.upload.waiting}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* 隐藏的文件输入 */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileInput}
        />
      </main>
    </div>
  );
}
