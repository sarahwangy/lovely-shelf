# 下次新项目开始前的 Prompt 流程

---

## 本次测试的 Skills 汇总

| Skill / 工具 | 来源 | 怎么用 | 安装方式 | 测试结果 | 下次用吗 |
|---|---|---|---|---|---|
| **graphify** | `uv tool install graphifyy` | `/graphify . --wiki` | 全局 | ✅ 生成了 441 节点知识图谱，可用 `/graphify query` 提问 | ✅ 新项目建议跑一次 |
| **frontend-design** | Anthropic 官方 skill | 开始新组件前调用 | 项目级 `npx skills add` | 📋 已了解，未深度测试 | ✅ 下个项目配合 DESIGN.md 用 |
| **awesome-design-md** | VoltAgent/awesome-design-md | 下载品牌 DESIGN.md 放根目录 | 手动下载文件 | ✅ 下载了 Airbnb DESIGN.md，生成了 HTML 预览 | ✅ 每个新项目选一个品牌风格 |
| **Superpowers** | `/plugin install superpowers@claude-plugins-official` | 全局安装，自动触发 | 全局 | 📋 已了解，项目快完未安装 | ✅ 下个项目开始前全局装 |
| **vercel-labs/agent-skills** | Vercel 官方 | React/Next.js 代码规范审查，自动触发 | 项目级 `npx skills add vercel-labs/agent-skills` | 📋 已了解，未安装 | ✅ 下个项目开始时装 |

---

## 三个设计/质量工具的分工

| 工具 | 解决什么问题 | 类比 |
|------|------------|------|
| **awesome-design-md** (DESIGN.md) | 视觉参数：颜色/字体/圆角/间距 | 设计稿上的色板和标注 |
| **frontend-design skill** | 设计决策流程：动手前问清楚审美方向 | 设计师问"你想要什么风格" |
| **vercel-labs/agent-skills** | 代码质量规范：React/Next.js 写法是否正确 | 代码 reviewer 说"这样写性能有问题" |

三者不重叠，可以同时用。

## 标准工作流（完整版）

```
新项目开始
    ↓
0. 全局装好 Superpowers（先问需求再写代码）
    ↓
1. 项目级装好 vercel-labs/agent-skills（代码质量守门）
    ↓
2. 挑一个 DESIGN.md（Airbnb / Notion / Linear...）
    ↓
3. frontend-design skill 先问：极简还是活泼？单色还是渐变？
    ↓
4. 让我生成 HTML 预览（就像 test-skills/ 里的这几个）
    ↓
5. 你在浏览器里看效果，觉得 OK？
    ↓
6. 说"开始"→ 我按这个风格写真正的 React 组件
         vercel-labs 自动审查代码规范
```

## 下次怎么说

> "新项目，我想用 Linear 风格，先给我看个 HTML 预览"

我就会：先拉 Linear 的 DESIGN.md → 生成对应的 HTML 小样 → 你确认风格 → 再动手写代码。

## 这样做的好处

- 改风格的成本很低——HTML 改一改就行，不用动真实组件
- 你能在写一行 TSX 之前就确认"我要的就是这个感觉"
- 设计决策留在 `DESIGN.md` 文件里，之后每次写组件都会参考它保持一致
- vercel-labs 自动把关代码质量，不用每次手动 review

## 可以选的 DESIGN.md 风格（73 个品牌）

| 风格 | 特点 | 适合什么项目 |
|------|------|------------|
| **Airbnb** | 珊瑚红、圆角、照片优先 | 内容展示、书架、消费类 |
| **Linear** | 极简、紫色、工程师审美 | 工具类、效率类 |
| **Notion** | 暖白、衬线标题、柔和 | 笔记、文档、知识库 |
| **Vercel** | 黑白、Geist 字体、精准 | 开发者工具、技术产品 |
| **Supabase** | 深色、翠绿、代码优先 | 后台、数据类 |

完整列表：`/graphify query` 或访问 https://github.com/VoltAgent/awesome-design-md

## 资源位置

- `DESIGN.md` → 项目根目录（当前是 Airbnb 风格）
- `test-skills/preview-airbnb.html` → Airbnb 效果预览

---

## Superpowers 插件

**是什么：** 一套完整的 AI 编程方法论，核心行为是——当你说"开始一个新项目"，它不会立刻写代码，而是先问你一连串问题，把需求、设计、实现方案全部确认清楚，你说 OK 之后才动手。强调 TDD（测试驱动）、YAGNI（不提前过度设计）、DRY（不重复代码）。

**现在这个项目要装吗？** 不需要，项目快完成了，装了也发挥不了作用。

