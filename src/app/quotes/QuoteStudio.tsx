"use client";

import { useState, useMemo, useRef } from "react";
import type { QuoteBook } from "@/app/api/quotes/route";
import type { ImageResult } from "@/app/api/images/route";
import type { VideoResult } from "@/app/api/videos/route";
import type { MusicResult } from "@/app/api/music/route";

// ── 背景预设 ──────────────────────────────────────────────────────

const COLOR_PRESETS = [
  { label: "米白",   value: "#F5F0E8" },
  { label: "鼠尾草", value: "#B2C9B2" },
  { label: "玫瑰",   value: "#D4A5A5" },
  { label: "天空",   value: "#A8C4D4" },
  { label: "杏黄",   value: "#F0C97A" },
  { label: "陶土",   value: "#C4714A" },
  { label: "炭灰",   value: "#4A4A4A" },
  { label: "深靛",   value: "#1B2A4A" },
];

const GRADIENT_PRESETS = [
  { label: "暮色",   value: "linear-gradient(135deg, #667eea, #764ba2)" },
  { label: "日落",   value: "linear-gradient(135deg, #f093fb, #f5576c)" },
  { label: "海洋",   value: "linear-gradient(135deg, #4facfe, #00f2fe)" },
  { label: "森林",   value: "linear-gradient(135deg, #134E5E, #71B280)" },
  { label: "蜜桃",   value: "linear-gradient(135deg, #FFECD2, #FCB69F)" },
  { label: "黄昏",   value: "linear-gradient(135deg, #2C3E50, #FD746C)" },
  { label: "薰衣草", value: "linear-gradient(135deg, #a18cd1, #fbc2eb)" },
  { label: "极光",   value: "linear-gradient(135deg, #0f3443, #34e89e)" },
];

const TEXT_COLOR_PRESETS = [
  { label: "白",   value: "#ffffff" },
  { label: "米",   value: "#F5F0E8" },
  { label: "金",   value: "#F0C97A" },
  { label: "粉",   value: "#FFB6C1" },
  { label: "蓝",   value: "#A8C4D4" },
  { label: "黑",   value: "#1a1a1a" },
];

// 精选装饰 Emoji
const CARD_EMOJIS = [
  "✨", "🌿", "🌸", "🌊", "🔥", "🌙", "⭐", "🦋",
  "🍀", "🌺", "💫", "🌈", "🎵", "📖", "💭", "🌻",
  "🌷", "🎐", "🕊️", "🌃", "🍃", "💐", "🌴", "🏔️",
];

type BgType   = "color" | "gradient" | "image" | "video";
type FontSize = "xs" | "sm" | "base" | "lg";
type VPos     = "top" | "center" | "bottom";
type HAlign   = "left" | "center" | "right";

// 语录卡样式快照，存 localStorage，打开制作室时恢复
export type CardStyle = {
  textColor:  string;
  fontSize:   FontSize;
  fontFamily: FontFamily;
  vPos:       VPos;
  hAlign:     HAlign;
  showWave:   boolean;
  bgType:     BgType;
  bgValue:    string;
  videoSrc:   string;
};

// 字体选项：label 显示名、css 用于 DOM 预览、canvas 用于 canvas ctx.font、google 是 Google Fonts 参数
const FONT_OPTIONS = [
  { label: "现代",  css: "system-ui, -apple-system, sans-serif",  canvas: "system-ui",           google: null },
  { label: "正式",  css: "'Noto Serif SC', serif",                 canvas: "'Noto Serif SC'",     google: "Noto+Serif+SC:wght@400;600" },
  { label: "可爱",  css: "'ZCOOL KuaiLe', cursive",               canvas: "'ZCOOL KuaiLe'",      google: "ZCOOL+KuaiLe" },
  { label: "手写",  css: "'Ma Shan Zheng', cursive",              canvas: "'Ma Shan Zheng'",     google: "Ma+Shan+Zheng" },
  { label: "优雅",  css: "'ZCOOL XiaoWei', serif",                canvas: "'ZCOOL XiaoWei'",     google: "ZCOOL+XiaoWei" },
  { label: "毛笔",  css: "'Liu Jian Mao Cao', cursive",           canvas: "'Liu Jian Mao Cao'",  google: "Liu+Jian+Mao+Cao" },
] as const;
type FontFamily = (typeof FONT_OPTIONS)[number]["css"];

