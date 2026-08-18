import type { ReactNode } from "react";
import { Download, ExternalLink, RotateCw, X } from "lucide-react";
import poOriginal from "@/assets/po-original.jpg";
import { peso2 } from "@/agent/runtime";
import { Field } from "@/components/Shell";
import type { DocumentRecord } from "@/agent/types";

const COLUMNS = [
  "#",
  "Opening",
  "Raw description",
  "Product family",
  "System",
  "Configuration",
  "Qty",
  "Unit",
  "Width mm",
  "Height mm",
  "Glass",
  "Unit price",
  "Line total",
];

function HeaderButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Download;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex h-9 items-center gap-2 rounded-lg border border-white/20 bg-white/[0.08] px-2.5 text-[13px] font-medium text-white transition-colors hover:bg-white/[0.16] sm:px-3"
    >
      <Icon className="h-[14px] w-[14px]" strokeWidth={2} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function SubCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 sm:p-5">
      <h4 className="text-[14px] font-bold tracking-[-0.01em] text-fg-900 sm:text-[15px]">{title}</h4>
      <div className="mt-3.5 space-y-3 sm:mt-4 sm:space-y-3.5">{children}</div>
    </div>
  );
}

export function DocumentReviewModal({
  doc,
  onClose,
  onReprocess,
}: {
  doc: DocumentRecord;
  onClose: () => void;
  onReprocess: (id: string) => void;
}) {
  const ex = doc.extraction;

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-black/55 p-0 backdrop-blur-[2px] sm:p-6">
      <div className="pop-in flex h-full w-full max-w-[1180px] flex-col overflow-hidden bg-surface-2 shadow-[0_40px_90px_-20px_rgba(6,19,35,0.6)] sm:h-auto sm:max-h-[94vh] sm:rounded-2xl">
        <div className="flex flex-wrap items-start justify-between gap-3 bg-[#0e2a47] px-4 py-3.5 sm:gap-4 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <p className="hidden text-[11px] font-bold uppercase tracking-[0.14em] text-[#7fb0e0] sm:block">
              Document intelligence / PO review
            </p>
            <h3 className="mt-0.5 truncate text-[14.5px] font-bold tracking-[-0.01em] text-white sm:mt-1.5 sm:text-[17px]">
              {doc.filename}
            </h3>
            <p className="mt-1 hidden text-[12px] text-[#a3bcd6] sm:block">
              Original source beside TALA extraction · private signed access refreshes on demand
            </p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <HeaderButton icon={ExternalLink} label="Open Original" />
            <HeaderButton icon={Download} label="Download" />
            <HeaderButton icon={RotateCw} label="Reprocess" onClick={() => onReprocess(doc.id)} />
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-lg p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="thin-scroll grid flex-1 gap-4 overflow-y-auto p-3 sm:p-4 lg:grid-cols-[minmax(320px,1fr)_1.75fr]">
          {/* Authoritative original */}
          <div className="h-fit rounded-xl border border-line bg-surface">
            <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5 sm:py-4">
              <h4 className="text-[14px] font-bold tracking-[-0.01em] text-fg-900 sm:text-[15px]">
                Authoritative original
              </h4>
              <button
                aria-label="Refresh access"
                className="flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-[12.5px] font-medium text-fg-700 transition-colors hover:bg-surface-hover sm:px-3"
              >
                <RotateCw className="h-[13px] w-[13px]" strokeWidth={2} />
                <span className="hidden sm:inline">Refresh access</span>
              </button>
            </div>
            <div className="thin-scroll overflow-auto border-t border-line px-3 pb-3 pt-3 sm:px-4 sm:pb-4 sm:pt-4">
              <img
                src={poOriginal}
                alt="Original purchase order"
                className="h-[260px] max-w-none rounded-sm border border-line-strong object-cover object-left-top sm:h-[370px]"
              />
            </div>
          </div>

          {/* Extraction */}
          <div className="space-y-4">
            <div className="rounded-xl border border-line bg-surface p-4 sm:p-5">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 sm:gap-x-6 sm:gap-y-4 lg:grid-cols-4">
                <Field label="Filename">{doc.filename}</Field>
                <Field label="Document type">{ex?.documentType ?? "—"}</Field>
                <Field label="Document date">{ex?.documentDate ?? "—"}</Field>
                <Field label="MRS number">{ex?.mrsNumber ?? "—"}</Field>
                <Field label="Payment terms">{ex?.paymentTerms ?? "—"}</Field>
                <Field label="Extraction status">{doc.intelligence}</Field>
                <Field label="HITL route">{ex?.reviewStatus ?? (ex?.humanReview === "Required" ? "FAIL" : "PASS")}</Field>
                <Field label="Human review">{ex?.humanReview ?? "Pending"}</Field>
                <Field label="Memo">{ex?.memo ?? "—"}</Field>
              </div>
              {(ex?.reviewReason || ex?.audit?.reason) && (
                <div className="mt-5 rounded-lg border border-line bg-surface-2 p-3 text-[13px] leading-relaxed text-fg-700">
                  <span className="font-bold text-fg-900">Review reason: </span>
                  {ex.reviewReason ?? ex.audit?.reason}
                </div>
              )}
              <div className="mt-5 max-w-[420px]">
                <Field label="Instructions">{ex?.instructions ?? "None recorded"}</Field>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <SubCard title="Buyer / customer">
                <Field label="Name">{ex?.buyer.name ?? "Not extracted"}</Field>
                {ex?.buyer.address && <Field label="Address">{ex.buyer.address}</Field>}
                {ex?.buyer.tin && <Field label="TIN">{ex.buyer.tin}</Field>}
              </SubCard>
              <SubCard title="Supplier">
                <Field label="Name">{ex?.supplier.name ?? "Not extracted"}</Field>
                {ex?.supplier.address && <Field label="Address">{ex.supplier.address}</Field>}
              </SubCard>
              <SubCard title="Project">
                <Field label="Name">{ex?.project.name ?? "Not extracted"}</Field>
              </SubCard>
            </div>

            <div className="rounded-xl border border-line bg-surface p-4 sm:p-5">
              <h4 className="text-[14px] font-bold tracking-[-0.01em] text-fg-900 sm:text-[15px]">
                Financial and scope summary
              </h4>
              <div className="mt-3.5 grid grid-cols-2 gap-x-4 gap-y-3.5 sm:mt-4 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-4 lg:grid-cols-5">
                <Field label="Product subtotal">{peso2(ex?.financial.productSubtotal ?? 0)}</Field>
                <Field label="VAT">{peso2(ex?.financial.vat ?? 0)}</Field>
                <Field label="Discount">{peso2(ex?.financial.discount ?? 0)}</Field>
                <Field label="Crating">{peso2(ex?.financial.crating ?? 0)}</Field>
                <Field label="Shipping">{peso2(ex?.financial.shipping ?? 0)}</Field>
                <Field label="Trucking">{peso2(ex?.financial.trucking ?? 0)}</Field>
                <Field label="Delivery">{peso2(ex?.financial.delivery ?? 0)}</Field>
                <Field label="Installation">{peso2(ex?.financial.installation ?? 0)}</Field>
                <Field label="Document total">{peso2(ex?.financial.documentTotal ?? 0)}</Field>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-line bg-surface">
              <div className="px-4 pt-4 pb-3.5 sm:px-5 sm:pt-5 sm:pb-4">
                <h4 className="text-[14px] font-bold tracking-[-0.01em] text-fg-900 sm:text-[15px]">
                  Every extracted line item
                </h4>
                <p className="mt-1 text-[12px] text-fg-400 sm:text-[12.5px]">
                  Raw descriptions remain visible so you can compare them directly with the original.
                </p>
              </div>
              <div className="thin-scroll overflow-x-auto">
                <table className="w-full min-w-[860px] border-collapse text-left">
                  <thead>
                    <tr className="border-y border-line bg-surface-2">
                      {COLUMNS.map((c) => (
                        <th
                          key={c}
                          className="whitespace-nowrap px-3 py-2.5 text-[11.5px] font-semibold text-fg-500"
                        >
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(ex?.lines ?? []).map((line, i) => (
                      <tr key={i} className="border-b border-line/70 align-top last:border-0">
                        <td className="px-3 py-3 text-[12.5px] text-fg-900">{line.index}</td>
                        <td className="px-3 py-3 text-[12.5px] text-fg-900">{line.opening}</td>
                        <td className="min-w-[280px] px-3 py-3 text-[12.5px] leading-[1.45] text-fg-900">
                          {line.raw}
                        </td>
                        <td className="px-3 py-3 text-[12.5px] text-fg-400">{line.productFamily}</td>
                        <td className="px-3 py-3 text-[12.5px] text-fg-400">{line.system}</td>
                        <td className="px-3 py-3 text-[12.5px] text-fg-400">{line.configuration}</td>
                        <td className="px-3 py-3 text-[12.5px] text-fg-900">{line.qty}</td>
                        <td className="px-3 py-3 text-[12.5px] text-fg-900">{line.unit}</td>
                        <td className="px-3 py-3 text-[12.5px] text-fg-400">{line.widthMm}</td>
                        <td className="px-3 py-3 text-[12.5px] text-fg-400">{line.heightMm}</td>
                        <td className="px-3 py-3 text-[12.5px] text-fg-400">{line.glass}</td>
                        <td className="px-3 py-3 text-[12.5px] text-fg-400">{line.unitPrice}</td>
                        <td className="px-3 py-3 text-[12.5px] text-fg-400">{line.lineTotal}</td>
                      </tr>
                    ))}
                    {!ex?.lines.length && (
                      <tr>
                        <td colSpan={COLUMNS.length} className="px-5 py-10 text-center text-[13px] text-fg-300">
                          No extraction has been learned for this file yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <SubCard title="Missing information">
                {ex?.missing.length ? (
                  ex.missing.map((m) => (
                    <p key={m} className="text-[13px] text-fg-900">
                      {m}
                    </p>
                  ))
                ) : (
                  <p className="text-[13px] text-fg-300">None reported</p>
                )}
              </SubCard>
              <SubCard title="Conflicts">
                {ex?.conflicts.length ? (
                  ex.conflicts.map((c) => (
                    <p key={c} className="text-[13px] text-fg-900">
                      {c}
                    </p>
                  ))
                ) : (
                  <p className="text-[13px] text-fg-300">None reported</p>
                )}
              </SubCard>
              <SubCard title="Source provenance">
                <Field label="Storage bucket">{ex?.provenance.bucket ?? "commercial-documents"}</Field>
                <Field label="Storage path">
                  <span className="break-all">{ex?.provenance.path ?? doc.r2Key}</span>
                </Field>
                <Field label="MIME / size">
                  {doc.mime} · {doc.sizeBytes} bytes
                </Field>
                <Field label="Extraction version">{ex?.provenance.version ?? "—"}</Field>
                <Field label="Learned at">{ex?.provenance.learnedAt ?? "—"}</Field>
              </SubCard>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
