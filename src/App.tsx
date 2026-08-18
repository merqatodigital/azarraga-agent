import { useMemo, useState } from "react";
import { Sidebar, TopBar, type PageKey } from "@/components/Shell";
import { AgentPanel } from "@/components/AgentPanel";
import { NewQuoteModal } from "@/components/NewQuoteModal";
import { NewInvoiceModal } from "@/components/NewInvoiceModal";
import { DocumentReviewModal } from "@/components/DocumentReviewModal";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { FloatingAgentButton } from "@/components/FloatingAgentButton";
import { Overview } from "@/pages/Overview";
import { Documents } from "@/pages/Documents";
import { Invoices, Leads, Quotes } from "@/pages/Records";
import { useAzarragaAgent } from "@/agent/useAzarragaAgent";
import { cn } from "@/utils/cn";
import type { Invoice } from "@/agent/types";

const TITLES: Record<PageKey, string> = {
  overview: "Overview",
  leads: "Leads",
  quotes: "Quotes",
  invoices: "Invoices",
  documents: "Documents",
};

export default function App() {
  const { state, status, call, metrics } = useAzarragaAgent();
  const [page, setPage] = useState<PageKey>("overview");
  // On desktop (>1024px, lg), agent panel is open by default side-by-side.
  // On tablet and mobile, it starts closed so workspace is never blocked.
  const [agentOpen, setAgentOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const reviewDoc = useMemo(
    () => state.documents.find((d) => d.id === reviewId) ?? null,
    [state.documents, reviewId],
  );

  const refresh = () => {
    setRefreshing(true);
    call("refresh");
    window.setTimeout(() => setRefreshing(false), 900);
  };

  const ask = (prompt: string) => {
    setAgentOpen(true);
    call("chat", prompt);
  };

  const downloadInvoice = (invoice: Invoice) => {
    const html = `<!doctype html><html><head><meta charset="utf-8" />
      <title>${invoice.ref} - Azarraga Glass & Aluminum</title>
      <style>
        body{font-family:Inter,Arial,sans-serif;margin:40px;color:#0f2540} .top{display:flex;justify-content:space-between;border-bottom:2px solid #0f2c4a;padding-bottom:18px;margin-bottom:28px}.brand{font-weight:800;font-size:20px}.muted{color:#64748b;font-size:13px}.box{border:1px solid #d7e0ec;border-radius:12px;padding:18px;margin:18px 0}.row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #eef2f7}.row:last-child{border-bottom:0}.total{font-size:24px;font-weight:800;color:#0f2c4a}.pill{display:inline-block;padding:6px 10px;border-radius:999px;background:#e7f0fb;color:#1259ae;font-weight:700;text-transform:uppercase;font-size:11px}
      </style></head><body>
      <div class="top"><div><div class="brand">AZARRAGA GLASS & ALUMINUM</div><div class="muted">Globe: 0945-1308277 · Smart: 0999-705 7770</div></div><div><div class="muted">Invoice</div><div class="brand">${invoice.ref}</div></div></div>
      <div class="box"><div class="row"><span>Customer</span><strong>${invoice.customer}</strong></div><div class="row"><span>Project</span><strong>${invoice.project}</strong></div><div class="row"><span>Issued</span><strong>${new Date(invoice.issuedAt).toLocaleDateString()}</strong></div><div class="row"><span>Due date</span><strong>${invoice.dueDate}</strong></div><div class="row"><span>Status</span><span class="pill">${invoice.status}</span></div></div>
      <div class="box"><div class="row"><span>Invoice amount</span><strong>₱${invoice.amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</strong></div><div class="row"><span>Amount paid</span><strong>₱${invoice.paid.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</strong></div><div class="row"><span>Balance due</span><span class="total">₱${invoice.balance.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span></div></div>
      <p class="muted">Generated from Azarraga Commercial Agent. Review before sending to customer.</p>
      </body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${invoice.ref}-invoice.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const latestMessage = state.messages[state.messages.length - 1];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-canvas">
      {/* Sidebar: persistent on desktop (lg), collapsible drawer behind hamburger on tablet/mobile */}
      <Sidebar page={page} onNavigate={setPage} open={navOpen} onClose={() => setNavOpen(false)} />

      {/* Main content area */}
      <main className="thin-scroll flex-1 overflow-y-auto pb-20 md:pb-6">
        <div className="mx-auto w-full max-w-[1400px] space-y-5 px-3.5 py-4 sm:space-y-6 sm:px-6 sm:py-7 lg:px-8">
          <TopBar
            crumb={`Azarraga commercial agent / ${TITLES[page]}`}
            title={TITLES[page]}
            refreshing={refreshing}
            onRefresh={refresh}
            onToggleAgent={() => setAgentOpen((v) => !v)}
            onPrimaryAction={() => (page === "invoices" ? setInvoiceOpen(true) : setQuoteOpen(true))}
            primaryActionLabel={page === "invoices" ? "Create invoice" : "New quote"}
            onOpenNav={() => setNavOpen((v) => !v)}
            navOpen={navOpen}
          />

          {page === "overview" && (
            <Overview
              state={state}
              metrics={metrics}
              onAction={(key) => {
                if (key === "leads") setPage("leads");
                if (key === "quote") setQuoteOpen(true);
                if (key === "billing") setPage("invoices");
                if (key === "agent") setAgentOpen(true);
              }}
            />
          )}

          {page === "leads" && (
            <Leads
              leads={state.leads}
              onAdd={(input) => call("addLead", input)}
              onExtractLeadFromUrl={async (url) => {
                const result = await call("extractLeadFromUrl", url);
                return (result as Record<string, string | number>) ?? null;
              }}
            />
          )}

          {page === "quotes" && (
            <Quotes
              quotes={state.quotes}
              onAdvance={(id) => call("advanceQuote", id)}
              onIssueInvoice={(id) => call("issueInvoice", id)}
              onNew={() => setQuoteOpen(true)}
            />
          )}

          {page === "invoices" && (
            <Invoices
              invoices={state.invoices}
              onRecordPayment={(id) => call("recordPayment", id)}
              onCreateInvoice={() => setInvoiceOpen(true)}
              onDownloadInvoice={downloadInvoice}
            />
          )}

          {page === "documents" && (
            <Documents
              documents={state.documents}
              onOpenIntelligence={(doc) => setReviewId(doc.id)}
              onReprocess={(id) => call("reprocessDocument", id)}
              onUpload={(meta) => call("uploadDocument", meta)}
            />
          )}
        </div>
      </main>

      {/* Agent panel:
       * - Desktop (>1024px): 380px panel on the right, side-by-side with main content.
       * - Tablet & Mobile (<=1024px): Bottom drawer / overlay that slides up smoothly without blocking everything.
       */}
      <div
        className={cn(
          "z-50 transition-all duration-200",
          agentOpen
            ? "fixed inset-x-0 bottom-0 top-16 bg-black/40 backdrop-blur-[1px] lg:static lg:inset-auto lg:h-full lg:w-[380px] lg:shrink-0 lg:bg-transparent lg:backdrop-blur-none"
            : "hidden lg:block lg:w-[380px] lg:shrink-0",
        )}
      >
        <div
          className={cn(
            "flex h-full w-full flex-col shadow-2xl transition-transform duration-200 lg:shadow-none",
            agentOpen ? "translate-y-0 lg:translate-x-0" : "translate-y-full lg:translate-x-full",
          )}
        >
          {agentOpen && (
            <div className="flex h-full w-full flex-col bg-surface lg:border-l lg:border-line">
              <AgentPanel
                state={state}
                connected={status === "connected"}
                onClose={() => setAgentOpen(false)}
                onSend={ask}
                onModelChange={(model) => call("setModel", model)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Mobile bottom navigation bar */}
      <MobileBottomNav page={page} onNavigate={setPage} />

      {/* Floating agent button on mobile when drawer is closed */}
      {!agentOpen && (
        <FloatingAgentButton
          onClick={() => setAgentOpen(true)}
          latestSnippet={latestMessage?.content}
        />
      )}

      {quoteOpen && (
        <NewQuoteModal
          onClose={() => setQuoteOpen(false)}
          onCreate={(input) => {
            call("createQuote", input);
            setQuoteOpen(false);
            setPage("quotes");
          }}
        />
      )}

      {invoiceOpen && (
        <NewInvoiceModal
          onClose={() => setInvoiceOpen(false)}
          onCreate={(input) => {
            call("createInvoice", input);
            setInvoiceOpen(false);
            setPage("invoices");
          }}
        />
      )}

      {reviewDoc && (
        <DocumentReviewModal
          doc={reviewDoc}
          onClose={() => setReviewId(null)}
          onReprocess={(id) => call("reprocessDocument", id)}
        />
      )}
    </div>
  );
}
