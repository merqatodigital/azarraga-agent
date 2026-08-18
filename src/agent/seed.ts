import type {
  AzarragaState,
  CustomerMemory,
  DocumentRecord,
  ExtractedLine,
  KnowledgeBase,
  SupplierFact,
} from "./types";

export const OPENROUTER_MODELS = [
  "NVIDIA: Nemotron 3.5 Lightning (free)",
  "Meta: Llama 3.3 70B Instruct (free)",
  "Qwen: Qwen3 235B A22B (free)",
  "DeepSeek: R1 Distill Llama 70B (free)",
  "Workers AI: @cf/meta/llama-3.3-70b-instruct-fp8-fast",
];

const rawLines: Array<[number, string, string]> = [
  [1, "—", "Fixed w/ Pocket Slide onr, Black Frame 10mm Tempered Clear 4.072 x 2.700"],
  [1, "—", "Fixed w/ Pocket Slide onr, Black Frame 10mm Tempered Clear 4.097 x 2.700"],
  [1, "—", "900 series Fixed-Slide-Slide Door, Black Frame, 10mm Tempered Clear 3.600 x 2.700 (SD3)"],
  [1, "—", "900 series Fixed-Slide-Slide Door, Black Frame, 10mm Tempered Clear 2.938 x 2.700 (SD4)"],
  [1, "—", "900 series Fixed-Slide-Slide Door, Black Frame, 10mm Tempered Clear 2.987 x 2.700 (SD5)"],
  [1, "—", "900 series Fixed-Slide-Slide Door, Black Frame, 10mm Tempered Clear 7.994 x 2.700 (SD6)"],
  [1, "—", "900 series Fixed-Slide-Slide Door, Black Frame, 10mm Tempered Clear 3.006 x 2.700 (SD7)"],
  [1, "—", "900 series Fixed-Slide-Slide Door, Black Frame, 10mm Tempered Clear 2.975 x 2.700 (SD8)"],
  [1, "—", "900 series Fixed-Slide-Slide Door, Black Frame, 10mm Tempered Clear 3.025 x 2.700 (SD9)"],
  [1, "—", "900 series Fixed-Slide-Slide Door, Black Frame, 10mm Tempered Clear 3.597 x 2.700 (SD10)"],
  [1, "—", "900 series Fixed-Slide-Slide Door, Black Frame, 10mm Tempered Clear 3.808 x 2.700 (SD11)"],
  [
    12,
    "—",
    "900 series Fixed-Slide-Slide Door, Black Frame, 10mm Tempered Clear 2.975 x 2.700 (SD12) Crating, shipping, trucking & installation cost Purchase discounts ***NOTHING FOLLOWS***",
  ],
];

const extractedLines: ExtractedLine[] = rawLines.map(([index, opening, raw]) => ({
  index,
  opening,
  raw,
  productFamily: "—",
  system: "—",
  configuration: "—",
  qty: 1,
  unit: "Set",
  widthMm: "—",
  heightMm: "—",
  glass: "—",
  unitPrice: "—",
  lineTotal: "—",
}));

export const seedDocuments: DocumentRecord[] = [
  {
    id: "doc_57c5969f",
    filename: "WhatsApp Image 2026-08-15 at 8.02.50 AM.jpeg",
    mime: "image/jpeg",
    sizeBytes: 271790,
    intelligence: "LEARNED",
    storage: "private",
    uploadedAt: "2026-08-16T18:11:26.000Z",
    r2Key:
      "57c5969f-435a-47b4-868c-6e4e1e1d5718/1786875083998-WhatsApp_Image_2026-08-15_at_8.02.50_AM.jpeg",
    extraction: {
      documentType: "purchase_order",
      documentDate: "2026-04-23",
      mrsNumber: "TCAT04001",
      paymentTerms: "Net",
      status: "LEARNED",
      humanReview: "Not required",
      memo: "FOR GROUND FLOOR & 2ND FLOOR",
      instructions:
        "This P.O. number must appear on all Delivery Receipts, Invoices, packages, boxes and shipping instructions. To process payment always attach SALES INVOICES upon delivery of item ordered.",
      buyer: {
        name: "TAGUSAO CONSTRUCTION AND TRADING INC.",
        address: "VRC Rizal Ave. Ext. Bancao Bancao Puerto Princesa City, Palawan",
        tin: "009-224-724-000",
      },
      supplier: {
        name: "AZARRAGA GLASS & ALUMINUM",
        address: "5300 SOUTH NATIONAL HIGHWAY SAN PEDRO PUERTO PRINCESA CITY",
      },
      project: { name: "TARA HOSTEL-ELNIDO" },
      financial: {
        productSubtotal: 847765,
        vat: 90831.97,
        discount: 0,
        crating: 0,
        shipping: 0,
        trucking: 0,
        delivery: 0,
        installation: 0,
        documentTotal: 905000,
      },
      lines: extractedLines,
      missing: [],
      conflicts: [],
      provenance: {
        bucket: "commercial-documents",
        path:
          "57c5969f-435a-47b4-868c-6e4e1e1d5718/1786875083998-WhatsApp_Image_2026-08-15_at_8.02.50_AM.jpeg",
        mime: "image/jpeg",
        bytes: 271790,
        version: "tala-document-v1",
        learnedAt: "2026-08-16T10:13:25.511+00:00",
      },
    },
  },
  {
    id: "doc_30456952",
    filename: "304569524_483325140471476_4772109627847171135_n.jpg",
    mime: "image/jpeg",
    sizeBytes: 47104,
    intelligence: "STORED",
    storage: "private",
    uploadedAt: "2026-08-16T14:24:14.000Z",
    r2Key: "57c5969f-435a-47b4-868c-6e4e1e1d5718/1786861454002-304569524_483325140471476.jpg",
  },
  {
    id: "doc_banner01",
    filename: "azarraga_glass_banner.jpeg",
    mime: "image/jpeg",
    sizeBytes: 58368,
    intelligence: "STORED",
    storage: "private",
    uploadedAt: "2026-08-16T14:24:00.000Z",
    r2Key: "57c5969f-435a-47b4-868c-6e4e1e1d5718/1786861440110-azarraga_glass_banner.jpeg",
  },
];

