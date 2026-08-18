import { createInitialState } from "./seed";
import {
  answerFromMemory as answerFromMemoryEngine,
  learnFromConversation as learnFromConversationEngine,
  learnFromDocument as learnFromDocumentEngine,
  learnFromQuote as learnFromQuoteEngine,
  suggestImprovements as suggestImprovementsEngine,
} from "./knowledge";
import { detectDueFollowUps, mergeFollowUps } from "./followups";
import type {
  AzarragaState,
  FollowUpTask,
  Invoice,
  Lead,
  Quote,
  QuoteLine,
  QuickReply,
  TalaMood,
} from "./types";

export const peso = (n: number) =>
  "₱" +
  n.toLocaleString("en-PH", { minimumFractionDigits: n % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 });

export const peso2 = (n: number) =>
  "₱" + n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 10)}`;
export const lineTotal = (l: QuoteLine) => l.qty * l.unitPrice;
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export type QuickActionKey = "leads" | "email" | "customers" | "money" | "documents" | "pricing";

export const QUICK_ACTION_PROMPTS: Record<QuickActionKey, string> = {
  leads:
    "Using only recorded leads and their stages, rank the next actions I should take today. Do not invent opportunities.",
  email:
    "Using only recorded leads, customers and contacts, identify who needs an email follow-up and draft a short follow-up for each. Show the recorded email address when present; say it is absent when missing. Do not claim anything was sent.",
  customers:
    "Review the recorded customer accounts and summarise the status of each using only stored commercial records.",
  money:
    "List the money owed to Azarraga from recorded invoices and prioritise collections. Use recorded balances only.",
  documents: "Summarise every learned document and what TALA extracted from each one.",
  pricing:
    "Trace PO and pricing evidence back to the exact source document lines that support it.",
};

export const TALA_GREETINGS = [
  "Kumusta po! 👋 I'm TALA from Azarraga Glass & Aluminum. How can I help with your project today?",
  "Good morning po! 🌅 TALA here. Ready to help with your glass and aluminum needs.",
  "Hi po! 👋 TALA speaking. What project are you working on today? I can get you a quote quickly.",
];

export const TALA_UPLOADS = [
  "Ang ganda! 📸 I can see the openings clearly. I'm extracting measurements now... Wait lang po, this will be quick!",
  "Nice photos! 🖼️ These are perfect. Let me analyze them for you po. I'm measuring everything now.",
  "Salamat po! 📷 Great photos. I'm measuring everything now. Medyo malaki ang sliding door na 'to (This sliding door is quite big).",
];

export const TALA_PROCESSING = [
  "Wait lang po... I'm measuring the openings. This will just take a moment. 🤔",
  "Working on it po... 🔍 Analyzing the photos and calculating dimensions. Medyo busy lang!",
  "One moment po... I'm checking the measurements against our pricing. 🧊",
];

export const TALA_QUOTE_DONE = [
  "Ready na po! ✅ I've prepared the quotation. Total is {{total}}. Check niyo lang po sa dashboard and approve if okay. Salamat po!",
  "TAPOS NA! 📊 Quote is ready po — {{ref}} for {{customer}} worth {{total}}. Review and approve lang po, then I'll send to customer.",
  "Quote done po! 🎉 I can send this to the customer once you approve. Total {{total}} for {{project}}. Ang ganda ng project na 'to!",
];

export const TALA_NO_EMAIL = [
  "Ay, walang email address si customer. 📧 Could you add one po so I can send the quote?",
  "Need ko po ng email para ma-send ang quote. ✉️ Pwede niyo po i-add? Walang email recorded eh.",
  "Customer has no email recorded po. 😅 Can you add it so I can send the quotation? Salamat po!",
];

export const TALA_PALAWAN = [
  "Maraming projects sa Palawan ngayon! 🏝️ Lots of beachfront glass installations. Would you like me to prioritize leads from Puerto Princesa po?",
  "El Nido is booming! 🌴 I'm seeing many inquiries from there. Shall I focus on those beachfront projects?",
  "I noticed many inquiries from Palawan. 🌊 Do you want me to focus on those first po? Madami kami projects diyan!",
];

export const TALA_CONFIRMATIONS = [
  "Salamat po! ✅ I'll add this to the approval queue. Na-save ko na!",
  "Na-save ko na po! 📥 It's now waiting for your approval. I'll notify you pag ready na.",
  "Done po! 🎯 I've saved everything. You can review it in your dashboard. Salamat po!",
];

export const TALA_NO_LEADS = [
  "Wala pang leads po. 📭 But I'm ready when they come in! I'm excited to help with your first Palawan project.",
  "No leads recorded yet po. 🤗 Once customers message, I'll add them right away. Waiting lang po!",
  "Waiting for new inquiries po. 🤗 I'll let you know as soon as someone reaches out. Maraming opportunities sa Palawan ngayon!",
];

export const TALA_TYPING_STATUSES = [
  "TALA is analyzing photos... 📸",
  "TALA is measuring openings... 📏",
  "TALA is drafting quotation... 📊",
  "TALA is checking commercial memory... 🧠",
  "TALA is reviewing customer history... 👥",
  "TALA is calculating glass specs... 🧊",
];

export const TALA_QUICK_REPLIES: Record<string, QuickReply[]> = {
  default: [
    { label: "Create a quote 📋", prompt: "Prepare a new quotation for me" },
    { label: "Check my documents 📁", prompt: "Summarise my learned documents" },
    { label: "Palawan leads? 🏝️", prompt: "Any Palawan opportunities?" },
    { label: "Send follow-up ✉️", prompt: "Who needs email follow-up?" },
  ],
  greeting: [
    { label: "Show my leads 🔍", prompt: "Show my leads" },
    { label: "New quotation ✨", prompt: "I want to create a new quotation" },
    { label: "Upload PO 📸", prompt: "I want to upload a purchase order" },
    { label: "Palawan jobs 🌴", prompt: "Any Palawan opportunities?" },
  ],
  afterUpload: [
    { label: "Extract line items 🔍", prompt: "Extract every line item from the latest document" },
    { label: "Create quote from PO 📊", prompt: "Create a quote from this PO" },
    { label: "Check pricing evidence 💰", prompt: "Trace PO pricing evidence" },
  ],
  quoteDone: [
    { label: "Approve quote ✅", prompt: "Approve the latest quotation" },
    { label: "Issue invoice 🧾", prompt: "Issue an invoice from the latest quote" },
    { label: "Send follow-up ✉️", prompt: "Draft follow-up for this customer" },
  ],
  noEmail: [
    { label: "Add email 📧", prompt: "I want to add customer email" },
    { label: "Show customer 📋", prompt: "Review customer accounts" },
    { label: "Call instead 📞", prompt: "Show me customer contact numbers" },
  ],
  knowledge: [
    { label: "Ask my memory 🧠", prompt: "What do you remember about our customers?" },
    { label: "Suggest improvements 📈", prompt: "Suggest improvements from what you've learned" },
    { label: "Pricing patterns 💰", prompt: "What price worked for similar projects?" },
    { label: "Supplier lookup 🏗️", prompt: "Who is our supplier for 6mm clear glass?" },
  ],
};

export function getMoodFromContent(content: string, streaming: boolean): TalaMood {
  const c = content.toLowerCase();
  if (streaming) {
    if (c.includes("photo") || c.includes("image") || c.includes("opening") || c.includes("measuring"))
      return "analyzing";
    if (c.includes("draft") || c.includes("quotation") || c.includes("calculat")) return "processing";
    return "processing";
  }
  if (c.includes("ay,") || c.includes("walang") || c.includes("no email") || c.includes("nothing recorded"))
    return "confused";
  if (c.includes("ready na") || c.includes("tapos na") || c.includes("done po") || c.includes("🎉") || c.includes("✅"))
    return "happy";
  if (c.includes("busy") || c.includes("many") || c.includes("maraming")) return "busy";
  if (c.includes("salamat") || c.includes("kumusta")) return "speaking";
  return "idle";
}

function personalize(raw: string, ctx?: { total?: string; ref?: string; customer?: string; project?: string; id?: string }) {
  let s = raw;
  if (ctx?.total) s = s.split("{{total}}").join(ctx.total);
  if (ctx?.ref) s = s.split("{{ref}}").join(ctx.ref);
  if (ctx?.customer) s = s.split("{{customer}}").join(ctx.customer);
  if (ctx?.project) s = s.split("{{project}}").join(ctx.project);
  if (ctx?.id) s = s.split("{{id}}").join(ctx.id);
  return s;
}

function pickQuickReplies(content: string): QuickReply[] {
  const c = content.toLowerCase();
  if (c.includes("no email") || c.includes("walang email")) return TALA_QUICK_REPLIES.noEmail;
  if (c.includes("quotation") || c.includes("quote")) return TALA_QUICK_REPLIES.quoteDone;
  if (c.includes("upload") || c.includes("r2 bucket")) return TALA_QUICK_REPLIES.afterUpload;
  if (c.includes("kumusta") || c.includes("hello") || c.includes("snapshot")) return TALA_QUICK_REPLIES.greeting;
  return TALA_QUICK_REPLIES.default;
}

/* ------------------------------------------------------------------ *
 * Grounded + personality response generator
 * ------------------------------------------------------------------ */
export function groundedReply(state: AzarragaState, prompt: string): string {
  const p = prompt.toLowerCase().trim();
  const learned = state.documents.filter((d) => d.intelligence === "LEARNED");
  const customers = Array.from(
    new Set([
      ...state.leads.map((l) => l.company),
      ...state.quotes.map((q) => q.customer),
      ...state.invoices.map((i) => i.customer),
      ...learned.map((d) => d.extraction?.buyer.name ?? ""),
    ].filter(Boolean)),
  );

  // --- Knowledge-recall questions route straight to the memory engine ---
  // e.g. "What was the glass thickness for Tagusao?", "Who is our supplier
  // for 6mm clear glass?", "What price worked for similar projects?",
  // "Generate a quote similar to Tara Hostel".
  const isMemoryQuestion =
    /\bwhat (was|is|were)\b/.test(p) ||
    /\bwho is our supplier\b|\bsupplier for\b/.test(p) ||
    /\bprice that worked\b|\bworked for similar\b/.test(p) ||
    /\bsimilar to\b|\bclone\b|\bremember\b/.test(p) ||
    (/\bglass\b/.test(p) && /\bthickness\b|\btype\b/.test(p));
  if (isMemoryQuestion) {
    return answerFromMemoryEngine(state, p);
  }

  // --- Greetings — only for short casual hellos ---
  if (/^(hi|hello|kumusta|good morning|good afternoon|hey|magandang)/i.test(p) && p.length < 60) {
    return `${pick(TALA_GREETINGS)}

