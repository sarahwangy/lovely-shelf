const zh = {
  // 导航栏
  nav: {
    upload:    "上传",
    dashboard: "书架",
    chat:      "聊天",
    quotes:    "语录",
    signOut:   "退出",
  },

  // Demo 横幅
  demo: {
    banner: "Demo 模式 · 当前展示的是示例数据，不会读写你的 Notion",
  },

  // 上传页
  upload: {
    title:       "扫一扫，入书架",
    subtitle:    "拍下书封面，AI 自动识别书名、作者、类型，一键存入 Notion",
    dragHint:    "拖拽图片到这里，或点击选择",
    supportHint: "支持 JPG、PNG、HEIC，可批量上传",
    processing:  "识别中…",
    done:        "完成",
    failed:      "识别失败",
    viewResults: "查看结果",
    selectBtn:   "+ 选择图片",
    waiting:     "等待",
  },

  // 结果页
  result: {
    title:       "入库结果",
    duplicate:   "已存在",
    saved:       "已入库",
    failed:      "识别失败",
    viewNotion:  "在 Notion 查看",
    uploadMore:  "继续上传",
    noResults:   "没有结果，请先上传图片",
    goUpload:    "去上传",
    sameGenre:   (n: number, genre: string) => `你的第 ${n} 本「${genre}」`,
    recommend:   "同类推荐",
  },

  // 书架 / Dashboard
  dashboard: {
    title:      "我的书架",
    totalBooks: "总藏书",
    books:      "本",
    genreChart: "类型分布",
    recentActivity: "最近入库",
    noData:     "暂无数据",
  },

  // 语录页
  quotes: {
    title:      "语录库",
    tabAll:     "全部",
    tabHandwritten: "手写",
    tabBooks:   "书库",
    tabFavorites: "已收藏",
    addQuote:   "添加语录",
    makeCard:   "制作卡片",
    noQuotes:   "还没有语录，去添加一条吧",
    placeholder: "写下你喜欢的一句话…",
    save:       "保存",
    cancel:     "取消",
  },

  // 聊天页
  chat: {
    title:       "和书架聊天",
    placeholder: "问问你的书架…",
    send:        "发送",
    newChat:     "新对话",
    dailyQuote:  "今日语录",
  },

  // 登录页
  login: {
    title:      "欢迎来到 Lovely Shelf",
    subtitle:   "你的 AI 私人书架",
    googleBtn:  "用 Google 账号登录",
    demoBtn:    "体验 Demo",
    demoHint:   "无需登录，查看示例数据",
  },

  // 通用
  common: {
    loading:  "加载中…",
    retry:    "重新加载",
    error:    "出了点问题",
    errorHint: "别担心，你的书架数据都在。",
    author:   "作者",
    genre:    "类型",
    unknown:  "未知",
  },
};

export default zh;
export type Translations = typeof zh;
