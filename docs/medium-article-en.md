# I Vibe-Coded a Full-Stack AI App in 7 Days as a Beginner

> Point your camera at a book cover. Watch it land in Notion.

That's the whole pitch for lovely-shelf. Upload a photo of any book cover, and Claude AI reads it — extracts the title, author, genre, country of origin, and memorable quotes — then writes everything into your Notion database automatically. No typing. No copy-paste. Just a photo.

I want to cover two things: what I built, and how I built it. The how is the interesting part. I'm a beginner developer learning Next.js. I vibe-coded this entire thing with Claude Code as my pair programmer, using a structured methodology called Superpowers that changed how I think about building software. Seven days. One real app.

---

## What Is lovely-shelf?

**[Try the live demo](https://lovely-shelf.vercel.app)** — click the demo button, no account needed.

![Upload page — the entry point for scanning a book cover](screenshots/showcase.png)

lovely-shelf turns book cover photos into a fully-tagged Notion library. It has five sections:

- **Upload**: drag a book cover photo, Claude reads it in seconds
- **Dashboard**: genre pie chart, 30-day activity heatmap, full book grid
- **Quotes**: every quote Claude extracted, searchable and filterable
- **Quote Studio**: turn any quote into a shareable card (PNG export or MP4 with background music)
- **Chat**: a streaming AI assistant that knows your entire shelf

The full data pipeline looks like this:

```
┌─────────────────────────────────────────────────────┐
│                    Upload flow                       │
│                                                     │
│  Photo ──► Preprocess ──► Claude AI ──► Notion      │
│  (any size)  (sharp)       (vision)     (write)     │
│                                                     │
│  Step 1: Resize to ≤1200px, convert to JPEG         │
│  Step 2: Claude returns { title, author, genres,    │
│           country, quotes, description }             │
│  Step 3: Duplicate check — link existing or create  │
│  Step 4: Achievement badge + recommendation row     │
└─────────────────────────────────────────────────────┘
```

After recognition, the result page shows what Claude extracted and lets you confirm before writing to Notion:

![Recognition result — Claude extracted title, author, genres, and description from the cover photo](screenshots/prototype-result.png)

---

## The Problem I Was Solving

I already kept a Notion database of books I'd read. The problem was maintenance. Every time I finished a book, I'd open Notion, create a new row, type the title, type the author, search for a cover image, copy a quote or two — the whole thing took five minutes minimum per book. Multiply that across a year of reading.

The specific frustrations:

- Typing book titles by hand means typos that break filtering later
- Finding a decent cover image meant opening a browser tab and searching
- Quotes only got saved if I happened to remember them at entry time, not when I actually read them
- The friction meant I'd skip entries entirely, and then the database was out of date

I wanted to close the loop at the moment of reading, not hours later. Point the camera, done. lovely-shelf is exactly that.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js (App Router) + TypeScript |
| Styling | Tailwind CSS v4 |
| Charts | Recharts |
| Image processing | sharp (server-side resize + JPEG conversion) |
| HEIC support | libheif-js (WebAssembly) → heic2any → Canvas API |
| AI | Anthropic Claude SDK |
| Database | Notion (via @notionhq/client) |
| Auth | next-auth v5 with Google OAuth |
| Real-time | Server-Sent Events (SSE) for streaming chat |
| Image search | Pixabay API |
| Music | Jamendo API |
| Card rendering | Satori (JSX → SVG → PNG) |
| Deployment | Vercel |

Nothing exotic. Every library here is actively maintained and well-documented. I deliberately avoided anything that would require me to learn a tool while also learning Next.js.

---

## APIs Used

### Anthropic Claude API

The core of the whole thing. Claude does three different jobs in this app:

- **Vision recognition**: receives a base64-encoded JPEG, returns structured book metadata
- **Tool use agent**: orchestrates a multi-step pipeline by calling four custom tools in sequence — it decides the order, checks results, and handles edge cases like duplicates
- **Streaming chat**: answers questions about your shelf via SSE, with access to the same tool set as the agent

Model used: `claude-sonnet-4-6`. The 200k context window matters for the chat feature — a large enough shelf means a lot of book data to pass as context.

The one rough edge I hit: no native JSON mode at the time. OpenAI has `response_format: { type: "json_object" }`. With Claude, I had to extract JSON using a regex (`{[\s\S]*}`) because the model occasionally wraps the output in a sentence. Not a dealbreaker, just something to handle.

### Notion API (@notionhq/client)

Full read/write access to a Notion database. The app creates pages, uploads cover images to Notion's file storage, queries for duplicates by title + author, and reads back the full library for the Dashboard and Chat features.

The SDK is well-maintained. The API itself is slow — a full write (image upload + page create) takes 3–5 seconds. That's not a bug, it's just Notion's infrastructure. You plan around it with loading states.

### Pixabay API

Background image and video search for Quote Studio. Free tier is generous. Used as an image proxy through `/api/images` and `/api/videos` routes to avoid exposing the API key client-side.

### Jamendo API

Royalty-free music search for Quote Studio MP4 recordings. Users can search by mood or keyword, pick a track, and have it mixed into the video recording of their quote card.

---

## AI Skills & Techniques

This is the part I find most interesting to write about. Here are the specific techniques I used with Claude, beyond the basic "call the API" part.

### 1. Structured JSON Output via Prompt Constraints

Claude doesn't have a native JSON mode the way some other APIs do. To get reliable structured output, I constrained the response in two ways: I told it exactly what fields to return, and I gave it a fixed vocabulary for the genre field.

```typescript
// src/lib/ai.ts
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 1024,
  messages: [{
    role: "user",
    content: [
      {
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: base64Image }
      },
      {
        type: "text",
        text: `Look at this book cover and return ONLY a JSON object with these exact fields:
{
  "title": "string",
  "subtitle": "string or empty string",
  "author": "string",
  "gender": "male | female | unknown",
  "country": "string",
  "genres": ["array of strings — pick ONLY from: 小说 散文 历史 哲学 心理相关 励志 政治 经济 科技 艺术 儿童读物 其他"],
  "description": "2-3 sentence summary",
  "quotes": ["2-3 memorable quotes from the book"]
}
Return only the JSON. No explanation, no markdown.`
      }
    ]
  }]
})
```

Constraining the genre list to a fixed vocabulary was the critical design decision. Without it, Claude might tag one book as "Psychology" and another as "心理学" and a third as "self-help" — and your Notion filters would never catch them all. Fixed vocabulary means consistent filtering across the whole library.

### 2. Error-Resilient JSON Parsing

Even with tight prompting, Claude occasionally wraps the JSON in a sentence or adds a trailing comment. I parse defensively:

```typescript
function extractJSON(text: string): BookInfo {
  // First try: direct parse (works when Claude behaves)
  try {
    return JSON.parse(text)
  } catch {
    // Second try: extract JSON block with regex
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        return JSON.parse(match[0])
      } catch {
        // Third try: strip markdown code fences
        const cleaned = text
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim()
        return JSON.parse(cleaned)
      }
    }
    throw new Error(`Could not extract JSON from Claude response: ${text.slice(0, 200)}`)
  }
}
```

Three tiers: direct parse, regex extraction, markdown stripping. If all three fail, throw with enough context to debug. This pattern works across any AI API — Claude, GPT, whatever. AIs are text generators, and you're trying to get structured data out of one. Treat it like parsing user input, not parsing a database response.

### 3. Tool Use — Building a Real Agent

The more interesting pipeline uses Claude Tool Use. Instead of calling the APIs in a fixed sequence in my code, I give Claude a set of tools and let it decide what to call and when.

```typescript
// src/lib/agent.ts
const tools: Anthropic.Tool[] = [
  {
    name: "recognize_book_from_image",
    description: "Extract book metadata (title, author, genres, quotes) from a cover image",
    input_schema: {
      type: "object",
      properties: {
        image_base64: { type: "string", description: "Base64-encoded JPEG" }
      },
      required: ["image_base64"]
    }
  },
  {
    name: "check_duplicate_in_notion",
    description: "Check if a book already exists in the Notion database",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        author: { type: "string" }
      },
      required: ["title", "author"]
    }
  },
  {
    name: "upload_cover_to_notion",
    description: "Upload a cover image file to Notion file storage",
    input_schema: {
      type: "object",
      properties: { image_base64: { type: "string" } },
      required: ["image_base64"]
    }
  },
  {
    name: "create_notion_page",
    description: "Create a new book record in Notion",
    input_schema: {
      type: "object",
      properties: {
        bookInfo: { type: "object" },
        coverUrl: { type: "string" }
      },
      required: ["bookInfo"]
    }
  }
]

// The agent loop — runs until Claude stops calling tools
async function runBookAgent(imageBase64: string): Promise<AgentResult> {
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageBase64 } },
        { type: "text", text: "Process this book cover and add it to my Notion library. Check for duplicates first." }
      ]
    }
  ]

  while (true) {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      tools,
      messages
    })

    if (response.stop_reason === "end_turn") {
      return extractFinalResult(response)
    }

    // Claude wants to call tools — execute them and feed results back
    const toolResults = await executeTools(response.content)
    messages.push(
      { role: "assistant", content: response.content },
      { role: "user", content: toolResults }
    )
  }
}
```

The difference between this and the sequential pipeline: Claude sees the result of each tool call before deciding what to call next. If the duplicate check returns a match, Claude stops and returns the existing record. If the image is too blurry to recognize confidently, Claude can say so. The model is making decisions, not executing a fixed script.

### 4. Streaming Chat with SSE

The chat assistant streams responses character by character using Server-Sent Events. This is the right tool for one-directional streaming — it's simpler than WebSockets and works natively with Next.js route handlers.

```typescript
// src/app/api/chat/route.ts
export async function POST(request: Request) {
  const { messages } = await request.json()

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const anthropicStream = await anthropic.messages.stream({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        system: `You are a knowledgeable assistant for a personal book library.
                 The user's library contains the following books: ${JSON.stringify(libraryContext)}
                 Answer questions about their reading, suggest books, discuss themes.
                 Respond in the same language the user writes in.`,
        messages,
        tools: bookTools
      })

      for await (const chunk of anthropicStream) {
        if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`))
        }
      }

      controller.enqueue(encoder.encode("data: [DONE]\n\n"))
      controller.close()
    }
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    }
  })
}
```

The system prompt injects the user's library as context. This is the simplest possible RAG — no vector database, no embeddings, just JSON. It works because a personal book library is small enough to fit in Claude's 200k context window. For a larger dataset, you'd want proper semantic search.

### 5. Vision + Preprocessing Pipeline

Images from phones are large and often in HEIC format. I preprocess before sending to Claude:

```typescript
// src/lib/image.ts
import sharp from "sharp"