Quick snapshot po from commercial memory:
- Active leads: **${state.leads.length}**
- Quotes: **${state.quotes.length}** — pipeline **${peso(state.quotes.reduce((s, q) => s + q.subtotal, 0))}**
- Invoices: **${state.invoices.length}**
- Documents: **${state.documents.length}** (${learned.length} learned)

Ask me about Palawan projects, customers, or I can create a new quotation for you po! 😊`;
  }

  if (p.includes("email") || p.includes("follow-up") || p.includes("follow up") || p.includes("draft message")) {
    if (!state.leads.length) {
      return `${pick(TALA_NO_EMAIL)}

Status check po:
| Entity | Recorded Email |
|---|---|
| **TAGUSAO CONSTRUCTION AND TRADING INC.** | *no email address recorded* (field is \`null\`) |
| **Leads** | None recorded po — ${pick(TALA_NO_LEADS)} |
| **Contacts** | None recorded |

Draft I prepared (not sent — I'll wait for you po):

> *Subject: Follow-up – Tara Hostel-Elnido Glass & Aluminum Inquiry*
> 
> Kumusta po! 👋 Just checking in regarding the glass and aluminum scope for the Tara Hostel-Elnido project. Medyo excited kami sa beachfront installation!
> 
> Please let me know po if you have questions. I'm here to help.
> 
> Salamat po!  
> TALA – Commercial Agent, Azarraga Glass & Aluminum 🏝️`;
    }
    const rows = state.leads
      .map((l) => `| **${l.company}** | ${l.email ?? "*no email po — " + pick(TALA_NO_EMAIL) + "*"} |`)
      .join("\n");
    return `Sure po! Let me check who needs follow-up... 🔍

| Entity | Email |
|---|---|
${rows}

${state.leads.some((l) => !l.email) ? pick(TALA_NO_EMAIL) : "All good po! May email lahat. 📧"}`;
  }

  if (p.includes("lead") || p.includes("next action") || p.includes("rank") || p.includes("opportunit")) {
    if (!state.leads.length) {
      return `${pick(TALA_NO_LEADS)}

But I found something po that could seed a lead:
- **TAGUSAO CONSTRUCTION AND TRADING INC.** — buyer on learned PO \`TCAT04001\` (TARA HOSTEL-ELNIDO, ${peso2(905000)}). Beachfront hostel project in El Nido! 🏝️

Gusto niyo po ba I add as a lead? I can do it now — just say "add TAGUSAO as lead" po.`;
    }
    return `Got it po! Here are your prioritized next actions — sorted by value, highest first. 🎯

${state.leads
      .slice()
      .sort((a, b) => b.value - a.value)
      .map(
        (l, i) =>
          `${i + 1}. **${l.company}** — ${l.project} (${l.location}) · stage \`${l.stage}\` · ${peso(l.value)}\n   👉 ${l.nextAction}${
            l.email ? "" : `\n   ${pick(TALA_NO_EMAIL)} — call ${l.phone ?? "the recorded number"} instead po 📞`
          }`,
      )
      .join("\n\n")}

