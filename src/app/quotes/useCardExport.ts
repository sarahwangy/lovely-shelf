"use client";

// useCardExport：PNG 导出 + MP4 录制的自定义 Hook
//
// 为什么提取这里？
// handleExport / handleExportVideo 加上两个 canvas 工具函数共 ~150 行，
// 是纯粹的"导出副作用"，和 QuoteStudio 的 UI 状态完全独立，
// 未来如果有其他卡片组件也需要导出，可以直接复用。

import { useState } from "react";
import type { RefObject } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { FONT_OPTIONS } from "./studioConstants";
import type { FontSize, FontFamily, VPos, HAlign } from "./studioConstants";

export type CardContent = {
  text:      string;
  bookTitle: string;
  author:    string;
};

// 只包含 canvas 渲染需要的样式字段，不含 bgType / bgValue（PNG 用 html-to-image 读 DOM）
export type CardExportStyle = {
  textColor:  string;
  fontSize:   FontSize;
  fontFamily: FontFamily;
  vPos:       VPos;
  hAlign:     HAlign;
  showWave:   boolean;
  videoSrc:   string;
};

// ── 内部 canvas 工具函数 ─────────────────────────────────────────────

// 按像素宽度自动换行（支持中文逐字、英文连续写入、\n 强制换行）
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

// hex (#RRGGBB) → rgba(r,g,b,alpha)，给 canvas fillStyle 用
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── Hook 主体 ────────────────────────────────────────────────────────

export function useCardExport(
  content:     CardContent,
  style:       CardExportStyle,
  videoRef:    RefObject<HTMLVideoElement | null>,
  recMusicUrl: string,          // 录制时混入的背景音乐 URL（可为空）
  saveStyle:   () => void,      // 导出完成后回调：把当前样式存入 localStorage
) {
  const { t } = useLanguage();

  const [exporting,      setExporting]      = useState(false);
  const [recording,      setRecording]      = useState(false);
  const [recordDuration, setRecordDuration] = useState(5);

  // ── 导出 PNG ────────────────────────────────────────────────────────
  // html-to-image 比 html2canvas 更新，支持 oklch / oklab 颜色和 video 元素
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

  // ── 录制 MP4（视频背景专用）─────────────────────────────────────────
  // 原理：canvas 每帧绘制视频 + 文字叠层 → captureStream → MediaRecorder
  async function handleExportVideo() {
    const videoEl = videoRef.current;
    if (!videoEl || !style.videoSrc) return;
    setRecording(true);

    const { text, bookTitle, author } = content;
    const { textColor, fontSize, fontFamily, vPos, hAlign, showWave } = style;

    const SCALE = 2;
    const W = 216 * SCALE, H = 320 * SCALE;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d")!;

    // 浏览器对 MP4 支持不一；优先 mp4，回退 webm
    const mimeType = MediaRecorder.isTypeSupported("video/mp4;codecs=avc1")
      ? "video/mp4;codecs=avc1"
      : "video/webm";
    const canvasStream = canvas.captureStream(30);
    const allTracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];

    // 混入配乐音轨：AudioContext 路由 → MediaStreamDestination → audio track
    let recAudioEl:  HTMLAudioElement | null = null;
    let recAudioCtx: AudioContext     | null = null;
    if (recMusicUrl) {
      try {
        recAudioCtx = new AudioContext();
        // 走代理：AudioContext 读跨域音频需要 CORS 头，代理路由帮我们加上
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

      // 2. 半透明遮罩（让文字更清晰）
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(0, 0, W, H);

      // 3. 波浪动画（底部装饰）
      if (showWave) {
        wavePhase += 0.04;
        const col = hexToRgba(textColor, 1);
        [{ a: 0.22, offset: 26 }, { a: 0.14, offset: 16 }].forEach(({ a, offset }) => {
          ctx.beginPath();
          for (let x = 0; x <= W; x++) {
            const y = H - offset*SCALE + Math.sin(x/(W/6) + wavePhase) * 13*SCALE;
            if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
          ctx.fillStyle = col.replace(/,[^,]+\)$/, `,${a})`);
          ctx.fill();
        });
      }

      // 4. 文字内容
      ctx.shadowColor = "rgba(0,0,0,0.4)"; ctx.shadowBlur = 4 * SCALE;
      ctx.fillStyle   = textColor;
      const padX = 20*SCALE;
      const xPos = hAlign === "left" ? padX : hAlign === "right" ? W - padX : W / 2;
      ctx.textAlign    = (hAlign === "left" ? "left" : hAlign === "right" ? "right" : "center") as CanvasTextAlign;
      ctx.textBaseline = "top";

      let y = vPos === "top" ? padX : vPos === "bottom" ? H * 0.45 : H * 0.28;

      const canvasFont = FONT_OPTIONS.find((f) => f.css === fontFamily)?.canvas ?? "system-ui";
      ctx.font = `600 ${fontPx[fontSize]}px ${canvasFont}`;
      const lines = wrapCanvasText(ctx, text || t.quoteStudio.cardPlaceholder, W - padX * 2);
      const lh    = fontPx[fontSize] * 1.5;
      for (const line of lines) { ctx.fillText(line, xPos, y); y += lh; }

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

  return { handleExport, handleExportVideo, exporting, recording, recordDuration, setRecordDuration };
}
