/**
 * TALA's Knowledge Engine.
 *
 * Pure functions that turn raw commercial activity (conversations, learned
 * documents, quote decisions) into structured long-term memory. Both the
 * Cloudflare Worker (AzarragaAgent Durable Object) and the in-browser
 * LocalAzarragaAgent mirror call these same functions, so learning behaves
 * identically whether TALA is running on Workers AI or in local-dev mode.
 *
 * Storage mapping in production:
 *   - R2 `commercial-documents` → original files (POs, photos, specs)
 *   - KV `COMMERCIAL_CACHE`      → cached extracted facts for fast recall
 *   - Durable Object SQLite      → `knowledge` field on AzarragaState (the
 *                                   queryable, structured memory itself)
 */

import { peso2, uid } from "./runtime";
import type {
  AzarragaState,
  ChatMessage,
  CustomerMemory,
  CustomerPreference,
  DocumentRecord,
  KnowledgeBase,
  KnowledgeSuggestion,
  LearnedFact,
  PricingSignal,
  Quote,
  SupplierFact,
} from "./types";

const GLASS_KEYWORDS = ["clear", "tempered", "frosted", "tinted", "bronze", "laminated", "mm"];
const FRAME_KEYWORDS = ["black frame", "analok", "mill finish", "powder coat", "bronze frame", "white frame"];

function findOrCreateCustomer(kb: KnowledgeBase, company: string): CustomerMemory {
  const existing = kb.customers.find((c) => c.company.toLowerCase() === company.toLowerCase());
  if (existing) return existing;
  return {
    id: uid("cust"),
    company,
    contact: "—",
    email: null,
    phone: null,
    location: "Palawan",
    projectHistory: [],
    preferences: [],
    lastInteractionAt: new Date().toISOString(),
    interactionCount: 0,
    notes: [],
  };
}

function upsertCustomer(kb: KnowledgeBase, next: CustomerMemory): KnowledgeBase {
  const idx = kb.customers.findIndex((c) => c.id === next.id);
  const customers = idx === -1 ? [next, ...kb.customers] : kb.customers.map((c) => (c.id === next.id ? next : c));
  return { ...kb, customers };
}

function upsertPreference(prefs: CustomerPreference[], next: CustomerPreference): CustomerPreference[] {
  const idx = prefs.findIndex((p) => p.key === next.key);
  if (idx === -1) return [next, ...prefs];
  // A confirmed observation always wins over an older inferred one.
  if (prefs[idx].confidence === "confirmed" && next.confidence === "inferred") return prefs;
  return prefs.map((p, i) => (i === idx ? next : p));
}

/* ------------------------------------------------------------------ *
 * 1. learnFromConversation — extract key facts from chat history
 * ------------------------------------------------------------------ */