All from Durable Object commercial memory po — nothing invented! Salamat po. 😊`;
  }

  if (p.includes("customer") || p.includes("account") || p.includes("review") && p.includes("status")) {
    return `Kumusta po! Here's your customer overview from commercial memory 🏗️

Total **${customers.length}** customer${customers.length === 1 ? "" : "s"} po:

${
  customers.length
    ? customers
        .map((c) => {
          const q = state.quotes.filter((x) => x.customer === c);
          const inv = state.invoices.filter((x) => x.customer === c);
          const owed = inv.reduce((s, x) => s + x.balance, 0);
          return `- **${c}** — ${q.length} quotation${q.length === 1 ? "" : "s"}, ${inv.length} invoice${inv.length === 1 ? "" : "s"}, outstanding **${peso2(owed)}**`;
        })
        .join("\n")
    : `- ${pick(TALA_NO_LEADS)}`
}

Source po: Durable Object \`AzarragaAgent\` state + ${learned.length} learned document${learned.length === 1 ? "" : "s"} in R2 bucket \`commercial-documents\`. ✅`;
  }

  if (p.includes("money") || p.includes("owed") || p.includes("collect") || p.includes("receiv") || p.includes("balance") || p.includes("prioriti")) {
    const owed = state.invoices.reduce((s, i) => s + i.balance, 0);
    if (!state.invoices.length) {
      return `Wala pong receivables yet — **${peso2(0)}** across 0 billing records. 📭

${pick(TALA_NO_LEADS)}

Once you approve a quotation po, I can issue an invoice and track collections for you. Salamat po!`;
    }
    return `Collection priority po — sorted by biggest balance first 💰

**Total owed: ${peso2(owed)} across ${state.invoices.length} invoices**

${state.invoices
      .slice()
      .sort((a, b) => b.balance - a.balance)
      .map(
        (i, idx) =>
          `${idx + 1}. **${i.ref}** — ${i.customer} · ${i.project}\n   Balance **${peso2(i.balance)}** of ${peso2(i.amount)} · due ${i.dueDate} · \`${i.status}\``,
      )
      .join("\n\n")}

Gusto niyo po ba I draft follow-up emails for overdue ones? 😊`;
  }

  if (p.includes("document") || p.includes("file") || p.includes("learned") || p.includes("summarise") || p.includes("summarize")) {
    return `Sige po! Here's what's in our private R2 bucket \`commercial-documents\` 📁

Total **${state.documents.length}** — learned: **${learned.length}** po

${state.documents
      .map(
        (d) =>
          `- **${d.filename}** — \`${d.intelligence}\` · ${d.mime} · ${Math.round(d.sizeBytes / 1024)} KB · private storage${
            d.extraction
              ? `\n  ↳ PO **${d.extraction.mrsNumber}** · ${d.extraction.buyer.name} · ${d.extraction.project.name} · ${d.extraction.lines.length} lines · total **${peso2(d.extraction.financial.documentTotal)}** 🏝️`
              : "\n  ↳ No extraction yet po — press Reprocess and I'll analyze it! 🔍"
          }`,
      )
      .join("\n")}

