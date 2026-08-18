/**
 * TALA's autonomous follow-up engine.
 *
 * Pure functions — no I/O — so the exact same "does TALA need to speak up?"
 * logic runs in two places:
 *   1. Cloudflare Worker: `AzarragaAgent` Durable Object, invoked on a
 *      recurring `this.schedule()` alarm (survives hibernation/restarts).
 *   2. Browser: `LocalAzarragaAgent`, invoked on a `setInterval` tick so the
 *      workspace still feels alive without a deployed Worker.
 *
 * Nothing here ever sends anything — it only *drafts* a FollowUpTask that
 * appears in "Needs your attention" for a human to approve or dismiss.
 */

import { peso2, uid } from "./runtime";
import type { AzarragaState, FollowUpTask } from "./types";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const QUOTE_STALE_AFTER_MS = 2 * DAY; // sent, no customer response in 48h
const LEAD_COLD_AFTER_MS = 3 * DAY; // new lead untouched for 3 days
const INVOICE_OVERDUE_GRACE_MS = 0; // past dueDate at all

export function detectDueFollowUps(state: AzarragaState, now: Date = new Date()): FollowUpTask[] {
  const drafts: FollowUpTask[] = [];
  const already = new Set(state.followUps.map((f) => f.relatedId + ":" + f.kind));

  for (const quote of state.quotes) {
    if (quote.status !== "sent") continue;
    const age = now.getTime() - new Date(quote.createdAt).getTime();
    if (age < QUOTE_STALE_AFTER_MS) continue;
    const key = quote.id + ":quote_stale";
    if (already.has(key)) continue;
    drafts.push({
      id: uid("fu"),
      kind: "quote_stale",
      title: `Follow up on ${quote.ref} — ${quote.customer}`,
      detail: `Sent ${Math.round(age / DAY)} day(s) ago with no recorded response. Quote worth ${peso2(quote.subtotal)}.`,
      draftMessage: `Kumusta po! 👋 Following up on quotation ${quote.ref} for ${quote.project || "your project"} (${peso2(
        quote.subtotal,
      )}). Let us know po if you have questions or if you'd like to proceed — happy to help! — Azarraga Glass & Aluminum`,
      relatedId: quote.id,
      relatedLabel: quote.ref,
      status: "pending",
      dueAt: now.toISOString(),
      createdAt: now.toISOString(),
    });
  }

  for (const lead of state.leads) {
    if (lead.stage === "won" || lead.stage === "lost") continue;
    const age = now.getTime() - new Date(lead.updatedAt).getTime();
    if (age < LEAD_COLD_AFTER_MS) continue;
    const key = lead.id + ":lead_cold";
    if (already.has(key)) continue;
    drafts.push({
      id: uid("fu"),
      kind: "lead_cold",
      title: `Re-engage ${lead.company}`,
      detail: `Stage "${lead.stage}" hasn't moved in ${Math.round(age / DAY)} day(s). Project: ${lead.project || "not recorded"}.`,
      draftMessage: `Hi po ${lead.contact !== "—" ? lead.contact : lead.company}! Just checking in about ${
        lead.project || "your glass and aluminum project"
      } — happy to prepare a quotation whenever you're ready po. — Azarraga Glass & Aluminum`,
      relatedId: lead.id,
      relatedLabel: lead.company,
      status: "pending",
      dueAt: now.toISOString(),
      createdAt: now.toISOString(),
    });
  }

  for (const invoice of state.invoices) {
    if (invoice.balance <= 0) continue;
    const due = new Date(invoice.dueDate).getTime();
    if (Number.isNaN(due) || now.getTime() - due < INVOICE_OVERDUE_GRACE_MS) continue;
    const key = invoice.id + ":invoice_overdue";
    if (already.has(key)) continue;
    const daysOverdue = Math.max(0, Math.round((now.getTime() - due) / DAY));
    drafts.push({
      id: uid("fu"),
      kind: "invoice_overdue",
      title: `Collect on ${invoice.ref} — ${invoice.customer}`,
      detail: `${daysOverdue} day(s) overdue. Balance ${peso2(invoice.balance)} of ${peso2(invoice.amount)}.`,
      draftMessage: `Kumusta po! Gentle reminder that invoice ${invoice.ref} (${peso2(
        invoice.balance,
      )} balance) is now ${daysOverdue} day(s) past due. Please let us know po if you need the statement of account resent. Salamat po! — Azarraga Glass & Aluminum`,
      relatedId: invoice.id,
      relatedLabel: invoice.ref,
      status: "pending",
      dueAt: now.toISOString(),
      createdAt: now.toISOString(),
    });
  }

  return drafts;
}

export function mergeFollowUps(existing: FollowUpTask[], incoming: FollowUpTask[]): FollowUpTask[] {
  if (!incoming.length) return existing;
  return [...incoming, ...existing].slice(0, 60);
}
