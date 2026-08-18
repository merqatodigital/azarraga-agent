/**
 * Shared contract between the Cloudflare Worker (Durable Object agent)
 * and the React client.
 *
 * The Worker runs:  class AzarragaAgent extends Agent<Env, AzarragaState>
 */

export type IntelligenceStatus = "LEARNED" | "STORED" | "PROCESSING" | "FAILED";
export type LeadStage = "new" | "qualifying" | "quoted" | "won" | "lost";
export type QuoteStatus = "draft" | "sent" | "approved" | "declined";
export type InvoiceStatus = "draft" | "sent" | "partial" | "paid" | "overdue";

export type TalaMood =
  | "idle"
  | "listening"
  | "processing"
  | "analyzing"
  | "happy"
  | "confused"
  | "busy"
  | "speaking";

export interface Lead {
  id: string;
  company: string;
  contact: string;
  email: string | null;
  phone: string | null;
  project: string;
  location: string;
  value: number;
  stage: LeadStage;
  nextAction: string;
  updatedAt: string;
}

export interface QuoteLine {
  id: string;
  description: string;
  system: string;
  glass: string;
  frame: string;
  widthMm: number | null;
  heightMm: number | null;
  qty: number;
  unit: string;
  unitPrice: number;
}

export interface Quote {
  id: string;
  ref: string;
  customer: string;
  project: string;
  location: string;
  leadTime: string;
  terms: string;
  lines: QuoteLine[];
  subtotal: number;
  status: QuoteStatus;
  createdAt: string;
}

export interface Invoice {
  id: string;
  ref: string;
  customer: string;
  project: string;
  amount: number;
  paid: number;
  balance: number;
  dueDate: string;
  status: InvoiceStatus;
  issuedAt: string;
}

export interface ExtractedLine {
  index: number;
  opening: string;
  raw: string;
  productFamily: string;
  system: string;
  configuration: string;
  qty: number;
  unit: string;
  widthMm: string;
  heightMm: string;
  glass: string;
  dimensions?: string;
  specification?: string;
  areaSqm?: number | null;
  areaSqft?: number | null;
  linearMeters?: number | null;
  taxType?: string;
  unitPrice: string;
  lineTotal: string;
  calculatedLineTotal?: number | null;
  lineDiscrepancy?: number | null;
}

export interface Party {
  name: string;
  address?: string;
  tin?: string;
  taxId?: string;
  contact?: string;
  email?: string;
  phone?: string;
  website?: string;
}

export interface TaxBreakdown {
  type: string;
  rate: number | null;
  taxableBase: number | null;
  amount: number;
  jurisdiction?: string;
}

export interface ExtractionAudit {
  reviewStatus: "PASS" | "FAIL";
  reason: string;
  currency: "PHP" | "USD" | "EUR";
  arithmeticBalanced: boolean;
  calculatedLineSubtotal: number;
  calculatedGrandTotal: number;
  statedGrandTotal: number | null;
  discrepancy: number;
}

export interface Extraction {
  documentType: string;
  documentDate: string;
  issueDate?: string;
  dueDate?: string;
  deliveryDate?: string;
  invoiceNumber?: string;
  poNumber?: string;
  jobReference?: string;
  mrsNumber: string;
  paymentTerms: string;
  status: IntelligenceStatus;
  humanReview: string;
  reviewStatus?: "PASS" | "FAIL";
  reviewReason?: string;
  currency?: "PHP" | "USD" | "EUR";
  audit?: ExtractionAudit;
  memo: string;
  instructions: string;
  buyer: Party;
  supplier: Party;
  project: Party;
  financial: {
    productSubtotal: number;
    vat: number;
    vatableSales?: number;
    vatAmount?: number;
    zeroRatedSales?: number;
    exemptSales?: number;
    salesTax?: number;
    taxBreakdown?: TaxBreakdown[];
    discount: number;
    crating: number;
    shipping: number;
    trucking: number;
    delivery: number;
    installation: number;
    documentTotal: number;
  };
  lines: ExtractedLine[];
  missing: string[];
  conflicts: string[];
  provenance: {
    bucket: string;
    path: string;
    mime: string;
    bytes: number;
    version: string;
    learnedAt: string;
  };
}

export interface DocumentRecord {
  id: string;
  filename: string;
  mime: string;
  sizeBytes: number;
  intelligence: IntelligenceStatus;
  storage: "private";
  uploadedAt: string;
  r2Key: string;
  extraction?: Extraction;
}

export interface QuickReply {
  label: string;
  prompt: string;
  icon?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  streaming?: boolean;
  mood?: TalaMood;
  quickReplies?: QuickReply[];
}

/* ------------------------------------------------------------------ *
 * KNOWLEDGE SYSTEM — TALA's long-term memory.
 * Grows from every conversation, document and quote decision.
 * R2 keeps the source files, KV caches the extracted facts, the
 * Durable Object (AzarragaState.knowledge) is the queryable memory.
 * ------------------------------------------------------------------ */