Everything remains authoritative po — you can open **Documents → Intelligence** to compare original beside TALA's extraction. Salamat po!`;
  }

  // PO / pricing — use word boundaries to avoid matching "po" in every prompt
  if (/\bpurchase order\b/.test(p) || /\bpric(e|ing|evidence)\b/.test(p) || p.includes("tara hostel") || /\btrace\b/.test(p) || /\bsource\b.*\bevidence\b/.test(p)) {
    const doc = learned[0];
    if (!doc?.extraction) {
      return `Ay, no learned PO yet po. 😅 Upload a PO and I'll extract every line item — dimensions, glass type, pricing evidence, all traced back to source.

${pick(TALA_PALAWAN)}`;
    }
    const f = doc.extraction.financial;
    return `Found it po! Source evidence — **PO ${doc.extraction.mrsNumber}** for **${doc.extraction.project.name}** 🏨

File: \`${doc.filename}\` (${doc.mime}, ${doc.sizeBytes} bytes)  
Bucket: \`${doc.extraction.provenance.bucket}\` → \`${doc.extraction.provenance.path}\`  
Learned: \`${doc.extraction.provenance.learnedAt}\` with \`${doc.extraction.provenance.version}\`

| Item | Amount po |
|---|---|
| Product subtotal | ${peso2(f.productSubtotal)} |
| VAT | ${peso2(f.vat)} |
| Crating / shipping / trucking | ${peso2(f.crating)} / ${peso2(f.shipping)} / ${peso2(f.trucking)} |
| Document total | **${peso2(f.documentTotal)}** |

**${doc.extraction.lines.length}** raw lines remain verbatim including \`*NOTHING FOLLOWS*\` — nothing normalised away po! Open **Documents → Intelligence** to compare beside the original. Salamat po! 😊`;
  }

  if (p.includes("palawan") || p.includes("puerto princesa") || p.includes("el nido") || p.includes("beachfront")) {
    return `${pick(TALA_PALAWAN)}

Quick stats po:
- Active leads in Palawan: **${state.leads.filter((l) => /palawan|princesa|elnido|el nido/i.test(l.location)).length}**
- Pipeline: **${peso(state.quotes.reduce((s, q) => s + q.subtotal, 0))}**
- Learned beachfront docs: **${learned.length}**

Want me to prioritize Puerto Princesa first po? 🌴`;
  }

  if (p.includes("quotation") || p.includes("quote") || p.includes("prepare")) {
    if (!state.quotes.length) {
      return `No quotations in the pipeline yet po. 📋 Use the **+ New quote** button above to build a multi-line quotation. I'll auto-price openings from our Azarraga rate card po!

${pick(TALA_PALAWAN)}`;
    }
    return `Pipeline update po! 📊

**${state.quotes.length}** quotation${state.quotes.length === 1 ? "" : "s"} in pipeline — **${peso(state.quotes.reduce((s, q) => s + q.subtotal, 0))}** total:

${state.quotes
      .map(
        (q) =>
          `- **${q.ref}** — ${q.customer} · ${q.project} · **${peso2(q.subtotal)}** · \`${q.status}\``,
      )
      .join("\n")}

Approve, send, or issue invoice po — use the actions in the Quotes tab! Salamat po. 😊`;
  }

  if (p.includes("invoice") || p.includes("billing") || p.includes("payment")) {
    const owed = state.invoices.reduce((s, i) => s + i.balance, 0);
    if (!state.invoices.length) {
      return `No billing records yet po. 🧾 Approve a quotation first, then I can issue an invoice for you. Salamat po!`;
    }
    return `Billing summary po 🧾

**${state.invoices.length}** invoice${state.invoices.length === 1 ? "" : "s"} — total owed: **${peso2(owed)}**

${state.invoices
      .map(
        (i) =>
          `- **${i.ref}** — ${i.customer} · **${peso2(i.balance)}** balance of ${peso2(i.amount)} · due ${i.dueDate} · \`${i.status}\``,
      )
      .join("\n")}

Need me to record a payment or draft follow-ups po? 😊`;
  }

  // Default — grounded snapshot with personality
  return `${pick(TALA_GREETINGS)}

Here's your commercial memory snapshot po 📊

- Active leads: **${state.leads.length}** ${state.leads.length === 0 ? `— ${pick(TALA_NO_LEADS)}` : ""}
- Quotations in pipeline: **${peso(state.quotes.reduce((s, q) => s + q.subtotal, 0))}** across ${state.quotes.length}
- Receivables: **${peso(state.invoices.reduce((s, i) => s + i.balance, 0))}** across ${state.invoices.length}
- Documents: **${state.documents.length}** (${learned.length} learned) — all in R2 private storage 🔒
- Model: \`${state.model}\`

I'm TALA, your commercial teammate at Azarraga Glass & Aluminum in Palawan po. Ask me about leads, customers, quotes, documents, pricing evidence, or Palawan opportunities. Salamat po! 🙏`;
}

/* ------------------------------------------------------------------ *
 * Local mirror of the Durable Object — same reducer the Worker runs.
 * React subscribes to state changes via .subscribe(setState).
 * ------------------------------------------------------------------ */