**下个项目装不装？** 值得装，能有效防止 AI 盲目写代码、做错方向。

**全局还是本地？** 全局安装，一次安装所有项目都能用，不需要每个项目单独装。

**安装命令（在 Claude Code 里执行）：**
```
/plugin install superpowers@claude-plugins-official
```

**和 DESIGN.md 一起用的完整流程：**
```
新项目开始
    ↓
Superpowers 先问你：做什么？给谁用？核心功能？边界在哪？
    ↓
你和 Claude 确认 spec（需求规格）
    ↓
选一个 DESIGN.md 风格 + 生成 HTML 预览确认视觉方向
    ↓
Claude 制定实现计划，你审阅通过
    ↓
说"开始" → 按计划逐步写代码，不再盲目乱写
```

---

## frontend-design Skill

**是什么：** Anthropic 官方出的 Claude Code skill，解决"AI 生成的 UI 千篇一律"的问题。启动时先问审美方向（极简/复古/奢华…），然后再生成代码，而不是默认甩出一个 Inter 字体 + 紫色渐变。

**安装命令：**
```bash
npx skills add https://github.com/anthropics/skills --skill frontend-design
```

**和 DESIGN.md 的区别：**

| | DESIGN.md | frontend-design skill |
|---|---|---|
| 是什么 | 某品牌的设计 token（颜色/字体/圆角） | 设计决策流程 |
| 回答什么 | "要长什么样" | "怎么想清楚再动手" |
| 使用时机 | 放项目根目录，全程参考 | 开始新组件/页面时调用 |

两者配合：DESIGN.md 给具体参数，skill 帮你在框架内做更细的决策，最终代码既符合品牌风格又有设计主见。

---

---

## vercel-labs/agent-skills

**是什么：** Vercel 官方出的 7 个 AI agent skill，专门针对 React / Next.js 项目的代码质量和部署。安装后，Claude 在写代码时会自动遵守这些规范，不需要你手动提醒。

**7 个 skill 清单：**

| Skill | 做什么 | 你的项目有用吗 |
|-------|--------|-------------|
| **react-best-practices** | 40+ 条 Next.js 规范，数据获取、bundle 优化 | ✅ 非常有用 |
| **web-design-guidelines** | 100+ 条 accessibility/UX 规则，含 dark mode | ✅ 有用 |
| **composition-patterns** | 用 compound components 替代 boolean props | ✅ 有用 |
| **react-view-transitions** | 页面切换动画（View Transition API） | 可选 |
| **vercel-optimize** | 审计 Vercel 部署的成本/性能 | 上线后有用 |
| **vercel-deploy-claimable** | 一键部署并生成 preview URL | 可选 |
| **react-native-guidelines** | React Native / Expo 规范 | 不适用 |

**和 awesome-design-md / frontend-design 的区别：**

- DESIGN.md → 管"长什么样"（视觉参数）
- frontend-design → 管"想清楚再动手"（决策流程）
- vercel-labs → 管"代码写得对不对"（质量规范）

**安装命令（项目级，不要全局）：**
```bash
npx skills add vercel-labs/agent-skills
```

**为什么装项目级而不是全局：** 这些规则和 Next.js / Vercel 深度绑定，不适合所有类型的项目。下个项目如果还是 Next.js 就装，如果换成别的框架就不装。

---

## `claude plugin install` vs `npx skills add` 的区别

两者是不同层面的工具：

| | `claude plugin install` | `npx skills add` |
|---|---|---|
| 作用范围 | 全局（所有项目） | 单个项目 |
| 存放位置 | `~/.claude/` | `.claude/skills/` |
| 能安装什么 | skill + MCP + agent + hook | 只有 skill |
| 团队共享 | 不能（本地） | 可以（commit 进 git） |

**使用建议：**
- 想让**整个团队**都能用某个 skill → 用 `npx skills add` 并 commit 进项目
- 只是**自己**用 → `claude plugin install` 更方便

---

## graphify 知识图谱的置信度分布

graphify 提取代码关系时，每条边都有置信度评分（confidence_score）。规则是：明确从代码里提取出来的关系（EXTRACTED）固定为 1.0；推断出来的关系（INFERRED）只能从五个离散值中选一个：0.95 / 0.85 / 0.75 / 0.65 / 0.55，不能用 0.5，也不能用其他数值。这是为了对抗实际观察到的"双峰分布"现象——模型在连续范围里打分时，超过 50% 会堆在 0.5，超过 40% 会堆在 0.85 以上，导致分布像两个峰而不是均匀的高斯分布。用离散档位强制模型做出明确判断，而不是躲在模糊的中间值里。