export function learnFromConversation(
  kb: KnowledgeBase,
  messages: ChatMessage[],
  contextCompany?: string,
): { knowledge: KnowledgeBase; learned: string[] } {
  const learned: string[] = [];
  let next = kb;

  const userTurns = messages.filter((m) => m.role === "user");
  if (!userTurns.length) return { knowledge: kb, learned };

  // Without a known customer context, TALA still extracts general facts
  // (glass/frame/budget mentions) but does not create a placeholder
  // customer record — that only happens once a real company name exists.
  const company = contextCompany ?? null;
  const label = company ?? "this conversation";
  let customer = company ? findOrCreateCustomer(next, company) : null;
  let preferences = customer?.preferences ?? [];
  const notes = [...(customer?.notes ?? [])];

  for (const turn of userTurns) {
    const text = turn.content.toLowerCase();

    // Glass preference detection
    for (const kw of GLASS_KEYWORDS) {
      if (text.includes(kw) && /\d\s?mm|clear|tempered|frosted|tinted|bronze|laminated/.test(text)) {
        const match = turn.content.match(/(\d{1,2}\s?mm[^.,\n]{0,24}|clear[^.,\n]{0,10}|tempered[^.,\n]{0,10})/i);
        if (match) {
          preferences = upsertPreference(preferences, {
            key: "glass_type",
            value: match[0].trim(),
            confidence: "inferred",
            learnedFrom: `conversation ${turn.id}`,
            learnedAt: turn.createdAt,
          });
          learned.push(`Glass preference for ${label}: ${match[0].trim()}`);
        }
        break;
      }
    }

    // Frame preference detection
    for (const kw of FRAME_KEYWORDS) {
      if (text.includes(kw)) {
        preferences = upsertPreference(preferences, {
          key: "frame_style",
          value: kw,
          confidence: "inferred",
          learnedFrom: `conversation ${turn.id}`,
          learnedAt: turn.createdAt,
        });
        learned.push(`Frame preference for ${label}: ${kw}`);
        break;
      }
    }

    // Budget / value mention
    const moneyMatch = turn.content.match(/₱\s?([\d,]+(?:\.\d+)?)/);
    if (moneyMatch) {
      notes.push(`Mentioned budget/amount ${moneyMatch[0]} on ${turn.createdAt.slice(0, 10)}.`);
      learned.push(`Budget signal for ${label}: ${moneyMatch[0]}`);
    }

    // Location mention
    const locationMatch = turn.content.match(/\b(el nido|puerto princesa|san vicente|port barton|coron)\b/i);
    if (locationMatch && customer) {
      customer = { ...customer, location: locationMatch[0] };
    }
  }

  if (customer) {
    customer = {
      ...customer,
      preferences,
      notes: notes.slice(-8),
      interactionCount: customer.interactionCount + userTurns.length,
      lastInteractionAt: new Date().toISOString(),
    };
    next = upsertCustomer(next, customer);
  }

  const tag = company ? company.toLowerCase().replace(/\s+/g, "-") : "general";
  const facts: LearnedFact[] = learned.map((summary) => ({
    id: uid("fact"),
    kind: "conversation" as const,
    summary,
    sourceRef: messages[messages.length - 1]?.id ?? "conversation",
    tags: ["conversation", tag],
    createdAt: new Date().toISOString(),
  }));

  next = {
    ...next,
    facts: [...facts, ...next.facts].slice(0, 200),
    stats: {
      ...next.stats,
      conversationsLearned: next.stats.conversationsLearned + 1,
      lastTrainedAt: new Date().toISOString(),
    },
  };

  return { knowledge: next, learned };
}

/* ------------------------------------------------------------------ *
 * 2. learnFromQuote — analyze approved vs rejected quotes, build a
 *    pricing model TALA can reuse for similar future openings.
 * ------------------------------------------------------------------ */
export function learnFromQuote(kb: KnowledgeBase, quote: Quote): { knowledge: KnowledgeBase; learned: string[] } {
  const learned: string[] = [];
  const outcome: PricingSignal["outcome"] =
    quote.status === "approved" ? "approved" : quote.status === "declined" ? "rejected" : "sent";

  const signals: PricingSignal[] = quote.lines.map((line) => ({
    id: uid("signal"),
    system: line.system || "Unspecified system",
    glass: line.glass || "Unspecified glass",
    frame: line.frame || "Unspecified frame",
    outcome,
    unitPrice: line.unitPrice,
    widthMm: line.widthMm,
    heightMm: line.heightMm,
    quoteRef: quote.ref,
    customer: quote.customer,
    recordedAt: new Date().toISOString(),
  }));

  if (signals.length) {
    learned.push(
      `${signals.length} pricing signal${signals.length === 1 ? "" : "s"} recorded from ${quote.ref} (${outcome}).`,
    );
  }

  // Update customer project history + preferences from an approved quote.
  let next: KnowledgeBase = { ...kb, pricingSignals: [...signals, ...kb.pricingSignals].slice(0, 500) };
  let customer = findOrCreateCustomer(next, quote.customer);
  const alreadyLogged = customer.projectHistory.some((h) => h.ref === quote.ref);
  if (!alreadyLogged) {
    customer = {
      ...customer,
      projectHistory: [
        { ref: quote.ref, kind: "quote" as const, project: quote.project, amount: quote.subtotal, status: quote.status },
        ...customer.projectHistory,
      ].slice(0, 30),
      lastInteractionAt: new Date().toISOString(),
      interactionCount: customer.interactionCount + 1,
    };
  }

  if (outcome === "approved") {
    let preferences = customer.preferences;
    const dominantGlass = mostCommon(quote.lines.map((l) => l.glass).filter(Boolean));
    const dominantFrame = mostCommon(quote.lines.map((l) => l.frame).filter(Boolean));
    if (dominantGlass) {
      preferences = upsertPreference(preferences, {
        key: "glass_type",
        value: dominantGlass,
        confidence: "confirmed",
        learnedFrom: `quote ${quote.ref} (approved)`,
        learnedAt: new Date().toISOString(),
      });
      learned.push(`Confirmed glass preference for ${quote.customer}: ${dominantGlass}`);
    }
    if (dominantFrame) {
      preferences = upsertPreference(preferences, {
        key: "frame_style",
        value: dominantFrame,
        confidence: "confirmed",
        learnedFrom: `quote ${quote.ref} (approved)`,
        learnedAt: new Date().toISOString(),
      });
      learned.push(`Confirmed frame preference for ${quote.customer}: ${dominantFrame}`);
    }
    customer = { ...customer, preferences };
  }

  next = upsertCustomer(next, customer);

  const facts: LearnedFact[] = [
    {
      id: uid("fact"),
      kind: "quote" as const,
      summary: `Quote ${quote.ref} for ${quote.customer} (${quote.project}) — ${outcome}, ${peso2(quote.subtotal)}.`,
      sourceRef: quote.id,
      tags: ["quote", outcome, quote.customer.toLowerCase().replace(/\s+/g, "-")],
      createdAt: new Date().toISOString(),
    },
    ...next.facts,
  ].slice(0, 200);

  next = {
    ...next,
    facts,
    stats: { ...next.stats, quotesAnalyzed: next.stats.quotesAnalyzed + 1, lastTrainedAt: new Date().toISOString() },
  };

  return { knowledge: next, learned };
}