function makeTalaMessage(
  content: string,
  mood: TalaMood = "happy",
  quickReplies: QuickReply[] = TALA_QUICK_REPLIES.default,
): AzarragaState["messages"][number] {
  return {
    id: uid("msg"),
    role: "assistant",
    content,
    createdAt: new Date().toISOString(),
    mood,
    quickReplies,
  };
}

export class LocalAzarragaAgent {
  state: AzarragaState;
  private listeners = new Set<(s: AzarragaState) => void>();
  private timers: number[] = [];
  private heartbeat: number | null = null;
  private lastSuggestionCount = 0;

  constructor() {
    const base = createInitialState();
    this.state = {
      ...base,
      messages: [
        {
          id: "msg_ready",
          role: "assistant" as const,
          content:
            pick(TALA_GREETINGS) +
            "\n\nReady na po! I'm TALA — your commercial teammate at Azarraga Glass & Aluminum in Palawan. 🏝️ I remember every customer, I track leads, I read PO photos, and I speak Taglish with po/opo.\n\nTry a quick action below or just type — Kumusta ang project niyo today? 😊",
          createdAt: new Date().toISOString(),
          mood: "happy" as TalaMood,
          quickReplies: TALA_QUICK_REPLIES.greeting,
        },
      ],
    };
    this.lastSuggestionCount = this.state.knowledge.suggestions.length;

    // Simulates the Cloudflare Durable Object recurring alarm
    // (`this.schedule(interval, "runDueFollowUps")`). In production this
    // loop runs inside the Worker and survives hibernation; here it keeps
    // the local dev mirror feeling equally autonomous.
    this.heartbeat = window.setInterval(() => this.runAutonomousCycle(), 45_000);
  }

  /** Runs without any user action: drafts follow-ups + surfaces new insights. */
  private runAutonomousCycle(): void {
    const due: FollowUpTask[] = detectDueFollowUps(this.state);
    if (due.length) {
      this.setState({ followUps: mergeFollowUps(this.state.followUps, due) });
      this.pushAssistant(
        `👀 Proactive check po — I noticed ${due.length} item${due.length === 1 ? "" : "s"} that need follow-up:\n${due
          .slice(0, 3)
          .map((f) => `- **${f.title}** — ${f.detail}`)
          .join("\n")}\n\nDrafted na po ang messages, nasa **Needs your attention** na lang para sa approval niyo. Wala pa akong ipapadala nang wala kayong go-signal! 🙏`,
        "busy",
        TALA_QUICK_REPLIES.knowledge,
      );
    }

    const { knowledge, suggestions } = suggestImprovementsEngine(this.state.knowledge);
    this.setState({ knowledge, lastAutonomousRunAt: new Date().toISOString() });
    if (suggestions.length > this.lastSuggestionCount) {
      const fresh = suggestions.slice(0, suggestions.length - this.lastSuggestionCount);
      this.pushAssistant(
        `💡 Bago kong napansin po (walang tinanong!): **${fresh[0].title}**\n${fresh[0].detail}\n\nTingnan niyo po sa dashboard, may iba pa akong suggestions doon. 📈`,
        "happy",
        TALA_QUICK_REPLIES.knowledge,
      );
    }
    this.lastSuggestionCount = suggestions.length;
  }

  subscribe(fn: (s: AzarragaState) => void) {
    this.listeners.add(fn);
    fn(this.state);
    return () => {
      this.listeners.delete(fn);
    };
  }

  setState(patch: Partial<AzarragaState>) {
    this.state = { ...this.state, ...patch, updatedAt: new Date().toISOString() };
    for (const fn of this.listeners) fn(this.state);
  }

  private pushAssistant(content: string, mood: TalaMood = "happy", quickReplies?: QuickReply[]) {
    this.setState({ messages: [...this.state.messages, makeTalaMessage(content, mood, quickReplies)] });
  }

  call(method: string, args: unknown[] = []): unknown {
    switch (method) {
      case "setModel":
        this.setState({ model: args[0] as string });
        return true;

      case "refresh":
        this.setState({});
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
          stage: (input.stage as Lead["stage"]) ?? "new",
          nextAction: input.nextAction || "Qualify scope and site measure",
          updatedAt: new Date().toISOString(),
        };
        this.setState({ leads: [lead, ...this.state.leads] });
        this.pushAssistant(
          `${pick(TALA_CONFIRMATIONS)}\n\nAdded **${lead.company}** for **${lead.project}** in **${lead.location}** — ${peso(lead.value)}. Ang ganda ng project na 'to! 🏗️ Next: ${lead.nextAction} po.`,
          "happy",
          TALA_QUICK_REPLIES.default,
        );
        return lead;
      }

      case "createQuote": {
        const input = args[0] as Omit<Quote, "id" | "ref" | "subtotal" | "status" | "createdAt">;
        const subtotal = input.lines.reduce((s, l) => s + lineTotal(l), 0);
        const quote: Quote = {
          ...input,
          id: uid("quote"),
          ref: `AGQ-${String(this.state.quotes.length + 1).padStart(4, "0")}`,
          subtotal,
          status: "draft",
          createdAt: new Date().toISOString(),
        };
        const known = this.state.leads.some((l) => l.company.toLowerCase() === quote.customer.toLowerCase());
        const leads = known
          ? this.state.leads.map((l) =>
              l.company.toLowerCase() === quote.customer.toLowerCase()
                ? { ...l, stage: "quoted" as const, value: subtotal, nextAction: `Follow up on ${quote.ref}` }
                : l,
            )
          : [
              {
                id: uid("lead"),
                company: quote.customer,
                contact: "—",
                email: null,
                phone: null,
                project: quote.project,
                location: quote.location,
                value: subtotal,
                stage: "quoted" as const,
                nextAction: `Follow up on ${quote.ref}`,
                updatedAt: new Date().toISOString(),
              },
              ...this.state.leads,
            ];
        this.setState({ quotes: [quote, ...this.state.quotes], leads });
        this.pushAssistant(
          personalize(pick(TALA_QUOTE_DONE), { total: peso2(subtotal), ref: quote.ref, customer: quote.customer, project: quote.project }),
          "happy",
          TALA_QUICK_REPLIES.quoteDone,
        );
        return quote;
      }

