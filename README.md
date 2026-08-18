# Azarraga Agent

**TALA** — Tagalog AI Logistics Assistant. A commercial agent for Azarraga Glass & Aluminum, a glass and aluminum fabrication business in Palawan, Philippines.

TALA is not a chatbot with a database bolted on. She is an *agentic* worker who:

- **Remembers forever** — every conversation, learned fact, and document extraction is persisted in append-only SQLite tables inside a Cloudflare Durable Object. Nothing is trimmed.
- **Learns from documents** — upload a PO photo and Workers AI vision extracts every line item, supplier, tax breakdown, and pricing evidence. TALA turns that into customer history and supplier facts.
- **Suggests actions without being asked** — an hourly autonomous cycle drafts proactive messages and dashboard suggestions the moment a new pattern is confident enough.
- **Follows up automatically** — stale quotes, cold leads, overdue invoices get drafted follow-up messages placed in "Needs your attention" for one-tap human approval. TALA never sends anything herself.
- **Gets smarter over time** — every approved/declined quote, every learned document, every conversation updates the knowledge base. `suggestImprovements()` mines those signals for higher-confidence advice each cycle.

---

## Live

**https://azarraga-agent.vercel.app** (frontend) · **https://azarraga-commercial-agent.workers.dev** (Cloudflare Worker)

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite 7 + Tailwind CSS 4 + TypeScript 5 |
| Agent runtime | Cloudflare Workers + Cloudflare Agents SDK (`agents` ^0.20.1) |
| State / memory | Durable Object with built-in SQLite (`this.sql`, `this.setState()`) |
| AI (text) | Workers AI (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`) + OpenRouter (free models: Nemotron, Llama 3.3 70B, Qwen3 235B, DeepSeek) |
| AI (vision) | Workers AI (`@cf/meta/llama-3.2-11b-vision-instruct`) for PO extraction |
| File storage | Cloudflare R2 bucket `commercial-documents` |
| Cache | Cloudflare KV namespace `COMMERCIAL_CACHE` |
| Realtime sync | WebSocket (Agents SDK wire protocol → `useAzarragaAgent` hook) |
| Offline/dev mode | `LocalAzarragaAgent` — in-browser mirror of the Durable Object with identical reducer |

**By design: no Postgres, no REST CRUD layer, no Composio.**

---

## Architecture

See [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md) for the full breakdown.

```
+------------------+     WebSocket      +---------------------------+
|  React SPA       | ←────────────────→ |  Cloudflare Worker         |
|  (Vite, Tailwind) |   JSON-RPC + state |  (workers.dev)             |
|  UseAzarragaAgent|                    |  routeAgentRequest()       |
+------------------+                    |                             |
        ↑                               |  AzarragaAgent (DO)         |
        | local fallback                |  - SQLite append-only logs   |
        |                               |  - Workers AI / OpenRouter   |
+------------------+                    |  - R2 + KV bindings          |
|  LocalAzarragaAgent | ←────────────── |                             |
|  (in-browser)    |   same reducer     +---------------------------+
|  setInterval     |                    |
+------------------+                    +---------------------------+
                                                       |  R2: originals
                                                       |  KV: cache
                                                       |  AI: Workers AI
```

---

## What TALA can do

### Chat
Type naturally in English or Taglish. TALA answers from her commercial memory — customers, quotes, invoices, documents, pricing signals. She never invents data. When a field is missing she says so and uses a warm line like *"Ay, walang email..."*

### Leads
Add leads manually or extract them from a public URL (Google Business, Facebook, website). TALA fetches the page, strips HTML, and runs it through OpenRouter to pull company, contact, email, phone, location, and project type.

### Quotes
Multi-line quotations with glass specs (mm, type), frame style, system (900 series, etc.), quantity, unit price. TALA auto-calculates subtotal. Advance through `draft → sent → approved`. Declined quotes are also recorded for pricing pattern learning.

### Invoices
Issue an invoice from an approved quote, or create one manually. Record payments. Download an HTML invoice. TALA flags overdue invoices in the autonomous cycle.

### Documents
Upload PO photos, specs, delivery receipts. Workers AI vision extracts structured data: vendor, buyer, TIN, dates, line items with dimensions and glass specs, VAT breakdown, grand total. TALA cross-checks arithmetic and returns a `PASS`/`FAIL` review status. Every extraction is archived next to the original in R2 so you can visually compare.

### Knowledge
TALA maintains a growing knowledge base:
- **Customer memories** — company, contact, location, project history, preferences (glass type, frame style, payment terms) with confidence levels (`confirmed` from approved quotes, `inferred` from conversation).
- **Pricing signals** — every quote line recorded with outcome (approved/rejected/sent), unit price, system, glass, frame. Used by `suggestImprovements()`.
- **Supplier facts** — material + supplier name traced to source document.
- **Learned facts** — append-only log of every extracted insight with source reference and tags.

### Autonomous cycle (hourly)
1. `detectDueFollowUps()` — drafts follow-ups for quotes stale >48h, leads cold >3 days, invoices past due.
2. `suggestImprovements()` — mines pricing signals for combos with repeated rejections (suggest price cut), confirmed approvals (safe baseline), missing emails, repeat customers, single-supplier dependency.

### Model selection
Switch between free models at runtime:
- NVIDIA Nemotron Nano 9B v2 (default)
- Meta Llama 3.3 70B Instruct
- Qwen3 235B A22B
- DeepSeek DeepSeek-Chat v3.1
- Workers AI fallback (no API key needed)

---

## Project structure

```
azarraga-agent/
├── index.html              # SPA entry (Vite template)
├── package.json            # React 19 + Vite 7 + Tailwind 4 + Agents SDK
├── tsconfig.json
├── vite.config.ts          # Tailwind 4 Vite plugin + singlefile output
├── wrangler.jsonc          # Cloudflare Worker config (DO, AI, R2, KV, vars)
├── src/
│   ├── main.tsx            # React entry, ThemeProvider
│   ├── App.tsx             # Router, layout, modals, agent panel
│   ├── index.css           # Tailwind 4 import + custom utilities
│   ├── vite-env.d.ts
│   ├── utils/cn.ts         # clsx + tailwind-merge
│   ├── theme/ThemeProvider.tsx  # light/dark, persisted in localStorage
│   ├── components/
│   │   ├── Shell.tsx       # Sidebar + TopBar (layout shell)
│   │   ├── AgentPanel.tsx  # Chat UI with streaming, quick replies, mood
│   │   ├── MobileBottomNav.tsx
│   │   ├── FloatingAgentButton.tsx
│   │   ├── Modal.tsx       # Reusable modal backbone
│   │   ├── NewQuoteModal.tsx
│   │   ├── NewInvoiceModal.tsx
│   │   ├── DocumentReviewModal.tsx  # Side-by-side original vs extraction
│   │   ├── Avatar.tsx
│   │   ├── TalaAvatarImage.tsx
│   │   ├── ThemeToggle.tsx
│   │   ├── WorldClock.tsx
│   │   ├── SafeImage.tsx   # R2-signed-URL image with fallback
│   │   ├── LeadUrlExtractor.tsx
│   │   └── ...
│   ├── pages/
│   │   ├── Overview.tsx    # KPIs: leads, pipeline, receivables, documents
│   │   ├── Documents.tsx   # Upload + document list + reprocess
│   │   └── Records.tsx     # Leads / Quotes / Invoices tabs
│   ├── agent/
│   │   ├── types.ts        # Full type contract (Lead, Quote, Invoice,
│   │   │                    #   DocumentRecord, Extraction, KnowledgeBase,
│   │   │                    #   FollowUpTask, ChatMessage, etc.)
│   │   ├── seed.ts         # createInitialState() + seedKnowledgeBase()
│   │   │                    #   Seeds TALA with Tagusao/Tara Hostel PO
│   │   ├── runtime.ts      # LocalAzarragaAgent, groundedReply(),
│   │   │                    #   TALA_* text constants, peso(), uid()
│   │   ├── knowledge.ts    # learnFromConversation, learnFromQuote,
│   │   │                    #   learnFromDocument, answerFromMemory,
│   │   │                    #   suggestImprovements — pure functions
│   │   ├── followups.ts    # detectDueFollowUps, mergeFollowUps — pure
│   │   └── useAzarragaAgent.ts  # WebSocket + local fallback hook
│   └── assets/             # tala-avatar.png, azarraga-logo.png,
│                           #   azarraga-icon.png, landing-hero.jpg,
│                           #   po-original.jpg
└── worker/
    ├── index.ts            # Cloudflare Worker entry — routeAgentRequest()
    ├── AzarragaAgent.ts   # Durable Object class (924 lines)
    └── README.md           # Worker-specific notes
```

---

## Cloudflare Worker config (`wrangler.jsonc`)

| Binding | Purpose |
|---------|---------|
| `AzarragaAgent` (Durable Object) | State, memory, WebSocket connections, autonomous cycle |
| `AI` (Workers AI) | Vision model for PO extraction + text model fallback |
| `DOCUMENTS` (R2 bucket `commercial-documents`) | Authoritative original files — never in a database |
| `COMMERCIAL_CACHE` (KV) | Short-lived chat answer cache (15 min TTL) + knowledge caches |
| `ASSETS` (Fetcher) | Serves the Vite-built SPA from `./dist` |

**Environment variables:**
- `OPENROUTER_SITE_URL` — https://azarraga-commercial-agent.workers.dev
- `OPENROUTER_MODEL` — nvidia/nemotron-nano-9b-v2:free
- `OPENROUTER_VISION_MODEL` — google/gemini-2.0-flash-exp:free
- `WHATSAPP_PHONE_ID` — 123456789 (placeholder)

**Compatibility:** `nodejs_compat`, `compatibility_date: 2026-01-15`

---

## RPC protocol

The client and Durable Object communicate over WebSocket using a simple JSON-RPC pattern:

```typescript
// Request
{ type: "rpc", id: "rpc_abc123", method: "chat", args: ["Kumusta po!"] }

// Response
{ type: "rpc", id: "rpc_abc123", success: true, result: true }

// State broadcast (on connect + on every state change)
{ type: "cf_agent_state", state: AzarragaState }
```

All 18 agent methods are defined in `src/agent/types.ts` as `AgentMethod`:
`chat`, `quickAction`, `createQuote`, `addLead`, `setModel`, `reprocessDocument`,
`uploadDocument`, `refresh`, `createInvoice`, `extractLeadFromUrl`,
`learnFromConversation`, `learnFromQuote`, `answerFromMemory`,
`suggestImprovements`, `runDueFollowUps`, `approveFollowUp`, `dismissFollowUp`,
`declineQuote`.

---

## Running locally

### Frontend only (no Worker)

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Without `VITE_AGENT_URL` set, `useAzarragaAgent` falls back to `LocalAzarragaAgent` — the full workspace is interactive with an in-browser agent that runs the same reducer as the Durable Object, including the autonomous cycle on a 45-second interval.

### With a deployed Worker

```bash
# Build the SPA first
npm run build

# Deploy the Worker (serves SPA from ./dist + runs the Durable Object)
npx wrangler deploy
```

Set `VITE_AGENT_URL=https://azarraga-commercial-agent.workers.dev` in your `.env` to connect the frontend to the live Worker over WebSocket.

---

## PO extraction detail

When you upload a document, TALA:

1. Stores the original in R2 `commercial-documents` (authoritative, never modified).
2. Runs `@cf/meta/llama-3.2-11b-vision-instruct` on the image with the `GLASS_INVOICE_PROMPT` (see `worker/AzarragaAgent.ts` lines 77–133) — a detailed system prompt covering:
   - Glass industry specifics (sqm, sqft, mm thickness, tempered/laminated, edging, drilling surcharges)
   - Philippine 12% VAT, US sales tax, EU reverse-charge detection
   - Currency default logic (PHP unless `$` or `€` explicitly appears)
   - Arithmetic verification (qty × unit price = line total; sum + taxes + fees = grand total)
   - Anomaly detection (math mismatches, missing fields, mixed currencies)
3. Returns structured JSON with `reviewStatus` (PASS/FAIL), full line items, financial summary, audit trail, and missing/conflicts arrays.
4. `learnFromDocument()` turns the extraction into customer history + supplier facts in the knowledge base.

The `DocumentReviewModal` shows the original image beside TALA's extraction so you can visually verify every field.

---

## Knowledge system detail

All knowledge functions in `src/agent/knowledge.ts` are **pure** — no I/O — so they run identically in the Cloudflare Worker and the in-browser `LocalAzarragaAgent`.

### `learnFromConversation(kb, messages, company?)`
Scans user turns for:
- Glass keywords + mm/clear/tempered → `glass_type` preference (inferred)
- Frame keywords → `frame_style` preference (inferred)
- `₱` amounts → budget notes
- Location names (El Nido, Puerto Princesa, San Vicente, Port Barton, Coron) → customer location

### `learnFromQuote(kb, quote)`
Records every line as a `PricingSignal` (system, glass, frame, unitPrice, outcome). On approved quotes, the dominant glass and frame become `confirmed` customer preferences. On declined quotes, the rejection is recorded for pattern analysis.

### `learnFromDocument(kb, doc)`
Adds supplier facts (material + supplier name traced to source document) and updates customer project history from the PO buyer.

### `answerFromMemory(state, query)`
Routes queries to the right knowledge slice:
- *"glass thickness for X"* → customer preference lookup
- *"supplier for 6mm clear"* → supplier facts
- *"price that worked for similar"* → approved pricing signals
- *"quote similar to Tara Hostel"* → customer project history

### `suggestImprovements(kb)`
Finds:
- Repeated rejections on same system/glass combo → price cut suggestion (8-10% lower or bundle installation)
- 2+ approvals on same combo → safe baseline confirmation
- Customers missing email → capture suggestion
- Repeat customers (2+ projects) → loyalty/priority suggestion
- Single-supplier dependency → backup supplier suggestion

---

## Autonomous follow-up detail

`detectDueFollowUps()` in `src/agent/followups.ts` is also pure. Thresholds:

| Trigger | Condition |
|---------|-----------|
| Quote stale | `sent` status, no response for 48 hours |
| Lead cold | Not `won`/`lost`, no activity for 3 days |
| Invoice overdue | `balance > 0`, past `dueDate` |

Each drafted `FollowUpTask` includes a `draftMessage` in Taglish/English. TALA places these in `state.followUps` with status `pending`. The user approves or dismisses from the dashboard. **TALA never sends anything without human approval.**

---

## Data model

### `AzarragaState` (the Durable Object's broadcast state)

```typescript
interface AzarragaState {
  business: { name, legalName, tagline, region, locations, services, contacts }
  model: string                    // currently selected LLM
  memory: "connected" | "connecting" | "offline"
  leads: Lead[]
  quotes: Quote[]
  invoices: Invoice[]
  documents: DocumentRecord[]
  messages: ChatMessage[]         // last 120
  knowledge: KnowledgeBase        // queryable long-term memory
  followUps: FollowUpTask[]       // "Needs your attention"
  lastAutonomousRunAt: string | null
  updatedAt: string
}
```

### Append-only SQL tables (survive hibernation, never trimmed)

| Table | Purpose |
|-------|---------|
| `activity` | Audit log of every action (lead.created, quote.approved, chat.openrouter, etc.) |
| `messages_log` | Every chat message archived permanently |
| `facts_log` | Every learned fact archived permanently (idempotent `INSERT OR IGNORE`) |

The in-memory `state` snapshot stays small for WebSocket performance; the SQL tables are TALA's permanent memory beneath it.

---

## Model strategy

TALA uses a tiered fallback:

1. **OpenRouter** (if `OPENROUTER_API_KEY` is set) — free models only, temperature 0.15, max 4096 tokens. Model selected by user preference in the agent panel.
2. **Workers AI** (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`) — no API key needed, streamed over WebSocket. Used as fallback when OpenRouter is unavailable or for vision extraction (`@cf/meta/llama-3.2-11b-vision-instruct`).

Chat answers are cached in KV for 15 minutes keyed by `chat:{stateUpdatedAt}:{prompt}` to avoid re-running the same question.

---

## Internationalization

TALA speaks English + casual Taglish with `po`/`opo` respect markers. All TALA-facing text is in `src/agent/runtime.ts` as `TALA_*` constants (greetings, processing messages, quote-done messages, no-email prompts, Palawan prompts, confirmations, quick replies). The system prompt for OpenRouter/Workers AI chat is in `worker/AzarragaAgent.ts` lines 430–458.

Currency is Philippine pesos (₱) by default, formatted with `peso()` and `peso2()` helpers in `runtime.ts`.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, testing approach, and how to add new agent capabilities.

---

## License

MIT — see [LICENSE](LICENSE).