/* ------------------------------------------------------------------ *
 * 3. learnFromDocument — pull supplier + spec facts out of an
 *    extraction produced by Workers AI vision (or the local mirror).
 * ------------------------------------------------------------------ */
export function learnFromDocument(kb: KnowledgeBase, doc: DocumentRecord): { knowledge: KnowledgeBase; learned: string[] } {
  const learned: string[] = [];
  if (!doc.extraction) return { knowledge: kb, learned };
  const ex = doc.extraction;

  let next = kb;
  const supplierName = ex.supplier?.name;
  if (supplierName) {
    const glassLine = ex.lines.find((l) => /mm|tempered|clear/i.test(l.raw));
    const material = glassLine ? glassLine.glass !== "—" ? glassLine.glass : "Glass & aluminum openings" : "Glass & aluminum openings";
    const already = next.supplierFacts.some(
      (s) => s.supplierName === supplierName && s.sourceDocumentId === doc.id,
    );
    if (!already) {
      const fact: SupplierFact = {
        id: uid("sup"),
        material,
        supplierName,
        sourceDocument: doc.filename,
        sourceDocumentId: doc.id,
        learnedAt: ex.provenance.learnedAt,
      };
      next = { ...next, supplierFacts: [fact, ...next.supplierFacts].slice(0, 200) };
      learned.push(`Supplier fact: ${supplierName} supplies ${material} (source: ${doc.filename})`);
    }
  }

  if (ex.buyer?.name) {
    let customer = findOrCreateCustomer(next, ex.buyer.name);
    const alreadyLogged = customer.projectHistory.some((h) => h.ref === ex.mrsNumber);
    customer = {
      ...customer,
      email: customer.email,
      projectHistory: alreadyLogged
        ? customer.projectHistory
        : [
            {
              ref: ex.mrsNumber,
              kind: "quote" as const,
              project: ex.project?.name ?? "Unspecified project",
              amount: ex.financial.documentTotal,
              status: "learned_from_po",
            },
            ...customer.projectHistory,
          ].slice(0, 30),
      lastInteractionAt: ex.provenance.learnedAt,
      interactionCount: customer.interactionCount + 1,
    };
    next = upsertCustomer(next, customer);
    learned.push(`Customer history updated for ${ex.buyer.name} from ${doc.filename}`);
  }

  const fact: LearnedFact = {
    id: uid("fact"),
    kind: "document",
    summary: `Extracted ${ex.lines.length} line item(s) from ${doc.filename} (PO ${ex.mrsNumber}), total ${peso2(ex.financial.documentTotal)}.`,
    sourceRef: doc.id,
    tags: ["document", "purchase-order"],
    createdAt: new Date().toISOString(),
  };
  next = {
    ...next,
    facts: [fact, ...next.facts].slice(0, 200),
    stats: {
      ...next.stats,
      documentsLearned: next.stats.documentsLearned + 1,
      lastTrainedAt: new Date().toISOString(),
    },
  };

  return { knowledge: next, learned };
}

