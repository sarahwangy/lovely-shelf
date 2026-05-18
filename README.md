# lovely-shelf 📚

[中文版 README →](./README_CN.md)

> Point your camera at a book cover. Watch it land in Notion.

lovely-shelf turns book cover photos into a fully-tagged Notion library. Upload an image, and Claude AI extracts the title, author, genre, country of origin, and a few memorable quotes — then writes everything into your Notion database in one shot, deduplicated, with the cover attached.

**[Try the live demo →](https://lovely-shelf.vercel.app)** — click **一键体验 Demo**, no account needed.

---

## How it works

```
┌─────────────────────────────────────────────────────────────────┐
│                         UPLOAD FLOW                             │
│                                                                 │
│  📸 Photo    ──►  Preprocess  ──►  Claude AI  ──►  Notion      │
│  (any size)       (sharp)          (vision)        (write)      │
│                                                                 │
│  Step 1: Resize to ≤1200px, convert to JPEG (server-side)      │
│                                                                 │
│  Step 2: Claude reads the cover image and returns:             │
│          { title, subtitle, author, gender, country,           │
│            genres[], description, quotes[] }                    │
│                                                                 │
│  Step 3: Check Notion — does this title+author already exist?  │
│          YES → return existing page URL (no duplicate)         │
│          NO  → upload cover + create new Notion page           │
│                                                                 │
│  Step 4: Count books in same genre → show achievement badge    │
│          Fetch 5 similar books → show recommendation row       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Features

### 📤 Upload & Recognize
- Drag-and-drop or tap-to-upload, process multiple covers at once
- HEIC/HEIF support (iPhone native format) with three-tier conversion:
  `libheif-js (WebAssembly) → heic2any → Canvas API`
- Duplicate detection: if the book is already in Notion, links to the existing record instead of creating a duplicate
- After a successful add: genre achievement badge ("your 14th 小说!") + horizontal scroll of similar books from your library

### 📊 Dashboard
```
┌────────────────────────────────────────┐
│  Your Library                          │
│                                        │
│   📚 32 books    📅 8 this year        │
│                                        │
│  Genre breakdown          Recent adds  │
│  ┌──────────┐             ┌──┐┌──┐┌──┐│
│  │  Pie     │  小说 44%   │  ││  ││  ││
│  │  Chart   │  心理学 25% │  ││  ││  ││
│  │(Recharts)│  散文 16%   └──┘└──┘└──┘│
│  └──────────┘             [tap to open]│
└────────────────────────────────────────┘
```
- Total book count, year-to-date additions, top-genre breakdown
- 30-day activity heatmap
- Tap any book thumbnail to open a full detail modal (live-fetched from Notion)

### 💬 Quote Library
- Every quote Claude extracted from every book, paginated 10 per page
- Four tabs: **全部** (all) · **手写** (handwritten) · **书库语录** (from books) · **已收藏** (liked)
- ❤️ Like quotes; likes persist in `localStorage`
- Add your own quotes by hand — they appear at the top under the Manual tab

### 🎨 Quote Card Studio
```
┌──────────────────┬───────────────────────────────┐
│  Live Preview    │  Controls                     │
│  ┌────────────┐  │                               │
│  │ 🌅 gradient│  │  Background: color/gradient/  │
│  │            │  │             image/video        │
│  │ "真正重要  │  │  Font: size / family / color  │
│  │  的东西…"  │  │  Layout: position / alignment │
│  │            │  │  Emoji insert at cursor        │
│  │ — 小王子   │  │  Wave decoration toggle        │
│  └────────────┘  │                               │
│                  │  [ Export PNG ]               │
│  [216 × 320px]   │  [ Record MP4 + music ]       │
└──────────────────┴───────────────────────────────┘
```
- Pixabay image & video search for backgrounds
- Jamendo music search + audio mixing into MP4 recordings
- Web Speech API for voice input
- Styles persist in `localStorage` per quote

### 🤖 AI Chat
- Streaming chat (Server-Sent Events) with a Claude assistant that knows your library
- Can recognize a book cover you upload mid-conversation
- Can surface quotes, list books by genre, and answer questions about your shelf

### 🎪 Demo Mode
- Runs **real Claude AI recognition** — results are genuine, not canned
- All Notion operations are bypassed — your database is never touched
- Ships with ~32 seeded books, genre stats, and quotes
- Session-scoped only: resets on page refresh

---

## Architecture

```
src/
├── app/                              Next.js App Router
│   ├── layout.tsx                    Root layout + session provider + NavBar
│   ├── upload/page.tsx               Multi-image upload with per-file progress
│   ├── result/page.tsx               Results: book cards + recommendations
│   ├── dashboard/page.tsx            Stats overview
│   ├── quotes/page.tsx               Quote browser + card studio
│   ├── login/page.tsx                Google OAuth + demo credentials
│   ├── chat/page.tsx                 SSE streaming chat UI
│   └── api/
│       ├── process/route.ts          Sequential pipeline (default)
│       ├── agent/route.ts            Claude Tool Use pipeline (optional)
│       ├── stats/route.ts            Dashboard data
│       ├── quotes/route.ts           Quote CRUD
│       ├── books/route.ts            Paginated book list
│       ├── chat/route.ts             SSE chat with tool use
│       ├── images/route.ts           Pixabay image proxy
│       ├── videos/route.ts           Pixabay video proxy
│       ├── music/route.ts            Jamendo music search
│       └── daily-quote/route.ts     Random quote of the day
│
├── lib/
│   ├── ai.ts                         recognizeBook() — Claude vision call
│   ├── agent.ts                      runBookAgent() — Tool Use loop
│   ├── notion.ts                     All Notion read/write helpers
│   ├── image.ts                      preprocessImage() — sharp pipeline
│   ├── notion-fields.ts              Single source of truth for property names
│   └── demo-data.ts                  Seed data for demo mode
│
├── components/
│   ├── NavBar.tsx                    Bottom tab bar (upload/quotes/books/dashboard)
│   ├── BookDetailModal.tsx           Full-screen book detail drawer
│   └── DemoBanner.tsx                "Demo mode" header strip
│
└── types/
    └── book.ts                       BookInfo, BookSummary, BookDetail
```

---

## Two upload pipelines

`NEXT_PUBLIC_USE_AGENT` selects which pipeline handles each upload:

```
NEXT_PUBLIC_USE_AGENT=false  (default — sequential)
═══════════════════════════════════════════════════

  Client                  /api/process              Services
  ──────                  ────────────              ────────
  POST image ──────────►  preprocessImage()  ──►  sharp
                          recognizeBook()     ──►  Anthropic API
                          findDuplicateBook() ──►  Notion query
                          uploadFileToNotion()──►  Notion files
                          createBookPage()    ──►  Notion create
                          countBooksByGenre() ──►  Notion query
                          listBooksByGenre()  ──►  Notion query
             ◄──────────  { bookInfo, pageUrl, stats, recommendations }


NEXT_PUBLIC_USE_AGENT=true  (agentic — Tool Use)
════════════════════════════════════════════════

  Client                  /api/agent                Services
  ──────                  ──────────                ────────
  POST image ──────────►  preprocessImage()  ──►  sharp
                          runBookAgent() loop:
                          │
                          │  Claude decides which tools to call:
                          │  ┌─ recognize_book_from_image ──► Anthropic (vision)
                          │  ├─ check_duplicate_in_notion  ──► Notion
                          │  ├─ upload_cover_to_notion     ──► Notion
                          │  └─ create_notion_page         ──► Notion
                          │
             ◄──────────  same JSON shape as /api/process
```

Both routes return the same response shape — the frontend is identical regardless of which pipeline runs.

---

## Authentication

```
                         next-auth v5
                    ┌────────────────────┐
                    │                    │
  Google OAuth ────►│  Google provider   │──► check AUTH_ALLOWED_EMAILS
                    │                    │    ✓ allowed → session created
                    │                    │    ✗ blocked → redirect to /login
                    │                    │
  Demo button ─────►│ Credentials        │──► always succeeds
                    │ provider           │    email = demo@lovely-shelf.com
                    └────────────────────┘

Every API route:
  const session = await auth()
  if (!session?.user) return 401

  if (session.user.email === "demo@lovely-shelf.com") {
    // skip all Notion writes, return demo data
    // (AI recognition still runs — results are real)
  }
```

---

## Notion database schema

Create one Notion database with these properties (exact names matter — they're mapped in `src/lib/notion-fields.ts`):

| Property | Type | Description |
|---|---|---|
| `书名` | Title | Book title |
| `副标题` | Rich text | Subtitle |
| `作者` | Rich text | Author(s) |
| `性别` | Select | Author gender |
| `国家` | Select | Country of origin |
| `类型 Label` | Multi-select | Genres |
| `描述` | Rich text | One-paragraph summary |
| `语录` | Rich text | 2–3 quotes, newline-separated |
| `封面` | Files & media | Cover image |
| `Notion URL` | URL | Self-referencing page link |
| `音乐` | URL | Optional music link (Quote Studio) |
| `视频` | URL | Optional video link (Quote Studio) |

**Fixed genre list** (Claude always picks from these):

```
小说  散文  历史  哲学  心理相关  励志  政治  经济  科技  艺术  儿童读物  其他
```

---

## Setup

### Prerequisites

- Node.js 20+
- Notion Integration with access to your database
- Anthropic API key
- Google OAuth credentials (for real accounts; demo works without this)

### 1. Clone

```bash
git clone https://github.com/sarahwangy/lovely-shelf.git
cd lovely-shelf
npm install
```

### 2. Environment variables

```bash
cp .env.sample .env.local
```

```env
# Required
ANTHROPIC_API_KEY=sk-ant-...
NOTION_TOKEN=secret_...
NOTION_DATABASE_ID=...                  # 32-char ID from your database URL

# Auth
AUTH_SECRET=...                         # generate: npx auth secret
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
AUTH_ALLOWED_EMAILS=you@gmail.com       # comma-separated

# Optional — selects the agentic pipeline
NEXT_PUBLIC_USE_AGENT=false

# Optional — enables Quote Studio backgrounds/music
PIXABAY_API_KEY=...
JAMENDO_CLIENT_ID=...
```

> `.env.local` is in `.gitignore` — it will never be committed.

### 3. Run

```bash
npm run dev
# → http://localhost:3000
```

Click **一键体验 Demo** to explore without any API keys (AI recognition requires `ANTHROPIC_API_KEY`).

---

## Deploy to Vercel

```bash
vercel deploy
```

Set the same env vars in Vercel project settings. Recommended settings:
- **Node.js version**: 20.x (required for sharp)
- **Function max duration**: 60s (AI + Notion can take ~10–15s cold)

---

## Development notes

**Adding a new Notion field**: Edit `src/lib/notion-fields.ts` (single source of truth), then update `src/lib/notion.ts` for read/write, and `src/lib/ai.ts` if Claude should extract it.

**Changing the genre list**: Update the system prompt in `src/lib/ai.ts` and the Multi-select options in your Notion database — keep them in sync.

**Demo mode locally**: Start the dev server, click the Demo button. The demo credentials provider accepts any password. AI recognition in demo mode requires `ANTHROPIC_API_KEY`; all other features work without it.

---

## Roadmap

- [x] AI cover recognition (Claude Vision)
- [x] Auto-write to Notion with deduplication
- [x] Batch upload with per-file progress
- [x] HEIC/HEIF support (iPhone native format)
- [x] Dashboard: genre charts, activity heatmap
- [x] Book detail modal with Notion field editing
- [x] Quote library with tabs, likes, pagination
- [x] Quote Card Studio (PNG export, MP4 recording)
- [x] AI Chat assistant (SSE streaming)
- [x] Agent pipeline (Claude Tool Use)
- [x] Demo mode with real AI recognition
- [ ] Google Books API for ISBN / page count
- [ ] Public share links for individual quote cards

---

## License

MIT
