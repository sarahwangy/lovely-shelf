帮我在这个项目里新增一个 Notion 字段。

需要改动的文件（按顺序）：

1. `src/lib/notion-fields.ts` — 唯一真值源，加字段的 key 和 Notion 属性名
2. `src/lib/notion.ts` — 读写逻辑：在读取函数里加这个字段的解析，在写入函数里加这个字段的赋值
3. `src/lib/ai.ts` — 如果这个字段需要 Claude 从封面图片里提取，就更新 system prompt 和返回的 JSON schema
4. `src/types/book.ts` — 如果这个字段要暴露给前端，更新 BookInfo / BookDetail 类型

开始之前：
- 先问我字段名（Notion 里显示的名字）、字段类型（Title / Rich text / Select / Multi-select / URL / Files & media）、是否需要 AI 提取
- 列出你打算改哪几个文件，等我说"开始"再动手
- 每改完一个文件，用一句话告诉我改了什么，再继续下一个

改完后提醒我：去 Notion 数据库手动添加这个字段，字段名和类型必须和 `notion-fields.ts` 里的完全一致。