/* ------------------------------------------------------------------ *
 * 4. answerFromMemory — search the knowledge base for a query
 * ------------------------------------------------------------------ */
export function answerFromMemory(state: AzarragaState, query: string): string {
  const kb = state.knowledge;
  const q = query.toLowerCase();

  // "glass thickness for X" / "what glass does X use"
  const customerMatch = kb.customers.find((c) => q.includes(c.company.toLowerCase().split(" ")[0].toLowerCase()));
  if (customerMatch && (q.includes("glass") || q.includes("thickness") || q.includes("prefer"))) {
    const glassPref = customerMatch.preferences.find((p) => p.key === "glass_type");
    const framePref = customerMatch.preferences.find((p) => p.key === "frame_style");
    if (!glassPref && !framePref) {
      return `Wala pa akong recorded preference po para sa **${customerMatch.company}**. Once we quote or chat about specs, matututunan ko agad! 🧠`;
    }
    return `Sa memory ko po, **${customerMatch.company}**:\n${glassPref ? `- Glass: **${glassPref.value}** (${glassPref.confidence}, learned from ${glassPref.learnedFrom})\n` : ""}${framePref ? `- Frame: **${framePref.value}** (${framePref.confidence}, learned from ${framePref.learnedFrom})\n` : ""}\nBased on ${customerMatch.interactionCount} interaction${customerMatch.interactionCount === 1 ? "" : "s"} po. 📚`;
  }

  // "supplier for X material"
  if (q.includes("supplier")) {
    const materialMatch = kb.supplierFacts.find((s) => q.includes(s.material.toLowerCase().split(" ")[0]));
    const fact = materialMatch ?? kb.supplierFacts[0];
    if (!fact) {
      return `Wala pa akong supplier facts na naka-record po. Mag-upload ka ng PO or specification at automatic kong ilalagay dito ang supplier info. 📦`;
    }
    return `Supplier po for **${fact.material}**: **${fact.supplierName}** — traced from \`${fact.sourceDocument}\`, learned ${fact.learnedAt.slice(0, 10)}. 🏗️`;
  }

  // "price that worked for similar project"
  if (q.includes("price") || q.includes("worked") || q.includes("similar")) {
    const approved = kb.pricingSignals.filter((s) => s.outcome === "approved");
    if (!approved.length) {
      return `Wala pa akong approved pricing signals po — once a quotation is approved, TALA logs the exact unit price that worked so future similar openings price themselves. 💰`;
    }
    const best = approved[0];
    return `Pinaka-recent na approved pricing po: **${peso2(best.unitPrice)}** for ${best.system} · ${best.glass} · ${best.frame} on quote ${best.quoteRef} (${best.customer}). Gagamitin ko ito bilang baseline sa susunod na katulad na project. ✅`;
  }

  // "generate a quote similar to X"
  if (q.includes("similar to") || q.includes("clone") || q.includes("like")) {
    const projectMatch = kb.customers.find((c) => c.projectHistory.some((h) => q.includes(h.project.toLowerCase().split(" ")[0])));
    if (projectMatch) {
      const history = projectMatch.projectHistory[0];
      return `Sige po! I found **${history.project}** sa memory ni **${projectMatch.company}** — ${peso2(history.amount)} (${history.status}). Gusto niyo po ba gawin kong bagong quotation base dito? Sabihin niyo lang customer name at project. 📋`;
    }
    return `Wala pa akong matching project sa memory po. Pero sabihin niyo lang details and I'll build it from scratch gamit ang rate card natin. 😊`;
  }

  return `Hmm, wala pa akong specific na sagot po dyan sa knowledge base — pero heto ang meron ako: **${kb.customers.length}** customer profile${kb.customers.length === 1 ? "" : "s"}, **${kb.pricingSignals.length}** pricing signal${kb.pricingSignals.length === 1 ? "" : "s"}, **${kb.supplierFacts.length}** supplier fact${kb.supplierFacts.length === 1 ? "" : "s"}. Try asking about a specific customer, supplier, or pricing po! 🧠`;
}

