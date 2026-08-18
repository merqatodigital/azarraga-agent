import { useState } from "react";
import { CircleCheckBig, Download, FilePlus2, Mail, Phone, Plus, Search, Send, UserPlus, X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Badge, EmptyState, Panel, thCls, tdCls } from "@/components/Shell";
import { peso, peso2 } from "@/agent/runtime";
import type { Invoice, Lead, Quote } from "@/agent/types";

const inputCls =
  "h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-[14px] text-fg-900 outline-none placeholder:text-fg-300 focus:border-brand-500";

function IconAction({
  icon: Icon,
  label,
  onClick,
  tone = "default",
}: {
  icon: typeof Send;
  label: string;
  onClick: () => void;
  tone?: "default" | "primary";
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={
        tone === "primary"
          ? "flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white transition-colors hover:bg-brand-700"
          : "flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-fg-700 transition-colors hover:border-brand-500/60 hover:bg-brand-100/50"
      }
    >
      <Icon className="h-[14px] w-[14px]" strokeWidth={2} />
    </button>
  );
}

function PillButton({
  icon: Icon,
  children,
  onClick,
}: {
  icon: typeof Send;
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-[12.5px] font-medium text-fg-700 transition-colors hover:border-brand-500/60 hover:bg-brand-100/50"
    >
      <Icon className="h-[13px] w-[13px]" strokeWidth={2} />
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ * LEADS * ------------------------------------------------------------------ */

export function Leads({
  leads,
  onAdd,
  onExtractLeadFromUrl,
}: {
  leads: Lead[];
  onAdd: (input: Partial<Lead>) => void;
  onExtractLeadFromUrl?: (url: string) => Promise<Record<string, string | number> | null> | Record<string, string | number> | null;
}) {
  const [open, setOpen] = useState(false);
  const [leadUrl, setLeadUrl] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState("");
  const [extractedPreview, setExtractedPreview] = useState<Record<string, string> | null>(null);
  const [form, setForm] = useState({
    company: "",
    contact: "",
    email: "",
    phone: "",
    project: "",
    location: "Puerto Princesa",
    value: "",
    nextAction: "",
  });

  const extractLeadFromUrl = async () => {
    setExtractError("");
    setExtractedPreview(null);
    let parsed: URL;
    try {
      parsed = new URL(leadUrl.trim().startsWith("http") ? leadUrl.trim() : `https://${leadUrl.trim()}`);
    } catch {
      setExtractError("Could not extract data from this URL. Please enter manually.");
      return;
    }

    setExtracting(true);
    if (onExtractLeadFromUrl) {
      try {
        const extracted = await onExtractLeadFromUrl(parsed.toString());
        if (!extracted?.company) throw new Error("No company extracted");
        const next = {
          company: String(extracted.company ?? ""),
          contact: String(extracted.contact ?? ""),
          email: String(extracted.email ?? ""),
          phone: String(extracted.phone ?? ""),
          project: String(extracted.project ?? extracted.industry ?? "Website lead"),
          location: String(extracted.location ?? "Palawan"),
          value: form.value,
          nextAction: String(extracted.nextAction ?? "Verify contact details and qualify glass/aluminum scope"),
        };
        setForm((current) => ({ ...current, ...next }));
        setExtractedPreview(next);
        setExtracting(false);
        return;
      } catch {
        setExtractError("Could not extract data from this URL. Please enter manually.");
        setExtracting(false);
        return;
      }
    }

    window.setTimeout(() => {
      const host = parsed.hostname.replace(/^www\./, "");
      const path = decodeURIComponent(parsed.pathname.replace(/\+/g, " "));
      const isFacebook = /facebook\.com|fb\.com/i.test(host);
      const isGoogle = /google\.|goo\.gl|maps\.app\.goo\.gl/i.test(host);
      const placeMatch = path.match(/\/place\/([^/]+)/i);
      const q = parsed.searchParams.get("q") || parsed.searchParams.get("query") || parsed.searchParams.get("cid") || "";

      const rawName =
        placeMatch?.[1] ||
        (isFacebook ? path.split("/").filter(Boolean)[0] : "") ||
        q ||
        host.split(".")[0];

      const company = rawName
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase())
        .replace(/\s+/g, " ")
        .trim();

      if (!company || company.length < 2) {
        setExtractError("Could not extract data from this URL. Please enter manually.");
        setExtracting(false);
        return;
      }

      const fullText = `${host} ${path} ${q}`.toLowerCase();
      const location = fullText.includes("el nido") || fullText.includes("elnido")
        ? "El Nido, Palawan"
        : fullText.includes("puerto") || fullText.includes("princesa")
          ? "Puerto Princesa, Palawan"
          : fullText.includes("palawan")
            ? "Palawan"
            : form.location || "Palawan";

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

      const next = {
        company,
        contact: "",
        email: "",
        phone: "",
        project,
        location,
        value: form.value,
        nextAction: "Verify contact details and qualify glass/aluminum scope",
      };

      setForm((current) => ({ ...current, ...next }));
      setExtractedPreview(next);
      setExtracting(false);
    }, 900);
  };

  return (
    <Panel
      title="Pipeline leads"
      action={
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[13px] font-medium text-fg-700 transition-colors hover:bg-surface-hover sm:h-10 sm:px-4 sm:text-[14px]"
        >
          {open ? <X className="h-[15px] w-[15px]" strokeWidth={2.2} /> : <UserPlus className="h-[15px] w-[15px]" strokeWidth={2.2} />}
          <span className="hidden sm:inline">{open ? "Close" : "Add lead"}</span>
        </button>
      }
    >
      {open && (
        <div className="fade-up grid gap-3 border-b border-line bg-surface-2 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
          <div className="rounded-xl border border-line bg-surface p-4 sm:col-span-2 lg:col-span-4">
            <p className="text-[14px] font-bold text-fg-900">Or paste a URL to auto-extract lead data</p>
            <p className="mt-1 text-[12.5px] text-fg-500">
              Paste a Google Business, Facebook, or website URL. TALA will handle deeper extraction later; this form prepares the lead fields now.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                className={`${inputCls} flex-1`}
                value={leadUrl}
                onChange={(e) => {
                  setLeadUrl(e.target.value);
                  setExtractError("");
                }}
                placeholder="Paste Google Business / Facebook / Website URL"
                inputMode="url"
              />
              <button
                type="button"
                onClick={extractLeadFromUrl}
                disabled={extracting || !leadUrl.trim()}
                className="flex h-10 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 text-[14px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Search className={extracting ? "h-4 w-4 animate-spin" : "h-4 w-4"} strokeWidth={2} />
                {extracting ? "Extracting business info..." : "Extract Lead"}
              </button>
            </div>
            {extractError && (
              <p className="mt-3 rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-[13px] font-medium text-danger">
                {extractError}
              </p>
            )}
            {extractedPreview && (
              <div className="mt-3 rounded-lg border border-line bg-surface-2 p-3">
                <div className="flex items-start gap-3">
                  <Avatar name={extractedPreview.company || "Lead"} size={34} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-bold text-fg-900">Extracted preview</p>
                    <div className="mt-2 grid gap-2 text-[12.5px] text-fg-500 sm:grid-cols-2 lg:grid-cols-4">
                      <span><b className="text-fg-900">Company:</b> {extractedPreview.company || "—"}</span>
                      <span><b className="text-fg-900">Contact:</b> {extractedPreview.contact || "Not found"}</span>
                      <span><b className="text-fg-900">Email:</b> {extractedPreview.email || "Not found"}</span>
                      <span><b className="text-fg-900">Phone:</b> {extractedPreview.phone || "Not found"}</span>
                      <span><b className="text-fg-900">Location:</b> {extractedPreview.location || "—"}</span>
                      <span className="sm:col-span-2"><b className="text-fg-900">Industry / Project:</b> {extractedPreview.project || "—"}</span>
                    </div>
                    <p className="mt-2 text-[12px] text-fg-400">Review and edit the fields below before saving.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          {(
            [
              ["company", "Customer / company"],
              ["contact", "Contact person"],
              ["email", "Email (optional)"],
              ["phone", "Phone (optional)"],
              ["project", "Project"],
              ["location", "Location"],
              ["value", "Estimated value PHP"],
              ["nextAction", "Next action"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <p className="mb-1.5 text-[12.5px] text-fg-500">{label}</p>
              <input
                className={inputCls}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </div>
          ))}
          <div className="sm:col-span-2 lg:col-span-4">
            <button
              onClick={() => {
                if (!form.company.trim()) return;
                onAdd({ ...form, value: Number(form.value) || 0 });
                setForm({
                  company: "",
                  contact: "",
                  email: "",
                  phone: "",
                  project: "",
                  location: "Puerto Princesa",
                  value: "",
                  nextAction: "",
                });
                setOpen(false);
              }}
              className="h-10 w-full rounded-lg bg-brand-600 px-5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-700 sm:w-auto"
            >
              Save lead to commercial memory
            </button>
          </div>
        </div>
      )}

      {leads.length === 0 ? (
        <EmptyState
          icon="📭"
          title="Wala pang leads po."
          text="No leads recorded yet po. Once customers message, I'll add them right away. 🤗"
        />
      ) : (
        <>
          {/* Mobile / tablet card list */}
          <div className="flex flex-col divide-y divide-line md:hidden">
            {leads.map((l) => (
              <div key={l.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={l.company} size={38} />
                    <div className="min-w-0">
                      <p className="truncate text-[14.5px] font-bold text-fg-900">{l.company}</p>
                      <p className="truncate text-[12.5px] text-fg-500">{l.project || "No project recorded"}</p>
                    </div>
                  </div>
                  <Badge tone={l.stage === "quoted" ? "blue" : "slate"} dot>
                    {l.stage}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-fg-500">
                  <span>{l.location}</span>
                  <span className="text-[14.5px] font-bold text-fg-900">{peso(l.value)}</span>
                </div>
                {(l.email || l.phone) && (
                  <div className="flex flex-wrap gap-2">
                    {l.email && (
                      <a
                        href={`mailto:${l.email}`}
                        className="flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-[12.5px] font-medium text-fg-700 transition-colors hover:border-brand-500/60 hover:bg-brand-100/50"
                      >
                        <Mail className="h-[13px] w-[13px]" strokeWidth={2} />
                        {l.email}
                      </a>
                    )}
                    {l.phone && (
                      <a
                        href={`tel:${l.phone.replace(/\D/g, "")}`}
                        className="flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-[12.5px] font-medium text-fg-700 transition-colors hover:border-brand-500/60 hover:bg-brand-100/50"
                      >
                        <Phone className="h-[13px] w-[13px]" strokeWidth={2} />
                        {l.phone}
                      </a>
                    )}
                  </div>
                )}
                {l.nextAction && <p className="text-[12.5px] text-fg-400">Next: {l.nextAction}</p>}
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="thin-scroll hidden overflow-x-auto md:block">
            <table className="w-full min-w-[820px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line bg-surface-2">
                  {["Company", "Contact", "Project", "Location", "Value", "Stage", "Next action"].map((c) => (
                    <th key={c} className={thCls}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id} className="border-b border-line transition-colors last:border-0 hover:bg-surface-2">
                    <td className={tdCls}>
                      <div className="flex items-center gap-3">
                        <Avatar name={l.company} size={32} />
                        <span className="font-bold">{l.company}</span>
                      </div>
                    </td>
                    <td className={tdCls}>
                      {l.contact !== "—" ? l.contact : <span className="text-fg-300">—</span>}
                      <span className="mt-0.5 block text-[12px] text-fg-400">
                        {l.email ? (
                          <a href={`mailto:${l.email}`} className="text-brand-600 underline-offset-2 hover:underline">
                            {l.email}
                          </a>
                        ) : l.phone ? (
                          <a href={`tel:${l.phone.replace(/\D/g, "")}`} className="text-brand-600 underline-offset-2 hover:underline">
                            {l.phone}
                          </a>
                        ) : (
                          "no contact channel recorded"
                        )}
                      </span>
                    </td>
                    <td className={tdCls}>{l.project || <span className="text-fg-300">—</span>}</td>
                    <td className={tdCls}>{l.location}</td>
                    <td className={`${tdCls} font-semibold`}>{peso(l.value)}</td>
                    <td className={tdCls}>
                      <Badge tone={l.stage === "quoted" ? "blue" : "slate"} dot>
                        {l.stage}
                      </Badge>
                    </td>
                    <td className={`${tdCls} text-fg-500`}>{l.nextAction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ * QUOTES * ------------------------------------------------------------------ */

export function Quotes({
  quotes,
  onAdvance,
  onIssueInvoice,
  onNew,
}: {
  quotes: Quote[];
  onAdvance: (id: string) => void;
  onIssueInvoice: (id: string) => void;
  onNew: () => void;
}) {
  const statusTone = (status: Quote["status"]) =>
    status === "approved" ? "green" : status === "sent" ? "blue" : status === "declined" ? "red" : "slate";

  return (
    <Panel
      title="Quotations"
      action={
        <button
          onClick={onNew}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[13px] font-medium text-fg-700 transition-colors hover:bg-surface-hover sm:h-10 sm:px-4 sm:text-[14px]"
        >
          <Plus className="h-[15px] w-[15px]" strokeWidth={2.2} />
          <span className="hidden sm:inline">New quotation</span>
        </button>
      }
    >
      {quotes.length === 0 ? (
        <EmptyState icon="📋" title="No quotations yet po." text="Ready to create your first quote? Tala is excited to help! ✨" />
      ) : (
        <>
          {/* Mobile / tablet card list */}
          <div className="flex flex-col divide-y divide-line md:hidden">
            {quotes.map((q) => (
              <div key={q.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={q.customer} size={38} />
                    <div className="min-w-0">
                      <p className="truncate text-[14.5px] font-bold text-fg-900">{q.customer}</p>
                      <p className="truncate text-[12.5px] text-fg-500">
                        {q.ref} · {q.lines.length} line{q.lines.length === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                  <Badge tone={statusTone(q.status)} dot>
                    {q.status}
                  </Badge>
                </div>
                <p className="truncate text-[12.5px] text-fg-500">{q.project}</p>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[16px] font-bold text-fg-900">{peso2(q.subtotal)}</span>
                  <div className="flex gap-2">
                    <IconAction icon={Send} label={q.status === "draft" ? "Send" : "Approve"} onClick={() => onAdvance(q.id)} />
                    <IconAction icon={CircleCheckBig} label="Issue invoice" onClick={() => onIssueInvoice(q.id)} tone="primary" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="thin-scroll hidden overflow-x-auto md:block">
            <table className="w-full min-w-[880px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line bg-surface-2">
                  {["Customer", "Project", "Lines", "Subtotal", "Status", "Actions"].map((c) => (
                    <th key={c} className={thCls}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <tr key={q.id} className="border-b border-line transition-colors last:border-0 hover:bg-surface-2">
                    <td className={tdCls}>
                      <div className="flex items-center gap-3">
                        <Avatar name={q.customer} size={32} />
                        <div>
                          <p className="font-bold">{q.customer}</p>
                          <p className="text-[12px] text-fg-400">{q.ref}</p>
                        </div>
                      </div>
                    </td>
                    <td className={tdCls}>
                      {q.project}
                      <span className="mt-0.5 block text-[12px] text-fg-400">
                        {q.location}
                        {q.terms ? ` · ${q.terms}` : ""}
                        {q.leadTime ? ` · ${q.leadTime}` : ""}
                      </span>
                    </td>
                    <td className={tdCls}>{q.lines.length}</td>
                    <td className={`${tdCls} font-semibold`}>{peso2(q.subtotal)}</td>
                    <td className={tdCls}>
                      <Badge tone={statusTone(q.status)} dot>
                        {q.status}
                      </Badge>
                    </td>
                    <td className={tdCls}>
                      <div className="flex gap-2">
                        <PillButton icon={Send} onClick={() => onAdvance(q.id)}>
                          {q.status === "draft" ? "Send" : "Approve"}
                        </PillButton>
                        <PillButton icon={CircleCheckBig} onClick={() => onIssueInvoice(q.id)}>
                          Invoice
                        </PillButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ * INVOICES * ------------------------------------------------------------------ */

export function Invoices({
  invoices,
  onRecordPayment,
  onCreateInvoice,
  onDownloadInvoice,
}: {
  invoices: Invoice[];
  onRecordPayment: (id: string) => void;
  onCreateInvoice: () => void;
  onDownloadInvoice: (invoice: Invoice) => void;
}) {
  const statusTone = (status: Invoice["status"]) =>
    status === "paid" ? "green" : status === "overdue" ? "red" : status === "sent" ? "blue" : "slate";

  return (
    <Panel
      title="Invoices"
      action={
        <button
          onClick={onCreateInvoice}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700 sm:h-10 sm:px-4 sm:text-[14px]"
        >
          <FilePlus2 className="h-[15px] w-[15px]" strokeWidth={2.2} />
          <span className="hidden sm:inline">Create invoice</span>
        </button>
      }
    >
      {invoices.length === 0 ? (
        <EmptyState icon="🧾" title="No invoices yet po." text="Create an invoice manually or issue one from an approved quotation. This is the billing control center." />
      ) : (
        <>
          {/* Mobile / tablet card list */}
          <div className="flex flex-col divide-y divide-line md:hidden">
            {invoices.map((i) => (
              <div key={i.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={i.customer} size={38} />
                    <div className="min-w-0">
                      <p className="truncate text-[14.5px] font-bold text-fg-900">{i.customer}</p>
                      <p className="truncate text-[12.5px] text-fg-500">{i.ref} · due {i.dueDate}</p>
                    </div>
                  </div>
                  <Badge tone={statusTone(i.status)} dot>
                    {i.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-[12.5px] text-fg-500">
                  <span>Amount {peso2(i.amount)}</span>
                  <span className="text-[16px] font-bold text-fg-900">{peso2(i.balance)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => onDownloadInvoice(i)}
                    className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-line bg-surface text-[13px] font-semibold text-fg-700 transition-colors hover:bg-surface-hover"
                  >
                    <Download className="h-[14px] w-[14px]" strokeWidth={2} />
                    Download invoice
                  </button>
                  {i.balance > 0 ? (
                    <button
                      onClick={() => onRecordPayment(i.id)}
                      className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-brand-600 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700"
                    >
                      <CircleCheckBig className="h-[14px] w-[14px]" strokeWidth={2} />
                      Record payment
                    </button>
                  ) : (
                    <span className="flex h-9 items-center justify-center rounded-lg bg-success-soft text-[13px] font-medium text-success">Settled</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="thin-scroll hidden overflow-x-auto md:block">
            <table className="w-full min-w-[880px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line bg-surface-2">
                  {["Customer", "Project", "Amount", "Balance", "Due", "Status", "Actions"].map((c) => (
                    <th key={c} className={thCls}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id} className="border-b border-line transition-colors last:border-0 hover:bg-surface-2">
                    <td className={tdCls}>
                      <div className="flex items-center gap-3">
                        <Avatar name={i.customer} size={32} />
                        <div>
                          <p className="font-bold">{i.customer}</p>
                          <p className="text-[12px] text-fg-400">{i.ref}</p>
                        </div>
                      </div>
                    </td>
                    <td className={tdCls}>{i.project}</td>
                    <td className={tdCls}>{peso2(i.amount)}</td>
                    <td className={`${tdCls} font-semibold`}>{peso2(i.balance)}</td>
                    <td className={tdCls}>{i.dueDate}</td>
                    <td className={tdCls}>
                      <Badge tone={statusTone(i.status)} dot>
                        {i.status}
                      </Badge>
                    </td>
                    <td className={tdCls}>
                      <div className="flex flex-wrap gap-2">
                        <PillButton icon={Download} onClick={() => onDownloadInvoice(i)}>
                          Download invoice
                        </PillButton>
                        {i.balance > 0 ? (
                          <PillButton icon={CircleCheckBig} onClick={() => onRecordPayment(i.id)}>
                            Record payment
                          </PillButton>
                        ) : (
                          <span className="text-[12.5px] font-medium text-success">Settled</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Panel>
  );
}
