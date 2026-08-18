import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { peso2, uid } from "@/agent/runtime";
import azarragaIcon from "@/assets/azarraga-icon.png";
import { SafeImage } from "@/components/SafeImage";
import type { QuoteLine } from "@/agent/types";

const emptyLine = (): QuoteLine => ({
  id: uid("line"),
  description: "",
  system: "",
  glass: "",
  frame: "",
  widthMm: null,
  heightMm: null,
  qty: 1,
  unit: "pc",
  unitPrice: 0,
});

function Label({ children }: { children: string }) {
  return <p className="mb-1.5 text-[13.5px] text-fg-500">{children}</p>;
}

const inputCls =
  "h-11 w-full rounded-lg border border-line-strong bg-surface px-3.5 text-[15px] text-fg-900 outline-none transition-colors placeholder:text-fg-300 focus:border-brand-500";

export function NewQuoteModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (input: {
    customer: string;
    project: string;
    location: string;
    leadTime: string;
    terms: string;
    lines: QuoteLine[];
  }) => void;
}) {
  const [customer, setCustomer] = useState("");
  const [project, setProject] = useState("");
  const [location, setLocation] = useState("Palawan");
  const [leadTime, setLeadTime] = useState("");
  const [terms, setTerms] = useState("");
  const [lines, setLines] = useState<QuoteLine[]>([emptyLine()]);

  const patch = (id: string, next: Partial<QuoteLine>) =>
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...next } : l)));

  const subtotal = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-0 backdrop-blur-[2px] sm:p-6">
      <div className="pop-in flex h-full w-full max-w-[1200px] flex-col overflow-hidden bg-surface shadow-[0_40px_80px_-20px_rgba(6,19,35,0.5)] sm:h-[min(92dvh,900px)] sm:rounded-2xl">
        <div className="shrink-0 border-b border-line px-4 pt-4 pb-4 sm:px-8 sm:pt-7 sm:pb-5">
          <div className="flex items-start justify-between gap-4 sm:gap-6">
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
                New quotation
              </h2>
              <p className="mt-0.5 hidden text-[12px] text-fg-400 sm:block">
                Globe: 0945-1308277 · Smart: 0999-705 7770
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

        <div className="thin-scroll min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-7">
          <div className="rounded-xl border border-line bg-surface p-4 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <Label>Customer / company</Label>
                <input className={inputCls} value={customer} onChange={(e) => setCustomer(e.target.value)} />
              </div>
              <div>
                <Label>Project</Label>
                <input className={inputCls} value={project} onChange={(e) => setProject(e.target.value)} />
              </div>
              <div>
                <Label>Location</Label>
                <input className={inputCls} value={location} onChange={(e) => setLocation(e.target.value)} />
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Lead time</Label>
                <input
                  className={inputCls}
                  placeholder="e.g. 30 working days"
                  value={leadTime}
                  onChange={(e) => setLeadTime(e.target.value)}
                />
              </div>
              <div>
                <Label>Terms</Label>
                <input
                  className={inputCls}
                  placeholder="e.g. 50% down payment"
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-line bg-surface p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
              <div>
                <h3 className="text-[16px] font-bold tracking-[-0.01em] text-fg-900 sm:text-[18px]">
                  Glass &amp; aluminum line items
                </h3>
                <p className="mt-1 text-[12.5px] text-fg-500 sm:text-[13.5px]">
                  Dimensions in millimeters. Prices in Philippine pesos.
                </p>
              </div>
              <button
                onClick={() => setLines((p) => [...p, emptyLine()])}
                className="flex h-10 items-center gap-2 rounded-lg border border-line bg-surface px-3.5 text-[13.5px] font-medium text-fg-700 transition-colors hover:bg-surface-hover sm:h-11 sm:px-4 sm:text-[15px]"
              >
                <Plus className="h-[16px] w-[16px] sm:h-[18px] sm:w-[18px]" strokeWidth={2.2} />
                Add line
              </button>
            </div>

            <div className="mt-5 space-y-4">
              {lines.map((line, index) => (
                <div key={line.id} className="rounded-lg bg-surface-2 p-3.5 sm:p-5">
                  <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] lg:items-end">
                    <div className="sm:col-span-2 lg:col-span-1">
                      <Label>{`Item ${index + 1}`}</Label>
                      <input
                        className={inputCls}
                        placeholder="900 Series sliding door"
                        value={line.description}
                        onChange={(e) => patch(line.id, { description: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>System</Label>
                      <input
                        className={inputCls}
                        placeholder="900 Series"
                        value={line.system}
                        onChange={(e) => patch(line.id, { system: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Glass</Label>
                      <input
                        className={inputCls}
                        placeholder="6mm clear"
                        value={line.glass}
                        onChange={(e) => patch(line.id, { glass: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Frame / finish</Label>
                      <input
                        className={inputCls}
                        placeholder="Analok"
                        value={line.frame}
                        onChange={(e) => patch(line.id, { frame: e.target.value })}
                      />
                    </div>
                    <button
                      onClick={() => setLines((p) => (p.length > 1 ? p.filter((l) => l.id !== line.id) : p))}
                      className="flex h-10 items-center justify-center gap-2 rounded-lg border border-line bg-surface-hover text-fg-400 transition-colors hover:bg-danger-soft hover:text-danger sm:h-11 sm:w-[68px]"
                    >
                      <Trash2 className="h-[16px] w-[16px] sm:h-[17px] sm:w-[17px]" strokeWidth={1.9} />
                      <span className="sm:hidden">Remove line</span>
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 sm:mt-4 sm:grid-cols-5 sm:gap-4">
                    <div>
                      <Label>Width mm</Label>
                      <input
                        className={inputCls}
                        inputMode="numeric"
                        value={line.widthMm ?? ""}
                        onChange={(e) => patch(line.id, { widthMm: Number(e.target.value) || null })}
                      />
                    </div>
                    <div>
                      <Label>Height mm</Label>
                      <input
                        className={inputCls}
                        inputMode="numeric"
                        value={line.heightMm ?? ""}
                        onChange={(e) => patch(line.id, { heightMm: Number(e.target.value) || null })}
                      />
                    </div>
                    <div>
                      <Label>Quantity</Label>
                      <input
                        className={inputCls}
                        inputMode="numeric"
                        value={line.qty}
                        onChange={(e) => patch(line.id, { qty: Number(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <Label>Unit</Label>
                      <input
                        className={inputCls}
                        value={line.unit}
                        onChange={(e) => patch(line.id, { unit: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Unit price PHP</Label>
                      <input
                        className={inputCls}
                        inputMode="decimal"
                        value={line.unitPrice}
                        onChange={(e) => patch(line.id, { unitPrice: Number(e.target.value) || 0 })}
                      />
                    </div>
                  </div>

                  <p className="mt-3 text-right text-[15px] font-bold text-fg-900 sm:pl-[19%] sm:text-left sm:text-[16px]">
                    {peso2(line.qty * line.unitPrice)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-line bg-surface px-4 py-4 sm:px-7 sm:py-5">
          <div className="flex flex-col gap-4 rounded-xl bg-[#0f2c4a] px-4 py-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-5 sm:px-7 sm:py-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8db4dd]">
                Quote subtotal
              </p>
              <p className="mt-1.5 text-[22px] font-bold tracking-[-0.02em] text-white sm:text-[26px]">
                {peso2(subtotal)}
              </p>
              <p className="mt-2 hidden text-[13.5px] text-[#b7cde3] sm:block">
                Tax, logistics and approved adjustments are applied by workflow guardrails.
              </p>
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
                    project: project.trim() || "Unspecified project",
                    location,
                    leadTime,
                    terms,
                    lines,
                  })
                }
                className="h-11 flex-1 rounded-lg bg-white px-6 text-[15px] font-bold text-[#0f2c4a] shadow-sm transition-colors hover:bg-[#eef3f9] sm:flex-none"
              >
                Create quotation
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