/**
 * TALA's starter long-term memory — seeded from the one learned PO
 * (TCAT04001) so she already "knows" the Tagusao/Tara Hostel history
 * on first boot, exactly like a real employee's first week of notes.
 */
export function seedKnowledgeBase(): KnowledgeBase {
  const learnedDoc = seedDocuments.find((d) => d.intelligence === "LEARNED");
  const extraction = learnedDoc?.extraction;

  const customers: CustomerMemory[] = extraction
    ? [
        {
          id: "cust_tagusao",
          company: extraction.buyer.name,
          contact: "—",
          email: null,
          phone: null,
          location: "Puerto Princesa",
          projectHistory: [
            {
              ref: extraction.mrsNumber,
              kind: "quote",
              project: extraction.project.name,
              amount: extraction.financial.documentTotal,
              status: "learned_from_po",
            },
          ],
          preferences: [
            {
              key: "glass_type",
              value: "10mm Tempered Clear",
              confidence: "confirmed",
              learnedFrom: `document ${learnedDoc!.filename}`,
              learnedAt: extraction.provenance.learnedAt,
            },
            {
              key: "frame_style",
              value: "Black Frame, 900 Series Fixed-Slide-Slide Door",
              confidence: "confirmed",
              learnedFrom: `document ${learnedDoc!.filename}`,
              learnedAt: extraction.provenance.learnedAt,
            },
            {
              key: "payment_terms",
              value: extraction.paymentTerms,
              confidence: "confirmed",
              learnedFrom: `document ${learnedDoc!.filename}`,
              learnedAt: extraction.provenance.learnedAt,
            },
          ],
          lastInteractionAt: extraction.provenance.learnedAt,
          interactionCount: 1,
          notes: [`Beachfront hostel build — ${extraction.project.name}, El Nido.`],
        },
      ]
    : [];

  const supplierFacts: SupplierFact[] = extraction
    ? [
        {
          id: "sup_azarraga_glass",
          material: "10mm Tempered Clear Glass",
          supplierName: extraction.supplier.name,
          sourceDocument: learnedDoc!.filename,
          sourceDocumentId: learnedDoc!.id,
          learnedAt: extraction.provenance.learnedAt,
        },
      ]
    : [];

  return {
    customers,
    pricingSignals: [],
    supplierFacts,
    facts: extraction
      ? [
          {
            id: "fact_seed_po",
            kind: "document",
            summary: `Learned PO ${extraction.mrsNumber}: ${extraction.buyer.name} ordered ${extraction.lines.length} openings for ${extraction.project.name}, total ${extraction.financial.documentTotal}.`,
            sourceRef: learnedDoc!.id,
            tags: ["purchase-order", "tara-hostel", "el-nido"],
            createdAt: extraction.provenance.learnedAt,
          },
        ]
      : [],
    suggestions: [],
    stats: {
      conversationsLearned: 0,
      documentsLearned: extraction ? 1 : 0,
      quotesAnalyzed: 0,
      lastTrainedAt: extraction ? extraction.provenance.learnedAt : null,
    },
  };
}

export function createInitialState(): AzarragaState {
  return {
    business: {
      name: "Azarraga Glass",
      legalName: "AZARRAGA GLASS & ALUMINUM",
      tagline: "Find the customer. Quote the job. Get paid.",
      region: "Palawan operations",
      locations: ["Puerto Princesa", "El Nido", "San Vicente", "Port Barton"],
      services: [
        "Fabrication and Installation of Aluminum Doors, Windows and Screen Door",
        "Frameless Patch Fittings",
        "Shower Enclosures",
        "Tempered Glass Storefronts, Stair Railings, Doors and Windows",
        "Roll Up",
      ],
      contacts: [
        { carrier: "Globe", number: "0945-1308277" },
        { carrier: "Smart", number: "0999-705 7770" },
      ],
    },
    model: OPENROUTER_MODELS[0],
    memory: "connected",
    leads: [],
    quotes: [],
    invoices: [],
    documents: seedDocuments,
    messages: [
      {
        id: "msg_ready",
        role: "assistant",
        content:
          "Kumusta po! 👋 I'm TALA from Azarraga Glass & Aluminum in Palawan. Ready na po! 🏝️ I'm your commercial teammate — I remember every customer, I read PO photos, I draft quotes, and I speak Taglish with po/opo.\n\nTry a quick action below or just type — Kumusta ang project niyo today? 😊",
        createdAt: "2026-08-16T14:25:00.000Z",
      },
    ],
    knowledge: seedKnowledgeBase(),
    followUps: [],
    lastAutonomousRunAt: null,
    updatedAt: "2026-08-16T18:11:26.000Z",
  };
}
