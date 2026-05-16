"use client";
// "use client" 告诉 Next.js：这个组件在浏览器里运行
// 因为需要用户交互（拖拽、点击、状态变化），服务端无法处理这些

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { BookInfo, BookSummary } from "@/types/book";
import NavBar from "@/components/NavBar";

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

  // HEIC → JPEG 转换，三道保险：
  // 方法1：libheif-js（WebAssembly，支持 HEVC，全浏览器包括 Chrome 都能用）
  // 方法2：heic2any（轻量级，适合部分非 HEVC 编码的 HEIC）
  // 方法3：Canvas 解码（Safari 原生支持 HEVC，fallback）
  const convertIfHeic = async (file: File): Promise<File> => {
    const name = file.name.toLowerCase();
    const isHeic =
      file.type === "image/heic" ||
      file.type === "image/heif" ||
      name.endsWith(".heic") ||
      name.endsWith(".heif");

    if (!isHeic) return file;

    const jpegName = file.name.replace(/\.heic$/i, ".jpg").replace(/\.heif$/i, ".jpg");

    // 方法1：libheif-js（WASM）— 主力方案，iPhone HEVC 格式靠这个
    // 动态 import 避免服务端渲染报错，WASM 只在浏览器里运行
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const libheif = (await import("libheif-js/wasm-bundle")).default as any;
      const arrayBuffer = await file.arrayBuffer();
      const decoder = new libheif.HeifDecoder();
      const data = decoder.decode(new Uint8Array(arrayBuffer));
      if (!data || data.length === 0) throw new Error("no images");

      const image = data[0];
      const width = image.get_width();
      const height = image.get_height();

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      const imageData = ctx.createImageData(width, height);

      // display() 是异步回调：把解码后的像素写入 ImageData，再 putImageData 到 canvas
      await new Promise<void>((resolve, reject) =>
        image.display(imageData, (result: ImageData | null) =>
          result ? resolve() : reject(new Error("libheif display failed"))
        )
      );

      ctx.putImageData(imageData, 0, 0);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
          "image/jpeg",
          0.9
        )
      );
      return new File([blob], jpegName, { type: "image/jpeg" });
    } catch {
      // 方法1 失败，继续尝试方法2
    }

    // 方法2：heic2any（动态 import，用到时才加载）
    try {
      const heic2any = (await import("heic2any")).default;
      const result = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
      const jpeg = Array.isArray(result) ? result[0] : result;
      return new File([jpeg], jpegName, { type: "image/jpeg" });
    } catch {
      // 方法2 失败，继续尝试方法3
    }

    // 方法3：Canvas 解码（Safari 原生支持 HEVC HEIC）
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
          "image/jpeg",
          0.9
        )
      );
      return new File([blob], jpegName, { type: "image/jpeg" });
    } catch {
      // 三种方法都失败，返回原文件（processOne 会给出友好提示）
      return file;
    }
  };

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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
        const msg = "HEIC 转换失败。请在 iPhone「设置 → 相机 → 格式」选「兼容性最佳」后重新拍照上传 JPG";
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
        updateItem(item.id, { status: "error", error: "网络错误，请重试" });
        collectedResults[resultIndex] = {
          filename: item.file.name,
          previewUrl: item.previewUrl,
          status: "error",
          error: "网络错误，请重试",
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
          <h1 className="text-2xl font-bold text-ink mb-2">整理你的书架</h1>
          <p className="text-ink-muted text-sm">拍一张封面，AI 自动识别并存入 Notion 书库</p>
        </div>

        {/* ── HEIC 转换中提示 ── */}
        {converting && (
          <div className="bg-shelf-50 border border-shelf-200 rounded-2xl p-4 mb-4 flex items-center gap-3">
            <div className="w-8 h-8 bg-shelf-100 rounded-full flex items-center justify-center animate-spin text-lg shrink-0">
              ⏳
            </div>
            <div>
              <p className="text-sm font-medium text-ink">正在处理 HEIC…</p>
              <p className="text-xs text-ink-muted">iPhone 原图转换中，通常需要 1-2 秒</p>
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
                    已完成 {currentIndex} / {items.length} 张
                  </p>
                  {/* 并发时显示"正在处理 N 张"，串行时显示具体文件名 */}
                  <p className="text-xs text-ink-muted">
                    {items.filter(i => i.status === "processing").length > 1
                      ? `同时处理 ${items.filter(i => i.status === "processing").length} 张中…`
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
