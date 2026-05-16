// Demo 模式种子数据：面试官点"一键体验 Demo"后看到这些假数据，不触碰真实 Notion
// 数据模拟一个真实中文读者的书架，共 32 本书

import type { StatsData } from "@/app/api/stats/route";
import type { QuoteBook }  from "@/app/api/quotes/route";
import type { BookSummary } from "@/types/book";

// ── 语录页 Demo 书库 ──────────────────────────────────────────────

export const DEMO_BOOKS: QuoteBook[] = [
  {
    pageId:    "demo-manual",
    notionUrl: "#",
    bookTitle: "手动语录",
    author:    "",
    coverUrl:  null,
    quotes: [
      "你值得被温柔对待，包括被你自己。",
      "休息不是懒惰，是对自己的温柔。",
      "不完美的你，已经足够值得被爱了。",
      "生活不需要完美，只需要真实。",
    ],
    musicUrl: null,
    videoUrl: null,
  },
  {
    pageId:    "demo-1",
    notionUrl: "#",
    bookTitle: "活着",
    author:    "余华",
    coverUrl:  null,
    quotes: [
      "人是为了活着本身而活着，不是为了活着以外的任何事物而活着。",
      "生活是属于每个人自己的感受，不属于任何别人的看法。",
      "人只要活着，就有希望。",
    ],
    musicUrl: null,
    videoUrl: null,
  },
  {
    pageId:    "demo-2",
    notionUrl: "#",
    bookTitle: "小王子",
    author:    "圣·埃克苏佩里",
    coverUrl:  null,
    quotes: [
      "真正重要的东西，用眼睛是看不见的。",
      "你在你的玫瑰身上耗费的时间，使你的玫瑰变得如此重要。",
      "所有的大人都曾经是个孩子，只是很少有人记得。",
      "你必须要求自己，每天早上把羊吃不完的小猴子的幼芽彻底拔除。",
    ],
    musicUrl: null,
    videoUrl: null,
  },
  {
    pageId:    "demo-3",
    notionUrl: "#",
    bookTitle: "被讨厌的勇气",
    author:    "岸见一郎 / 古贺史健",
    coverUrl:  null,
    quotes: [
      "决定我们自身的，不是过去的经历，而是我们自己赋予经历的意义。",
      "不是能力不足，而是勇气不足。",
      "所谓自由，就是被别人讨厌。",
      "重要的不是被给予了什么，而是如何去利用被给予的东西。",
    ],
    musicUrl: null,
    videoUrl: null,
  },
  {
    pageId:    "demo-4",
    notionUrl: "#",
    bookTitle: "百年孤独",
    author:    "加西亚·马尔克斯",
    coverUrl:  null,
    quotes: [
      "过去都是假的，回忆是一条没有归途的路，以往的一切春天都无法复原。",
      "他还太年轻，不知道回忆总是会抹去坏的，夸大好的，也正是由于这种幻想，我们才能承担过去的重负。",
      "一个人只有在孤独中，才能看清楚自己。",
    ],
    musicUrl: null,
    videoUrl: null,
  },
  {
    pageId:    "demo-5",
    notionUrl: "#",
    bookTitle: "瓦尔登湖",
    author:    "亨利·戴维·梭罗",
    coverUrl:  null,
    quotes: [
      "我步入丛林，因为我希望生活得有意义，我希望活得深刻，吸取生命中所有的精华。",
      "不必给我爱，不必给我钱，不必给我名誉，给我真理吧。",
      "大多数人都生活在平静的绝望中。",
    ],
    musicUrl: null,
    videoUrl: null,
  },
  {
    pageId:    "demo-6",
    notionUrl: "#",
    bookTitle: "挪威的森林",
    author:    "村上春树",
    coverUrl:  null,
    quotes: [
      "死并非生的对立面，而是作为生的一部分永存。",
      "哪里会有人喜欢孤独，不过是不喜欢失望。",
      "每个人都有属于自己的一片森林，迷失的人迷失了，相逢的人会再相逢。",
      "不管全世界所有人怎么说，我都认为自己的感受才是正确的。",
    ],
    musicUrl: null,
    videoUrl: null,
  },
  {
    pageId:    "demo-7",
    notionUrl: "#",
    bookTitle: "当下的力量",
    author:    "埃克哈特·托利",
    coverUrl:  null,
    quotes: [
      "你无法在未来找到自己，只能在当下这一刻找到自己。",
      "接受眼前发生的一切，然后采取行动，改变你所能改变的。",
      "当你完全活在当下，过去与未来都会消融。",
    ],
    musicUrl: null,
    videoUrl: null,
  },
  {
    pageId:    "demo-8",
    notionUrl: "#",
    bookTitle: "人间失格",
    author:    "太宰治",
    coverUrl:  null,
    quotes: [
      "我的不幸，恰恰在于我缺乏拒绝的能力。",
      "胆怯者连幸福都害怕，碰到棉花也会受伤。",
      "我一直对人类生活充满了恐惧，而那份恐惧，其实来自我对自己的不信任。",
    ],
    musicUrl: null,
    videoUrl: null,
  },
];

