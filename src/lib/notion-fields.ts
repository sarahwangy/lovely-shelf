// 以后如果改了 Notion 里的字段名，只改这个文件，其他业务代码不用动

// as const 告诉 TypeScript：这个对象的值是"字面量类型"，不是宽泛的 string
// 没有 as const：TypeScript 认为 title 的类型是 string
// 有了 as const：TypeScript 认为 title 的类型是精确的 "书名"
export const NOTION_FIELDS = {
  title: "书名",
  subtitle: "副标题",
  author: "作者",
  gender: "性别",
  country: "国家",
  genres: "类型 Label",
  description: "描述",
  cover: "封面",
  status: "状态",
  sourceFilename: "原图文件名",
} as const;

// 类型 Label 的预设选项，必须和 Notion 里一字不差
export const GENRE_LABELS = [
  "回忆录", "传记", "喜剧", "冒险", "心理相关",
  "励志", "身心健康", "育儿", "科普", "园艺",
  "体育", "历史", "儿童读物", "旅行", "其他",
] as const;

// 国家的预设选项
export const COUNTRY_OPTIONS = [
  "澳大利亚", "英国", "美国", "新西兰",
  "南非", "加拿大", "中国", "日本",
] as const;

export const STATUS_VALUES = ["草稿", "已确认"] as const;

// (typeof GENRE_LABELS)[number] 的含义：
// typeof GENRE_LABELS → 拿到数组的类型：readonly ["回忆录", "传记", ...]
// [number]            → 用数字下标索引，得到所有元素的联合类型："回忆录" | "传记" | ...
// 效果：自动从数组派生出枚举类型，不用手动重复写一遍
export type Genre = (typeof GENRE_LABELS)[number];
export type Country = (typeof COUNTRY_OPTIONS)[number];
export type Status = (typeof STATUS_VALUES)[number];