export type PreferenceConfidence = "confirmed" | "inferred";

export interface CustomerPreference {
  key: string; // e.g. "glass_type", "frame_style", "payment_terms"
  value: string;
  confidence: PreferenceConfidence;
  learnedFrom: string; // e.g. "quote AGQ-0002", "conversation msg_x9f"
  learnedAt: string;
}

export interface CustomerMemory {
  id: string;
  company: string;
  contact: string;
  email: string | null;
  phone: string | null;
  location: string;
  projectHistory: Array<{ ref: string; kind: "quote" | "invoice"; project: string; amount: number; status: string }>;
  preferences: CustomerPreference[];
  lastInteractionAt: string;
  interactionCount: number;
  notes: string[];
}

export interface PricingSignal {
  id: string;
  system: string; // e.g. "900 Series"
  glass: string; // e.g. "10mm Tempered Clear"
  frame: string;
  outcome: "approved" | "rejected" | "sent";
  unitPrice: number;
  widthMm: number | null;
  heightMm: number | null;
  quoteRef: string;
  customer: string;
  recordedAt: string;
}

export interface SupplierFact {
  id: string;
  material: string; // e.g. "6mm Clear Glass"
  supplierName: string;
  sourceDocument: string; // filename
  sourceDocumentId: string;
  partNumber?: string;
  unitCost?: number;
  learnedAt: string;
}

export interface LearnedFact {
  id: string;
  kind: "conversation" | "document" | "quote" | "job";
  summary: string;
  sourceRef: string; // message id / document id / quote id
  tags: string[];
  createdAt: string;
}

export interface KnowledgeSuggestion {
  id: string;
  title: string;
  detail: string;
  kind: "pricing" | "approach" | "follow-up" | "supplier";
  confidence: number; // 0-1
  createdAt: string;
}

/* ------------------------------------------------------------------ *
 * AGENTIC LAYER — TALA acts without being asked.
 * FollowUpTask records are produced by the Durable Object's recurring
 * alarm (this.schedule) or the in-browser mirror's interval, so TALA
 * proactively drafts outreach instead of waiting for a manual prompt.
 * ------------------------------------------------------------------ */

export type FollowUpKind = "quote_stale" | "lead_cold" | "invoice_overdue" | "customer_checkin";
export type FollowUpStatus = "pending" | "approved" | "dismissed";

export interface FollowUpTask {
  id: string;
  kind: FollowUpKind;
  title: string;
  detail: string;
  draftMessage: string;
  relatedId: string | null;
  relatedLabel: string | null;
  status: FollowUpStatus;
  dueAt: string;
  createdAt: string;
}

export interface KnowledgeBase {
  customers: CustomerMemory[];
  pricingSignals: PricingSignal[];
  supplierFacts: SupplierFact[];
  facts: LearnedFact[];
  suggestions: KnowledgeSuggestion[];
  stats: {
    conversationsLearned: number;
    documentsLearned: number;
    quotesAnalyzed: number;
    lastTrainedAt: string | null;
  };
}

export function emptyKnowledgeBase(): KnowledgeBase {
  return {
    customers: [],
    pricingSignals: [],
    supplierFacts: [],
    facts: [],
    suggestions: [],
    stats: { conversationsLearned: 0, documentsLearned: 0, quotesAnalyzed: 0, lastTrainedAt: null },
  };
}

export interface AzarragaState {
  business: {
    name: string;
    legalName: string;
    tagline: string;
    region: string;
    locations: string[];
    services: string[];
    contacts: Array<{ carrier: string; number: string }>;
  };
  model: string;
  memory: "connected" | "connecting" | "offline";
  leads: Lead[];
  quotes: Quote[];
  invoices: Invoice[];
  documents: DocumentRecord[];
  messages: ChatMessage[];
  knowledge: KnowledgeBase;
  followUps: FollowUpTask[];
  lastAutonomousRunAt: string | null;
  updatedAt: string;
}

export type AgentMethod =
  | "chat"
  | "quickAction"
  | "createQuote"
  | "addLead"
  | "setModel"
  | "reprocessDocument"
  | "uploadDocument"
  | "refresh"
  | "createInvoice"
  | "extractLeadFromUrl"
  | "learnFromConversation"
  | "learnFromQuote"
  | "answerFromMemory"
  | "suggestImprovements"
  | "runDueFollowUps"
  | "approveFollowUp"
  | "dismissFollowUp"
  | "declineQuote";

export interface RpcRequest {
  type: "rpc";
  id: string;
  method: AgentMethod;
  args: unknown[];
}

export interface RpcResponse {
  type: "rpc";
  id: string;
  success: boolean;
  result?: unknown;
  error?: string;
}

export interface StateMessage {
  type: "cf_agent_state";
  state: AzarragaState;
}

export type ServerMessage = StateMessage | RpcResponse;