/* ------------------------------------------------------------------ *
 * 5. suggestImprovements — find patterns, propose better pricing
 * ------------------------------------------------------------------ */
export function suggestImprovements(kb: KnowledgeBase): { knowledge: KnowledgeBase; suggestions: KnowledgeSuggestion[] } {
  const suggestions: KnowledgeSuggestion[] = [];

  // Pattern: repeated rejections on the same system/glass combo → suggest a price cut
  const byCombo = new Map<string, PricingSignal[]>();
  for (const s of kb.pricingSignals) {
    const key = `${s.system}::${s.glass}`;
    byCombo.set(key, [...(byCombo.get(key) ?? []), s]);
  }
  for (const [combo, signals] of byCombo) {
    const rejected = signals.filter((s) => s.outcome === "rejected");
    const approved = signals.filter((s) => s.outcome === "approved");
    if (rejected.length >= 1 && approved.length === 0) {
      const avgRejected = rejected.reduce((sum, s) => sum + s.unitPrice, 0) / rejected.length;
      const [system, glass] = combo.split("::");
      suggestions.push({
        id: uid("sugg"),
        kind: "pricing",
        title: `Consider lowering price for ${system} · ${glass}`,
        detail: `${rejected.length} rejection${rejected.length === 1 ? "" : "s"} recorded around ${peso2(avgRejected)}. Try quoting 8-10% lower or bundling installation to win the next one.`,
        confidence: Math.min(0.9, 0.4 + rejected.length * 0.15),
        createdAt: new Date().toISOString(),
      });
    }
    if (approved.length >= 2) {
      const avgApproved = approved.reduce((sum, s) => sum + s.unitPrice, 0) / approved.length;
      const [system, glass] = combo.split("::");
      suggestions.push({
        id: uid("sugg"),
        kind: "pricing",
        title: `Pricing pattern confirmed for ${system} · ${glass}`,
        detail: `${approved.length} approvals averaging ${peso2(avgApproved)}. This is a safe baseline for future quotes with this spec.`,
        confidence: Math.min(0.95, 0.5 + approved.length * 0.15),
        createdAt: new Date().toISOString(),
      });
    }
  }

  // Pattern: customers with no email on file → suggest follow-up approach
  const missingEmail = kb.customers.filter((c) => !c.email && c.interactionCount > 0);
  if (missingEmail.length) {
    suggestions.push({
      id: uid("sugg"),
      kind: "follow-up",
      title: `${missingEmail.length} customer${missingEmail.length === 1 ? "" : "s"} missing email`,
      detail: `${missingEmail.map((c) => c.company).join(", ")} — capture an email or WhatsApp number so TALA can send quotes directly instead of relying on manual follow-up.`,
      confidence: 0.7,
      createdAt: new Date().toISOString(),
    });
  }

  // Pattern: repeat customers → suggest loyalty/priority handling
  const repeatCustomers = kb.customers.filter((c) => c.projectHistory.length >= 2);
  if (repeatCustomers.length) {
    suggestions.push({
      id: uid("sugg"),
      kind: "approach",
      title: `${repeatCustomers.length} repeat customer${repeatCustomers.length === 1 ? "" : "s"} identified`,
      detail: `${repeatCustomers.map((c) => c.company).join(", ")} have ordered more than once. Consider a standing discount or priority scheduling to keep them loyal.`,
      confidence: 0.65,
      createdAt: new Date().toISOString(),
    });
  }

  // Pattern: single-supplier dependency
  const supplierNames = new Set(kb.supplierFacts.map((s) => s.supplierName));
  if (kb.supplierFacts.length >= 2 && supplierNames.size === 1) {
    suggestions.push({
      id: uid("sugg"),
      kind: "supplier",
      title: "Single supplier dependency detected",
      detail: `All learned documents point to one supplier (${[...supplierNames][0]}). Consider recording a backup supplier for glass/aluminum to protect lead times.`,
      confidence: 0.55,
      createdAt: new Date().toISOString(),
    });
  }

  const knowledge: KnowledgeBase = {
    ...kb,
    suggestions: [...suggestions, ...kb.suggestions].slice(0, 30),
  };

  return { knowledge, suggestions };
}

function mostCommon(values: string[]): string | null {
  if (!values.length) return null;
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: string | null = null;
  let bestCount = 0;
  for (const [v, c] of counts) {
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}
