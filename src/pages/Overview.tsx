import {
  BotMessageSquare,
  ChevronRight,
  FileSpreadsheet,
  MapPin,
  Phone,
  ReceiptText,
  UserRoundSearch,
  Users,
  FileStack,
  Wallet,
  Wrench,
} from "lucide-react";
import { Panel, StatCard } from "@/components/Shell";
import { SafeImage } from "@/components/SafeImage";
import { peso } from "@/agent/runtime";
import azarragaIcon from "@/assets/azarraga-icon.png";
import type { AzarragaState } from "@/agent/types";

const ACTIONS = [
  { key: "leads", title: "Find new business", hint: "Add and qualify opportunities", icon: UserRoundSearch },
  { key: "quote", title: "Prepare a quotation", hint: "Build a real multi-line quotation", icon: FileSpreadsheet },
  { key: "billing", title: "Manage billing", hint: "Invoices, payments and balances", icon: ReceiptText },
  { key: "agent", title: "Ask the agent", hint: "Use live commercial memory", icon: BotMessageSquare },
] as const;

export function Overview({
  state,
  metrics,
  onAction,
}: {
  state: AzarragaState;
  metrics: {
    activeLeads: number;
    pipeline: number;
    quoteCount: number;
    receivables: number;
    invoiceCount: number;
    documents: number;
  };
  onAction: (key: (typeof ACTIONS)[number]["key"]) => void;
}) {
  const attention = state.leads.filter((l) => l.stage !== "won" && l.stage !== "lost").slice(0, 6);

  return (
    <div className="space-y-4">
      <div
        className="overflow-hidden rounded-xl px-4 py-5 text-white shadow-[0_10px_30px_-18px_rgba(9,34,60,0.8)] sm:px-8 sm:py-8"
        style={{ backgroundImage: "linear-gradient(105deg,#0c2743 0%,#123a63 62%,#0f3157 100%)" }}
      >
        <div className="flex flex-wrap items-start justify-between gap-6 sm:gap-8">
          <div className="flex items-start gap-3.5 sm:gap-5">
            <SafeImage
              src={azarragaIcon}
              alt="Azarraga"
              fallbackLabel="AG"
              className="h-12 w-12 shrink-0 rounded-xl bg-white object-contain p-1.5 shadow-md sm:h-16 sm:w-16 sm:p-2"
              fallbackClassName="h-12 w-12 rounded-xl sm:h-16 sm:w-16"
            />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#7fb0e0] sm:text-[12.5px]">
                {state.business.legalName}
              </p>
              <h3 className="font-display mt-2 text-[24px] font-bold leading-none tracking-[-0.02em] sm:mt-3 sm:text-[34px]">
                Commercial workspace
              </h3>
              <p className="mt-2 text-[14px] text-[#c2d6e9] sm:mt-3 sm:text-[17px]">{state.business.tagline}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 pb-1 sm:gap-3">
            <MapPin className="h-[20px] w-[20px] shrink-0 text-[#8db4dd] sm:h-[26px] sm:w-[26px]" strokeWidth={1.7} />
            <div>
              <p className="text-[14.5px] font-bold leading-tight sm:text-[17px]">{state.business.region}</p>
              <p className="mt-1 text-[12px] text-[#a9c2da] sm:text-[13.5px]">
                {state.business.locations.slice(0, 2).join(" · ")} ·{" "}
                {state.business.locations.slice(2).join(" / ")}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-start gap-x-8 gap-y-3 border-t border-white/10 pt-4 sm:mt-6 sm:items-center sm:pt-5">
          <div className="flex items-start gap-2.5">
            <Wrench className="mt-0.5 h-[15px] w-[15px] shrink-0 text-[#8db4dd]" strokeWidth={2} />
            <p className="max-w-2xl text-[12.5px] leading-relaxed text-[#c2d6e9] sm:text-[13px]">
              {state.business.services.join(" • ")}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3 sm:gap-4">
            {state.business.contacts.map((c) => (
              <a
                key={c.carrier}
                href={`tel:${c.number.replace(/\D/g, "")}`}
                className="flex items-center gap-1.5 text-[12.5px] font-semibold text-white underline-offset-2 hover:underline sm:text-[13.5px]"
              >
                <Phone className="h-[14px] w-[14px] text-[#8db4dd]" strokeWidth={2} />
                {c.carrier}: {c.number}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Active leads"
          value={String(metrics.activeLeads)}
          hint="Palawan opportunities"
          icon={Users}
        />
        <StatCard
          label="Quotes in pipeline"
          value={peso(metrics.pipeline)}
          hint={`${metrics.quoteCount} quotation${metrics.quoteCount === 1 ? "" : "s"}`}
          icon={FileStack}
        />
        <StatCard
          label="Receivables"
          value={peso(metrics.receivables)}
          hint={`${metrics.invoiceCount} billing record${metrics.invoiceCount === 1 ? "" : "s"}`}
          icon={Wallet}
        />
        <StatCard label="Documents" value={String(metrics.documents)} hint="Commercial files" icon={FileStack} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
        <Panel title="Needs your attention">
          {attention.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center sm:py-14">
              <span className="text-4xl">📭</span>
              <p className="text-[15px] font-semibold text-fg-900">Wala pang leads po.</p>
              <p className="max-w-[300px] text-[13.5px] leading-[1.5] text-fg-400">
                No leads recorded yet po. Once customers message, I'll add them right away. Waiting lang po! 🤗
              </p>
            </div>
          ) : (
            <div className="divide-y divide-line">
              {attention.map((lead) => (
                <div key={lead.id} className="flex items-start justify-between gap-3 px-4 py-3.5 sm:gap-4 sm:px-6 sm:py-4">
                  <div className="min-w-0">
                    <p className="truncate text-[14.5px] font-bold text-fg-900 sm:text-[15px]">{lead.company}</p>
                    <p className="mt-1 truncate text-[13px] text-fg-500 sm:text-[13.5px]">
                      {lead.project} · {lead.location}
                    </p>
                    <p className="mt-1.5 hidden text-[13px] text-fg-400 sm:block">{lead.nextAction}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[14.5px] font-bold text-fg-900 sm:text-[15px]">{peso(lead.value)}</p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-600 sm:text-[12px]">
                      {lead.stage}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="What are we doing?" bodyClassName="divide-y divide-line">
          {ACTIONS.map(({ key, title, hint, icon: Icon }) => (
            <button
              key={key}
              onClick={() => onAction(key)}
              className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-surface-2 sm:gap-4 sm:px-6 sm:py-[18px]"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600 sm:h-9 sm:w-9">
                <Icon className="h-[15px] w-[15px] sm:h-[17px] sm:w-[17px]" strokeWidth={1.9} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] font-bold text-fg-900 sm:text-[15.5px]">{title}</span>
                <span className="mt-0.5 block truncate text-[12.5px] text-fg-500 sm:text-[13.5px]">{hint}</span>
              </span>
              <ChevronRight className="h-[16px] w-[16px] shrink-0 text-fg-300 sm:h-[18px] sm:w-[18px]" strokeWidth={2} />
            </button>
          ))}
        </Panel>
      </div>
    </div>
  );
}
