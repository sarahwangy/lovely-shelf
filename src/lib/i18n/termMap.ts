const GENRE_ZH_TO_EN: Record<string, string> = {
  "励志": "Self-Help",
  "心理相关": "Psychology",
  "身心健康": "Wellness",
  "回忆录": "Memoir",
  "传记": "Biography",
  "喜剧": "Comedy",
  "冒险": "Adventure",
  "育儿": "Parenting",
  "科普": "Science",
  "园艺": "Gardening",
  "体育": "Sports",
  "历史": "History",
  "儿童读物": "Children",
  "旅行": "Travel",
  "其他": "Other",
  "小说": "Fiction",
  "散文": "Essays",
  "诗歌": "Poetry",
  "哲学": "Philosophy",
  "艺术": "Art",
  "音乐": "Music",
  "经济": "Economics",
  "商业": "Business",
  "科技": "Technology",
  "政治": "Politics",
  "社会": "Society",
  "文化": "Culture",
  "宗教": "Religion",
  "医学": "Medicine",
  "烹饪": "Cooking",
};

const COUNTRY_ZH_TO_EN: Record<string, string> = {
  "中国": "China",
  "美国": "USA",
  "英国": "UK",
  "日本": "Japan",
  "澳大利亚": "Australia",
  "加拿大": "Canada",
  "法国": "France",
  "德国": "Germany",
  "意大利": "Italy",
  "西班牙": "Spain",
  "韩国": "Korea",
  "印度": "India",
  "巴西": "Brazil",
  "俄罗斯": "Russia",
  "墨西哥": "Mexico",
  "南非": "South Africa",
  "新西兰": "New Zealand",
  "挪威": "Norway",
  "瑞典": "Sweden",
  "丹麦": "Denmark",
  "荷兰": "Netherlands",
  "瑞士": "Switzerland",
  "奥地利": "Austria",
  "葡萄牙": "Portugal",
  "土耳其": "Turkey",
  "以色列": "Israel",
  "爱尔兰": "Ireland",
  "苏格兰": "Scotland",
  "波兰": "Poland",
  "匈牙利": "Hungary",
  "希腊": "Greece",
  "埃及": "Egypt",
  "尼日利亚": "Nigeria",
  "肯尼亚": "Kenya",
  "津巴布韦": "Zimbabwe",
  "越南": "Vietnam",
  "泰国": "Thailand",
  "菲律宾": "Philippines",
  "印度尼西亚": "Indonesia",
  "马来西亚": "Malaysia",
  "新加坡": "Singapore",
  "阿根廷": "Argentina",
  "智利": "Chile",
  "哥伦比亚": "Colombia",
  "秘鲁": "Peru",
};

export function translateTerm(
  name: string,
  type: "genre" | "country",
  lang: string
): string {
  if (lang !== "en") return name;
  const map = type === "genre" ? GENRE_ZH_TO_EN : COUNTRY_ZH_TO_EN;
  return map[name] ?? name;
}

// 将英文（或中文）分类名转回中文，用于 API 查询 Notion
export function toZhTerm(name: string, type: "genre" | "country"): string {
  const map = type === "genre" ? GENRE_ZH_TO_EN : COUNTRY_ZH_TO_EN;
  if (name in map) return name; // 已经是中文
  const entry = Object.entries(map).find(([, en]) => en === name);
  return entry ? entry[0] : name;
}
