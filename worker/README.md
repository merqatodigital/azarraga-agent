# Azarraga Commercial Agent — Cloudflare deployment

Architecture (no Postgres, no REST CRUD, no OpenAI key, no Composio):

| Concern      | Cloudflare primitive                                            |
| ------------ | --------------------------------------------------------------- |
| Compute      | Cloudflare Workers (`worker/index.ts`)                            |
| Agent + state| Durable Object `AzarragaAgent extends Agent<Env, AzarragaState>`  |
| AI           | Workers AI `env.AI` (`llama-3.3-70b`, `llama-3.2-11b-vision`)     |
| AI routing   | OpenRouter first (`OPENROUTER_API_KEY`), Workers AI fallback        |
| Documents    | R2 bucket `commercial-documents` (originals stay private)         |
| Cache        | KV namespace `COMMERCIAL_CACHE`                                   |
| Realtime     | WebSocket state sync (`cf_agent_state` broadcasts)                |

## Provision

```bash
npm i -D wrangler
npx wrangler r2 bucket create commercial-documents
npx wrangler kv namespace create COMMERCIAL_CACHE   # paste the id into wrangler.jsonc
npx wrangler secret put OPENROUTER_API_KEY          # optional, Workers AI remains fallback
```

## Run / deploy

```bash
npm run build          # builds the SPA into ./dist (served via the ASSETS binding)
npx wrangler dev       # Worker + Durable Object + Workers AI locally
npx wrangler deploy
```

## Client wiring

`src/agent/useAzarragaAgent.ts` speaks the Agents SDK wire protocol
(`cf_agent_state` broadcasts + JSON-RPC frames) against
`/agents/azarraga-agent/:room`. Point it at a deployed Worker with:

```bash
VITE_AGENT_URL=https://azarraga-commercial-agent.<account>.workers.dev npm run build
```

Without that variable the same reducer runs in the browser, so the workspace is
fully interactive before the Worker is provisioned.

## Agent RPC surface

`chat`, `refresh`, `setModel`, `addLead`, `createQuote`, `advanceQuote`,
`issueInvoice`, `recordPayment`, `reprocessDocument` — plus HTTP
`POST /agents/azarraga-agent/:room/upload` (R2 put + `learnDocument` schedule)
and `GET …/original/:key` for private originals.
