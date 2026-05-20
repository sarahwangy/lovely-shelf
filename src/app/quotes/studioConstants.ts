// QuoteStudio 制作室的所有预设常量和类型定义
// 纯数据文件，不包含任何逻辑或 React 组件

// ── 背景预设 ──────────────────────────────────────────────────────

export const COLOR_PRESETS = [
  { label: "米白",   value: "#F5F0E8" },
  { label: "鼠尾草", value: "#B2C9B2" },
  { label: "玫瑰",   value: "#D4A5A5" },
  { label: "天空",   value: "#A8C4D4" },
  { label: "杏黄",   value: "#F0C97A" },
  { label: "陶土",   value: "#C4714A" },
  { label: "炭灰",   value: "#4A4A4A" },
  { label: "深靛",   value: "#1B2A4A" },
];

export const GRADIENT_PRESETS = [
  { label: "暮色",   value: "linear-gradient(135deg, #667eea, #764ba2)" },
  { label: "日落",   value: "linear-gradient(135deg, #f093fb, #f5576c)" },
  { label: "海洋",   value: "linear-gradient(135deg, #4facfe, #00f2fe)" },
  { label: "森林",   value: "linear-gradient(135deg, #134E5E, #71B280)" },
  { label: "蜜桃",   value: "linear-gradient(135deg, #FFECD2, #FCB69F)" },
  { label: "黄昏",   value: "linear-gradient(135deg, #2C3E50, #FD746C)" },
  { label: "薰衣草", value: "linear-gradient(135deg, #a18cd1, #fbc2eb)" },
  { label: "极光",   value: "linear-gradient(135deg, #0f3443, #34e89e)" },
];

export const TEXT_COLOR_PRESETS = [
  { label: "白",   value: "#ffffff" },
  { label: "米",   value: "#F5F0E8" },
  { label: "金",   value: "#F0C97A" },
  { label: "粉",   value: "#FFB6C1" },
  { label: "蓝",   value: "#A8C4D4" },
  { label: "黑",   value: "#1a1a1a" },
];

// 精选装饰 Emoji
export const CARD_EMOJIS = [
  "✨", "🌿", "🌸", "🌊", "🔥", "🌙", "⭐", "🦋",
  "🍀", "🌺", "💫", "🌈", "🎵", "📖", "💭", "🌻",
  "🌷", "🎐", "🕊️", "🌃", "🍃", "💐", "🌴", "🏔️",
];

// ── 字体选项 ──────────────────────────────────────────────────────
// label：显示名  css：DOM 样式用  canvas：canvas ctx.font 用  google：Google Fonts 参数

export const FONT_OPTIONS = [
  { label: "现代",  css: "system-ui, -apple-system, sans-serif",  canvas: "system-ui",           google: null },
  { label: "正式",  css: "'Noto Serif SC', serif",                 canvas: "'Noto Serif SC'",     google: "Noto+Serif+SC:wght@400;600" },
  { label: "可爱",  css: "'ZCOOL KuaiLe', cursive",               canvas: "'ZCOOL KuaiLe'",      google: "ZCOOL+KuaiLe" },
  { label: "手写",  css: "'Ma Shan Zheng', cursive",              canvas: "'Ma Shan Zheng'",     google: "Ma+Shan+Zheng" },
  { label: "优雅",  css: "'ZCOOL XiaoWei', serif",                canvas: "'ZCOOL XiaoWei'",     google: "ZCOOL+XiaoWei" },
  { label: "毛笔",  css: "'Liu Jian Mao Cao', cursive",           canvas: "'Liu Jian Mao Cao'",  google: "Liu+Jian+Mao+Cao" },
] as const;

// ── 字体大小 ──────────────────────────────────────────────────────

export const FONT_SIZE_LABEL: Record<FontSize, string> = {
  xs: "小", sm: "中", base: "大", lg: "特大",
};

export const FONT_SIZE_CLASS: Record<FontSize, string> = {
  xs:   "text-xs",
  sm:   "text-sm",
  base: "text-base",
  lg:   "text-lg",
};

// ── 类型定义 ──────────────────────────────────────────────────────

export type BgType     = "color" | "gradient" | "image" | "video";
export type FontSize   = "xs" | "sm" | "base" | "lg";
export type VPos       = "top" | "center" | "bottom";
export type HAlign     = "left" | "center" | "right";
export type FontFamily = (typeof FONT_OPTIONS)[number]["css"];

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