export async function preprocessImage(buffer: Buffer): Promise<string> {
  const processed = await sharp(buffer)
    .resize(1200, 1200, {
      fit: "inside",        // preserve aspect ratio
      withoutEnlargement: true  // don't upscale small images
    })
    .jpeg({ quality: 85 }) // good quality, manageable size
    .toBuffer()

  return processed.toString("base64")
}
```

This does two things: keeps the image under Anthropic's size limits, and reduces API costs by not sending 12MB iPhone photos. Claude reads book covers fine at 1200px — you don't need the full resolution to read a title.

HEIC support required a three-tier fallback because no single library handles every device reliably:

```
Try libheif-js (WebAssembly, most accurate)
  fails? → heic2any (JS library, broader compatibility)
  fails? → Canvas API (basic but universally supported)
```

---

## The Vibe Coding Process

This is the section I wished existed when I started. I built this with Claude Code and a methodology plugin called **Superpowers**. Here's what that workflow actually looks like.

### The Tools

**`superpowers:brainstorming`** — before writing a single line of code, I'd trigger this for any non-trivial feature. It asks questions: What's the user goal? What are the edge cases? What's the simplest version that works? Only after that conversation would I start thinking about implementation.

**`superpowers:writing-plans`** — converts the design discussion into a concrete implementation plan with file paths, function signatures, and code snippets. The plan becomes the contract. If I deviate, I update the plan first.

**`superpowers:subagent-driven-development`** — each task runs as its own agent with fresh context. No context pollution from previous tasks. After each task, two reviewers run: a spec compliance reviewer (did we build what we said we'd build?) and a code quality reviewer (is the code clean?).

**`superpowers:systematic-debugging`** — when something breaks, this forces root-cause analysis before any fix. No symptom patching. I used this three times: once for the HEIC conversion, once for a streaming race condition, once for Notion rate limiting.

**`superpowers:verification-before-completion`** — requires running actual verification commands before claiming a task is done. Prevented me from shipping "works on my machine" bugs twice.

**`superpowers:frontend-design`** — generates HTML mockups for browser preview before writing any React code. This was the difference between "generic AI UI" and something that actually looked designed.

### Example: Building the Quote Studio

Here's how the Quote Studio feature went from idea to code using this workflow.

**Step 1 — Brainstorm.** I triggered `superpowers:brainstorming` with: "I want users to be able to make shareable image cards from quotes." The brainstorming session surfaced questions I hadn't thought about: What's the output format? (PNG, not just screenshots.) Should video backgrounds be supported? (Yes, with music.) How do we handle fonts that aren't system fonts? (Load them at card generation time.) What's the fallback if Pixabay is down? (Color gradients.)

**Step 2 — Write the plan.** `superpowers:writing-plans` produced a plan with these files:
```
src/app/quotes/page.tsx          — add QuoteStudio panel at bottom
src/components/QuoteCard.tsx     — the card renderer (Satori)
src/app/api/generate-card/route.ts — POST endpoint, returns PNG
src/app/api/images/route.ts      — Pixabay proxy
src/app/api/music/route.ts       — Jamendo proxy
```

Each file had a described interface, not just a name. The plan specified that Satori would render JSX to SVG on the server, which then gets converted to PNG. That architectural decision is in the plan, not discovered mid-implementation.

**Step 3 — Subagent development.** Each file ran as its own task. The QuoteCard renderer was one task. The API route was another. The UI integration was a third. The spec compliance reviewer checked each one against the plan before the next started. This caught one deviation: the first implementation of the card renderer was doing the PNG conversion client-side, which the plan had specified should be server-side.

**Step 4 — Code quality review.** After all tasks completed, the quality reviewer flagged a duplicated font-loading block that existed in both the card renderer and the chat page. Extracted into `src/lib/fonts.ts` and imported in both places.

**Step 5 — Verification.** `superpowers:verification-before-completion` ran the actual export flow: upload a quote, configure the card, click export, verify the PNG downloaded, verify the dimensions. Not "I think it works" — actual commands.

The whole feature took about four hours. Half of that was the brainstorming and planning. The coding itself was faster because the decisions were already made.

---

## App Pages

### Upload

The entry point. Drag-and-drop or tap to select, handles multiple files at once with per-file progress indicators. HEIC images are converted in-browser before upload. After recognition, a confirmation screen shows what Claude found — you review before it writes to Notion. The result page shows an achievement badge ("Your 14th 小说!") and a horizontal scroll of similar books from your library.

### Dashboard

Library stats at a glance. Genre breakdown as a pie chart (Recharts), 30-day activity heatmap showing when you added books, total count and year-to-date. Every book appears as a thumbnail grid — tap any one to open a full detail modal that fetches live from Notion and lets you edit any field directly.

### Quotes

Every sentence Claude extracted from every book across your library. Four tabs: all, handwritten (ones you added yourself), from books (AI-extracted), liked. Paginated 10 per page. Likes persist in localStorage. You can also add your own quotes manually — they appear under the handwritten tab.

### Quote Studio

Turn any quote into a shareable card. Controls for font family, size, color, background (solid color, gradient, Pixabay image, Pixabay video), layout, and emoji insertion. Export as PNG or record a 5-second MP4 with Jamendo background music mixed in. Settings persist per quote in localStorage, so your card style is remembered when you come back to the same quote.

### Chat

A streaming AI assistant built with SSE. It knows your entire library from the system prompt context. You can ask it to recommend books by genre, tell you what quotes exist on a topic, or discuss any book on the shelf. You can also send it a cover photo mid-conversation and it'll recognize the book. Responds in Chinese or English depending on your browser language header.

---

## Example: How Book Recognition Works

Here's the full sequence when you upload a cover photo:

1. **Client-side**: file drops onto the upload zone, gets read into an ArrayBuffer
2. **HEIC detection**: if the file is HEIC, three-tier conversion runs before upload
3. **POST /api/process**: the preprocessed image goes to the server
4. **sharp**: resize to ≤1200px, convert to JPEG, encode as base64
5. **Claude Vision**: the base64 image + text prompt go to `claude-sonnet-4-6`
6. **JSON extraction**: parse the response with the three-tier fallback parser
7. **Notion query**: check if title + author already exist
8. **If new**: upload cover image to Notion file storage, create the page with all extracted fields
9. **Achievement query**: count books in the same genre, return badge text
10. **Recommendations**: fetch 5 other books with overlapping genres
11. **Response to client**: `{ bookInfo, pageUrl, stats, recommendations }`

The whole round trip takes 8–12 seconds for a first-time upload. Most of that is Notion (3–5s for the write). Claude itself responds in under 3 seconds.

In demo mode, step 7 through 10 are replaced with reads from a hardcoded dataset. Claude still runs. The recognition result is real.

---

## What I Learned

**1. Agents are just structured loops.** The agentic pipeline sounds advanced but it's a while loop that calls Claude, executes whatever tools Claude asked for, and feeds the results back. The interesting part is that Claude makes the sequencing decisions. Once I understood the loop pattern, the agent code was actually simpler than the sequential version.

**2. Demo mode is an architecture decision, not an afterthought.** I added it on day five, which meant touching every API route. If I'd thought about it on day one, I would have put all data access behind an interface and swapped the implementation based on the session email. Adding it later meant finding every Notion call and wrapping it in an if-check. Both work; one is cleaner.

**3. Rate limiting before you share.** I shared the app with three friends for testing. Hit my Anthropic API limit the next morning. `express-rate-limit` or a simple in-memory counter takes thirty minutes to add. Do it before you tell anyone the URL.

**4. SSE is the right tool for streaming. Not WebSockets.** WebSockets are for bidirectional real-time communication — multiplayer, collaborative editing. SSE is for server-to-client streams. The chat feature doesn't need the client to be able to push data mid-stream; it needs the server to push text as Claude generates it. SSE handles this with about 20 lines of code. WebSockets would have required a separate server setup.

**5. The planning phase isn't overhead, it's the work.** With Superpowers, I spent roughly 30% of my time in brainstorming and planning before any code ran. That felt inefficient the first time. By day four I understood: every hour of planning eliminated two hours of refactoring. The Quote Studio feature took four hours total. The HEIC support (which I coded without planning) took a full afternoon and three rewrites.

---

## Try It

Live demo: [lovely-shelf.vercel.app](https://lovely-shelf.vercel.app)

GitHub: [github.com/sarahwangy/lovely-shelf](https://github.com/sarahwangy/lovely-shelf)

Stack: Next.js, TypeScript, Claude Sonnet 4.6, Notion API, next-auth, Tailwind CSS v4, Vercel.

This isn't a tutorial project. It's an actual app I use to track my reading. The demo button gives you real Claude AI recognition — scan any book cover you have nearby and it'll tell you what it sees. The recognition works on photos of physical books, screenshots of Kindle covers, even images of book spines if they're clear enough.

If you're a beginner developer thinking about building something with AI APIs, the main thing I'd want you to take from this: the AI integration itself isn't the hard part. The hard parts are the same as any other web app — auth, error handling, demo mode, rate limiting, deployment. Claude's API is well-documented and the SDK is straightforward. You can have a working prototype in a weekend.

---

*Built in 7 days, May 2025. Full stack: Next.js App Router, TypeScript, Claude Vision + Tool Use + Streaming, Notion API, Vercel.*