const FONT_SIZE_LABEL: Record<FontSize, string> = { xs: "小", sm: "中", base: "大", lg: "特大" };
const FONT_SIZE_CLASS: Record<FontSize, string> = {
  xs:   "text-xs",
  sm:   "text-sm",
  base: "text-base",
  lg:   "text-lg",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySpeech = any;

// ── HEIC 转 JPEG ──────────────────────────────────────────────────

async function convertIfHeic(file: File): Promise<File> {
  const name   = file.name.toLowerCase();
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
  } catch { /* 三种方法全失败 */ }
  return file;
}

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
  const [imageFile,      setImageFile]      = useState<File | null>(null);
  const [imageUrl,       setImageUrl]       = useState<string | null>(null);
  const [converting,     setConverting]     = useState(false);
  const imgSource = "pixabay" as const;
  const [imgQuery,       setImgQuery]       = useState("");
  const [imgResults,     setImgResults]     = useState<ImageResult[]>([]);
  const [imgSearching,   setImgSearching]   = useState(false);
  const [imgSearchError, setImgSearchError] = useState<string | null>(null);
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const textareaRef   = useRef<HTMLTextAreaElement>(null);

  // ── 视频背景 ──────────────────────────────────────────────────────
  const [videoSrc,     setVideoSrc]     = useState(initialStyle?.videoSrc ?? "");
  const vidSource = "pixabay" as const;
  const [vidQuery,     setVidQuery]     = useState("");
  const [vidResults,   setVidResults]   = useState<VideoResult[]>([]);
  const [vidSearching, setVidSearching] = useState(false);
  const [vidSearchErr, setVidSearchErr] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // ── 录制配乐 ──────────────────────────────────────────────────────
  const [recMusicUrl,   setRecMusicUrl]   = useState("");
  const [recMusicTitle, setRecMusicTitle] = useState("");
  const [musQuery,      setMusQuery]      = useState("");
  const [musResults,    setMusResults]    = useState<MusicResult[]>([]);
  const [musSearching,  setMusSearching]  = useState(false);
  const [musSearchErr,  setMusSearchErr]  = useState<string | null>(null);

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
  const [saving,         setSaving]         = useState(false);
  const [exporting,      setExporting]      = useState(false);
  const [recording,      setRecording]      = useState(false);
  const [recordDuration, setRecordDuration] = useState(5);
  const [saveError,      setSaveError]      = useState<string | null>(null);

  // ── Google Fonts 动态加载 ────────────────────────────────────────
  // 每当字体切换时，把对应的 Google Fonts <link> 注入 <head>（已注入则跳过）
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    r.lang = "zh-CN"; r.continuous = true; r.interimResults = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (e: any) => {
      const t = e.results[e.results.length - 1][0].transcript;
      setText((prev) => prev ? prev + " " + t : t);
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

  // ── 图片搜索 ──────────────────────────────────────────────────────
  async function handleImgSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!imgQuery.trim()) return;
    setImgSearching(true); setImgSearchError(null); setImgResults([]);
    try {
      const res  = await fetch(`/api/images?q=${encodeURIComponent(imgQuery)}&source=${imgSource}`);
      const data = (await res.json()) as { images?: ImageResult[]; error?: string };
      if (!res.ok || data.error) { setImgSearchError(data.error ?? "搜索失败，请重试"); return; }
      const imgs = data.images ?? [];
      setImgResults(imgs);
      if (imgs.length === 0) setImgSearchError("没有找到图片，换英文关键词试试");
    } catch { setImgSearchError("网络错误，请重试"); }
    finally { setImgSearching(false); }
  }

  function selectImage(img: ImageResult) {
    setImageUrl(img.fullUrl); setImageFile(null);
    setBgValue(img.fullUrl); setBgType("image");
  }

  function clearImage() {
    setImageFile(null); setImageUrl(null); setBgValue(""); setBgType("image");
  }

  // ── 视频搜索 ──────────────────────────────────────────────────────
  async function handleVidSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!vidQuery.trim()) return;
    setVidSearching(true); setVidSearchErr(null); setVidResults([]);
    try {
      const res  = await fetch(`/api/videos?q=${encodeURIComponent(vidQuery)}&source=${vidSource}`);
      const data = (await res.json()) as { videos?: VideoResult[]; error?: string };
      if (!res.ok || data.error) { setVidSearchErr(data.error ?? "搜索失败"); return; }
      const vids = data.videos ?? [];
      setVidResults(vids);
      if (vids.length === 0) setVidSearchErr("没有找到视频，换英文关键词试试");
    } catch { setVidSearchErr("网络错误，请重试"); }
    finally { setVidSearching(false); }
  }

  function selectVideo(vid: VideoResult) {
    setVideoSrc(vid.videoUrl); setBgType("video"); setBgValue("");
  }

  // ── 音乐搜索（录制用）────────────────────────────────────────────
  async function handleMusicSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!musQuery.trim()) return;
    setMusSearching(true); setMusSearchErr(null); setMusResults([]);
    try {
      const res  = await fetch(`/api/music?q=${encodeURIComponent(musQuery)}`);
      const data = (await res.json()) as { music?: MusicResult[]; error?: string };
      if (!res.ok || data.error) { setMusSearchErr(data.error ?? "搜索失败"); return; }
      const tracks = data.music ?? [];
      setMusResults(tracks);
      if (tracks.length === 0) setMusSearchErr("没有找到，换英文关键词试试（如 calm、piano）");
    } catch { setMusSearchErr("网络错误，请重试"); }
    finally { setMusSearching(false); }
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

  // ── 导出 PNG ──────────────────────────────────────────────────────
  // 用 html-to-image 替代 html2canvas：支持现代 CSS（oklch/oklab）且能渲染 video 元素
  async function handleExport() {
    setExporting(true);
    try {
      const { toPng } = await import("html-to-image");
      const el = document.getElementById("qs-card-preview");
      if (!el) return;
      const dataUrl = await toPng(el, { pixelRatio: 2, skipFonts: false });
      const a = document.createElement("a");
      a.href = dataUrl; a.download = `quote-${Date.now()}.png`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      saveStyle();
    } finally { setExporting(false); }
  }

  // ── 录制 MP4（视频背景专用）────────────────────────────────────────
  // 原理：用 canvas 每帧绘制视频 + 文字叠层 → captureStream → MediaRecorder 录制
  async function handleExportVideo() {
    const videoEl = videoRef.current;
    if (!videoEl || !videoSrc) return;
    setRecording(true);

    const SCALE = 2;
    const W = 216 * SCALE, H = 320 * SCALE;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d")!;

    // 浏览器对 MP4 支持不一；优先用 mp4，回退到 webm
    const mimeType    = MediaRecorder.isTypeSupported("video/mp4;codecs=avc1")
      ? "video/mp4;codecs=avc1"
      : "video/webm";
    const canvasStream = canvas.captureStream(30);
    const allTracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];

    // 混入配乐音轨：AudioContext 路由 → MediaStreamDestination → 拿 audio track
    let recAudioEl:  HTMLAudioElement | null = null;
    let recAudioCtx: AudioContext     | null = null;
    if (recMusicUrl) {
      try {
        recAudioCtx = new AudioContext();
        // 走代理：AudioContext 读取跨域音频需要 CORS 头，代理路由帮我们加上
        const proxiedAudio = `/api/music/proxy?url=${encodeURIComponent(recMusicUrl)}`;
        recAudioEl  = new Audio(proxiedAudio);
        recAudioEl.loop = true;
        const src  = recAudioCtx.createMediaElementSource(recAudioEl);
        const dest = recAudioCtx.createMediaStreamDestination();
        src.connect(dest);
        src.connect(recAudioCtx.destination); // 录制同时本机也能听到
        await recAudioEl.play();
        allTracks.push(...dest.stream.getAudioTracks());
      } catch (e) {
        console.warn("[record] 音频混入失败，将录制无声视频:", e);
        recAudioEl = null; recAudioCtx = null;
      }
    }

    const stream   = new MediaStream(allTracks);
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => {
      // pause() 只暂停，src = "" 才能彻底释放音频资源并断开 Web Audio 图
      if (recAudioEl) { recAudioEl.pause(); recAudioEl.src = ""; }
      void recAudioCtx?.close();
      const ext  = mimeType.startsWith("video/mp4") ? "mp4" : "webm";
      const blob = new Blob(chunks, { type: mimeType });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = `quote-${Date.now()}.${ext}`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      saveStyle();
      setRecording(false);
    };

    const fontPx: Record<FontSize, number> = { xs: 11*SCALE, sm: 13*SCALE, base: 15*SCALE, lg: 18*SCALE };
    let wavePhase = 0;
    let animId: number;

    function drawFrame() {
      // 1. 视频帧
      ctx.drawImage(videoEl!, 0, 0, W, H);

      // 2. 半透明遮罩
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(0, 0, W, H);

      // 3. 波浪动画（底部）
      if (showWave) {
        wavePhase += 0.04;
        const col = hexToRgba(textColor, 1);
        [{ a: 0.22, offset: 26 }, { a: 0.14, offset: 16 }].forEach(({ a, offset }) => {
          ctx.beginPath();
          for (let x = 0; x <= W; x++) {
            const y = H - offset*SCALE + Math.sin(x/(W/6) + wavePhase) * 13*SCALE;
            x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
          ctx.fillStyle = col.replace("rgba(", `rgba(`).replace(/,[^,]+\)$/, `,${a})`);
          ctx.fill();
        });
      }

      // 4. 文字内容
      ctx.shadowColor = "rgba(0,0,0,0.4)"; ctx.shadowBlur = 4 * SCALE;
      ctx.fillStyle   = textColor;
      const padX = 20*SCALE;
      const xPos = hAlign === "left" ? padX : hAlign === "right" ? W - padX : W / 2;
      ctx.textAlign  = (hAlign === "left" ? "left" : hAlign === "right" ? "right" : "center") as CanvasTextAlign;
      ctx.textBaseline = "top";

      let y = vPos === "top" ? padX : vPos === "bottom" ? H * 0.45 : H * 0.28;

      // 语句（自动换行）：使用用户选择的字体
      const canvasFont = FONT_OPTIONS.find((f) => f.css === fontFamily)?.canvas ?? "system-ui";
      ctx.font = `600 ${fontPx[fontSize]}px ${canvasFont}`;
      const lines = wrapCanvasText(ctx, text || "在这里输入你的语句…", W - padX * 2);
      const lh    = fontPx[fontSize] * 1.5;
      for (const line of lines) { ctx.fillText(line, xPos, y); y += lh; }

      // 书名 / 作者
      if (bookTitle) {
        ctx.font = `${11*SCALE}px ${canvasFont}`;
        ctx.globalAlpha = 0.7;
        ctx.fillText(`— ${bookTitle}${author ? ` · ${author}` : ""}`, xPos, y + 8*SCALE);
        ctx.globalAlpha = 1;
      }

      ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;
      animId = requestAnimationFrame(drawFrame);
    }

    recorder.start();
    drawFrame();
    setTimeout(() => { cancelAnimationFrame(animId); recorder.stop(); }, recordDuration * 1000);
  }

  // canvas 文字自动换行（支持中文和 emoji）
  function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const lines: string[] = [];
    let current = "";
    for (const ch of [...text]) {
      if (ch === "\n") { lines.push(current); current = ""; continue; }
      const test = current + ch;
      if (ctx.measureText(test).width > maxWidth && current) { lines.push(current); current = ch; }
      else { current = test; }
    }
    if (current) lines.push(current);
    return lines;
  }

  // hex 颜色 → rgba 字符串（给 canvas fillStyle 用）
  function hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16) || 0;
    const g = parseInt(hex.slice(3, 5), 16) || 0;
    const b = parseInt(hex.slice(5, 7), 16) || 0;
    return `rgba(${r},${g},${b},${alpha})`;
  }

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
      if (!res.ok || data.error) throw new Error(data.error ?? "保存失败");
      onSaved(data.book!);
    } catch (e) {
      setSaveError((e as Error).message);
    } finally { setSaving(false); }
  }

  const saveLabel = saving ? "保存中…" : bookTitle.trim() ? "💾 保存到 Notion" : "✨ 添加到语录";

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
            <h2 className="font-semibold text-ink text-lg">语录卡制作</h2>
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
                    {text || "在这里输入你的语句…"}
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
                  {listening ? "录音中，点击停止" : "语音输入"}
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
                    {recording ? `录制中 ${recordDuration}s…` : "🎬 录制 MP4"}
                  </button>
                </div>
              ) : (
                <button type="button" onClick={handleExport} disabled={exporting}
                  className="w-full py-2.5 rounded-xl text-sm font-medium bg-shelf-500 hover:bg-shelf-600 disabled:bg-stone-300 text-white transition-colors">
                  {exporting ? "导出中…" : "⬇ 导出 PNG"}
                </button>
              )}

              {/* 样式编辑模式（从 🎨 打开）：明确的保存 / 取消 */}
              {!onSaved && styleKey && (
                <div className="w-full flex gap-2">
                  <button type="button" onClick={onClose}
                    className="flex-1 py-2 rounded-xl text-sm font-medium bg-stone-100 text-ink-muted hover:bg-stone-200 transition-colors">
                    取消
                  </button>
                  <button type="button" onClick={() => {
                    saveStyle();
                    // 如果文字被修改过，通知父组件更新卡片显示
                    if (onTextChanged && text !== initialText) onTextChanged(text);
                    onClose();
                  }}
                    className="flex-1 py-2 rounded-xl text-sm font-medium bg-ink hover:bg-ink/80 text-white transition-colors">
                    保存样式
                  </button>
                </div>
              )}
            </div>

            {/* ── 右：控制面板 ── */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">

              {/* 语句内容 */}
              <div>
                <label className="text-xs font-medium text-ink-muted mb-1.5 block">语句内容</label>
                <textarea
                  ref={textareaRef}
                  value={text} onChange={(e) => setText(e.target.value)}
                  placeholder="输入或粘贴你的语句…点击下方 Emoji 可插入" rows={4}
                  className="w-full resize-none bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm text-ink placeholder-ink-muted focus:outline-none focus:border-shelf-400 focus:bg-white transition-colors leading-relaxed"
                />
              </div>

              {/* 来源书名 + 作者 */}
              <div className="flex gap-3">
                <input value={bookTitle} onChange={(e) => setBookTitle(e.target.value)}
                  placeholder="来源书名（不填则仅本地展示）"
                  className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-shelf-400 focus:bg-white transition-colors" />
                <input value={author} onChange={(e) => setAuthor(e.target.value)}
                  placeholder="作者（选填）"
                  className="w-28 bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-shelf-400 focus:bg-white transition-colors" />
              </div>

              {/* ── 卡片背景 ── */}
              <div>
                <p className="text-xs font-medium text-ink-muted mb-2">卡片背景</p>
                <div className="flex gap-1 bg-stone-100 rounded-xl p-1 mb-3">
                  {(["color", "gradient", "image", "video"] as BgType[]).map((t) => (
                    <button key={t} type="button" onClick={() => switchBgType(t)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        bgType === t ? "bg-white text-ink shadow-sm" : "text-ink-muted hover:text-ink"
                      }`}>
                      {t === "color" ? "纯色" : t === "gradient" ? "渐变" : t === "image" ? "图片" : "🎬 动态"}
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
                          <div className="w-full h-20 bg-stone-100 rounded-xl flex items-center justify-center text-ink-muted text-sm">转换中…</div>
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
                      📁 本地上传（支持 JPG / PNG / GIF / HEIC）
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLocalUpload} />
                    <p className="text-xs text-stone-400">Pixabay 图库 · 英文关键词效果更佳</p>
                    <form onSubmit={handleImgSearch} className="flex gap-2">
                      <input value={imgQuery} onChange={(e) => setImgQuery(e.target.value)}
                        placeholder="搜索图片，如 ocean、forest…"
                        className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-shelf-400 transition-colors" />
                      <button type="submit" disabled={imgSearching}
                        className="px-4 py-2 bg-shelf-500 hover:bg-shelf-600 disabled:bg-stone-200 text-white rounded-xl text-sm transition-colors">
                        {imgSearching ? "…" : "搜"}
                      </button>
                    </form>
                    {imgSearchError && <p className="text-xs text-red-500">{imgSearchError}</p>}
                    {imgResults.length > 0 && (
                      <div className="grid grid-cols-3 gap-2">
                        {imgResults.map((img) => (
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
                    <p className="text-xs text-ink-muted">预览里是动态效果，导出 PNG 会截取当前帧</p>
                    {videoSrc && (
                      <div className="relative">
                        <video src={videoSrc} autoPlay loop muted playsInline
                          className="w-full h-24 object-cover rounded-xl shadow-sm" />
                        <button type="button" onClick={() => setVideoSrc("")}
                          className="absolute top-2 right-2 w-5 h-5 bg-black/50 text-white rounded-full text-xs flex items-center justify-center hover:bg-black/70 transition-colors">✕</button>
                      </div>
                    )}
                    <p className="text-xs text-stone-400">Pixabay 视频库 · 搜英文关键词效果更佳</p>
                    <form onSubmit={handleVidSearch} className="flex gap-2">
                      <input value={vidQuery} onChange={(e) => setVidQuery(e.target.value)}
                        placeholder="搜索视频，如 ocean wave、night sky…"
                        className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-shelf-400 transition-colors" />
                      <button type="submit" disabled={vidSearching}
                        className="px-4 py-2 bg-shelf-500 hover:bg-shelf-600 disabled:bg-stone-200 text-white rounded-xl text-sm transition-colors">
                        {vidSearching ? "…" : "搜"}
                      </button>
                    </form>
                    {vidSearchErr && <p className="text-xs text-red-500">{vidSearchErr}</p>}
                    {vidResults.length > 0 && (
                      <div className="grid grid-cols-3 gap-2">
                        {vidResults.map((vid) => (
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
                        🎵 录制配乐
                        <span className="font-normal text-stone-400 ml-1">（选填，MP4 里会有音乐）</span>
                      </p>

                      {/* 已选音乐提示条 */}
                      {recMusicUrl && (
                        <div className="flex items-center gap-2 bg-shelf-50 border border-shelf-200 rounded-xl px-3 py-2 mb-2">
                          <span className="text-xs text-shelf-700 flex-1 truncate">♪ {recMusicTitle}</span>
                          <button type="button"
                            onClick={() => { setRecMusicUrl(""); setRecMusicTitle(""); setMusResults([]); }}
                            className="text-stone-400 hover:text-stone-600 text-xs shrink-0">✕</button>
                        </div>
                      )}

                      <form onSubmit={handleMusicSearch} className="flex gap-2">
                        <input value={musQuery} onChange={(e) => setMusQuery(e.target.value)}
                          placeholder="搜音乐，如 calm、piano、lofi…"
                          className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-shelf-400 transition-colors" />
                        <button type="submit" disabled={musSearching}
                          className="px-4 py-2 bg-shelf-500 hover:bg-shelf-600 disabled:bg-stone-200 text-white rounded-xl text-sm transition-colors">
                          {musSearching ? "…" : "搜"}
                        </button>
                      </form>
                      {musSearchErr && <p className="text-xs text-red-500 mt-1">{musSearchErr}</p>}

                      {/* 音乐结果列表 */}
                      {musResults.length > 0 && (
                        <div className="mt-2 space-y-1.5 max-h-44 overflow-y-auto">
                          {musResults.map((m) => {
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
                                  <span className="text-shelf-600 text-[10px] font-medium shrink-0">✓ 已选</span>
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
                <p className="text-xs font-medium text-ink-muted mb-2">文字颜色</p>
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
                    <span className="text-xs text-ink-muted">自定义</span>
                  </label>
                </div>
              </div>

              {/* ── 字体大小 ── */}
              <div className="pt-3 border-t border-stone-100">
                <p className="text-xs font-medium text-ink-muted mb-2">字体大小</p>
                <div className="flex gap-1 bg-stone-100 rounded-xl p-1">
                  {(Object.keys(FONT_SIZE_LABEL) as FontSize[]).map((size) => (
                    <button key={size} type="button" onClick={() => setFontSize(size)}
                      className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        fontSize === size ? "bg-white text-ink shadow-sm" : "text-ink-muted hover:text-ink"
                      }`}>
                      {FONT_SIZE_LABEL[size]}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── 字体类型 ── */}
              <div className="pt-3 border-t border-stone-100">
                <p className="text-xs font-medium text-ink-muted mb-2">字体类型</p>
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
                <p className="text-xs font-medium text-ink-muted mb-2">文字位置</p>
                <div className="flex gap-2">
                  <div className="flex gap-1 bg-stone-100 rounded-xl p-1 flex-1">
                    {([["top", "上"], ["center", "中"], ["bottom", "下"]] as [VPos, string][]).map(([pos, label]) => (
                      <button key={pos} type="button" onClick={() => setVPos(pos)}
                        className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          vPos === pos ? "bg-white text-ink shadow-sm" : "text-ink-muted hover:text-ink"
                        }`}>{label}</button>
                    ))}
                  </div>
                  <div className="flex gap-1 bg-stone-100 rounded-xl p-1 flex-1">
                    {([["left", "左"], ["center", "中"], ["right", "右"]] as [HAlign, string][]).map(([align, label]) => (
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
                <p className="text-xs font-medium text-ink-muted mb-2">插入 Emoji <span className="font-normal text-stone-400">（插入到光标位置）</span></p>
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
                <p className="text-xs font-medium text-ink-muted">底部波浪装饰</p>
                <button type="button" onClick={() => setShowWave((v) => !v)}
                  className={`relative w-10 h-6 rounded-full transition-colors ${showWave ? "bg-shelf-500" : "bg-stone-200"}`}>
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${showWave ? "translate-x-4" : "translate-x-0.5"}`} />
                </button>
              </div>

              {/* ── 配乐 / 视频链接 ── */}
              <div className="pt-3 border-t border-stone-100">
                <button type="button" onClick={() => setShowMedia((v) => !v)}
                  className="flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-ink transition-colors">
                  🎵🎬 配乐 / 视频链接
                  <span className="text-stone-400 text-[10px]">{showMedia ? "▲" : "▼"}</span>
                </button>
                {showMedia && (
                  <div className="mt-3 space-y-2">
                    <input value={musicUrl} onChange={(e) => setMusicUrl(e.target.value)}
                      placeholder="音乐链接（Spotify / 网易云 / Apple Music…）"
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-shelf-400 focus:bg-white transition-colors" />
                    <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="视频链接（YouTube / Bilibili / 抖音…）"
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
