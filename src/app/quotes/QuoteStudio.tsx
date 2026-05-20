"use client";

import { useState, useMemo, useRef } from "react";
import type { QuoteBook } from "@/app/api/quotes/route";
import type { ImageResult } from "@/app/api/images/route";
import type { VideoResult } from "@/app/api/videos/route";
import type { MusicResult } from "@/app/api/music/route";
import { useLanguage } from "@/contexts/LanguageContext";
import { convertIfHeic } from "@/lib/heic-converter";
import {
  COLOR_PRESETS, GRADIENT_PRESETS, TEXT_COLOR_PRESETS, CARD_EMOJIS,
  FONT_OPTIONS, FONT_SIZE_LABEL, FONT_SIZE_CLASS,
} from "./studioConstants";
import type { BgType, FontSize, VPos, HAlign, FontFamily, CardStyle } from "./studioConstants";
import { useMediaSearch } from "./useMediaSearch";
import { useCardExport } from "./useCardExport";

export type { CardStyle };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySpeech = any;

// ── 主组件 ────────────────────────────────────────────────────────

export default function QuoteStudio({
  initialText      = "",
  initialBookTitle = "",
  initialAuthor    = "",
  initialStyle,
  styleKey,
  onSaved,
  onTextChanged,
  onClose,
}: {
  initialText?:      string;
  initialBookTitle?: string;
  initialAuthor?:    string;
  initialStyle?:     CardStyle;     // 上次使用的卡片样式（从 localStorage 读取）
  styleKey?:         string;        // localStorage key，导出后用来保存样式
  onSaved?:          (book: QuoteBook) => void;
  onTextChanged?:    (newText: string) => void; // 样式编辑模式下文字被修改后的回调
  onClose:           () => void;
}) {
  const { t, lang } = useLanguage();

  // ── 卡片内容 ──────────────────────────────────────────────────────
  const [text,      setText]      = useState(initialText);
  const [bookTitle, setBookTitle] = useState(initialBookTitle);
  const [author,    setAuthor]    = useState(initialAuthor);

  // ── 文字样式（有 initialStyle 时恢复上次的设置，否则用默认值）──────
  const [textColor,   setTextColor]   = useState(initialStyle?.textColor ?? "#ffffff");
  const [fontSize,    setFontSize]    = useState<FontSize>(initialStyle?.fontSize ?? "sm");
  const [fontFamily,  setFontFamily]  = useState<FontFamily>(initialStyle?.fontFamily ?? FONT_OPTIONS[0].css);
  const [vPos,      setVPos]      = useState<VPos>(initialStyle?.vPos ?? "center");
  const [hAlign,    setHAlign]    = useState<HAlign>(initialStyle?.hAlign ?? "center");
  const [showWave,  setShowWave]  = useState(initialStyle?.showWave ?? false);

  // ── 背景 ──────────────────────────────────────────────────────────
  const [bgType,  setBgType]  = useState<BgType>(initialStyle?.bgType ?? "color");
  const [bgValue, setBgValue] = useState(initialStyle?.bgValue ?? COLOR_PRESETS[0].value);

  // ── 图片搜索 ──────────────────────────────────────────────────────
  const [imageFile,  setImageFile]  = useState<File | null>(null);
  const [imageUrl,   setImageUrl]   = useState<string | null>(null);
  const [converting, setConverting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef  = useRef<HTMLTextAreaElement>(null);

  // 三个搜索各调用一次通用 Hook，state 和 fetch 逻辑不再重复写
  const imgSearch = useMediaSearch<ImageResult>("/api/images", "images", t.quoteStudio.imgSearchError, "pixabay");
  const vidSearch = useMediaSearch<VideoResult>("/api/videos", "videos", t.quoteStudio.vidSearchError, "pixabay");
  const musSearch = useMediaSearch<MusicResult>("/api/music",  "music",  t.quoteStudio.musSearchError);

  // ── 视频背景 ──────────────────────────────────────────────────────
  const [videoSrc, setVideoSrc] = useState(initialStyle?.videoSrc ?? "");
  const videoRef = useRef<HTMLVideoElement>(null);

  // ── 录制配乐 ──────────────────────────────────────────────────────
  const [recMusicUrl,   setRecMusicUrl]   = useState("");
  const [recMusicTitle, setRecMusicTitle] = useState("");

  // ── 语音 ──────────────────────────────────────────────────────────
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<AnySpeech>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w         = typeof window !== "undefined" ? (window as any) : null;
  const SpeechAPI = w ? (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) : null;

  // ── 配乐 / 视频链接 ────────────────────────────────────────────────
  const [musicUrl,  setMusicUrl]  = useState("");
  const [videoUrl,  setVideoUrl]  = useState("");
  const [showMedia, setShowMedia] = useState(false);

  // ── 操作状态 ──────────────────────────────────────────────────────
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Google Fonts 动态加载 ────────────────────────────────────────
  // 每当字体切换时，把对应的 Google Fonts <link> 注入 <head>（已注入则跳过）
  const option = FONT_OPTIONS.find((f) => f.css === fontFamily);
  if (typeof window !== "undefined" && option?.google) {
    const id = `gf-${option.google.split(":")[0].replace(/\+/g, "-")}`;
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id   = id;
      link.rel  = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${option.google}&display=swap`;
      document.head.appendChild(link);
    }
  }

  // ── 背景 CSS ──────────────────────────────────────────────────────
  const cardStyle = useMemo<React.CSSProperties>(() => {
    if (bgType === "color")    return { backgroundColor: bgValue };
    if (bgType === "gradient") return { backgroundImage: bgValue, backgroundSize: "cover" };
    if (bgType === "image" && bgValue) {
      const src = bgValue.startsWith("data:")
        ? bgValue
        : `/api/images/proxy?url=${encodeURIComponent(bgValue)}`;
      return { backgroundImage: `url(${src})`, backgroundSize: "cover", backgroundPosition: "center" };
    }
    if (bgType === "video") return { backgroundColor: "#0a0a0a" };
    return { backgroundColor: COLOR_PRESETS[0].value };
  }, [bgType, bgValue]);

  const hasOverlay = (bgType === "image" && !!bgValue) || (bgType === "video" && !!videoSrc);
  const textShadow = hasOverlay ? "0 2px 8px rgba(0,0,0,0.6)" : "0 1px 4px rgba(0,0,0,0.12)";

  // 位置 class（写全 class name 避免 Tailwind purge）
  const justifyClass   = vPos   === "top"    ? "justify-start" : vPos   === "bottom" ? "justify-end"  : "justify-center";
  const itemsClass     = hAlign === "left"   ? "items-start"   : hAlign === "right"  ? "items-end"    : "items-center";
  const textAlignClass = hAlign === "left"   ? "text-left"     : hAlign === "right"  ? "text-right"   : "text-center";
  const paddingClass   = vPos   === "top"    ? "pt-5"          : vPos   === "bottom" ? "pb-5"         : "";

  // ── 背景类型切换 ──────────────────────────────────────────────────
  function switchBgType(type: BgType) {
    setBgType(type);
    setImageFile(null); setImageUrl(null);
    if (type !== "video") setVideoSrc("");
    if (type === "color")    setBgValue(COLOR_PRESETS[0].value);
    if (type === "gradient") setBgValue(GRADIENT_PRESETS[0].value);
    if (type === "image" || type === "video") setBgValue("");
  }

  // ── 语音输入 ──────────────────────────────────────────────────────
  function toggleVoice() {
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }
    if (!SpeechAPI) return;
    const r = new SpeechAPI();
    r.lang = lang === "en" ? "en-US" : "zh-CN"; r.continuous = true; r.interimResults = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (e: any) => {
      const transcript = e.results[e.results.length - 1][0].transcript;
      setText((prev) => prev ? prev + " " + transcript : transcript);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    r.start(); recognitionRef.current = r; setListening(true);
  }

  // ── 本地图片上传 ──────────────────────────────────────────────────
  async function handleLocalUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.files?.[0];
    if (!raw) return;
    e.target.value = "";
    setConverting(true); setImageUrl(null);
    const file = await convertIfHeic(raw);
    setImageFile(file);
    setConverting(false);
    const reader = new FileReader();
    reader.onload = (evt) => { setBgValue(evt.target?.result as string ?? ""); setBgType("image"); };
    reader.readAsDataURL(file);
  }

  function selectImage(img: ImageResult) {
    setImageUrl(img.fullUrl); setImageFile(null);
    setBgValue(img.fullUrl); setBgType("image");
  }

  function clearImage() {
    setImageFile(null); setImageUrl(null); setBgValue(""); setBgType("image");
  }

  function selectVideo(vid: VideoResult) {
    setVideoSrc(vid.videoUrl); setBgType("video"); setBgValue("");
  }

  // ── Emoji 插入光标 ────────────────────────────────────────────────
  // 点击 emoji 时，把它插入到 textarea 当前光标位置（多选：可以连续点击插入多个）
  function insertEmoji(emoji: string) {
    const ta = textareaRef.current;
    if (!ta) { setText((prev) => prev + emoji); return; }
    const start = ta.selectionStart;
    const end   = ta.selectionEnd;
    const next  = text.slice(0, start) + emoji + text.slice(end);
    setText(next);
    // 把光标移到 emoji 之后（setTimeout 等 React 重渲染完再设置）
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);
  }

  // ── 保存当前卡片样式到 localStorage ──────────────────────────────────
  // 下次点击 🎨 时可以恢复；data: URL（本地上传图片）太大不存，回退到默认纯色
  function saveStyle() {
    if (!styleKey) return;
    const style: CardStyle = {
      textColor,
      fontSize,
      fontFamily,
      vPos,
      hAlign,
      showWave,
      bgType:  (bgType === "image" && bgValue.startsWith("data:")) ? "color" : bgType,
      bgValue: bgValue.startsWith("data:") ? COLOR_PRESETS[0].value : bgValue,
      videoSrc,
    };
    try { localStorage.setItem(styleKey, JSON.stringify(style)); } catch { /* storage full */ }
  }

  // ── 导出 / 录制（委托给 useCardExport）──────────────────────────────
  const { handleExport, handleExportVideo, exporting, recording, recordDuration, setRecordDuration } =
    useCardExport(
      { text, bookTitle, author },
      { textColor, fontSize, fontFamily, vPos, hAlign, showWave, videoSrc },
      videoRef,
      recMusicUrl,
      saveStyle,
    );

  // ── 保存 ─────────────────────────────────────────────────────────
  async function handleSave() {
    if (!text.trim() || !onSaved) return;
    setSaving(true); setSaveError(null);
    try {
      const fd = new FormData();
      fd.append("text", text);
      fd.append("bookTitle", bookTitle);
      if (author.trim())    fd.append("author", author);
      if (imageFile)        fd.append("imageFile", imageFile);
      if (imageUrl)         fd.append("imageUrl", imageUrl);
      if (musicUrl.trim())  fd.append("musicUrl", musicUrl.trim());
      if (videoUrl.trim())  fd.append("videoUrl", videoUrl.trim());
      const res  = await fetch("/api/quotes", { method: "POST", body: fd });
      const data = (await res.json()) as { book?: QuoteBook; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? t.quoteStudio.saveFailed);
      onSaved(data.book!);
    } catch (e) {
      setSaveError((e as Error).message);
    } finally { setSaving(false); }
  }

  const saveLabel = saving ? t.common.saving : bookTitle.trim() ? `💾 ${t.common.save}` : `✨ ${t.quotes.addQuote}`;

  return (
    <>
      {/* 波浪动画 keyframe（在组件内定义，不污染全局）*/}
      <style>{`
        @keyframes qs-wave {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>

      <div
        className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">

          {/* 标题栏 */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 shrink-0">
            <h2 className="font-semibold text-ink text-lg">{t.quoteStudio.title}</h2>
            <button type="button" onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full text-ink-muted hover:bg-stone-100 transition-colors">
              ✕
            </button>
          </div>

          <div className="flex flex-col md:flex-row flex-1 min-h-0">

            {/* ── 左：实时预览 ── */}
            <div className="md:w-64 shrink-0 flex flex-col items-center justify-center gap-4 p-6 bg-stone-50 border-b md:border-b-0 md:border-r border-stone-100">

              {/* 卡片预览 */}
              <div
                id="qs-card-preview"
                className={`relative rounded-2xl overflow-hidden flex flex-col ${justifyClass} ${itemsClass}`}
                style={{ width: 216, height: 320, ...cardStyle }}
              >
                {/* 视频背景：直接显示在卡片内，html-to-image 通过 foreignObject 能捕捉到 */}
                {bgType === "video" && videoSrc && (
                  <video ref={videoRef} src={videoSrc} autoPlay loop muted playsInline
                    crossOrigin="anonymous"
                    className="absolute inset-0 w-full h-full"
                    style={{ objectFit: "cover" }} />
                )}

                {/* 半透明遮罩（图片/视频背景时让文字更清晰）*/}
                {hasOverlay && <div className="absolute inset-0 bg-black/30" />}

                {/* 波浪装饰 */}
                {showWave && (
                  <div className="absolute bottom-0 left-0 right-0 overflow-hidden" style={{ height: 52 }}>
                    <div style={{ width: "200%", animation: "qs-wave 4s linear infinite" }}>
                      <svg viewBox="0 0 432 52" style={{ display: "block", width: "100%", height: 52 }}>
                        <path d="M0 26 Q54 4 108 26 Q162 48 216 26 Q270 4 324 26 Q378 48 432 26 L432 52 L0 52 Z"
                          fill={textColor} fillOpacity="0.22" />
                        <path d="M0 36 Q54 14 108 36 Q162 58 216 36 Q270 14 324 36 Q378 58 432 36 L432 52 L0 52 Z"
                          fill={textColor} fillOpacity="0.14" />
                      </svg>
                    </div>
                  </div>
                )}

                {/* 卡片内容 */}
                <div className={`relative z-10 px-5 w-full flex flex-col gap-2 ${itemsClass} ${paddingClass}`}>
                  <p className={`leading-relaxed font-medium w-full ${FONT_SIZE_CLASS[fontSize]} ${textAlignClass}`}
                    style={{ color: textColor, textShadow, fontFamily }}>
                    {text || t.quoteStudio.cardPlaceholder}
                  </p>
                  {bookTitle && (
                    <p className={`text-xs w-full ${textAlignClass}`}
                      style={{ color: textColor, textShadow, opacity: 0.7, fontFamily }}>
                      — {bookTitle}{author ? ` · ${author}` : ""}
                    </p>
                  )}
                </div>
              </div>

              {/* 语音输入 */}
              {SpeechAPI && (
                <button type="button" onClick={toggleVoice}
                  className={`w-full py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                    listening ? "bg-red-500 text-white animate-pulse" : "bg-stone-100 text-ink-muted hover:bg-stone-200"
                  }`}>
                  <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="2" width="6" height="11" rx="3" />
                    <path d="M5 10a7 7 0 0 0 14 0" /><line x1="12" y1="19" x2="12" y2="22" /><line x1="8" y1="22" x2="16" y2="22" />
                  </svg>
                  {listening ? t.quoteStudio.voiceListening : t.quoteStudio.voiceInput}
                </button>
              )}

              {/* 导出按钮：视频背景 → 录制 MP4；其他 → 导出 PNG */}
              {bgType === "video" && videoSrc ? (
                <div className="w-full space-y-2">
                  {/* 录制时长选择 */}
                  <div className="flex gap-1 bg-stone-100 rounded-xl p-1">
                    {[5, 10, 15].map((d) => (
                      <button key={d} type="button" onClick={() => setRecordDuration(d)}
                        className={`flex-1 py-1 rounded-lg text-xs font-medium transition-colors ${
                          recordDuration === d ? "bg-white text-ink shadow-sm" : "text-ink-muted hover:text-ink"
                        }`}>{d}s</button>
                    ))}
                  </div>
                  {recMusicUrl && (
                    <p className="text-[10px] text-shelf-600 text-center truncate px-1">♪ {recMusicTitle}</p>
                  )}
                  <button type="button" onClick={handleExportVideo} disabled={recording}
                    className="w-full py-2.5 rounded-xl text-sm font-medium bg-shelf-500 hover:bg-shelf-600 disabled:bg-stone-300 text-white transition-colors">
                    {recording ? t.quoteStudio.recording(recordDuration) : t.quoteStudio.recordMP4}
                  </button>
                </div>
              ) : (
                <button type="button" onClick={handleExport} disabled={exporting}
                  className="w-full py-2.5 rounded-xl text-sm font-medium bg-shelf-500 hover:bg-shelf-600 disabled:bg-stone-300 text-white transition-colors">
                  {exporting ? t.quoteStudio.exporting : t.quoteStudio.exportPNG}
                </button>
              )}

              {/* 样式编辑模式（从 🎨 打开）：明确的保存 / 取消 */}
              {!onSaved && styleKey && (
                <div className="w-full flex gap-2">
                  <button type="button" onClick={onClose}
                    className="flex-1 py-2 rounded-xl text-sm font-medium bg-stone-100 text-ink-muted hover:bg-stone-200 transition-colors">
                    {t.common.cancel}
                  </button>
                  <button type="button" onClick={() => {
                    saveStyle();
                    // 如果文字被修改过，通知父组件更新卡片显示
                    if (onTextChanged && text !== initialText) onTextChanged(text);
                    onClose();
                  }}
                    className="flex-1 py-2 rounded-xl text-sm font-medium bg-ink hover:bg-ink/80 text-white transition-colors">
                    {t.quoteStudio.saveStyle}
                  </button>
                </div>
              )}
            </div>

            {/* ── 右：控制面板 ── */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">

              {/* 语句内容 */}
              <div>
                <label className="text-xs font-medium text-ink-muted mb-1.5 block">{t.quoteStudio.quoteLabel}</label>
                <textarea
                  ref={textareaRef}
                  value={text} onChange={(e) => setText(e.target.value)}
                  placeholder={t.quoteStudio.quotePlaceholder} rows={4}
                  className="w-full resize-none bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm text-ink placeholder-ink-muted focus:outline-none focus:border-shelf-400 focus:bg-white transition-colors leading-relaxed"
                />
              </div>

              {/* 来源书名 + 作者 */}
              <div className="flex gap-3">
                <input value={bookTitle} onChange={(e) => setBookTitle(e.target.value)}
                  placeholder={t.quoteStudio.bookPlaceholder}
                  className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-shelf-400 focus:bg-white transition-colors" />
                <input value={author} onChange={(e) => setAuthor(e.target.value)}
                  placeholder={t.quoteStudio.authorPlaceholder}
                  className="w-28 bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-shelf-400 focus:bg-white transition-colors" />
              </div>

              {/* ── 卡片背景 ── */}
              <div>
                <p className="text-xs font-medium text-ink-muted mb-2">{t.quoteStudio.bgSection}</p>
                <div className="flex gap-1 bg-stone-100 rounded-xl p-1 mb-3">
                  {(["color", "gradient", "image", "video"] as BgType[]).map((bgT) => (
                    <button key={bgT} type="button" onClick={() => switchBgType(bgT)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        bgType === bgT ? "bg-white text-ink shadow-sm" : "text-ink-muted hover:text-ink"
                      }`}>
                      {bgT === "color" ? t.quoteStudio.bgColor : bgT === "gradient" ? t.quoteStudio.bgGradient : bgT === "image" ? t.quoteStudio.bgImage : t.quoteStudio.bgVideo}
                    </button>
                  ))}
                </div>

                {/* 纯色 */}
                {bgType === "color" && (
                  <div className="grid grid-cols-4 gap-3">
                    {COLOR_PRESETS.map((c) => (
                      <button key={c.value} type="button" onClick={() => setBgValue(c.value)} title={c.label}
                        className={`aspect-square rounded-xl border-2 transition-all ${
                          bgValue === c.value ? "border-shelf-500 scale-95 shadow-md" : "border-transparent hover:scale-95"
                        }`} style={{ backgroundColor: c.value }} />
                    ))}
                  </div>
                )}

                {/* 渐变 */}
                {bgType === "gradient" && (
                  <div className="grid grid-cols-4 gap-3">
                    {GRADIENT_PRESETS.map((g) => (
                      <button key={g.value} type="button" onClick={() => setBgValue(g.value)} title={g.label}
                        className={`aspect-square rounded-xl border-2 transition-all ${
                          bgValue === g.value ? "border-shelf-500 scale-95 shadow-md" : "border-transparent hover:scale-95"
                        }`} style={{ backgroundImage: g.value }} />
                    ))}
                  </div>
                )}

                {/* 图片 */}
                {bgType === "image" && (
                  <div className="space-y-3">
                    {(bgValue || converting) && (
                      <div className="relative">
                        {converting ? (
                          <div className="w-full h-20 bg-stone-100 rounded-xl flex items-center justify-center text-ink-muted text-sm">{t.quoteStudio.converting}</div>
                        ) : bgValue ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={bgValue.startsWith("data:") ? bgValue : `/api/images/proxy?url=${encodeURIComponent(bgValue)}`}
                              alt="背景预览" className="w-full h-24 object-cover rounded-xl shadow-sm" />
                            <button type="button" onClick={clearImage}
                              className="absolute top-2 right-2 w-5 h-5 bg-black/50 text-white rounded-full text-xs flex items-center justify-center hover:bg-black/70 transition-colors">✕</button>
                          </>
                        ) : null}
                      </div>
                    )}
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                      className="w-full py-2 rounded-xl border-2 border-dashed border-stone-300 text-sm text-ink-muted hover:border-shelf-400 hover:text-shelf-600 transition-colors">
                      {t.quoteStudio.localUpload}
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLocalUpload} />
                    <p className="text-xs text-stone-400">{t.quoteStudio.pixabayHint}</p>
                    <form onSubmit={imgSearch.handleSearch} className="flex gap-2">
                      <input value={imgSearch.query} onChange={(e) => imgSearch.setQuery(e.target.value)}
                        placeholder={t.quoteStudio.searchImgPlaceholder}
                        className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-shelf-400 transition-colors" />
                      <button type="submit" disabled={imgSearch.searching}
                        className="px-4 py-2 bg-shelf-500 hover:bg-shelf-600 disabled:bg-stone-200 text-white rounded-xl text-sm transition-colors">
                        {imgSearch.searching ? "…" : t.quoteStudio.searchBtn}
                      </button>
                    </form>
                    {imgSearch.error && <p className="text-xs text-red-500">{imgSearch.error}</p>}
                    {imgSearch.results.length > 0 && (
                      <div className="grid grid-cols-3 gap-2">
                        {imgSearch.results.map((img) => (
                          <button key={img.id} type="button" onClick={() => selectImage(img)}
                            className={`aspect-[3/4] rounded-xl overflow-hidden border-2 transition-all ${
                              imageUrl === img.fullUrl ? "border-shelf-500 scale-95" : "border-transparent hover:scale-95"
                            }`}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img.thumbUrl} alt={img.author} className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 动态视频背景 */}
                {bgType === "video" && (
                  <div className="space-y-3">
                    <p className="text-xs text-ink-muted">{t.quoteStudio.videoHint}</p>
                    {videoSrc && (
                      <div className="relative">
                        <video src={videoSrc} autoPlay loop muted playsInline
                          className="w-full h-24 object-cover rounded-xl shadow-sm" />
                        <button type="button" onClick={() => setVideoSrc("")}
                          className="absolute top-2 right-2 w-5 h-5 bg-black/50 text-white rounded-full text-xs flex items-center justify-center hover:bg-black/70 transition-colors">✕</button>
                      </div>
                    )}
                    <p className="text-xs text-stone-400">{t.quoteStudio.pixabayVideoHint}</p>
                    <form onSubmit={vidSearch.handleSearch} className="flex gap-2">
                      <input value={vidSearch.query} onChange={(e) => vidSearch.setQuery(e.target.value)}
                        placeholder={t.quoteStudio.searchVidPlaceholder}
                        className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-shelf-400 transition-colors" />
                      <button type="submit" disabled={vidSearch.searching}
                        className="px-4 py-2 bg-shelf-500 hover:bg-shelf-600 disabled:bg-stone-200 text-white rounded-xl text-sm transition-colors">
                        {vidSearch.searching ? "…" : t.quoteStudio.searchBtn}
                      </button>
                    </form>
                    {vidSearch.error && <p className="text-xs text-red-500">{vidSearch.error}</p>}
                    {vidSearch.results.length > 0 && (
                      <div className="grid grid-cols-3 gap-2">
                        {vidSearch.results.map((vid) => (
                          <button key={vid.id} type="button" onClick={() => selectVideo(vid)}
                            className={`aspect-[3/4] rounded-xl overflow-hidden border-2 transition-all relative ${
                              videoSrc === vid.videoUrl ? "border-shelf-500 scale-95" : "border-transparent hover:scale-95"
                            }`}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={vid.thumbUrl} alt={vid.author} className="w-full h-full object-cover" />
                            <span className="absolute inset-0 flex items-center justify-center bg-black/20">
                              <span className="text-white text-lg">▶</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* ── 录制配乐（Pixabay 音乐库）── */}
                    <div className="pt-3 border-t border-stone-200">
                      <p className="text-xs font-medium text-ink-muted mb-2">
                        {t.quoteStudio.recMusicLabel}
                        <span className="font-normal text-stone-400 ml-1">{t.quoteStudio.recMusicHint}</span>
                      </p>

                      {/* 已选音乐提示条 */}
                      {recMusicUrl && (
                        <div className="flex items-center gap-2 bg-shelf-50 border border-shelf-200 rounded-xl px-3 py-2 mb-2">
                          <span className="text-xs text-shelf-700 flex-1 truncate">♪ {recMusicTitle}</span>
                          <button type="button"
                            onClick={() => { setRecMusicUrl(""); setRecMusicTitle(""); musSearch.setQuery(""); }}
                            className="text-stone-400 hover:text-stone-600 text-xs shrink-0">✕</button>
                        </div>
                      )}

                      <form onSubmit={musSearch.handleSearch} className="flex gap-2">
                        <input value={musSearch.query} onChange={(e) => musSearch.setQuery(e.target.value)}
                          placeholder={t.quoteStudio.searchMusPlaceholder}
                          className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-shelf-400 transition-colors" />
                        <button type="submit" disabled={musSearch.searching}
                          className="px-4 py-2 bg-shelf-500 hover:bg-shelf-600 disabled:bg-stone-200 text-white rounded-xl text-sm transition-colors">
                          {musSearch.searching ? "…" : t.quoteStudio.searchBtn}
                        </button>
                      </form>
                      {musSearch.error && <p className="text-xs text-red-500 mt-1">{musSearch.error}</p>}

                      {/* 音乐结果列表 */}
                      {musSearch.results.length > 0 && (
                        <div className="mt-2 space-y-1.5 max-h-44 overflow-y-auto">
                          {musSearch.results.map((m) => {
                            // 音频走代理路由：绕过 Jamendo CDN 的 CORS 限制
                            const proxied = `/api/music/proxy?url=${encodeURIComponent(m.previewUrl)}`;
                            return (
                              <div key={m.id}
                                onClick={() => { setRecMusicUrl(m.previewUrl); setRecMusicTitle(m.title); }}
                                className={`flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-colors ${
                                  recMusicUrl === m.previewUrl
                                    ? "bg-shelf-50 border border-shelf-300"
                                    : "bg-stone-50 hover:bg-stone-100"
                                }`}>
                                {/* 预览播放：通过代理 URL 避免 CORS 问题 */}
                                <button type="button"
                                  onClick={(e) => { e.stopPropagation(); new Audio(proxied).play(); }}
                                  className="w-6 h-6 rounded-full bg-shelf-500 hover:bg-shelf-600 text-white flex items-center justify-center shrink-0 text-[9px] transition-colors">
                                  ▶
                                </button>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-ink truncate">{m.title}</p>
                                  <p className="text-[10px] text-ink-muted">
                                    {m.author} · {Math.floor(m.duration / 60)}:{String(m.duration % 60).padStart(2, "0")}
                                  </p>
                                </div>
                                {recMusicUrl === m.previewUrl && (
                                  <span className="text-shelf-600 text-[10px] font-medium shrink-0">{t.quoteStudio.selected}</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* ── 文字颜色 ── */}
              <div className="pt-3 border-t border-stone-100">
                <p className="text-xs font-medium text-ink-muted mb-2">{t.quoteStudio.textColorLabel}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {TEXT_COLOR_PRESETS.map((c) => (
                    <button key={c.value} type="button" onClick={() => setTextColor(c.value)} title={c.label}
                      className={`w-7 h-7 rounded-full border-2 transition-all shrink-0 ${
                        textColor === c.value ? "border-shelf-500 scale-95 shadow" : "border-stone-300 hover:scale-95"
                      }`} style={{ backgroundColor: c.value }} />
                  ))}
                  <label className="flex items-center gap-1.5 cursor-pointer ml-1">
                    <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)}
                      className="w-7 h-7 rounded-full cursor-pointer border-2 border-stone-300 p-0.5 bg-transparent" />
                    <span className="text-xs text-ink-muted">{t.quoteStudio.customColor}</span>
                  </label>
                </div>
              </div>

              {/* ── 字体大小 ── */}
              <div className="pt-3 border-t border-stone-100">
                <p className="text-xs font-medium text-ink-muted mb-2">{t.quoteStudio.fontSizeLabel}</p>
                <div className="flex gap-1 bg-stone-100 rounded-xl p-1">
                  {(Object.keys(FONT_SIZE_LABEL) as FontSize[]).map((size) => (
                    <button key={size} type="button" onClick={() => setFontSize(size)}
                      className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        fontSize === size ? "bg-white text-ink shadow-sm" : "text-ink-muted hover:text-ink"
                      }`}>
                      {t.quoteStudio.fontSizes[size]}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── 字体类型 ── */}
              <div className="pt-3 border-t border-stone-100">
                <p className="text-xs font-medium text-ink-muted mb-2">{t.quoteStudio.fontTypeLabel}</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {FONT_OPTIONS.map((f) => (
                    <button key={f.css} type="button" onClick={() => setFontFamily(f.css)}
                      className={`py-2 px-1 rounded-xl text-sm transition-colors ${
                        fontFamily === f.css
                          ? "bg-shelf-100 text-shelf-700 shadow-sm"
                          : "bg-stone-50 text-ink-muted hover:bg-stone-100"
                      }`}
                      style={{ fontFamily: f.css }}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── 文字位置 ── */}
              <div className="pt-3 border-t border-stone-100">
                <p className="text-xs font-medium text-ink-muted mb-2">{t.quoteStudio.textPosLabel}</p>
                <div className="flex gap-2">
                  <div className="flex gap-1 bg-stone-100 rounded-xl p-1 flex-1">
                    {([["top", t.quoteStudio.posTop], ["center", t.quoteStudio.posMiddle], ["bottom", t.quoteStudio.posBottom]] as [VPos, string][]).map(([pos, label]) => (
                      <button key={pos} type="button" onClick={() => setVPos(pos)}
                        className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          vPos === pos ? "bg-white text-ink shadow-sm" : "text-ink-muted hover:text-ink"
                        }`}>{label}</button>
                    ))}
                  </div>
                  <div className="flex gap-1 bg-stone-100 rounded-xl p-1 flex-1">
                    {([["left", t.quoteStudio.alignLeft], ["center", t.quoteStudio.alignCenter], ["right", t.quoteStudio.alignRight]] as [HAlign, string][]).map(([align, label]) => (
                      <button key={align} type="button" onClick={() => setHAlign(align)}
                        className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          hAlign === align ? "bg-white text-ink shadow-sm" : "text-ink-muted hover:text-ink"
                        }`}>{label}</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Emoji 插入 ── */}
              {/* 点击任意 emoji 会插入到语句文字框当前光标位置，可多次点击叠加 */}
              <div className="pt-3 border-t border-stone-100">
                <p className="text-xs font-medium text-ink-muted mb-2">{t.quoteStudio.insertEmoji} <span className="font-normal text-stone-400">{t.quoteStudio.insertEmojiHint}</span></p>
                <div className="flex flex-wrap gap-1.5">
                  {CARD_EMOJIS.map((e) => (
                    <button key={e} type="button" onClick={() => insertEmoji(e)}
                      className="text-xl w-9 h-9 rounded-xl flex items-center justify-center hover:bg-stone-100 active:scale-90 transition-all">
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── 波浪装饰 ── */}
              <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
                <p className="text-xs font-medium text-ink-muted">{t.quoteStudio.waveLabel}</p>
                <button type="button" onClick={() => setShowWave((v) => !v)}
                  className={`relative w-10 h-6 rounded-full transition-colors ${showWave ? "bg-shelf-500" : "bg-stone-200"}`}>
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${showWave ? "translate-x-4" : "translate-x-0.5"}`} />
                </button>
              </div>

              {/* ── 配乐 / 视频链接 ── */}
              <div className="pt-3 border-t border-stone-100">
                <button type="button" onClick={() => setShowMedia((v) => !v)}
                  className="flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-ink transition-colors">
                  {t.quoteStudio.mediaLabel}
                  <span className="text-stone-400 text-[10px]">{showMedia ? "▲" : "▼"}</span>
                </button>
                {showMedia && (
                  <div className="mt-3 space-y-2">
                    <input value={musicUrl} onChange={(e) => setMusicUrl(e.target.value)}
                      placeholder={t.quoteStudio.musicUrlPlaceholder}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-shelf-400 focus:bg-white transition-colors" />
                    <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder={t.quoteStudio.videoUrlPlaceholder}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-shelf-400 focus:bg-white transition-colors" />
                  </div>
                )}
              </div>

              {saveError && <p className="text-xs text-red-500">{saveError}</p>}

              {onSaved && (
                <button type="button" onClick={handleSave} disabled={!text.trim() || saving}
                  className="w-full py-2.5 rounded-xl text-sm font-medium bg-ink hover:bg-ink/80 disabled:bg-stone-200 text-white transition-colors">
                  {saveLabel}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
