



# Notion Database 字段映射
/**
 * Notion Database 字段映射
 * 一边是代码里用的英文变量名，一边是 Notion 里的实际字段名
 * 改 Notion 字段名时只改这个文件
 */
export const NOTION_FIELDS = {
  title: "书名",
  subtitle: "副标题",
  author: "作者",
  gender:"性别“,
  country: "国家",
  genres: "类型 Label",
  description: "描述",
  cover: "封面",
  status: "状态",
  sourceFilename: "原图文件名",
} as const;

/**
 * 类型枚举（用于 Multi-select / Select 字段）
 * 必须和 Notion 里预设的选项一字不差
 */
export const GENRE_LABELS = [
  "回忆录",
  "传记",
  "喜剧",
  "冒险",
  "心理相关",
  "励志",
  "身心健康",
  "育儿",
  "科普",
  "园艺",
  "体育",
  "历史",
  "儿童读物",
  "旅行",
  "其他",
] as const;

export const STATUS_VALUES = ["草稿", "已确认"] as const;



# Notion Database 字段配置（必读）
=== Notion Database 字段配置（必读）===

我已经在 Notion 里手动创建了一个 Database，字段如下：

| Notion 字段名 | 字段类型 | 说明 |
|--------------|---------|------|
| 书名 | Title | 主标，每个 Database 唯一的 Title 字段 |
| 副标题 | Text | 书名冒号后的部分 |
| 作者 | Text | 多作者用 "&" 分隔 |
| 性别 | Text | |
| 国家 | Select | 作者主要国籍 |
| 类型 Label | Multi-select | 书的类型标签，可多选 |
| 描述 | Text | 一句话主题 |
| 封面 | Files & Media | 上传的封面图 |
| 状态 | Select | 草稿 / 已确认 |
| 原图文件名 | Text | 调试用，上传时的原始文件名 |

Select / Multi-select 字段在 Notion 里已经预设好以下选项：

「类型 Label」预设选项：
回忆录、传记、喜剧、冒险、心理相关、励志、身心健康、育儿、科普、园艺、体育、历史、儿童读物、旅行、其他

「国家」预设选项：
澳大利亚、英国、美国、新西兰、南非、加拿大、中国、日本。
重要：如果没有国家预设选项，你可以按照作者国家名，自己加进去。

「状态」预设选项：
草稿、已确认

=== 代码侧的字段映射规则 ===

代码里所有 Notion 字段相关的访问都必须通过 `src/lib/notion-fields.ts` 这个映射文件，
不允许在业务代码里直接写中文字段名字符串。

具体要求：

1. 创建 `src/lib/notion-fields.ts`，导出一个 `NOTION_FIELDS` 常量对象，
   把英文 key（代码里用）映射到中文字段名（Notion 里用）。
   用 `as const` 让 TypeScript 推断成字面量类型。

2. 同时导出 `GENRE_LABELS`、`COUNTRY_OPTIONS`、`STATUS_VALUES` 三个常量数组，
   分别对应三个 Select / Multi-select 字段的预设选项。
   也用 `as const`，让代码能用 `(typeof GENRE_LABELS)[number]` 派生出枚举类型。

3. 创建 `src/types/book.ts`，定义 `BookInfo` 类型，字段名用英文 camelCase：
   - title: string
   - subtitle: string | null
   - author: string
   - gender:string
   - country: string | null   （必须是 COUNTRY_OPTIONS 之一，或 null）
   - genres: Genre[]            （必须是 GENRE_LABELS 的子集）
   - description: string
   并从 notion-fields.ts 派生出 Genre / Country / Status 三个联合类型。

4. 在 `src/lib/notion.ts` 里实现 `createBookPage(info, fileUploadId, sourceFilename)`，
   构造 properties 对象时必须用 `[NOTION_FIELDS.xxx]: ...` 的方括号语法，
   绝对不要在 properties 里直接写 "书名"、"作者" 这种字符串。

5. 写一个简短的注释说明：以后如果改了 Notion 字段名，
   只需要改 notion-fields.ts 一处，其他业务代码不用动。

=== 容易踩坑的注意事项 ===

- Title 字段（书名）的 API 格式是 `title: [{ text: { content } }]`，跟普通 Text 不一样
- Text 字段的 API key 是 `rich_text` 不是 `text`
- Select 字段为 null 时要传 `{ select: null }` 不是 `{}`，也不是省略不传
- Multi-select 的值是 `[{ name: "回忆录" }]`，name 必须和 Notion 预设选项一字不差
- Files & Media 通过 file_upload 上传时格式是：
  `{ files: [{ name, type: "file_upload", file_upload: { id } }] }`

=== 任务 ===

现在请按上面的要求实现 3 个文件：
1. src/lib/notion-fields.ts
2. src/types/book.ts
3. src/lib/notion.ts

按 CLAUDE.md 的教学模式来：
- 每个文件开始前，先告诉我打算放什么内容
- 写完后用注释和聊天解释关键逻辑
- 解释 `as const` 和 `(typeof X)[number]` 这两个 TypeScript 语法（我没用过）
- 解释 properties 里 `[NOTION_FIELDS.title]: ...` 这个方括号语法为什么必要

等我说"开始"再动手。


# test
请创建一个测试用例，造一份假的 BookInfo 数据，
调用 createBookPage 写入 Notion（不上传图片，fileUploadId 传 null），
然后我去 Notion 里看看是否所有字段都正确填上了。