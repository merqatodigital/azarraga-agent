import { useState } from "react";
import { CalendarDays, FileText, X } from "lucide-react";
import { peso2 } from "@/agent/runtime";
import azarragaIcon from "@/assets/azarraga-icon.png";
import { SafeImage } from "@/components/SafeImage";
import type { Invoice } from "@/agent/types";

const inputCls =
  "h-11 w-full rounded-lg border border-line-strong bg-surface px-3.5 text-[15px] text-fg-900 outline-none transition-colors placeholder:text-fg-300 focus:border-brand-500";

function Label({ children }: { children: string }) {
  return <p className="mb-1.5 text-[13.5px] text-fg-500">{children}</p>;
}

export function NewInvoiceModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (input: Partial<Invoice>) => void;
}) {
  const [customer, setCustomer] = useState("");
  const [project, setProject] = useState("");
  const [amount, setAmount] = useState("");
  const [paid, setPaid] = useState("0");
  const [dueDate, setDueDate] = useState(() => new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10));

  const parsedAmount = Number(amount) || 0;
  const parsedPaid = Number(paid) || 0;
  const balance = Math.max(0, parsedAmount - parsedPaid);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-0 backdrop-blur-[2px] sm:p-6">
      <div className="pop-in flex h-full w-full max-w-[860px] flex-col overflow-hidden bg-surface shadow-[0_40px_80px_-20px_rgba(6,19,35,0.5)] sm:h-auto sm:max-h-[92dvh] sm:rounded-2xl">
        <div className="shrink-0 border-b border-line px-4 pt-4 pb-4 sm:px-8 sm:pt-7 sm:pb-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3 sm:gap-4">
              <SafeImage
                src={azarragaIcon}
                alt="Azarraga"
                fallbackLabel="AG"
                className="h-10 w-10 shrink-0 rounded-lg border border-line bg-white object-contain p-1 sm:h-12 sm:w-12 sm:p-1.5"
                fallbackClassName="h-10 w-10 rounded-lg sm:h-12 sm:w-12"
              />
              <div className="min-w-0">
                <p className="hidden text-[12px] font-bold uppercase tracking-[0.14em] text-brand-600 sm:block">
                  Azarraga Glass &amp; Aluminum
                </p>
                <h2 className="truncate text-[19px] font-bold tracking-[-0.02em] text-fg-900 sm:mt-2 sm:text-[26px]">
                  Create invoice
                </h2>
                <p className="mt-0.5 hidden text-[12px] text-fg-400 sm:block">
                  Billing records, balances, and downloadable invoice files
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-fg-500 transition-colors hover:bg-surface-hover"
            >
              <X className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="thin-scroll flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-7">
          <div className="rounded-xl border border-line bg-surface p-4 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Customer / company</Label>
                <input className={inputCls} value={customer} onChange={(e) => setCustomer(e.target.value)} />
              </div>
              <div>
                <Label>Project / billing scope</Label>
                <input className={inputCls} value={project} onChange={(e) => setProject(e.target.value)} />
              </div>
              <div>
                <Label>Invoice amount PHP</Label>
                <input className={inputCls} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div>
                <Label>Amount paid PHP</Label>
                <input className={inputCls} inputMode="decimal" value={paid} onChange={(e) => setPaid(e.target.value)} />
              </div>
              <div>
                <Label>Due date</Label>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-400" />
                  <input className={`${inputCls} pl-9`} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-line bg-surface px-4 py-4 sm:px-7 sm:py-5">
          <div className="flex flex-col gap-4 rounded-xl bg-[#0f2c4a] px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8db4dd]">Balance due</p>
              <p className="mt-1.5 text-[24px] font-bold tracking-[-0.02em] text-white">{peso2(balance)}</p>
              <p className="mt-2 text-[13.5px] text-[#b7cde3]">Invoice amount {peso2(parsedAmount)} · paid {peso2(parsedPaid)}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="h-11 flex-1 rounded-lg border border-white/25 px-6 text-[15px] font-medium text-white transition-colors hover:bg-white/10 sm:flex-none"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  onCreate({
                    customer: customer.trim() || "Unnamed customer",
                    project: project.trim() || "General billing",
                    amount: parsedAmount,
                    paid: parsedPaid,
                    balance,
                    dueDate,
                    status: balance <= 0 ? "paid" : parsedPaid > 0 ? "partial" : "sent",
                  })
                }
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-white px-6 text-[15px] font-bold text-[#0f2c4a] shadow-sm transition-colors hover:bg-[#eef3f9] sm:flex-none"
              >
                <FileText className="h-4 w-4" strokeWidth={2} />
                Create invoice
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}