      case "advanceQuote": {
        const id = args[0] as string;
        const q = this.state.quotes.find((x) => x.id === id);
        const nextStatus = q?.status === "draft" ? ("sent" as const) : ("approved" as const);
        this.setState({
          quotes: this.state.quotes.map((qq) => (qq.id === id ? { ...qq, status: nextStatus } : qq)),
        });
        if (q) {
          if (nextStatus === "approved") {
            // Learning moment: an approved quote confirms a pricing pattern
            // and locks in customer glass/frame preferences.
            const approvedQuote = { ...q, status: "approved" as const };
            const { knowledge, learned } = learnFromQuoteEngine(this.state.knowledge, approvedQuote);
            this.setState({ knowledge });
            this.pushAssistant(
              `Approved na po! ✅ Quote **${q.ref}** — ${peso2(q.subtotal)} for ${q.customer}. Ready to issue invoice po?`,
              "happy",
              TALA_QUICK_REPLIES.quoteDone,
            );
            if (learned.length) {
              this.pushAssistant(
                `🧠 Natutunan ko po from this approval:\n${learned.map((l) => `- ${l}`).join("\n")}\n\nGagamitin ko ito next time may katulad na project. Salamat po!`,
                "happy",
                TALA_QUICK_REPLIES.knowledge,
              );
            }
          } else {
            this.pushAssistant(
              `Na-send ko na po! 📤 Quote **${q.ref}** for **${q.customer}** is now sent. Waiting for client approval — I'll follow up po if needed! 😊`,
              "happy",
              TALA_QUICK_REPLIES.quoteDone,
            );
          }
        }
        return true;
      }

      case "declineQuote": {
        const id = args[0] as string;
        const reason = (args[1] as string) ?? "No reason recorded";
        const q = this.state.quotes.find((x) => x.id === id);
        if (!q) return false;
        const declined = { ...q, status: "declined" as const };
        this.setState({ quotes: this.state.quotes.map((qq) => (qq.id === id ? declined : qq)) });
        const { knowledge, learned } = learnFromQuoteEngine(this.state.knowledge, declined);
        this.setState({ knowledge });
        this.pushAssistant(
          `Ay, hindi na-approve po si **${q.ref}** (${q.customer}). Reason: ${reason}. 😔 Na-record ko na po ito para sa pricing patterns natin — ${
            learned.length ? learned[0] : "I'll watch for a pattern as more data comes in."
          }`,
          "confused",
          TALA_QUICK_REPLIES.knowledge,
        );
        return declined;
      }

      case "issueInvoice": {
        const id = args[0] as string;
        const quote = this.state.quotes.find((q) => q.id === id);
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
        this.setState({
          invoices: [invoice, ...this.state.invoices],
          quotes: this.state.quotes.map((q) => (q.id === id ? { ...q, status: "approved" as const } : q)),
        });
        this.pushAssistant(
          `Invoice issued na po! 🧾 **${invoice.ref}** for **${invoice.customer}** — **${peso2(invoice.amount)}** due ${invoice.dueDate}. Salamat po! Tracking collection now. 💰`,
          "happy",
          TALA_QUICK_REPLIES.default,
        );
        return invoice;
      }