// ── Dashboard Demo 统计数据 ───────────────────────────────────────

// 最近 30 天哪些天有入库（距今天的天数 → 当天入库数）
function buildRecentActivity(): { date: string; count: number }[] {
  const today = new Date();
  const active: Record<number, number> = {
    1: 1, 3: 2, 6: 1, 9: 2, 11: 1, 14: 3, 17: 1, 20: 2, 23: 1, 26: 2, 29: 1,
  };
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (29 - i));
    return { date: d.toISOString().slice(0, 10), count: active[29 - i] ?? 0 };
  });
}

const DEMO_LATEST: BookSummary[] = [
  { pageId: "demo-6", title: "挪威的森林",   author: "村上春树",       coverUrl: null, notionUrl: "#" },
  { pageId: "demo-7", title: "当下的力量",   author: "埃克哈特·托利", coverUrl: null, notionUrl: "#" },
  { pageId: "demo-5", title: "瓦尔登湖",     author: "亨利·戴维·梭罗", coverUrl: null, notionUrl: "#" },
  { pageId: "demo-3", title: "被讨厌的勇气", author: "岸见一郎",       coverUrl: null, notionUrl: "#" },
  { pageId: "demo-1", title: "活着",         author: "余华",           coverUrl: null, notionUrl: "#" },
];

export function buildDemoStats(): StatsData {
  const total = 32;

  const genres = [
    { name: "小说",   count: 14, percentage: 43.8 },
    { name: "心理学", count:  8, percentage: 25.0 },
    { name: "散文",   count:  5, percentage: 15.6 },
    { name: "历史",   count:  3, percentage:  9.4 },
    { name: "哲学",   count:  2, percentage:  6.3 },
  ];

  const countries = [
    { name: "日本",     count: 10 },
    { name: "中国",     count:  8 },
    { name: "法国",     count:  5 },
    { name: "美国",     count:  4 },
    { name: "哥伦比亚", count:  2 },
    { name: "德国",     count:  2 },
    { name: "其他",     count:  1 },
  ];

  const authors = [
    { name: "村上春树",   count: 4 },
    { name: "余华",       count: 3 },
    { name: "太宰治",     count: 3 },
    { name: "加缪",       count: 2 },
    { name: "岸见一郎",   count: 2 },
    { name: "埃克哈特·托利", count: 2 },
    { name: "龙应台",     count: 2 },
    { name: "圣·埃克苏佩里", count: 1 },
    { name: "梭罗",       count: 1 },
    { name: "马尔克斯",   count: 1 },
  ];

  // 今年各月入库数（1月到12月，0-indexed）
  const byMonth = [3, 2, 4, 5, 4, 0, 0, 0, 0, 0, 0, 0];

  return {
    total,
    genres,
    topGenres: genres.slice(0, 3),
    countries,
    authors,
    thisYear: { total: 18, byMonth },
    recentActivity: buildRecentActivity(),
    latest: DEMO_LATEST,
  };
}
