# System Architecture — Azarraga Agent (TALA)

**Version:** 1.0 · **Last updated:** 2026-08-18 · **Owner:** David / MerQato Digital

This document explains how TALA works end-to-end so external developers can understand, extend, and contribute.

---

## 1. What TALA Is

TALA (Tagalog AI Logistics Assistant) is an **agentic commercial worker** for Azarraga Glass & Aluminum, a glass and aluminum fabrication business in Palawan, Philippines. She lives inside a Cloudflare Durable Object and speaks to a React SPA over WebSocket.

She is **not** a chatbot with a database. She is a persistent worker who:

- Remembers everything (append-only SQLite in the Durable Object)
- Learns from documents (Workers AI vision → structured PO extraction)
- Suggests actions proactively (hourly autonomous cycle)
- Drafts follow-ups for human approval (never sends anything unverified)
- Builds a growing knowledge base from every interaction

---

## 2. High-level diagram

```
                          ┌─────────────────────────────┐
                          │       Cloudflare Workers      │
                          │  azarraga-commercial-agent.   │
                          │         workers.dev           │
                          │                               │
                          │  ┌─────────────────────────┐  │
     WebSocket            │  │  AzarragaAgent (DO)     │  │
     JSON-RPC             │  │  ┌─────────────────────┐ │  │
     cf_agent_state       │  │  │ SQLite (append-only)│ │  │
                          │  │  │ - activity           │ │  │
                          │  │  │ - messages_log       │ │  │
                          │  │  │ - facts_log          │ │  │
                          │  │  └─────────────────────┘ │  │
                          │  │  ┌─────────────────────┐ │  │
                          │  │  │ AzarragaState        │ │  │
                          │  │  │ (broadcast snapshot) │ │  │
                          │  │  │ - leads, quotes,     │ │  │
                          │  │  │   invoices, docs,    │ │  │
                          │  │  │   messages,          │ │  │
                          │  │  │   knowledge,         │ │  │
                          │  │  │   followUps          │ │  │
                          │  │  └─────────────────────┘ │  │
                          │  │  ┌─────────────────────┐ │  │
                          │  │  │ Methods (18 RPC)    │ │  │
                          │  │  │ - chat               │ │  │
                          │  │  │ - createQuote        │ │  │
                          │  │  │ - addLead            │ │  │
                          │  │  │ - learnFromDocument  │ │  │
                          │  │  │ - runAutonomousCycle │ │  │
                          │  │  │ - ...                │ │  │
                          │  │  └─────────────────────┘ │  │
                          │  └─────────────────────────┘  │
                          │                               │
                          │  Bindings:                     │
                          │  - AI (Workers AI)             │
                          │  - DOCUMENTS (R2)              │
                          │  - COMMERCIAL_CACHE (KV)       │
                          │  - ASSETS (SPA dist/)          │
                          └──────────────┬────────────────┘
                                         │
                                         │ R2 (original files)
                                         │ KV (answer caches)
                                         │ Workers AI (vision + text)
                                         │ OpenRouter (free LLMs)
                                         ▼
                          ┌─────────────────────────────┐
                          │       React SPA              │
                          │  (Vite + Tailwind + React 19)│
                          │                               │
                          │  useAzarragaAgent()          │
                          │  ├─ WebSocket → DO           │
                          │  └─ LocalAzarragaAgent       │
                          │     (in-browser mirror)      │
                          │                               │
                          │  Pages: Overview, Leads,     │
                          │  Quotes, Invoices, Documents  │
                          │  Components: AgentPanel,     │
                          │  Sidebar, TopBar, Modals     │
                          └─────────────────────────────┘
```

---

## 3. Component breakdown

### 3.1 Cloudflare Worker entry (`worker/index.ts`)

**Role:** HTTP router + WebSocket gateway.

```
Request → routeAgentRequest() → AzarragaAgent DO (WebSocket + RPC)
       → env.ASSETS.fetch() → SPA (if not an agent request)
       → 404
```

