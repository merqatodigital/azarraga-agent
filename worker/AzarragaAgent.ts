/**
 * AzarragaAgent — Cloudflare Agents SDK Durable Object.
 *
 * TALA is an *agentic* agent, not a chatbot with a database attached:
 *
 *  1. REMEMBERS FOREVER
 *     - `state.knowledge` / `state.messages` are broadcast + persisted by the
 *       Agents SDK's built-in SQLite-backed `this.setState()`.
 *     - Every message and learned fact is *also* archived into append-only
 *       SQL tables (`messages_log`, `facts_log`) that are never trimmed, so
 *       conversation history survives hibernation, restarts and state
 *       payload pruning — real durable memory, not a session cache.
 *
 *  2. LEARNS FROM DOCUMENTS
 *     - Workers AI vision (`@cf/meta/llama-3.2-11b-vision-instruct`) extracts
 *       structured POs from R2-stored originals; `learnFromDocument()` turns
 *       that into supplier facts + customer history in the knowledge base.
 *
 *  3. SUGGESTS ACTIONS WITHOUT BEING ASKED
 *     - `runAutonomousCycle()` runs on a recurring `this.scheduleEvery()`
 *       alarm (a native Cloudflare Agents SDK primitive backed by Durable
 *       Object alarms) and pushes proactive chat messages + dashboard
 *       suggestions the moment a new pattern is confident enough — no user
 *       prompt required.
 *
 *  4. FOLLOWS UP AUTOMATICALLY
 *     - The same autonomous cycle drafts follow-ups for stale quotes, cold
 *       leads and overdue invoices (`detectDueFollowUps`) and queues them in
 *       "Needs your attention" for one-tap owner approval. TALA never sends
 *       anything herself — she prepares, the human approves.
 *
 *  5. GETS SMARTER OVER TIME
 *     - Every approved/declined quote, every learned document and every
 *       conversation updates `state.knowledge` (customer preferences,
 *       pricing signals, supplier facts). `suggestImprovements()` mines
 *       those growing signals for new, higher-confidence advice each cycle.
 */

import { Agent, callable, type Connection, type ConnectionContext } from "agents";
import { createInitialState } from "../src/agent/seed";
import {
  answerFromMemory,
  learnFromConversation,
  learnFromDocument,
  learnFromQuote,
  suggestImprovements,
} from "../src/agent/knowledge";
import { detectDueFollowUps, mergeFollowUps } from "../src/agent/followups";
import type {
  AzarragaState,
  ChatMessage,
  DocumentRecord,
  FollowUpTask,
  Invoice,
  Lead,
  Quote,
} from "../src/agent/types";

export interface Env {
  AzarragaAgent: DurableObjectNamespace;
  AI: Ai;
  DOCUMENTS: R2Bucket;
  COMMERCIAL_CACHE: KVNamespace;
  ASSETS: Fetcher;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_SITE_URL?: string;
  OPENROUTER_MODEL?: string;
  OPENROUTER_VISION_MODEL?: string;
  WHATSAPP_PHONE_ID?: string;
}

const TEXT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const VISION_MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";
const DEFAULT_OPENROUTER_MODEL = "nvidia/nemotron-nano-9b-v2:free";
const DEFAULT_OPENROUTER_VISION_MODEL = "google/gemini-2.0-flash-exp:free";

