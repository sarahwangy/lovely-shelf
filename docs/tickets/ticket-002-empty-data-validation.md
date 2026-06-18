# [Bug] Empty / invalid Claude response can write garbage records into Notion

**Priority:** High  
**Area:** API / Data Integrity  
**Affects:** `/api/process`, `/api/agent`

---

## Problem

When Claude Vision fails to recognize a book (blurry photo, non-book image, API hiccup), it may return **empty or partial data**. The current pipeline in `src/app/api/process/route.ts` does not validate the response before writing to Notion:

```ts
const bookInfo = await recognizeBook(base64);   // may return { title: "", author: "", ... }
// ↓ no guard here
await uploadCoverToNotion(...);
await createNotionPage(bookInfo);               // writes empty record 💥
```

This results in **ghost records in the Notion database** — pages with no title, no author, a cover image but no metadata. Over time these corrupt the library, break stats aggregation (`/api/stats` counts all pages), and pollute recommendations.

### Known failure cases

| Scenario | Claude output | Current behavior |
|---|---|---|
| Photo of a wall / not a book | `{ title: "", author: "" }` | Empty Notion page created |
| Handwritten cover, Claude unsure | `{ title: "Unknown", author: "Unknown" }` | Garbage record created |
| Claude API timeout / 500 | Exception uncaught or empty JSON | Unhandled error or empty page |
| Image too dark / blurry | Partial fields, missing genres | Record with nulls written |

---

## Expected Behavior

1. If Claude cannot identify a book with sufficient confidence, **return a clear error to the user** — do not write anything to Notion.
2. Partial data (e.g. title found but no author) should be **flagged to the user** with an option to manually fill in the blanks before saving.
3. Non-book images should return a user-friendly message: *"No book detected in this photo. Try a clearer shot."*

---

## Proposed Fix

### Step 1 — Add a confidence/validity check in `src/lib/ai.ts`

Update the Claude prompt to always return a `confidence` field and an `isBook` boolean:

```ts
// In the system prompt sent to Claude:
// "If you cannot identify this as a book cover, set isBook: false.
//  Set confidence from 0–100 based on how clearly you can read title and author."

interface RecognizeResult {
  isBook: boolean;
  confidence: number;   // 0-100
  title: string;
  author: string;
  genres: string[];
  description: string;
  quotes: string[];
}
```

### Step 2 — Validate before any Notion operation in `src/app/api/process/route.ts`

```ts
const bookInfo = await recognizeBook(base64);

if (!bookInfo.isBook) {
  return NextResponse.json(
    { success: false, error: "no_book_detected", message: "未识别到书籍，请拍摄清晰的书封面" },
    { status: 422 }
  );
}

if (bookInfo.confidence < 60) {
  return NextResponse.json(
    { success: false, error: "low_confidence", bookInfo, message: "识别结果置信度较低，请确认后再保存" },
    { status: 422 }
  );
}

if (!bookInfo.title?.trim()) {
  return NextResponse.json(
    { success: false, error: "missing_title", message: "无法识别书名，请手动填写" },
    { status: 422 }
  );
}

// ✅ Only reach here if data is valid
await uploadCoverToNotion(...);
await createNotionPage(bookInfo);
```

### Step 3 — Handle on the frontend (`src/app/result/page.tsx`)

For `low_confidence` responses: show the recognized data in an **editable form** so the user can correct fields before confirming the save. Only send the final `confirm` POST to actually write to Notion.

---

## Scope of Changes

- [ ] Update Claude system prompt in `src/lib/ai.ts` to return `isBook` + `confidence`
- [ ] Update `RecognizeResult` type in `src/types/book.ts`
- [ ] Add validation guard in `src/app/api/process/route.ts` before Notion writes
- [ ] Add same guard in `src/app/api/agent/route.ts` (agentic pipeline)
- [ ] Update frontend result page to handle `422` responses gracefully
- [ ] Add "edit before saving" flow for low-confidence results
- [ ] Write unit tests for the validation logic with mock Claude responses

---

## Notes

- The deduplication check (same title + author) already exists but fires **after** Notion write, not before — move it to before or keep as is (it prevents duplicates but doesn't prevent empties)
- Demo mode is unaffected: demo users never write to Notion, so empty data is already harmless there
- Consider logging rejected recognitions (with anonymized data) to understand failure rate over time
