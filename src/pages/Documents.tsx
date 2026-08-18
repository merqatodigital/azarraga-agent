import { useRef } from "react";
import { Download, ExternalLink, Eye, ShieldCheck, RotateCw, UploadCloud } from "lucide-react";
import { Badge, Card, EmptyState, thCls, tdCls } from "@/components/Shell";
import type { DocumentRecord } from "@/agent/types";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: "UTC", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });

function intelligenceTone(status: DocumentRecord["intelligence"]) {
  if (status === "LEARNED") return "blue" as const;
  if (status === "PROCESSING") return "amber" as const;
  if (status === "FAILED") return "red" as const;
  return "slate" as const;
}

function IconAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Eye;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-fg-700 transition-colors hover:border-brand-500/60 hover:bg-brand-100/50"
    >
      <Icon className="h-[14px] w-[14px]" strokeWidth={2} />
    </button>
  );
}

export function Documents({
  documents,
  onOpenIntelligence,
  onReprocess,
  onUpload,
}: {
  documents: DocumentRecord[];
  onOpenIntelligence: (doc: DocumentRecord) => void;
  onReprocess: (id: string) => void;
  onUpload: (meta: { filename: string; mime: string; sizeBytes: number }) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-[18px] font-bold tracking-[-0.02em] text-fg-900 sm:text-[21px]">
            TALA document learning
          </h3>
          <p className="mt-1.5 max-w-[720px] text-[13px] text-fg-500 sm:text-[14px]">
            Upload a PO, then compare the preserved original against every extracted line, dimension,
            price and scope item.
          </p>
        </div>
        <button
          onClick={() => fileInput.current?.click()}
          className="flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-[13.5px] font-semibold text-white shadow-[0_2px_6px_rgba(22,104,201,0.28)] transition-colors hover:bg-brand-700 sm:h-11 sm:px-5 sm:text-[15px]"
        >
          <UploadCloud className="h-[16px] w-[16px] sm:h-[17px] sm:w-[17px]" strokeWidth={2.1} />
          Upload &amp; Learn
        </button>
        <input
          ref={fileInput}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file)
              onUpload({
                filename: file.name,
                mime: file.type || "application/octet-stream",
                sizeBytes: file.size,
              });
            e.target.value = "";
          }}
        />
      </div>

      <div className="rounded-lg border border-line-strong bg-info-soft px-4 py-3.5 text-[13px] leading-[1.5] text-fg-700 sm:px-5 sm:py-4 sm:text-[14px]">
        <b className="font-bold text-fg-900">The original remains private and authoritative.</b> Each row opens a
        review workspace showing the source beside TALA&apos;s extraction. Missing or uncertain
        information is never hidden.
      </div>

      <Card className="overflow-hidden">
        {documents.length === 0 ? (
          <EmptyState icon="📁" title="No documents yet po." text="Upload a purchase order and TALA will extract every line item automatically." />
        ) : (
          <>
            {/* Mobile / tablet card list */}
            <div className="flex flex-col divide-y divide-line md:hidden">
              {documents.map((doc) => (
                <div key={doc.id} className="flex flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-bold text-fg-900">{doc.filename}</p>
                      <p className="mt-0.5 text-[12px] text-fg-400">
                        {doc.mime} · {Math.round(doc.sizeBytes / 1024)} KB
                      </p>
                    </div>
                    <Badge tone={intelligenceTone(doc.intelligence)} dot>
                      {doc.intelligence}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-[12.5px] text-fg-500">
                    <span className="flex items-center gap-1.5 font-medium text-success">
                      <ShieldCheck className="h-[13px] w-[13px]" strokeWidth={2} />
                      Private
                    </span>
                    <span>{fmtDate(doc.uploadedAt)}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <IconAction icon={ExternalLink} label="Open" />
                    <IconAction icon={Download} label="Download" />
                    <IconAction icon={Eye} label="Intelligence" onClick={() => onOpenIntelligence(doc)} />
                    <IconAction icon={RotateCw} label="Reprocess" onClick={() => onReprocess(doc.id)} />
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="thin-scroll hidden overflow-x-auto md:block">
              <table className="w-full min-w-[860px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line bg-surface-2">
                    {["File", "Intelligence", "Original", "Uploaded", "Actions"].map((c) => (
                      <th key={c} className={thCls}>
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr key={doc.id} className="border-b border-line transition-colors last:border-0 hover:bg-surface-2">
                      <td className={tdCls}>
                        <p className="font-bold">{doc.filename}</p>
                        <p className="mt-0.5 text-[12px] text-fg-400">
                          {doc.mime} · {Math.round(doc.sizeBytes / 1024)} KB
                        </p>
                      </td>
                      <td className={tdCls}>
                        <Badge tone={intelligenceTone(doc.intelligence)} dot>
                          {doc.intelligence}
                        </Badge>
                      </td>
                      <td className={tdCls}>
                        <span className="flex items-center gap-1.5 font-medium text-success">
                          <ShieldCheck className="h-[13px] w-[13px]" strokeWidth={2} />
                          Private Storage
                        </span>
                      </td>
                      <td className={`${tdCls} whitespace-nowrap text-fg-500`}>{fmtDate(doc.uploadedAt)}</td>
                      <td className={tdCls}>
                        <div className="flex gap-1.5">
                          <IconAction icon={ExternalLink} label="Open" />
                          <IconAction icon={Download} label="Download" />
                          <IconAction icon={Eye} label="Intelligence" onClick={() => onOpenIntelligence(doc)} />
                          <IconAction icon={RotateCw} label="Reprocess" onClick={() => onReprocess(doc.id)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