const GLASS_INVOICE_PROMPT = `
# ROLE & MINDSET
You are an elite, highly precise Document AI Agent specializing in corporate financial data extraction for the global glass manufacturing, glazing, and installation industry. You function with absolute mathematical accuracy, flawless structural analysis, and adherence to international accounting standards.

# DOMAIN CONTEXT: GLASS INDUSTRY PARTICULARS
Glass industry invoices contain sector-specific metrics. Meticulously extract and interpret dimensions/measurements (sqm, sqft, linear meters, millimeters such as 6mm Clear Tempered or 12mm Laminated), pricing metrics (price per sqm/sqft or flat supply-and-install rates), and surcharges (polishing, edging, hole drilling, safety film, heavy delivery/crane lifting fees).

# GLOBAL & REGIONAL TAX COMPLIANCE STANDARDS
1. Philippine Market (Default): Default currency is PHP when no explicit currency appears. Extract 12% VAT structure: VATable Sales, VAT Amount, Zero-Rated/Exempt Sales where applicable. Identify BIR-registered TIN for vendor and buyer.
2. US Market: If $, USD, or United States tax language appears, output USD and isolate State/Local Sales Tax plus separate freight charges.
3. European Market: If €, EUR/EURO, VAT number, or reverse-charge language appears, output EUR and isolate standard VAT rates / reverse charge.

# CORE OBJECTIVES
1. SYSTEMATIC EXTRACTION: Ingest raw, messy, or OCR-scanned invoice/PO/spec text and isolate every mandatory billing field.
2. CURRENCY MASTER LOGIC: Identify primary currency. If no symbol/code exists, default strictly to PHP. Adapt to USD or EUR only when explicitly indicated.
3. ARITHMETIC VERIFICATION: Internally audit every line item: quantity x unit price = amount. Sum amounts + taxes + logistics/delivery/handling fees = grand total.
4. ANOMALY DETECTION: Flag math mismatches, unreadable text, missing compliance fields, ambiguous currency, or mixed currencies.

# INPUT DATA FOR EVALUATION
[INSERT RAW INVOICE TEXT / OCR STREAM HERE]

# EXTRACTION AND STANDARDIZATION PROTOCOLS
1. Corporate Entities & Compliance Details: vendor/issuer full legal name, address, contact info, tax registration (TIN/EIN/VAT No.); client/bill-to name, delivery/installation address, tax registration.
2. Temporal & Tracking Metadata: invoice number, PO number, job/project reference, issue date, due date, delivery/completion date. Standardize all dates as YYYY-MM-DD.
3. Glass-Specific Line Items: For each item/service capture description/spec, dimensions, quantity/area, UOM, unit price, line net amount, calculated line total and discrepancy.
4. Financial Summary: subtotal/net amount, freight/delivery/special handling/crane fees, tax breakdown, currency, gross grand total.

# HUMAN-IN-THE-LOOP ROUTING
Output reviewStatus PASS only if all critical fields are populated, currency assigned, and arithmetic balances exactly. Output FAIL if invoice number/vendor/grand total missing, currency ambiguous/mixed, or math differs by any amount. Provide plain-language reviewReason, e.g. "Calculated total is 45,000 PHP but document states 50,000 PHP".

# OUTPUT FORMAT
Return ONLY valid JSON, no markdown, no wrapper text. Use this structure:
{
  "reviewStatus":"PASS|FAIL",
  "reviewReason":"...",
  "documentType":"invoice|purchase_order|quotation|specification|delivery_receipt|other",
  "currency":"PHP|USD|EUR",
  "invoiceNumber":null,
  "poNumber":null,
  "jobReference":null,
  "documentDate":null,
  "issueDate":null,
  "dueDate":null,
  "deliveryDate":null,
  "mrsNumber":null,
  "paymentTerms":null,
  "memo":null,
  "instructions":null,
  "buyer":{"name":null,"address":null,"tin":null,"taxId":null,"contact":null,"email":null,"phone":null,"website":null},
  "supplier":{"name":null,"address":null,"tin":null,"taxId":null,"contact":null,"email":null,"phone":null,"website":null},
  "project":{"name":null,"address":null,"contact":null},
  "financial":{"productSubtotal":0,"vat":0,"vatableSales":0,"vatAmount":0,"zeroRatedSales":0,"exemptSales":0,"salesTax":0,"discount":0,"crating":0,"shipping":0,"trucking":0,"delivery":0,"installation":0,"documentTotal":0,"taxBreakdown":[{"type":"12% PH VAT","rate":12,"taxableBase":0,"amount":0}]},
  "lines":[{"index":1,"opening":null,"raw":"verbatim line text","productFamily":null,"system":null,"configuration":null,"qty":0,"unit":null,"widthMm":null,"heightMm":null,"dimensions":null,"specification":null,"glass":null,"areaSqm":null,"areaSqft":null,"linearMeters":null,"unitPrice":null,"lineTotal":null,"calculatedLineTotal":null,"lineDiscrepancy":0,"taxType":null}],
  "audit":{"reviewStatus":"PASS|FAIL","reason":"...","currency":"PHP|USD|EUR","arithmeticBalanced":true,"calculatedLineSubtotal":0,"calculatedGrandTotal":0,"statedGrandTotal":0,"discrepancy":0},
  "missing":[],
  "conflicts":[]
}`;

/** How often TALA checks for stale quotes/leads/invoices and fresh insights. */
const AUTONOMOUS_CYCLE_SECONDS = 60 * 60; // hourly

const uid = (p: string) => `${p}_${crypto.randomUUID().slice(0, 8)}`;

export class AzarragaAgent extends Agent<Env, AzarragaState> {
  initialState: AzarragaState = createInitialState();

  async onStart() {
    // Durable Object SQL storage — append-only, never pruned, survives
    // hibernation. This is TALA's permanent memory beneath the broadcast
    // `state` snapshot (which stays small for WebSocket performance).
    this.sql`CREATE TABLE IF NOT EXISTS activity (
      id TEXT PRIMARY KEY,
      kind TEXT,
      payload TEXT,
      created_at TEXT
    )`;
    this.sql`CREATE TABLE IF NOT EXISTS messages_log (
      id TEXT PRIMARY KEY,
      role TEXT,
      content TEXT,
      created_at TEXT
    )`;
    this.sql`CREATE TABLE IF NOT EXISTS facts_log (
      id TEXT PRIMARY KEY,
      kind TEXT,
      summary TEXT,
      source_ref TEXT,
      created_at TEXT
    )`;

    // Native Cloudflare Agents SDK recurring schedule, backed by a Durable
    // Object alarm. Idempotent — safe to call on every wake, only ever one
    // active schedule for this callback/interval/payload combination.
    await this.scheduleEvery(AUTONOMOUS_CYCLE_SECONDS, "runAutonomousCycle", {});
  }

