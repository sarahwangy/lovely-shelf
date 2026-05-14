"use client";
// "use client" 告诉 Next.js：这个组件在浏览器里运行
// 因为需要用户交互（拖拽、点击、状态变化），服务端无法处理这些

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { BookInfo } from "@/types/book";

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
  status: "success" | "error";
  bookInfo?: BookInfo;
  pageUrl?: string;
  error?: string;
};

export default function Home() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<FileItem[]>([]);
  const [processing, setProcessing] = useState(false);
  // currentIndex 记录当前处理到第几张（用于显示进度文字）
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);

  // 更新单个 item 的状态（不影响其他 item）
  // 这里用函数式更新是行业惯例：避免读到过时的 state
  const updateItem = useCallback((id: string, patch: Partial<FileItem>) => {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, ...patch } : item));
  }, []);

  // 把选中的 File 对象转成 FileItem，生成预览 URL
  const addFiles = useCallback((files: FileList | File[]) => {
    const newItems: FileItem[] = Array.from(files).map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
      previewUrl: URL.createObjectURL(file), // 浏览器内存里的临时 URL，不上传到服务器
      status: "pending",
    }));
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

    for (let i = 0; i < pendingItems.length; i++) {
      const item = pendingItems[i];
      setCurrentIndex(i + 1);
      updateItem(item.id, { status: "processing" });

      try {
        // 用 FormData 把图片发给后端，字段名 "image" 要和 route.ts 里对得上
        const formData = new FormData();
        formData.append("image", item.file);

        const res = await fetch("/api/process", { method: "POST", body: formData });
        const data = await res.json();

        if (data.success) {
          updateItem(item.id, { status: "success", bookInfo: data.bookInfo, pageUrl: data.pageUrl });
        } else {
          updateItem(item.id, { status: "error", error: data.error });
        }
      } catch {
        updateItem(item.id, { status: "error", error: "网络错误，请重试" });
      }
    }

    setProcessing(false);

    // 处理完毕：把结果存入 localStorage，跳转到结果页
    // localStorage 是浏览器本地存储，刷新不丢，但关闭浏览器会清空（sessionStorage 才真的关了就没了）
    const results: ProcessResult[] = items.map((item) => ({
      filename: item.file.name,
      previewUrl: item.previewUrl,
      status: item.status === "success" ? "success" : "error",
      bookInfo: item.bookInfo,
      pageUrl: item.pageUrl,
      error: item.error,
    }));
    localStorage.setItem("lovely-shelf-results", JSON.stringify(results));
    router.push("/result");
  };

  const processingItem = items.find((i) => i.status === "processing");
  const progress = processing && items.length > 0
    ? Math.round(((currentIndex - 1) / items.filter(i => i.status !== "pending" || processing).length) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-shelf-50">
      {/* ── Header ── */}
      <header className="bg-white border-b border-stone-100 px-5 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-shelf-500 rounded-xl flex items-center justify-center shadow-sm">
            <span className="text-white text-sm">📚</span>
          </div>
          <span className="font-semibold text-ink text-lg tracking-tight">lovely-shelf</span>
        </div>
        <span className="text-xs text-ink-muted">把书封面变成书库</span>
      </header>

      <main className="max-w-xl mx-auto px-4 py-10">
        {/* Hero */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-ink mb-2">整理你的书架</h1>
          <p className="text-ink-muted text-sm">拍一张封面，AI 自动识别并存入 Notion 书库</p>
        </div>

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
            <p className="font-semibold text-ink mb-1">拍照或选择图片</p>
            <p className="text-ink-light text-sm mb-5">支持 JPG · PNG · HEIC，可多选</p>
            <span className="inline-flex items-center gap-2 bg-shelf-500 hover:bg-shelf-600 text-white text-sm font-medium px-5 py-2.5 rounded-full transition-colors shadow-sm">
              + 选择图片
            </span>
          </div>
        )}

        {/* ── 已选文件：缩略图网格 ── */}
        {items.length > 0 && !processing && (
          <>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-ink">
                已选 <span className="text-shelf-600">{items.length}</span> 张
              </span>
              <button
                onClick={() => setItems([])}
                className="text-xs text-ink-muted hover:text-red-500 transition-colors"
              >
                🗑 清空
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6">
              {items.map((item) => (
                <div key={item.id} className="relative group rounded-xl overflow-hidden aspect-[3/4] bg-stone-100 shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.previewUrl} alt={item.file.name} className="w-full h-full object-cover" />
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
                <span className="text-shelf-400 text-xl mb-1">+</span>
                <span className="text-xs text-shelf-400">继续添加</span>
              </div>
            </div>

            {/* CTA 按钮 */}
            <button
              onClick={handleProcess}
              className="w-full bg-shelf-500 hover:bg-shelf-600 active:bg-shelf-700 text-white font-semibold py-4 rounded-2xl transition-colors shadow-md text-base"
            >
              ✨ 开始识别（{items.length} 张）
            </button>
            <p className="text-center text-xs text-ink-light mt-3">识别完成后可预览并修改，再决定是否写入 Notion</p>
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
                    正在识别第 {currentIndex} / {items.length} 张
                  </p>
                  <p className="text-xs text-ink-muted">{processingItem?.file.name}</p>
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
                    {item.status === "success" ? "完成" :
                     item.status === "error" ? "失败" :
                     item.status === "processing" ? "识别中…" : "等待"}
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
