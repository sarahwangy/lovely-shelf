// 图表和可视化用到的颜色，统一在这里管理
// 修改颜色只需改这一个文件，不需要到处找

// 饼图：按类型给每一块分配颜色，颜色不够时循环复用
export const GENRE_COLORS = [
  "#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd",
  "#818cf8", "#4f46e5", "#7c3aed", "#9333ea",
  "#d946ef", "#ec4899", "#f43f5e", "#fb923c",
  "#facc15", "#4ade80", "#2dd4bf",
];

// 柱状图主色（与 GENRE_COLORS[0] 保持一致，象征"类型"维度）
export const BAR_PRIMARY_COLOR = "#6366f1";

// 词云：三类词用不同颜色区分
export const WORD_CLOUD_COLORS: Record<"genre" | "country" | "author", string[]> = {
  genre:   ["#6366f1", "#8b5cf6", "#a78bfa", "#7c3aed", "#4f46e5", "#9333ea"],
  country: ["#059669", "#10b981", "#34d399", "#047857", "#065f46", "#0d9488"],
  author:  ["#d97706", "#f59e0b", "#fb923c", "#ea580c", "#b45309", "#c2410c"],
};