  async onConnect(connection: Connection, _ctx: ConnectionContext) {
    connection.send(JSON.stringify({ type: "cf_agent_state", state: this.state }));
  }

  async onMessage(connection: Connection, message: string) {
    let parsed: { type?: string; id?: string; method?: string; args?: unknown[] };
    try {
      parsed = JSON.parse(message);
    } catch {
      return;
    }
    if (parsed.type !== "rpc" || !parsed.method) return;

    try {
      const result = await this.dispatch(parsed.method, parsed.args ?? []);
      connection.send(JSON.stringify({ type: "rpc", id: parsed.id, success: true, result }));
    } catch (error) {
      connection.send(JSON.stringify({ type: "rpc", id: parsed.id, success: false, error: String(error) }));
    }
  }

  private log(kind: string, payload: unknown) {
    this.sql`INSERT INTO activity (id, kind, payload, created_at)
      VALUES (${uid("act")}, ${kind}, ${JSON.stringify(payload)}, ${new Date().toISOString()})`;
  }

  /** Archives a message permanently — independent of in-memory state trimming. */
  private archiveMessage(message: ChatMessage) {
    this.sql`INSERT INTO messages_log (id, role, content, created_at)
      VALUES (${message.id}, ${message.role}, ${message.content}, ${message.createdAt})`;
  }

  private archiveFacts(facts: Array<{ id: string; kind: string; summary: string; sourceRef: string; createdAt: string }>) {
    for (const fact of facts) {
      this.sql`INSERT OR IGNORE INTO facts_log (id, kind, summary, source_ref, created_at)
        VALUES (${fact.id}, ${fact.kind}, ${fact.summary}, ${fact.sourceRef}, ${fact.createdAt})`;
    }
  }

  private patch(next: Partial<AzarragaState>) {
    this.setState({ ...this.state, ...next, updatedAt: new Date().toISOString() });
  }

  private pushMessage(content: string) {
    const message: ChatMessage = {
      id: uid("msg"),
      role: "assistant",
      content,
      createdAt: new Date().toISOString(),
    };
    this.patch({ messages: [...this.state.messages, message].slice(-120) });
    this.archiveMessage(message);
  }

  private openRouterModelFromState() {
    const selected = this.state.model.toLowerCase();
    if (selected.includes("nemotron")) return this.env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL;
    if (selected.includes("llama")) return "meta-llama/llama-3.3-70b-instruct:free";
    if (selected.includes("qwen")) return "qwen/qwen3-235b-a22b:free";
    if (selected.includes("deepseek")) return "deepseek/deepseek-chat-v3.1:free";
    return this.env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL;
  }

