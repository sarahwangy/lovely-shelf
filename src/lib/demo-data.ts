// Demo 模式种子数据：面试官点"一键体验 Demo"后看到这些假数据，不触碰真实 Notion
// 数据模拟一个真实中文读者的书架，共 32 本书

import type { StatsData } from "@/app/api/stats/route";
import type { QuoteBook }  from "@/app/api/quotes/route";
import type { BookDetail, BookSummary, BookInfo } from "@/types/book";

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
    ],
    musicUrl: null,
    videoUrl: null,
  },
];

// ── 完整书库（书架页 / 类型页 / 详情 modal 用） ────────────────────

type DemoBookFull = BookDetail & { demoGenre: string };

// Open Library 封面 URL（isbn 为 null 时返回 null）
const ol = (isbn: string | null) =>
  isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg` : null;

// 工厂函数：一行一本书
function book(
  pageId: string,
  demoGenre: string,
  title: string,
  author: string,
  country: BookDetail["country"],
  genres: BookDetail["genres"],
  isbn: string | null,
  description: string,
  quotes: string[]
): DemoBookFull {
  return {
    pageId, demoGenre, pageUrl: "#", subtitle: null, gender: null,
    title, author, country, genres, description, quotes,
    coverUrl: ol(isbn),
  };
}

// 32 本书，对应 buildDemoStats() 里的五个分类
const DEMO_BOOKS_FULL: DemoBookFull[] = [
  // ── 小说 (14) ────────────────────────────────────────────────────
  book("demo-b01","小说","挪威的森林","村上春树","日本",["其他"],"0375704027",
    "1960年代末东京，渡边彻在失落与爱之间的青春成长。",
    ["死并非生的对立面，而是作为生的一部分永存。","哪里会有人喜欢孤独，不过是不喜欢失望。"]),
  book("demo-b02","小说","活着","余华","中国",["其他"],"1400033438",
    "农民福贵历经战乱与苦难，顽强活下去的故事。",
    ["人是为了活着本身而活着，不是为了活着以外的任何事物。"]),
  book("demo-b03","小说","小王子","圣·埃克苏佩里",null,["儿童读物"],"0156012197",
    "小王子游历各星球，最终领悟爱与责任的真谛。",
    ["真正重要的东西，用眼睛是看不见的。"]),
  book("demo-b04","小说","百年孤独","加西亚·马尔克斯",null,["其他"],"0060929790",
    "布恩迪亚家族七代人在马孔多的百年兴衰，魔幻现实主义巅峰。",
    ["过去都是假的，回忆是一条没有归途的路。"]),
  book("demo-b05","小说","人间失格","太宰治","日本",["其他"],"0811204812",
    "主人公叶藏对人类社会的恐惧与自我毁灭。",
    ["我的不幸，恰恰在于我缺乏拒绝的能力。","胆怯者连幸福都害怕，碰到棉花也会受伤。"]),
  book("demo-b06","小说","局外人","加缪",null,["其他"],"0679720020",
    "默尔索对母亲的死无动于衷，随后卷入命案。荒诞主义代表作。",
    ["在这温柔的夜晚，我感到与世界奇异的和解。"]),
  book("demo-b07","小说","麦田里的守望者","塞林格","美国",["其他"],"0316769177",
    "少年霍尔顿逃离学校在纽约游荡的三天，青春期反叛经典。",
    ["我老是在想象，有那么一群小孩子在一大块麦田里做游戏。"]),
  book("demo-b08","小说","雪国","川端康成","日本",["其他"],"0679761047",
    "岛村数度造访雪国温泉，与艺伎驹子的温柔邂逅。",
    ["穿过县界长长的隧道，便是雪国。夜空下，大地一片莹白。"]),
  book("demo-b09","小说","1984","乔治·奥威尔","英国",["其他"],"0451524934",
    "极权社会下温斯顿的反抗与爱情终被碾碎，反乌托邦警示之作。",
    ["战争即和平，自由即奴役，无知即力量。"]),
  book("demo-b10","小说","霍乱时期的爱情","加西亚·马尔克斯",null,["其他"],"0140120289",
    "费尔明娜与弗洛伦蒂诺跨越五十年的爱情。",
    ["爱情是实在的，它比死亡更强大，比金钱更强大。"]),
  book("demo-b11","小说","美丽新世界","阿道斯·赫胥黎","英国",["其他"],"0060929871",
    "科技操控一切的反乌托邦世界，幸福被设计成枷锁。",
    ["人们爱上了压迫，崇拜那些毁灭他们的技术。"]),
  // 原 围城（无封面）→ 金阁寺（有封面）
  book("demo-b12","小说","金阁寺","三岛由纪夫","日本",["其他"],"0679752706",
    "学生放火焚烧金阁寺，执念与美的极端呈现。三岛由纪夫代表作。",
    ["美，有时候是一种暴力。"]),
  // 原 源氏物语（无封面）→ 白夜行（有封面）
  book("demo-b13","小说","白夜行","东野圭吾","日本",["其他"],"0312672780",
    "一对少年男女在犯罪的阴影下相互依存、彼此庇护。",
    ["我的天空里没有太阳，但我并不觉得黑暗。"]),
  book("demo-b14","小说","献给阿尔吉侬的花束","丹尼尔·凯斯","美国",["其他"],"0156030306",
    "智力低下的查理经手术变聪明，又失去智力的悲剧。",
    ["聪明让我看见了世界的残忍，但我宁愿曾经聪明过。"]),

  // ── 心理学 (8) ───────────────────────────────────────────────────
  book("demo-b15","心理学","被讨厌的勇气","岸见一郎 / 古贺史健","日本",["心理相关","励志"],"1501197276",
    "以哲人与青年对话阐述阿德勒心理学，改变人生的一百页。",
    ["决定我们自身的，不是过去的经历，而是我们赋予经历的意义。","所谓自由，就是被别人讨厌。"]),
  book("demo-b16","心理学","当下的力量","埃克哈特·托利",null,["心理相关","身心健康"],"1577314808",
    "聚焦当下、脱离思维束缚的心灵觉醒之书。",
    ["你无法在未来找到自己，只能在当下这一刻找到自己。"]),
  // 原 自卑与超越（无封面）→ 思考，快与慢（有封面）
  book("demo-b17","心理学","思考，快与慢","丹尼尔·卡尼曼",null,["心理相关"],"0374533555",
    "诺贝尔奖得主揭示人类思维的两套系统如何左右我们的决策。",
    ["我们都喜欢把自己视为理性的决策者，但这往往是幻觉。"]),
  book("demo-b18","心理学","心流","米哈里·契克森米哈伊",null,["心理相关"],"0062283251",
    "完全专注时出现的高峰体验——心流的科学解析。",
    ["当你完全沉浸在一件事中，忘记时间流逝，那就是心流。"]),
  book("demo-b19","心理学","少有人走的路","斯科特·派克","美国",["心理相关","励志"],"068484870X",
    "用精神分析阐释爱、自律与成长的深刻关系。",
    ["自律是解决人生问题最主要的工具，也是消除人生痛苦最重要的方法。"]),
  // 原 蛤蟆先生（无封面）→ 爱的艺术（有封面）
  book("demo-b20","心理学","爱的艺术","埃里希·弗洛姆",null,["心理相关"],"0062119788",
    "爱是一门需要学习的艺术，而非等待降临的命运。",
    ["爱不是一种感觉，而是一种行动，是一种意志的实践。"]),
  // 原 亲密关系（无封面）→ 爱的五种语言（有封面）
  book("demo-b21","心理学","爱的五种语言","盖瑞·查普曼","美国",["心理相关","励志"],"080242848X",
    "人们表达和接受爱的方式各不相同，找对语言才能真正沟通。",
    ["真正的爱，是以对方需要的方式给予，而非你认为应该给予的方式。"]),
  book("demo-b22","心理学","情绪急救","盖伊·温奇","美国",["心理相关","身心健康"],"1451690630",
    "七种常见情绪创伤的自我急救手册。",
    ["我们对待情绪伤口的方式，应该像对待身体伤口一样认真。"]),

  // ── 散文 (5) ─────────────────────────────────────────────────────
  book("demo-b23","散文","瓦尔登湖","亨利·戴维·梭罗","美国",["其他"],"1505297729",
    "梭罗独居湖畔两年，追求简朴生活与自我觉知的经典。",
    ["我步入丛林，因为我希望生活得有意义。","大多数人都生活在平静的绝望中。"]),
  // 原 目送（无封面）→ 当我谈跑步时我谈些什么（有封面）
  book("demo-b24","散文","当我谈跑步时我谈些什么","村上春树","日本",["其他"],"0307269191",
    "村上春树以跑步为线索，写下关于意志、孤独与创作的坦诚告白。",
    ["无论多么艰难，只要活着就能感受到每一天的美好。"]),
  // 原 孩子你慢慢来（无封面）→ 活出生命的意义（有封面）
  book("demo-b25","散文","活出生命的意义","维克多·弗兰克尔",null,["其他"],"080701429X",
    "奥斯维辛幸存者记录极端苦难中如何在绝望里找到意义。",
    ["人可以适应几乎任何处境，只要他能从中找到意义。"]),
  // 原 人间词话（无封面）→ 岛上书店（有封面）
  book("demo-b26","散文","岛上书店","加布里埃尔·泽文","美国",["其他"],"1616203706",
    "孤独书店主人和被遗弃孩子相互拯救的故事，写给所有爱书之人。",
    ["没有谁是一座孤岛，每本书都是一个世界。"]),
  // 原 浮生六记（无封面）→ 偷书贼（有封面）
  book("demo-b27","散文","偷书贼","马库斯·祖萨克","澳大利亚",["其他"],"0375842209",
    "二战德国，小女孩莉塞尔在死神的注视下，用书籍寻找生的力量。",
    ["文字拯救了她，也终将拯救她爱的人。"]),

  // ── 历史 (3) ─────────────────────────────────────────────────────
  book("demo-b28","历史","人类简史","尤瓦尔·赫拉利",null,["历史"],"0062316095",
    "从认知革命到现代社会，宏观俯瞰人类十万年历史。",
    ["历史学最重要的一件事就是：让人察觉那些原本不在意料之中的可能。"]),
  book("demo-b29","历史","万历十五年","黄仁宇","中国",["历史"],"0300034601",
    "以1587年为切口，解剖明朝政治与文明的内在矛盾。",
    ["中国两千年来以道德代替法制，至明代而极，这就是一切问题的症结。"]),
  book("demo-b30","历史","枪炮、病菌与钢铁","贾雷德·戴蒙德","美国",["历史","科普"],"0393061310",
    "为什么是欧亚人征服了世界？地理决定论的力证。",
    ["历史沿着不同的轨迹发展，原因在于各民族环境的差异，而非生物性差异。"]),

  // ── 哲学 (2) ─────────────────────────────────────────────────────
  book("demo-b31","哲学","苏菲的世界","乔斯坦·贾德",null,["其他"],"0374530718",
    "少女苏菲通过神秘信件学习西方哲学史，小说与哲学完美融合。",
    ["你是谁？世界从哪里来？——这是哲学最初也是永恒的问题。"]),
  book("demo-b32","哲学","沉思录","马可·奥勒留",null,["其他"],"0812968255",
    "罗马皇帝的私人日记，斯多葛哲学的不朽践行。",
    ["你拥有掌控自己想法的力量，而非外在事物的控制。"]),
];

// ── Demo 书库对外 API ─────────────────────────────────────────────

export function getDemoBooksForGenre(genre: string): BookSummary[] {
  return DEMO_BOOKS_FULL
    .filter((b) => b.demoGenre === genre)
    .map(({ pageId, title, author, coverUrl }) => ({ pageId, title, author, coverUrl, notionUrl: "#" }));
}

export function getDemoBookDetail(pageId: string): BookDetail | null {
  const found = DEMO_BOOKS_FULL.find((b) => b.pageId === pageId);
  if (!found) return null;
  const { demoGenre: _g, ...detail } = found;
  return detail;
}

// 上传页 demo 识别结果（轮转，避免每次都是同一本书）
const DEMO_PROCESS_POOL: BookInfo[] = [
  { title:"挪威的森林", subtitle:"", author:"村上春树", gender:"男", country:"日本",   genres:["其他"],              description:"1960年代末东京，渡边彻在失落与爱之间的青春成长。", quotes:["死并非生的对立面，而是作为生的一部分永存。"] },
  { title:"被讨厌的勇气", subtitle:"自我启发之父阿德勒的哲学课", author:"岸见一郎 / 古贺史健", gender:"男", country:"日本", genres:["心理相关","励志"], description:"以哲人与青年对话阐述阿德勒心理学。", quotes:["决定我们自身的，不是过去的经历，而是我们赋予经历的意义。"] },
  { title:"小王子",   subtitle:"", author:"圣·埃克苏佩里", gender:"男", country:null,   genres:["儿童读物"],          description:"小王子游历各星球，领悟爱与责任的真谛。", quotes:["真正重要的东西，用眼睛是看不见的。"] },
  { title:"瓦尔登湖", subtitle:"", author:"亨利·戴维·梭罗", gender:"男", country:"美国", genres:["其他"],              description:"梭罗独居湖畔两年，追求简朴生活与自我觉知。", quotes:["大多数人都生活在平静的绝望中。"] },
];
let _processIdx = 0;
export function getDemoProcessResult() {
  const bookInfo = DEMO_PROCESS_POOL[_processIdx % DEMO_PROCESS_POOL.length];
  _processIdx++;
  return {
    bookInfo,
    pageUrl: "#",
    stats: { primaryGenre: bookInfo.genres[0], countInGenre: 14 },
    recommendations: getDemoBooksForGenre("小说").slice(0, 5),
  };
}

// ── Dashboard Demo 统计数据 ───────────────────────────────────────

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

const DEMO_LATEST: BookSummary[] = ["demo-b01","demo-b15","demo-b16","demo-b23","demo-b02"]
  .map((id) => {
    const b = DEMO_BOOKS_FULL.find((x) => x.pageId === id)!;
    return { pageId: b.pageId, title: b.title, author: b.author, coverUrl: b.coverUrl, notionUrl: "#" };
  });

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
    { name: "村上春树",       count: 4 },
    { name: "余华",           count: 3 },
    { name: "太宰治",         count: 3 },
    { name: "加缪",           count: 2 },
    { name: "岸见一郎",       count: 2 },
    { name: "埃克哈特·托利",  count: 2 },
    { name: "龙应台",         count: 2 },
    { name: "圣·埃克苏佩里",  count: 1 },
    { name: "梭罗",           count: 1 },
    { name: "马尔克斯",       count: 1 },
  ];

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