      case "createInvoice": {
        const input = args[0] as Partial<Invoice>;
        const amount = Number(input.amount ?? 0);
        const invoice: Invoice = {
          id: uid("inv"),
          ref: `AGI-${String(this.state.invoices.length + 1).padStart(4, "0")}`,
          customer: input.customer?.trim() || "Unnamed customer",
          project: input.project?.trim() || "General billing",
          amount,
          paid: Number(input.paid ?? 0),
          balance: Math.max(0, amount - Number(input.paid ?? 0)),
          dueDate:
            input.dueDate || new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10),
          status: input.status ?? "sent",
          issuedAt: input.issuedAt || new Date().toISOString(),
        };
        this.setState({ invoices: [invoice, ...this.state.invoices] });
        this.pushAssistant(
          `Invoice created na po! 🧾 **${invoice.ref}** for **${invoice.customer}** — **${peso2(invoice.amount)}** due ${invoice.dueDate}. You can download it from the Invoices section po.`,
          "happy",
          TALA_QUICK_REPLIES.default,
        );
        return invoice;
      }

      case "extractLeadFromUrl": {
        const rawUrl = String(args[0] ?? "").trim();
        let parsed: URL;
        try {
          parsed = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
        } catch {
          throw new Error("Could not extract data from this URL. Please enter manually.");
        }
        const host = parsed.hostname.replace(/^www\./, "");
        const path = decodeURIComponent(parsed.pathname.replace(/\+/g, " "));
        const isFacebook = /facebook\.com|fb\.com/i.test(host);
        const isGoogle = /google\.|goo\.gl|maps\.app\.goo\.gl/i.test(host);
        const placeMatch = path.match(/\/place\/([^/]+)/i);
        const q = parsed.searchParams.get("q") || parsed.searchParams.get("query") || "";
        const rawName = placeMatch?.[1] || (isFacebook ? path.split("/").filter(Boolean)[0] : "") || q || host.split(".")[0];
        const company = rawName
          .replace(/[-_]+/g, " ")
          .replace(/\b\w/g, (char) => char.toUpperCase())
          .replace(/\s+/g, " ")
          .trim();
        if (!company || company.length < 2) throw new Error("Could not extract data from this URL. Please enter manually.");
        const fullText = `${host} ${path} ${q}`.toLowerCase();
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
          email: "",
          phone: "",
          location,
          project,
          nextAction: "Verify contact details and qualify glass/aluminum scope",
          sourceUrl: parsed.toString(),
        };
      }

      case "recordPayment": {
        const id = args[0] as string;
        const inv = this.state.invoices.find((i) => i.id === id);
        this.setState({
          invoices: this.state.invoices.map((i) =>
            i.id === id ? { ...i, paid: i.amount, balance: 0, status: "paid" as const } : i,
          ),
        });
        if (inv) {
          this.pushAssistant(
            `Bayad na po! 🎉 Payment recorded for **${inv.ref}** — **${peso2(inv.amount)}** from ${inv.customer}. Salamat po! Zero balance na. ✅`,
            "happy",
            TALA_QUICK_REPLIES.default,
          );
        }
        return true;
      }

      case "uploadDocument": {
        const meta = args[0] as { filename: string; mime: string; sizeBytes: number };
        const doc = {
          id: uid("doc"),
          filename: meta.filename,
          mime: meta.mime,
          sizeBytes: meta.sizeBytes,
          intelligence: "PROCESSING" as const,
          storage: "private" as const,
          uploadedAt: new Date().toISOString(),
          r2Key: `57c5969f/${Date.now()}-${meta.filename.replace(/\s+/g, "_")}`,
        };
        this.setState({ documents: [doc, ...this.state.documents] });
        this.pushAssistant(pick(TALA_UPLOADS), "analyzing", TALA_QUICK_REPLIES.afterUpload);
        this.timers.push(
          window.setTimeout(() => {
            this.setState({
              documents: this.state.documents.map((d) =>
                d.id === doc.id ? { ...d, intelligence: "STORED" as const } : d,
              ),
            });
            this.pushAssistant(
              `Done na po ang upload! ✅ **${meta.filename}** is safely stored in R2 private bucket. Press **Intelligence** or **Reprocess** to extract line items po. 🔍`,
              "happy",
              TALA_QUICK_REPLIES.afterUpload,
            );
          }, 1800),
        );
        return doc;
      }

      case "reprocessDocument": {
        const id = args[0] as string;
        const before = this.state.documents.find((d) => d.id === id);
        this.setState({
          documents: this.state.documents.map((d) =>
            d.id === id ? { ...d, intelligence: "PROCESSING" as const } : d,
          ),
        });
        this.pushAssistant(pick(TALA_PROCESSING), "analyzing");
        this.timers.push(
          window.setTimeout(() => {
            const finalDoc = before?.extraction
              ? { ...before, intelligence: "LEARNED" as const }
              : before
                ? { ...before, intelligence: "STORED" as const }
                : undefined;
            this.setState({
              documents: this.state.documents.map((d) => (d.id === id && finalDoc ? finalDoc : d)),
            });
            if (finalDoc?.extraction) {
              const { knowledge, learned } = learnFromDocumentEngine(this.state.knowledge, finalDoc);
              this.setState({ knowledge });
              this.pushAssistant(
                `LEARNED na po! 🧠✨ I've extracted **${finalDoc.extraction.lines.length}** line items from **${finalDoc.filename}** — PO ${finalDoc.extraction.mrsNumber}, total ${peso2(finalDoc.extraction.financial.documentTotal)}. Check **Intelligence** tab po!${
                  learned.length ? `\n\nAdded to long-term memory:\n${learned.map((l) => `- ${l}`).join("\n")}` : ""
                }`,
                "happy",
                TALA_QUICK_REPLIES.knowledge,
              );
            } else {
              this.pushAssistant(
                `Processed na po! Stored in private R2. Press **Reprocess** again when Workers AI vision is connected, and I'll extract every opening. 🔍`,
                "happy",
                TALA_QUICK_REPLIES.afterUpload,
              );
            }
          }, 1600),
        );
        return true;
      }

      case "chat": {
        const prompt = String(args[0] ?? "").trim();
        if (!prompt) return false;
        const userMsg = {
          id: uid("msg"),
          role: "user" as const,
          content: prompt,
          createdAt: new Date().toISOString(),
        };
        const assistantId = uid("msg");
        // Add user message + empty streaming placeholder
        this.setState({
          messages: [
            ...this.state.messages,
            userMsg,
            {
              id: assistantId,
              role: "assistant" as const,
              content: "",
              createdAt: new Date().toISOString(),
              streaming: true,
              mood: "processing" as TalaMood,
            },
          ],
        });
        // Generate reply from commercial memory (NOT from the state that includes the placeholder)
        const cleanMessages = this.state.messages.filter((m) => m.id !== assistantId);
        const full = groundedReply({ ...this.state, messages: cleanMessages }, prompt);
        const quickReplies = pickQuickReplies(full);
        this.stream(assistantId, full, quickReplies);

        // Passive learning: every few user turns, TALA quietly extracts
        // preferences/budget/location signals from the conversation so far
        // without interrupting the chat with an extra message.
        const userTurnCount = cleanMessages.filter((m) => m.role === "user").length;
        if (userTurnCount > 0 && userTurnCount % 3 === 0) {
          const { knowledge } = learnFromConversationEngine(this.state.knowledge, cleanMessages);
          this.setState({ knowledge });
        }
        return true;
      }

      case "learnFromConversation": {
        const company = args[0] as string | undefined;
        const { knowledge, learned } = learnFromConversationEngine(this.state.knowledge, this.state.messages, company);
        this.setState({ knowledge });
        this.pushAssistant(
          learned.length
            ? `🧠 Natutunan ko po from our conversation:\n${learned.map((l) => `- ${l}`).join("\n")}\n\nSalamat po sa details!`
            : `Wala pa akong bagong natutunan sa chat na 'to po — pero I'm always listening. Try mentioning a glass type, frame style, or budget! 😊`,
          "happy",
          TALA_QUICK_REPLIES.knowledge,
        );
        return true;
      }

      case "learnFromQuote": {
        const quoteId = args[0] as string;
        const quote = this.state.quotes.find((q) => q.id === quoteId);
        if (!quote) return false;
        const { knowledge, learned } = learnFromQuoteEngine(this.state.knowledge, quote);
        this.setState({ knowledge });
        this.pushAssistant(
          learned.length
            ? `📊 Pricing analysis done po for **${quote.ref}**:\n${learned.map((l) => `- ${l}`).join("\n")}`
            : `Wala pang enough data si **${quote.ref}** para mag-generate ng pricing insight po.`,
          "happy",
          TALA_QUICK_REPLIES.knowledge,
        );
        return true;
      }

      case "answerFromMemory": {
        const query = String(args[0] ?? "").trim();
        if (!query) return false;
        const userMsg = {
          id: uid("msg"),
          role: "user" as const,
          content: query,
          createdAt: new Date().toISOString(),
        };
        const assistantId = uid("msg");
        this.setState({
          messages: [
            ...this.state.messages,
            userMsg,
            {
              id: assistantId,
              role: "assistant" as const,
              content: "",
              createdAt: new Date().toISOString(),
              streaming: true,
              mood: "processing" as TalaMood,
            },
          ],
        });
        const answer = answerFromMemoryEngine(this.state, query);
        this.stream(assistantId, answer, TALA_QUICK_REPLIES.knowledge);
        return true;
      }

      case "suggestImprovements": {
        const { knowledge, suggestions } = suggestImprovementsEngine(this.state.knowledge);
        this.setState({ knowledge });
        this.pushAssistant(
          suggestions.length
            ? `📈 Here are my suggestions based on patterns I've learned po:\n\n${suggestions
                .slice(0, 4)
                .map((s) => `**${s.title}**\n${s.detail} _(confidence ${Math.round(s.confidence * 100)}%)_`)
                .join("\n\n")}`
            : `Wala pa akong sapat na data para mag-suggest ng improvements po. Keep quoting and I'll spot patterns as they appear! 🌱`,
          "happy",
          TALA_QUICK_REPLIES.knowledge,
        );
        return true;
      }

      case "runDueFollowUps": {
        const due = detectDueFollowUps(this.state);
        const followUps = mergeFollowUps(this.state.followUps, due);
        this.setState({ followUps, lastAutonomousRunAt: new Date().toISOString() });
        this.pushAssistant(
          due.length
            ? `🔔 Nag-check ako po ng commercial memory — ${due.length} follow-up${due.length === 1 ? "" : "s"} drafted na po, waiting for your approval sa **Needs your attention**.`
            : `Sinuri ko na po ang leads, quotes at invoices — walang overdue follow-up ngayon. Lahat maayos! ✅`,
          "happy",
          TALA_QUICK_REPLIES.knowledge,
        );
        return { created: due.length };
      }

      case "approveFollowUp": {
        const id = args[0] as string;
        const task = this.state.followUps.find((f) => f.id === id);
        if (!task) return false;
        this.setState({
          followUps: this.state.followUps.map((f) => (f.id === id ? { ...f, status: "approved" as const } : f)),
        });
        this.pushAssistant(
          `Salamat po! ✅ Follow-up for **${task.relatedLabel ?? task.title}** approved. Draft ready na po to send — sabihin niyo lang kung paano niyo gustong ipadala (email/WhatsApp/SMS). 📤`,
          "happy",
          TALA_QUICK_REPLIES.default,
        );
        return true;
      }

      case "dismissFollowUp": {
        const id = args[0] as string;
        this.setState({
          followUps: this.state.followUps.map((f) => (f.id === id ? { ...f, status: "dismissed" as const } : f)),
        });
        return true;
      }

      default:
        return false;
    }
  }

  /** Simulates Workers AI token stream broadcast over WebSocket. */
  private stream(messageId: string, full: string, quickReplies: QuickReply[]) {
    const tokens = full.match(/\S+\s*/g) ?? [full];
    let i = 0;
    const finalMood = getMoodFromContent(full, false);
    const step = () => {
      i += 5;
      const content = tokens.slice(0, i).join("");
      const done = i >= tokens.length;
      const streamingMood: TalaMood = done ? finalMood : getMoodFromContent(content, true);
      this.setState({
        messages: this.state.messages.map((m) =>
          m.id === messageId
            ? {
                ...m,
                content: done ? full : content,
                streaming: !done,
                mood: streamingMood,
                quickReplies: done ? quickReplies : undefined,
              }
            : m,
        ),
      });
      if (!done) this.timers.push(window.setTimeout(step, 22));
    };
    this.timers.push(window.setTimeout(step, 220));
  }

  destroy() {
    this.timers.forEach((t) => window.clearTimeout(t));
    this.timers = [];
    if (this.heartbeat !== null) window.clearInterval(this.heartbeat);
    this.heartbeat = null;
    this.listeners.clear();
  }
}