  private async openRouterChat(messages: Array<{ role: string; content: unknown }>, model?: string) {
    if (!this.env.OPENROUTER_API_KEY) return null;
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": this.env.OPENROUTER_SITE_URL || "https://azarraga-commercial-agent.workers.dev",
        "X-Title": "Azarraga Glass Agent",
      },
      body: JSON.stringify({
        model: model || this.openRouterModelFromState(),
        messages,
        temperature: 0.15,
        max_tokens: 4096,
      }),
    });
    if (!response.ok) return null;
    const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return json.choices?.[0]?.message?.content?.trim() || null;
  }

  private extractJsonObject(text: string) {
    return text
      .replace(/^\s*```(?:json)?/i, "")
      .replace(/```\s*$/i, "")
      .trim()
      .match(/\{[\s\S]*\}/)?.[0] ?? text;
  }

  async dispatch(method: string, args: unknown[]): Promise<unknown> {
    switch (method) {
      case "refresh":
        this.patch({});
        return true;

      case "setModel":
        this.patch({ model: String(args[0]) });
        return true;

      case "addLead": {
        const input = args[0] as Partial<Lead>;
        const lead: Lead = {
          id: uid("lead"),
          company: input.company ?? "Unnamed company",
          contact: input.contact ?? "—",
          email: input.email || null,
          phone: input.phone || null,
          project: input.project ?? "—",
          location: input.location ?? "Palawan",
          value: Number(input.value ?? 0),
          stage: input.stage ?? "new",
          nextAction: input.nextAction || "Qualify scope and site measure",
          updatedAt: new Date().toISOString(),
        };
        this.patch({ leads: [lead, ...this.state.leads] });
        this.log("lead.created", lead);
        return lead;
      }

      case "createQuote": {
        const input = args[0] as Omit<Quote, "id" | "ref" | "subtotal" | "status" | "createdAt">;
        const subtotal = input.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
        const quote: Quote = {
          ...input,
          id: uid("quote"),
          ref: `AGQ-${String(this.state.quotes.length + 1).padStart(4, "0")}`,
          subtotal,
          status: "draft",
          createdAt: new Date().toISOString(),
        };
        this.patch({ quotes: [quote, ...this.state.quotes] });
        this.log("quote.created", quote);
        return quote;
      }

      case "advanceQuote": {
        const id = String(args[0]);
        const current = this.state.quotes.find((q) => q.id === id);
        const nextStatus = current?.status === "draft" ? "sent" : "approved";
        this.patch({
          quotes: this.state.quotes.map((q) => (q.id === id ? { ...q, status: nextStatus } : q)),
        });
        if (current && nextStatus === "approved") {
          void this.learnFromQuoteById(id);
        }
        return true;
      }

      case "declineQuote":
        return this.declineQuoteById(String(args[0]), args[1] as string | undefined);

      case "issueInvoice": {
        const quote = this.state.quotes.find((q) => q.id === String(args[0]));
        if (!quote) return false;
        const invoice: Invoice = {
          id: uid("inv"),
          ref: `AGI-${String(this.state.invoices.length + 1).padStart(4, "0")}`,
          customer: quote.customer,
          project: quote.project,
          amount: quote.subtotal,
          paid: 0,
          balance: quote.subtotal,
          dueDate: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10),
          status: "sent",
          issuedAt: new Date().toISOString(),
        };
        this.patch({ invoices: [invoice, ...this.state.invoices] });
        this.log("invoice.issued", invoice);
        return invoice;
      }

      case "createInvoice": {
        const input = args[0] as Partial<Invoice>;
        const amount = Number(input.amount ?? 0);
        const paid = Number(input.paid ?? 0);
        const invoice: Invoice = {
          id: uid("inv"),
          ref: `AGI-${String(this.state.invoices.length + 1).padStart(4, "0")}`,
          customer: input.customer?.trim() || "Unnamed customer",
          project: input.project?.trim() || "General billing",
          amount,
          paid,
          balance: Math.max(0, amount - paid),
          dueDate: input.dueDate || new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10),
          status: input.status ?? "sent",
          issuedAt: input.issuedAt || new Date().toISOString(),
        };
        this.patch({ invoices: [invoice, ...this.state.invoices] });
        this.log("invoice.created", invoice);
        return invoice;
      }

      case "extractLeadFromUrl":
        return this.extractLeadFromUrl(String(args[0] ?? ""));

      case "recordPayment": {
        const id = String(args[0]);
        this.patch({
          invoices: this.state.invoices.map((i) =>
            i.id === id ? { ...i, paid: i.amount, balance: 0, status: "paid" } : i,
          ),
        });
        return true;
      }

      case "reprocessDocument":
        return this.learnDocument(String(args[0]));

      case "chat":
        return this.chat(String(args[0] ?? ""));

      case "learnFromConversation":
        return this.learnFromConversationTurn(args[0] as string | undefined);

      case "learnFromQuote":
        return this.learnFromQuoteById(String(args[0]));

      case "answerFromMemory":
        return this.answerFromMemoryQuery(String(args[0] ?? ""));

      case "suggestImprovements":
        return this.runSuggestImprovements();

      case "runDueFollowUps":
        return this.runAutonomousCycle();

      case "approveFollowUp":
        return this.approveFollowUpById(String(args[0]));

      case "dismissFollowUp":
        return this.dismissFollowUpById(String(args[0]));

      default:
        throw new Error(`Unknown agent method: ${method}`);
    }
  }

  /* ---------------- Workers AI: grounded chat, streamed over WS -------- */

  async chat(prompt: string) {
    if (!prompt.trim()) return false;

    const user: ChatMessage = { id: uid("msg"), role: "user", content: prompt, createdAt: new Date().toISOString() };
    const assistant: ChatMessage = {
      id: uid("msg"),
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
      streaming: true,
    };
    this.patch({ messages: [...this.state.messages, user, assistant] });
    this.archiveMessage(user);

    const system = [
      "You are TALA — the warm, Taglish-speaking commercial agent for AZARRAGA GLASS & ALUMINUM in Palawan, Philippines. You work in the office, you've been there for years, you are a trusted colleague.",
      "PERSONALITY:",
      "- Professional but warm, like an office best friend. Enthusiastic about glass & aluminum (sliding doors, tempered glass, beachfront installations).",
      "- You speak English + casual Filipino Taglish. Use 'po' and 'opo' to show respect.",
      "- You remember customer history and bring it up naturally. You suggest next steps proactively without being asked.",
      "- Emoji usage is warm but not childish. Use 1-2 per message. Keep Taglish authentic.",
      "",
      "GROUNDING RULES (CRITICAL):",
      "- Answer ONLY from the recorded commercial memory supplied below. Never invent customers, leads, prices, emails or documents.",
      "- When a field is missing say it is not recorded — then use a warm Tala line like 'Ay, walang email...'",
      "- Never claim an email was sent. Amounts are Philippine pesos (₱).",
      "",
      "LONG-TERM KNOWLEDGE (grows over time — cite it naturally):",
      JSON.stringify(this.state.knowledge),
      "",
      "COMMERCIAL MEMORY SNAPSHOT:",
      JSON.stringify({
        leads: this.state.leads,
        quotes: this.state.quotes,
        invoices: this.state.invoices,
        followUps: this.state.followUps,
        documents: this.state.documents.map((d) => ({
          filename: d.filename,
          intelligence: d.intelligence,
          extraction: d.extraction,
        })),
      }),
    ].join("\n");

    const cacheKey = `chat:${this.state.updatedAt}:${prompt}`;
    const cached = await this.env.COMMERCIAL_CACHE?.get(cacheKey);
    if (cached) {
      this.finishAssistant(assistant.id, cached);
      return true;
    }

    const openRouterAnswer = await this.openRouterChat([
      { role: "system", content: system },
      ...this.state.messages.slice(-8).map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: prompt },
    ]);
    if (openRouterAnswer) {
      this.finishAssistant(assistant.id, openRouterAnswer);
      await this.env.COMMERCIAL_CACHE?.put(cacheKey, openRouterAnswer, { expirationTtl: 900 });
      this.log("chat.openrouter", { prompt, answer: openRouterAnswer, model: this.openRouterModelFromState() });
      const { knowledge, learned } = learnFromConversation(this.state.knowledge, this.state.messages);
      if (learned.length) {
        this.patch({ knowledge });
        this.archiveFacts(knowledge.facts.slice(0, learned.length));
      }
      return true;
    }

    const stream = (await this.env.AI.run(TEXT_MODEL, {
      stream: true,
      max_tokens: 1200,
      messages: [
        { role: "system", content: system },
        ...this.state.messages.slice(-8).map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: prompt },
      ],
    })) as unknown as ReadableStream;

    const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    let text = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += value;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const chunk = JSON.parse(payload) as { response?: string };
          if (chunk.response) {
            text += chunk.response;
            this.patch({
              messages: this.state.messages.map((m) => (m.id === assistant.id ? { ...m, content: text } : m)),
            });
          }
        } catch {
          /* partial frame */
        }
      }
    }

    this.finishAssistant(assistant.id, text);
    await this.env.COMMERCIAL_CACHE?.put(cacheKey, text, { expirationTtl: 900 });
    this.log("chat", { prompt, answer: text });

    // Passive learning after every turn — TALA is always listening, not
    // just when explicitly told to "learn".
    const { knowledge, learned } = learnFromConversation(this.state.knowledge, this.state.messages);
    if (learned.length) {
      this.patch({ knowledge });
      this.archiveFacts(knowledge.facts.slice(0, learned.length));
    }
    return true;
  }

  private finishAssistant(id: string, content: string) {
    this.patch({
      messages: this.state.messages.map((m) => (m.id === id ? { ...m, content, streaming: false } : m)),
    });
    const final = this.state.messages.find((m) => m.id === id);
    if (final) this.archiveMessage({ ...final, content, streaming: false });
  }

  /* ---------------- Knowledge system — TALA learns and grows ----------- */

  @callable({ description: "Learn customer preferences and facts from the current conversation." })
  async learnFromConversationTurn(company?: string) {
    const { knowledge, learned } = learnFromConversation(this.state.knowledge, this.state.messages, company);
    this.patch({ knowledge });
    this.archiveFacts(knowledge.facts.slice(0, learned.length));
    await this.env.COMMERCIAL_CACHE?.put(
      `knowledge:conversation:${Date.now()}`,
      JSON.stringify({ learned, company: company ?? null }),
      { expirationTtl: 60 * 60 * 24 * 30 },
    );
    this.pushMessage(
      learned.length
        ? `🧠 Natutunan ko po from our conversation:\n${learned.map((l) => `- ${l}`).join("\n")}\n\nSalamat po sa details!`
        : "Wala pa akong bagong natutunan sa chat na 'to po — pero I'm always listening. 😊",
    );
    this.log("knowledge.conversation", { learned, company });
    return { learned };
  }

  @callable({ description: "Analyze a quote outcome (approved/rejected) and update pricing patterns." })
  async learnFromQuoteById(quoteId: string) {
    const quote = this.state.quotes.find((q) => q.id === quoteId);
    if (!quote) return { learned: [] };
    const { knowledge, learned } = learnFromQuote(this.state.knowledge, quote);
    this.patch({ knowledge });
    this.archiveFacts(knowledge.facts.slice(0, 1));
    await this.env.COMMERCIAL_CACHE?.put(
      `knowledge:quote:${quoteId}`,
      JSON.stringify({ learned, outcome: quote.status }),
      { expirationTtl: 60 * 60 * 24 * 90 },
    );
    this.log("knowledge.quote", { quoteId, learned });
    return { learned };
  }

  @callable({ description: "Decline a quote and record the rejection for pricing pattern learning." })
  async declineQuoteById(quoteId: string, reason?: string) {
    const quote = this.state.quotes.find((q) => q.id === quoteId);
    if (!quote) return false;
    const declined: Quote = { ...quote, status: "declined" };
    this.patch({ quotes: this.state.quotes.map((q) => (q.id === quoteId ? declined : q)) });
    const { knowledge, learned } = learnFromQuote(this.state.knowledge, declined);
    this.patch({ knowledge });
    this.pushMessage(
      `Ay, hindi na-approve po si **${quote.ref}** (${quote.customer}). Reason: ${reason ?? "No reason recorded"}. 😔 ${
        learned[0] ?? "Na-record ko na po ito para sa pricing patterns natin."
      }`,
    );
    this.log("quote.declined", { quoteId, reason });
    return declined;
  }

  @callable({ description: "Answer a question by searching TALA's long-term knowledge base." })
  async answerFromMemoryQuery(query: string) {
    const cacheKey = `knowledge:answer:${JSON.stringify(this.state.knowledge.stats)}:${query}`;
    const cached = await this.env.COMMERCIAL_CACHE?.get(cacheKey);
    const answer = cached ?? answerFromMemory(this.state, query);
    if (!cached) await this.env.COMMERCIAL_CACHE?.put(cacheKey, answer, { expirationTtl: 900 });

    const userMsg: ChatMessage = { id: uid("msg"), role: "user", content: query, createdAt: new Date().toISOString() };
    const assistantMsg: ChatMessage = {
      id: uid("msg"),
      role: "assistant",
      content: answer,
      createdAt: new Date().toISOString(),
    };
    this.patch({ messages: [...this.state.messages, userMsg, assistantMsg] });
    this.archiveMessage(userMsg);
    this.archiveMessage(assistantMsg);
    this.log("knowledge.query", { query });
    return { answer };
  }

  @callable({ description: "Analyze learned patterns and suggest pricing or process improvements." })
  async runSuggestImprovements() {
    const { knowledge, suggestions } = suggestImprovements(this.state.knowledge);
    this.patch({ knowledge });
    this.pushMessage(
      suggestions.length
        ? `📈 Here are my suggestions based on patterns I've learned po:\n\n${suggestions
            .slice(0, 4)
            .map((s) => `**${s.title}**\n${s.detail} _(confidence ${Math.round(s.confidence * 100)}%)_`)
            .join("\n\n")}`
        : "Wala pa akong sapat na data para mag-suggest ng improvements po. Keep quoting and I'll spot patterns as they appear! 🌱",
    );
    this.log("knowledge.suggestions", { count: suggestions.length });
    return { suggestions };
  }

  @callable({ description: "Extract lead business details from a public Google Business, Facebook, or website URL." })
  async extractLeadFromUrl(url: string) {
    let parsed: URL;
    try {
      parsed = new URL(url.trim().startsWith("http") ? url.trim() : `https://${url.trim()}`);
    } catch {
      throw new Error("Could not extract data from this URL. Please enter manually.");
    }

    let pageText = "";
    try {
      const response = await fetch(parsed.toString(), {
        headers: { "User-Agent": "AzarragaGlassLeadExtractor/1.0" },
      });
      const html = await response.text();
      pageText = html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .slice(0, 24_000);
    } catch {
      pageText = `URL only: ${parsed.toString()}`;
    }

    const prompt = `Extract lead data for Azarraga Glass & Aluminum from this public business URL. Return ONLY JSON with keys: company, contact, email, phone, location, project, industry, nextAction, confidence. If a field is missing use empty string. URL: ${parsed.toString()} TEXT: ${pageText}`;
    const ai = await this.openRouterChat([{ role: "user", content: prompt }]);

    if (ai) {
      try {
        const extracted = JSON.parse(this.extractJsonObject(ai)) as Record<string, unknown>;
        return {
          company: String(extracted.company ?? ""),
          contact: String(extracted.contact ?? ""),
          email: String(extracted.email ?? ""),
          phone: String(extracted.phone ?? ""),
          location: String(extracted.location ?? "Palawan"),
          project: String(extracted.project ?? extracted.industry ?? "Website lead"),
          nextAction: String(extracted.nextAction ?? "Verify contact details and qualify glass/aluminum scope"),
          sourceUrl: parsed.toString(),
          confidence: Number(extracted.confidence ?? 0.6),
        };
      } catch {
        // Fall through to deterministic extraction below.
      }
    }

    const host = parsed.hostname.replace(/^www\./, "");
    const path = decodeURIComponent(parsed.pathname.replace(/\+/g, " "));
    const isFacebook = /facebook\.com|fb\.com/i.test(host);
    const isGoogle = /google\.|goo\.gl|maps\.app\.goo\.gl/i.test(host);
    const placeMatch = path.match(/\/place\/([^/]+)/i);
    const q = parsed.searchParams.get("q") || parsed.searchParams.get("query") || "";
    const rawName = placeMatch?.[1] || (isFacebook ? path.split("/").filter(Boolean)[0] : "") || q || host.split(".")[0];
    const company = rawName.replace(/[-_]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()).replace(/\s+/g, " ").trim();
    if (!company || company.length < 2) throw new Error("Could not extract data from this URL. Please enter manually.");
    const fullText = `${host} ${path} ${q} ${pageText}`.toLowerCase();
    const location = fullText.includes("el nido") || fullText.includes("elnido")
      ? "El Nido, Palawan"
      : fullText.includes("puerto") || fullText.includes("princesa")
        ? "Puerto Princesa, Palawan"
        : fullText.includes("palawan")
          ? "Palawan"
          : "Palawan";
    const project = fullText.includes("hotel") || fullText.includes("hostel") || fullText.includes("resort")
      ? "Hotel / resort glass and aluminum scope"
      : fullText.includes("restaurant") || fullText.includes("cafe")
        ? "Commercial storefront glazing"
        : fullText.includes("construction") || fullText.includes("trading")
          ? "Contractor / project account"
          : isGoogle
            ? "Google Business lead"
            : isFacebook
              ? "Facebook business lead"
              : "Website lead";
    return {
      company,
      contact: "",
      email: pageText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "",
      phone: pageText.match(/(?:\+?63|0)\s?9\d{2}[\s.-]?\d{3}[\s.-]?\d{4}/)?.[0] ?? "",
      location,
      project,
      nextAction: "Verify contact details and qualify glass/aluminum scope",
      sourceUrl: parsed.toString(),
      confidence: 0.45,
    };
  }

  /* ---------------- Agentic layer: acts without being asked ------------
   * Invoked automatically every AUTONOMOUS_CYCLE_SECONDS via
   * `this.scheduleEvery()` (registered once, idempotently, in onStart()).
   * Also reachable manually as the `runDueFollowUps` RPC for an immediate
   * "check now" button on the dashboard.
   * ------------------------------------------------------------------- */
  @callable({ description: "Autonomous cycle: draft overdue follow-ups and surface new insights, unprompted." })
  async runAutonomousCycle() {
    const due: FollowUpTask[] = detectDueFollowUps(this.state);
    const beforeSuggestionCount = this.state.knowledge.suggestions.length;

    if (due.length) {
      this.patch({ followUps: mergeFollowUps(this.state.followUps, due) });
      this.pushMessage(
        `👀 Proactive check po — I noticed ${due.length} item${due.length === 1 ? "" : "s"} that need follow-up:\n${due
          .slice(0, 3)
          .map((f) => `- **${f.title}** — ${f.detail}`)
          .join("\n")}\n\nDrafted na po ang messages, nasa **Needs your attention** na lang para sa approval niyo. Wala pa akong ipapadala nang wala kayong go-signal! 🙏`,
      );
      this.log("autonomous.followups", { count: due.length });
    }

    const { knowledge, suggestions } = suggestImprovements(this.state.knowledge);
    this.patch({ knowledge, lastAutonomousRunAt: new Date().toISOString() });
    if (suggestions.length > beforeSuggestionCount) {
      const fresh = suggestions.slice(0, suggestions.length - beforeSuggestionCount);
      this.pushMessage(
        `💡 Bago kong napansin po (walang tinanong!): **${fresh[0].title}**\n${fresh[0].detail}\n\nTingnan niyo po sa dashboard, may iba pa akong suggestions doon. 📈`,
      );
      this.log("autonomous.suggestions", { count: fresh.length });
    }

    return { followUpsDrafted: due.length, newSuggestions: Math.max(0, suggestions.length - beforeSuggestionCount) };
  }

  @callable({ description: "Approve a drafted follow-up so it is ready to send through a connected channel." })
  async approveFollowUpById(id: string) {
    const task = this.state.followUps.find((f) => f.id === id);
    if (!task) return false;
    this.patch({ followUps: this.state.followUps.map((f) => (f.id === id ? { ...f, status: "approved" } : f)) });
    this.pushMessage(
      `Salamat po! ✅ Follow-up for **${task.relatedLabel ?? task.title}** approved. Draft ready na po to send — sabihin niyo lang kung paano niyo gustong ipadala (email/WhatsApp/SMS). 📤`,
    );
    this.log("followup.approved", { id });
    return true;
  }

  @callable({ description: "Dismiss a drafted follow-up without sending it." })
  async dismissFollowUpById(id: string) {
    this.patch({ followUps: this.state.followUps.map((f) => (f.id === id ? { ...f, status: "dismissed" } : f)) });
    this.log("followup.dismissed", { id });
    return true;
  }

  /* ---------------- R2 + Workers AI vision: document learning ---------- */

  async storeDocument(file: File): Promise<DocumentRecord> {
    const key = `${this.name}/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
    await this.env.DOCUMENTS.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
    const doc: DocumentRecord = {
      id: uid("doc"),
      filename: file.name,
      mime: file.type,
      sizeBytes: file.size,
      intelligence: "PROCESSING",
      storage: "private",
      uploadedAt: new Date().toISOString(),
      r2Key: key,
    };
    this.patch({ documents: [doc, ...this.state.documents] });
    await this.schedule(1, "learnDocument", doc.id);
    return doc;
  }

  async learnDocument(documentId: string) {
    const doc = this.state.documents.find((d) => d.id === documentId);
    if (!doc) return false;

    this.patch({ documents: this.state.documents.map((d) => (d.id === documentId ? { ...d, intelligence: "PROCESSING" } : d)) });

    const object = await this.env.DOCUMENTS.get(doc.r2Key);
    if (!object) {
      this.patch({ documents: this.state.documents.map((d) => (d.id === documentId ? { ...d, intelligence: "FAILED" } : d)) });
      return false;
    }

    const bytes = [...new Uint8Array(await object.arrayBuffer())];
    const prompt = GLASS_INVOICE_PROMPT.replace(
      "[INSERT RAW INVOICE TEXT / OCR STREAM HERE]",
      "Extract from this invoice, purchase order, quotation, delivery receipt, or specification image. If OCR text is unclear, use null and route to human review.",
    );
    let responseText: string | undefined;

    if (this.env.OPENROUTER_API_KEY) {
      try {
        let binary = "";
        const uint8 = new Uint8Array(bytes);
        for (let i = 0; i < uint8.length; i += 0x8000) {
          binary += String.fromCharCode(...uint8.subarray(i, i + 0x8000));
        }
        const base64 = btoa(binary);
        responseText =
          (await this.openRouterChat(
            [
              {
                role: "user",
                content: [
                  { type: "text", text: prompt },
                  { type: "image_url", image_url: { url: `data:${doc.mime || "image/jpeg"};base64,${base64}` } },
                ],
              },
            ],
            this.env.OPENROUTER_VISION_MODEL || DEFAULT_OPENROUTER_VISION_MODEL,
          )) ?? undefined;
      } catch {
        responseText = undefined;
      }
    }

    if (!responseText) {
      const result = (await this.env.AI.run(VISION_MODEL, {
        image: bytes,
        max_tokens: 4096,
        prompt,
      })) as { response?: string };
      responseText = result.response;
    }

    let extraction: DocumentRecord["extraction"];
    try {
      const raw = responseText ?? "";
      const jsonText = this.extractJsonObject(raw);
      const json = JSON.parse(jsonText);
      extraction = {
        ...json,
        status: "LEARNED",
        humanReview: json.reviewStatus === "FAIL" || json.missing?.length || json.conflicts?.length ? "Required" : "Not required",
        reviewStatus: json.reviewStatus ?? json.audit?.reviewStatus ?? "FAIL",
        reviewReason: json.reviewReason ?? json.audit?.reason ?? "No review reason supplied by extractor.",
        currency: json.currency ?? json.audit?.currency ?? "PHP",
        provenance: {
          bucket: "commercial-documents",
          path: doc.r2Key,
          mime: doc.mime,
          bytes: doc.sizeBytes,
          version: "tala-document-v1",
          learnedAt: new Date().toISOString(),
        },
      };
    } catch {
      extraction = undefined;
    }

    const finalDoc: DocumentRecord = { ...doc, intelligence: extraction ? "LEARNED" : "STORED", extraction };
    this.patch({ documents: this.state.documents.map((d) => (d.id === documentId ? finalDoc : d)) });

    if (extraction) {
      const { knowledge, learned } = learnFromDocument(this.state.knowledge, finalDoc);
      this.patch({ knowledge });
      this.archiveFacts(knowledge.facts.slice(0, 1));
      await this.env.COMMERCIAL_CACHE?.put(`knowledge:document:${documentId}`, JSON.stringify({ learned }), {
        expirationTtl: 60 * 60 * 24 * 180,
      });
      this.log("knowledge.document", { documentId, learned });
    }

    this.log("document.learned", { documentId, learned: Boolean(extraction) });
    return true;
  }

  /** HTTP surface of the agent: upload, signed original access, permanent transcript export. */
  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname.endsWith("/upload")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return new Response("file required", { status: 400 });
      return Response.json(await this.storeDocument(file));
    }

    if (request.method === "GET" && url.pathname.includes("/original/")) {
      const key = decodeURIComponent(url.pathname.split("/original/")[1]);
      const object = await this.env.DOCUMENTS.get(key);
      if (!object) return new Response("not found", { status: 404 });
      return new Response(object.body, {
        headers: {
          "content-type": object.httpMetadata?.contentType ?? "application/octet-stream",
          "cache-control": "private, max-age=60",
        },
      });
    }

    // Full, unbounded conversation history — proof that memory survives
    // beyond the trimmed `state.messages` window broadcast over WebSocket.
    if (request.method === "GET" && url.pathname.endsWith("/history")) {
      const rows = this.sql`SELECT id, role, content, created_at FROM messages_log ORDER BY created_at ASC`;
      return Response.json({ messages: rows });
    }

    return Response.json(this.state);
  }
}