Exports:
- `AzarragaAgent` class (required by wrangler.jsonc durable_objects bindings)
- `Env` type (the Worker's environment bindings)
- `default` fetch handler

**No Postgres. No REST CRUD. No external API except OpenRouter + Workers AI.**

### 3.2 AzarragaAgent Durable Object (`worker/AzarragaAgent.ts`)

**Role:** The agent. 924 lines. Extends `Agent<Env, AzarragaState>` from the Cloudflare Agents SDK.

#### Lifecycle

| Hook | What happens |
|------|-------------|
| `constructor` | Sets `initialState = createInitialState()` |
| `onStart()` | Creates 3 SQLite tables (`activity`, `messages_log`, `facts_log`). Schedules `runAutonomousCycle` every 60 minutes via `this.scheduleEvery()` |
| `onConnect()` | Sends current `this.state` to the new WebSocket connection as `cf_agent_state` |
| `onMessage()` | Parses JSON-RPC, dispatches to `dispatch()`, returns result or error |

#### SQLite tables (append-only, never trimmed)

```sql
CREATE TABLE activity (
  id TEXT PRIMARY KEY,
  kind TEXT,        -- e.g. "lead.created", "chat.openrouter", "quote.approved"
  payload TEXT,     -- JSON snapshot of what happened
  created_at TEXT   -- ISO timestamp
);

CREATE TABLE messages_log (
  id TEXT PRIMARY KEY,
  role TEXT,        -- "user" | "assistant"
  content TEXT,
  created_at TEXT
);

CREATE TABLE facts_log (
  id TEXT PRIMARY KEY,
  kind TEXT,        -- "conversation" | "document" | "quote" | "job"
  summary TEXT,     -- human-readable summary
  source_ref TEXT,  -- message id / document id / quote id
  created_at TEXT
);
```

These tables survive Durable Object hibernation and restarts. The in-memory `this.state` snapshot stays small for WebSocket performance; the SQL tables are the permanent memory beneath it.

#### State management

```typescript
this.setState({ ...this.state, ...next, updatedAt: new Date().toISOString() })
```

`setState()` is provided by the Agents SDK. It:
- Persists state to SQLite
- Broadcasts the new state to all connected WebSocket clients
- Triggers the client's `useAzarragaAgent` hook to re-render

#### RPC dispatch (18 methods)

```typescript
async dispatch(method: string, args: unknown[]): Promise<unknown>
```

Each method mutates `this.state` via `this.patch()` and returns a result. Key methods:

| Method | What it does |
|--------|-------------|
| `chat(prompt)` | Adds user + streaming assistant message to state. Tries OpenRouter first (cached in KV, 15min TTL). Falls back to Workers AI streamed. After response: `learnFromConversation()` passively. |
| `createQuote(input)` | Builds a Quote with auto-calculated subtotal, ref `AGQ-XXXX`, status `draft`. |
| `advanceQuote(id)` | Moves `draft → sent → approved`. On `approved`: `learnFromQuoteById()`. |
| `declineQuote(id, reason?)` | Sets status `declined`. Records rejection for pricing patterns. Pushes a Taglish message. |
| `issueInvoice(quoteId)` | Creates an Invoice from an approved quote. Ref `AGI-XXXX`, 30-day due date. |
| `createInvoice(input)` | Manual invoice creation. |
| `addLead(input)` | Adds a lead with auto-generated id, defaults to Palawan location. |
| `extractLeadFromUrl(url)` | Fetches the URL, strips HTML, runs through OpenRouter to extract company/contact/email/phone/location/project. Falls back to deterministic parsing if AI fails. |
| `recordPayment(id)` | Sets invoice paid = amount, balance = 0, status = `paid`. |
| `reprocessDocument(id)` | Re-runs `learnDocument()` on a document. |
| `learnFromConversation(company?)` | Scans recent messages for glass/frame/budget/location facts. Updates knowledge base. Pushes a Taglish confirmation. |
| `learnFromQuote(quoteId)` | Records pricing signals from a quote. On approved: confirmed preferences. |
| `answerFromMemory(query)` | Searches knowledge base for customer preferences, supplier facts, pricing signals, project history. Cached in KV. |
| `suggestImprovements()` | Runs `suggestImprovements()` engine. Pushes suggestions as a chat message. |
| `runDueFollowUps()` | Runs `runAutonomousCycle()` — detects stale quotes/cold leads/overdue invoices + suggestions. |
| `approveFollowUp(id)` / `dismissFollowUp(id)` | Changes follow-up status. |
| `setModel(model)` | Changes the active LLM selection. |
| `refresh()` | No-op patch to trigger a state re-broadcast. |

#### AI strategy

**Two-tier fallback:**

1. **OpenRouter** — if `OPENROUTER_API_KEY` is set. Free models only. Temperature 0.15, max 4096 tokens. Model selected by user preference:
   - `nvidia/nemotron-nano-9b-v2:free` (default)
   - `meta-llama/llama-3.3-70b-instruct:free`
   - `qwen/qwen3-235b-a22b:free`
   - `deepseek/deepseek-chat-v3.1:free`

2. **Workers AI** — `@cf/meta/llama-3.3-70b-instruct-fp8-fast` for text, `@cf/meta/llama-3.2-11b-vision-instruct` for document vision. No API key needed. Streamed over WebSocket.

**Chat system prompt** (lines 430–458 of AzarragaAgent.ts): TALA is a warm, Taglish-speaking commercial agent for Azarraga Glass & Aluminum in Palawan. She answers ONLY from recorded commercial memory. Never invents data. When a field is missing she says so. Amounts are in Philippine pesos (₱).

**Chat caching:** KV key `chat:{stateUpdatedAt}:{prompt}`, 15-minute TTL.

**Document extraction prompt** (lines 77–133): A detailed 133-line system prompt covering glass industry specifics, Philippine 12% VAT / US sales tax / EU reverse-charge, currency logic, arithmetic verification, and anomaly detection. Returns structured JSON with `reviewStatus` (PASS/FAIL), full line items, financial summary, audit, missing/conflicts arrays.

#### Vision / document extraction flow

1. User uploads a document image.
2. File stored in R2 `commercial-documents` (authoritative original).
3. `learnDocument(documentId)` runs `@cf/meta/llama-3.2-11b-vision-instruct` on the image with the GLASS_INVOICE_PROMPT.
4. Response parsed as JSON. If `reviewStatus === "PASS"`, the extraction is marked `LEARNED`. If `FAIL`, marked `PROCESSING` for human review.
5. `learnFromDocument()` turns the extraction into customer history + supplier facts.
6. `DocumentReviewModal` shows original image beside extraction for visual verification.

### 3.3 React SPA (`src/`)

#### Entry (`main.tsx`)

```tsx
createRoot(root).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>
)
```

#### App (`App.tsx`)

The main layout and router. Manages:
- Page state (`overview | leads | quotes | invoices | documents`)
- Agent panel open/closed state (desktop: 380px right panel; mobile: bottom drawer)
- Sidebar nav open/closed
- Modal open states (quote, invoice, document review)
- `refresh()` and `ask()` handlers
- `downloadInvoice()` — generates an HTML invoice blob and triggers download

**Responsive layout:**
- Desktop (>1024px): sidebar + main content + 380px agent panel side-by-side
- Tablet/mobile (≤1024px): sidebar as hamburger drawer, agent panel as bottom drawer, floating agent button

#### useAzarragaAgent hook (`src/agent/useAzarragaAgent.ts`)

**Role:** Connects the React UI to the agent. Two modes:

**Mode 1 — Live Worker (WebSocket):**
When `VITE_AGENT_URL` is set in the environment:
- Opens a WebSocket to `{VITE_AGENT_URL}/agents/azarraga-agent/{room}`
- On `cf_agent_state` message: calls `setState(msg.state)`
- On `rpc` message: resolves/rejects the pending promise for that RPC id
- `call(method, ...args)`: sends JSON-RPC over WebSocket, returns a promise

**Mode 2 — Local mirror (no Worker):**
When `VITE_AGENT_URL` is not set:
- Uses `LocalAzarragaAgent` (in-browser mirror with identical reducer)
- Marks status `connected` after 350ms
- `call()` invokes the local agent synchronously

**Fallback behavior:** If the WebSocket fails to connect or errors, the hook falls back to local mode automatically. This means the workspace is always usable — even offline.

**Derived metrics:** `activeLeads`, `pipeline` (sum of quote subtotals), `receivables` (sum of invoice balances), `quoteCount`, `invoiceCount`, `documents`.

#### LocalAzarragaAgent (`src/agent/runtime.ts`)

**Role:** In-browser mirror of the Durable Object. Same reducer, same state shape, same learning functions.

- Constructor: creates state from `createInitialState()`, starts a 45-second `setInterval` simulating the Durable Object's hourly `scheduleEvery` alarm.
- `runAutonomousCycle()`: calls `detectDueFollowUps()` + `suggestImprovementsEngine()`. If due follow-ups exist, pushes a busy message and updates `followUps`.
- `call(method, args)`: mirrors the Durable Object's dispatchswitch. Calls the same pure functions (`learnFromConversationEngine`, `learnFromQuoteEngine`, etc.).
- `subscribe(setState)`: returns an unsubscribe function. The React hook uses this to re-render on every state change.

**All state mutation goes through `setState()`**, which fires all listeners. This is the same pattern the Durable Object uses with `this.setState()`.

#### Knowledge engine (`src/agent/knowledge.ts`)

**Pure functions — no I/O.** Same functions run in the Worker and the local mirror.

| Function | Input | Output | What it does |
|----------|-------|--------|-------------|
| `learnFromConversation(kb, messages, company?)` | KnowledgeBase, ChatMessage[], optional company | `{ knowledge, learned }` | Scans user turns for glass/frame/budget/location facts. Updates customer preferences (inferred). Returns learned summaries. |
| `learnFromQuote(kb, quote)` | KnowledgeBase, Quote | `{ knowledge, learned }` | Records pricing signals for every line. On approved: dominant glass/frame become confirmed preferences. Updates customer project history. |
| `learnFromDocument(kb, doc)` | KnowledgeBase, DocumentRecord (with extraction) | `{ knowledge, learned }` | Adds supplier facts. Updates customer history from PO buyer. |
| `answerFromMemory(state, query)` | AzarragaState, query string | string (Taglish answer) | Routes to customer prefs / supplier facts / pricing signals / project history based on query keywords. |
| `suggestImprovements(kb)` | KnowledgeBase | `{ knowledge, suggestions }` | Finds pricing patterns (rejections → price cut suggestion; approvals → safe baseline), missing emails, repeat customers, single-supplier dependency. |

### 3.4 UI components

#### Shell (`src/components/Shell.tsx`)

Exports `Sidebar` and `TopBar`.

- **Sidebar:** Navigation links (Overview, Leads, Quotes, Invoices, Documents). Persistent on desktop, collapsible drawer on mobile. Active page highlighted.
- **TopBar:** Breadcrumb, title, refresh button, toggle agent button, primary action button (Create invoice / New quote depending on page), mobile nav toggle.

#### AgentPanel (`src/components/AgentPanel.tsx`)

The chat UI. Displays:
- Message list (user + assistant, with streaming indicator)
- TALA's mood (idle, listening, processing, analyzing, happy, confused, busy, speaking) — derived from message content
- Quick replies (context-sensitive: greeting, default, after-upload, quote-done, no-email, knowledge)
- Input field with send button
- Model selector dropdown

Mood detection: `getMoodFromContent()` in `runtime.ts` reads the latest assistant message content and returns a mood. This drives avatar/icon changes in the panel.

#### DocumentReviewModal (`src/components/DocumentReviewModal.tsx`)

Side-by-side comparison: original document image (left) vs TALA's structured extraction (right). Shows every field: vendor, buyer, TIN, dates, line items with dimensions, financial summary, VAT breakdown, review status (PASS/FAIL), missing fields, conflicts.

#### NewQuoteModal / NewInvoiceModal

Form-based creation. Quote modal: customer, project, location, lead time, terms, multi-line items (description, system, glass, frame, width, height, qty, unit, unit price). Invoice modal: customer, project, amount, paid, due date, status.

#### MobileBottomNav (`src/components/MobileBottomNav.tsx`)

Bottom navigation bar for mobile. Links to the 5 pages.

#### FloatingAgentButton (`src/components/FloatingAgentButton.tsx`)

Circular button that floats on mobile when the agent drawer is closed. Tapping opens the drawer. Shows a snippet of TALA's latest message.

#### SafeImage (`src/components/SafeImage.tsx`)

Renders images from R2 using signed URLs. Falls back to a placeholder if the image fails to load.

#### ThemeProvider (`src/theme/ThemeProvider.tsx`)

Light/dark theme. Persisted in `localStorage` under key `azarraga-theme`. Respects `prefers-color-scheme` on first visit.

### 3.5 Types (`src/agent/types.ts`)

The single source of truth for the data model. 396 lines. Key types:

| Type | Purpose |
|------|---------|
| `Lead` | Company, contact, email, phone, project, location, value, stage, nextAction |
| `Quote` / `QuoteLine` | Multi-line quotation with ref, customer, project, lines, subtotal, status |
| `Invoice` | Ref, customer, project, amount, paid, balance, dueDate, status |
| `DocumentRecord` / `Extraction` | File metadata + full structured extraction (vendor, buyer, TIN, dates, lines, financial, audit, missing, conflicts, provenance) |
| `ChatMessage` | Id, role, content, createdAt, streaming, mood, quickReplies |
| `KnowledgeBase` | customers, pricingSignals, supplierFacts, facts, suggestions, stats |
| `CustomerMemory` / `CustomerPreference` | Company profile with project history and confirmed/inferred preferences |
| `PricingSignal` | One quote line recorded with outcome (approved/rejected/sent) |
| `SupplierFact` | Material + supplier name traced to source document |
| `FollowUpTask` | Drafted follow-up with kind, title, detail, draftMessage, status, relatedId |
| `AzarragaState` | The full Durable Object state shape |
| `AgentMethod` | Union of all 18 RPC method names |
| `RpcRequest` / `RpcResponse` / `ServerMessage` | WebSocket wire protocol types |

---

## 4. Data flow examples

### 4.1 Creating a quote

```
User clicks "+ New quote" → NewQuoteModal opens
User fills form → clicks Create
App.tsx: call("createQuote", input)
  → WebSocket sends { type: "rpc", id, method: "createQuote", args: [input] }
  → AzarragaAgent.dispatch("createQuote", [input])
    → calculates subtotal from lines
    → builds Quote { id, ref: "AGQ-0001", subtotal, status: "draft", ... }
    → this.patch({ quotes: [quote, ...state.quotes] })
      → this.setState() → SQLite persist + WebSocket broadcast
  → Client receives cf_agent_state → re-renders with new quote
```

### 4.2 Chat with TALA

```
User types "Kumusta ang Tagusao?" → enters message
App.tsx: call("chat", prompt)
  → WebSocket RPC
  → AzarragaAgent.dispatch("chat", [prompt])
    → creates user message + streaming assistant message in state
    → builds system prompt (grounding rules + commercial memory snapshot + knowledge)
    → tries KV cache key chat:{updatedAt}:{prompt}
    → if miss: tries OpenRouter (with API key)
    → if no key or fail: tries Workers AI streamed
    → streams tokens back via patch() on each chunk
    → on complete: caches in KV (15min), logs to activity, runs learnFromConversation passively
    → this.finishAssistant() removes streaming flag
  → Client re-renders as messages stream in
```

### 4.3 Uploading a PO

```
User drops PO photo → Documents page upload handler
  → file → R2 DOCUMENTS bucket (authoritative original)
  → creates DocumentRecord { id, filename, mime, sizeBytes, intelligence: "PROCESSING", r2Key }
  → this.patch({ documents: [...state.documents, newDoc] })
  → background: learnDocument(docId)
    → fetches image from R2
    → runs Workers AI vision with GLASS_INVOICE_PROMPT
    → parses JSON extraction
    → sets DocumentRecord.extraction = extraction
    → sets intelligence = extraction.reviewStatus === "PASS" ? "LEARNED" : "FAILED"
    → this.patch({ documents: updated })
    → learnFromDocument() → customer history + supplier facts
  → DocumentReviewModal: user can visually compare original vs extraction
```

### 4.4 Autonomous cycle (hourly in Worker, 45s in local mirror)

```
Timer fires → runAutonomousCycle()
  1. detectDueFollowUps(state)
     → checks quotes (sent > 48h), leads (not won/lost > 3 days), invoices (past due)
     → returns FollowUpTask[] with draftMessages
  2. if due.length > 0:
     → this.patch({ followUps: mergeFollowUps(state.followUps, due) })
     → pushes busy message: "I noticed N items that need follow-up"
  3. suggestImprovementsEngine(state.knowledge)
     → finds pricing patterns, missing emails, repeat customers, supplier dependency
     → this.patch({ knowledge: { ...knowledge, suggestions } })
     → if new suggestions: pushes suggestion message
```

---

## 5. Storage strategy

| What | Where | Why |
|------|-------|-----|
| Original documents (PO photos, specs) | R2 `commercial-documents` | Authoritative originals. Never in a database. Cheap storage. |
| Chat answer cache | KV `COMMERCIAL_CACHE` | 15-minute TTL. Avoids re-running the same question through the LLM. |
| Knowledge caches | KV `COMMERCIAL_CACHE` | `knowledge:conversation:{ts}`, `knowledge:quote:{id}`, `knowledge:answer:{hash}:{query}` — various TTLs (30 days down to 15 min). |
| Activity audit log | DO SQLite `activity` table | Append-only. Every action logged with kind + JSON payload. Survives hibernation. |
| Chat messages (permanent) | DO SQLite `messages_log` | Every message archived. Independent of in-memory state trimming (last 120). |
| Learned facts (permanent) | DO SQLite `facts_log` | Idempotent `INSERT OR IGNORE`. Survives hibernation. |
| Queryable state (leads, quotes, invoices, documents, messages, knowledge, followUps) | DO `this.state` (broadcast via `this.setState()`) | Small enough for WebSocket perf. Backed by SQLite persistence. |

**The Durable Object SQLite is TALA's permanent memory.** The in-memory `state` is just a broadcast snapshot. If the DO hibernates and wakes, `onStart()` re-creates the SQL tables (IF NOT EXISTS) and the state is restored from SQLite via `this.setState()`.

---

## 6. Wire protocol

### 6.1 WebSocket messages

**Client → Server (JSON-RPC):**

```json
{
  "type": "rpc",
  "id": "rpc_abc123",
  "method": "chat",
  "args": ["Kumusta po!"]
}
```

**Server → Client (state broadcast):**

```json
{
  "type": "cf_agent_state",
  "state": { ...AzarragaState }
}
```

**Server → Client (RPC response):**

```json
{
  "type": "rpc",
  "id": "rpc_abc123",
  "success": true,
  "result": true
}
```

Error response:

```json
{
  "type": "rpc",
  "id": "rpc_abc123",
  "success": false,
  "error": "Unknown agent method: foobar"
}
```

### 6.2 Agent methods (18)

```typescript
type AgentMethod =
  | "chat"
  | "quickAction"
  | "createQuote"
  | "addLead"
  | "setModel"
  | "reprocessDocument"
  | "uploadDocument"
  | "refresh"
  | "createInvoice"
  | "extractLeadFromUrl"
  | "learnFromConversation"
  | "learnFromQuote"
  | "answerFromMemory"
  | "suggestImprovements"
  | "runDueFollowUps"
  | "approveFollowUp"
  | "dismissFollowUp"
  | "declineQuote";
```

### 6.3 State shape (AzarragaState)

```typescript
interface AzarragaState {
  business: {
    name: string;
    legalName: string;
    tagline: string;
    region: string;
    locations: string[];
    services: string[];
    contacts: Array<{ carrier: string; number: string }>;
  };
  model: string;
  memory: "connected" | "connecting" | "offline";
  leads: Lead[];
  quotes: Quote[];
  invoices: Invoice[];
  documents: DocumentRecord[];
  messages: ChatMessage[];       // last 120
  knowledge: KnowledgeBase;
  followUps: FollowUpTask[];
  lastAutonomousRunAt: string | null;
  updatedAt: string;
}
```

---

## 7. Model configuration

### 7.1 OpenRouter (primary, requires API key)

| Model | OpenRouter name | Notes |
|-------|----------------|-------|
| NVIDIA Nemotron Nano 9B v2 | `nvidia/nemotron-nano-9b-v2:free` | Default. Fast, decent quality. |
| Meta Llama 3.3 70B | `meta-llama/llama-3.3-70b-instruct:free` | Stronger reasoning. |
| Qwen3 235B A22B | `qwen/qwen3-235b-a22b:free` | Large context. |
| DeepSeek DeepSeek-Chat v3.1 | `deepseek/deepseek-chat-v3.1:free` | Alternative. |

Configured in `wrangler.jsonc`:
```jsonc
"vars": {
  "OPENROUTER_SITE_URL": "https://azarraga-commercial-agent.workers.dev",
  "OPENROUTER_MODEL": "nvidia/nemotron-nano-9b-v2:free",
  "OPENROUTER_VISION_MODEL": "google/gemini-2.0-flash-exp:free",
}
```

The `OPENROUTER_API_KEY` is NOT in wrangler.jsonc — it must be set as a secret:
```bash
npx wrangler secret put OPENROUTER_API_KEY
```

### 7.2 Workers AI (fallback, no key needed)

| Model | Binding | Use |
|-------|---------|-----|
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | `AI` | Text chat fallback, streamed |
| `@cf/meta/llama-3.2-11b-vision-instruct` | `AI` | Document/PO vision extraction |

### 7.3 Model selection in the agent

`openRouterModelFromState()` in AzarragaAgent.ts maps the user's UI selection to the OpenRouter model string:

```typescript
if (selected.includes("nemotron")) return "nvidia/nemotron-nano-9b-v2:free";
if (selected.includes("llama")) return "meta-llama/llama-3.3-70b-instruct:free";
if (selected.includes("qwen")) return "qwen/qwen3-235b-a22b:free";
if (selected.includes("deepseek")) return "deepseek/deepseek-chat-v3.1:free";
```

---

## 8. Responsive design

| Breakpoint | Layout |
|------------|--------|
| `>1024px` (lg) | Sidebar + main content + 380px agent panel (right side, static) |
| `≤1024px` | Sidebar as hamburger drawer, agent panel as bottom drawer overlay, floating agent button when drawer closed |

The agent panel uses Tailwind's `lg:` variants to switch between desktop side-by-side and mobile overlay behavior. The transition is animated with `transition-all duration-200`.

---

## 9. Internationalization

TALA's personality is defined in `src/agent/runtime.ts`:

- `TALA_GREETINGS` — 3 greeting variants
- `TALA_UPLOADS` — 3 photo-upload acknowledgment variants
- `TALA_PROCESSING` — 3 processing messages
- `TALA_QUOTE_DONE` — 3 quote-completion variants (with `{{total}}`, `{{ref}}`, `{{customer}}`, `{{project}}` template variables)
- `TALA_NO_EMAIL` — 3 no-email prompts
- `TALA_PALAWAN` — 3 Palawan-opportunity prompts
- `TALA_CONFIRMATIONS` — 3 confirmation messages
- `TALA_NO_LEADS` — 3 no-leads messages
- `TALA_TYPING_STATUSES` — 6 typing-status strings
- `TALA_QUICK_REPLIES` — context-sensitive quick reply groups (default, greeting, afterUpload, quoteDone, noEmail, knowledge)

The system prompt for the LLM (in `worker/AzarragaAgent.ts`, lines 430–458) defines TALA's personality in English for the model to follow: warm, professional, Taglish-speaking, uses `po`/`opo`, remembers customer history, suggests proactively, uses 1-2 emojis per message.

Currency formatting: `peso(n)` and `peso2(n)` in `runtime.ts` format numbers as Philippine pesos with `toLocaleString("en-PH")`.

---

## 10. Seed data

`src/agent/seed.ts` creates TALA's initial state:

- **Business profile:** Azarraga Glass & Aluminum, Palawan operations, 4 locations (Puerto Princesa, El Nido, San Vicente, Port Barton), 5 service categories, 2 contact numbers (Globe 0945-1308277, Smart 0999-705 7770).
- **Seed documents:** 3 documents pre-loaded:
  1. `WhatsApp Image 2026-08-15 at 8.02.50 AM.jpeg` — a learned PO (TCAT04001) from TAGUSAO CONSTRUCTION AND TRADING INC. for Tara Hostel-El Nido, total ₱905,000, 12 lines of 10mm Tempered Clear glass in 900 series Fixed-Slide-Slide doors with Black Frame.
  2. `304569524_483325140471476_4772109627847171135_n.jpg` — stored (not yet learned).
  3. `azarraga_glass_banner.jpeg` — stored (not yet learned).
- **Seed knowledge:** From the learned PO, TALA already knows:
  - Customer: TAGUSAO CONSTRUCTION AND TRADING INC., Puerto Princesa, project Tara Hostel-El Nido, ₱905,000
  - Preferences: 10mm Tempered Clear glass, Black Frame 900 Series Fixed-Slide-Slide Door, Net payment terms (all confirmed from the document)
  - Supplier fact: Azarraga Glass & Aluminum supplies 10mm Tempered Clear Glass
  - One learned fact about the PO
- **Welcome message:** TALA introduces herself in Taglish, mentions her capabilities, and suggests trying a quick action.

This means on first boot, TALA already has commercial memory — exactly like a real employee's first week of notes.

---

## 11. Development

### 10.1 Prerequisites

- Node.js 20+
- npm or bun
- Cloudflare Wrangler CLI (for deployment)

### 10.2 Install + run

```bash
npm install
npm run dev          # Vite dev server, local agent (no Worker needed)
```

Open `http://localhost:5173`. Without `VITE_AGENT_URL`, the `useAzarragaAgent` hook uses `LocalAzarragaAgent` — the full workspace runs in-browser with the autonomous cycle on a 45-second interval.

### 10.3 Build + deploy

```bash
npm run build        # Vite build → ./dist (single-file SPA)
npx wrangler deploy  # Deploys Worker + serves ./dist as ASSETS
```

Set `VITE_AGENT_URL=https://azarraga-commercial-agent.workers.dev` to connect the frontend to the live Worker.

### 10.4 Environment variables (Worker)

| Variable | Value | Required |
|----------|-------|----------|
| `OPENROUTER_API_KEY` | Your OpenRouter API key | No ( Workers AI fallback works without it) |
| `OPENROUTER_SITE_URL` | `https://azarraga-commercial-agent.workers.dev` | Yes (for HTTP-Referer header) |
| `OPENROUTER_MODEL` | Model string from table above | No (has default) |
| `OPENROUTER_VISION_MODEL` | Model string | No (has default) |
| `WHATSAPP_PHONE_ID` | Phone ID | No (placeholder) |

KV and R2 bindings must be configured in the Cloudflare dashboard or via wrangler:
```bash
npx wrangler kv:namespace create COMMERCIAL_CACHE
npx wrangler r2 bucket create commercial-documents
```

Then update `wrangler.jsonc` with the returned IDs.

### 10.5 Project roles

| File/dir | Owner | Purpose |
|----------|-------|---------|
| `worker/index.ts` | Cloudflare Worker | HTTP router, exports DO class |
| `worker/AzarragaAgent.ts` | DO agent | All agent logic, AI calls, state management |
| `src/agent/runtime.ts` | Local mirror | In-browser agent, groundedReply, TALA text constants |
| `src/agent/knowledge.ts` | Shared | Pure knowledge functions (runs in both Worker and browser) |
| `src/agent/followups.ts` | Shared | Pure follow-up detection (runs in both) |
| `src/agent/seed.ts` | Shared | Initial state + seed data |
| `src/agent/types.ts` | Shared | Full type contract |
| `src/agent/useAzarragaAgent.ts` | Client hook | WebSocket + local fallback |
| `src/App.tsx` | Client | Layout, routing, modals, handlers |
| `src/components/` | Client | UI components |
| `wrangler.jsonc` | Cloudflare | Worker config, bindings, vars |

---

## 12. Extension points

### Adding a new agent method

1. Add the method name to `AgentMethod` union in `src/agent/types.ts`.
2. Add the case to `dispatch()` in `worker/AzarragaAgent.ts`.
3. If it should also work in the local mirror, add it to `LocalAzarragaAgent.call()` in `src/agent/runtime.ts`.
4. Add a `@callable()` decorator if it should appear in the Agents SDK's method registry.

### Adding a new knowledge function

1. Add the pure function to `src/agent/knowledge.ts` (no I/O, takes `KnowledgeBase` or `AzarragaState`, returns `{ knowledge, ... }`).
2. Call it from the relevant agent method in `AzarragaAgent.ts` or `LocalAzarragaAgent`.

### Adding a new UI page

1. Create the page component in `src/pages/`.
2. Add the page key to `PageKey` type in `src/components/Shell.tsx`.
3. Add the page to the `TITLES` record and the route switch in `App.tsx`.
4. Add a sidebar link in `Sidebar.tsx`.

### Adding a new LLM model

1. Add the model to `OPENROUTER_MODELS` in `src/agent/seed.ts`.
2. Add the mapping in `openRouterModelFromState()` in `worker/AzarragaAgent.ts`.

---

## 13. Limitations

- **No WhatsApp integration yet.** `WHATSAPP_PHONE_ID` is a placeholder. TALA drafts follow-up messages but the actual sending path is not implemented.
- **No multi-room support.** The WebSocket room is hardcoded to `"main"` in `useAzarragaAgent()`.
- **Local mirror is single-tab.** `LocalAzarragaAgent` runs in one browser tab. Opening the app in multiple tabs gives each its own independent agent state.
- **KV cache is best-effort.** If `COMMERCIAL_CACHE` is not configured, caching is silently skipped.
- **Vision extraction quality depends on photo clarity.** The GLASS_INVOICE_PROMPT is designed for clear PO photos but blurry or heavily OCR-degraded images may produce `FAIL` review status.
- **Free models only.** TALA uses only free OpenRouter models + Workers AI. Quality is good but not frontier-level.

---

## 14. Files summary

```
worker/
├── index.ts              # 33 lines — Worker entry, routeAgentRequest, exports
└── AzarragaAgent.ts     # 924 lines — Durable Object agent class

src/
├── main.tsx             # 13 lines — React entry, ThemeProvider
├── App.tsx              # 223 lines — Layout, routing, modals, handlers
├── index.css            # Tailwind 4 import + custom utilities
├── vite-env.d.ts        # Vite environment types
├── utils/cn.ts          # clsx + tailwind-merge helper
├── theme/ThemeProvider.tsx  # light/dark, localStorage persistence
├── agent/
│   ├── types.ts         # 396 lines — Full type contract
│   ├── seed.ts          # 267 lines — createInitialState + seedKnowledgeBase
│   ├── runtime.ts       # 1052 lines — LocalAzarragaAgent, groundedReply, TALA_* constants
│   ├── knowledge.ts     # 498 lines — Pure knowledge functions (5 exports)
│   ├── followups.ts     # 102 lines — Pure follow-up detection (2 exports)
│   └── useAzarragaAgent.ts  # 133 lines — WebSocket + local fallback hook
├── components/
│   ├── Shell.tsx        # Sidebar + TopBar
│   ├── AgentPanel.tsx   # Chat UI
│   ├── Modal.tsx        # Modal backbone
│   ├── NewQuoteModal.tsx
│   ├── NewInvoiceModal.tsx
│   ├── DocumentReviewModal.tsx  # Side-by-side original vs extraction
│   ├── MobileBottomNav.tsx
│   ├── FloatingAgentButton.tsx
│   ├── Avatar.tsx
│   ├── TalaAvatarImage.tsx
│   ├── ThemeToggle.tsx
│   ├── WorldClock.tsx
│   ├── SafeImage.tsx
│   ├── LeadUrlExtractor.tsx
│   └── ...
├── pages/
│   ├── Overview.tsx     # KPI dashboard
│   ├── Documents.tsx    # Upload + document list
│   └── Records.tsx      # Leads / Quotes / Invoices tabs
└── assets/              # 5 images (avatar, logo, icon, hero, PO sample)

worker/README.md         # Worker-specific notes
```
