/**
 * Azarraga Commercial Agent — Cloudflare Workers entry point.
 *
 *   Runtime : Cloudflare Workers
 *   Agent   : AzarragaAgent (see ./AzarragaAgent.ts) — Durable Object via
 *             `Agent<Env, AzarragaState>` from the Cloudflare Agents SDK
 *   AI      : Workers AI (env.AI) — no OpenAI key, no external LLM account
 *   Files   : R2 bucket `commercial-documents`
 *   Cache   : KV namespace `COMMERCIAL_CACHE`
 *   Realtime: WebSocket state sync (`agents/react` → useAgent on the client)
 *
 * There is no Postgres, no REST CRUD layer and no Composio here by design.
 * The Durable Object class bound in wrangler.jsonc must be exported from
 * this main entry file — see AzarragaAgent.ts for the actual agent logic
 * (memory, document learning, proactive suggestions, autonomous follow-ups).
 */

import { routeAgentRequest } from "agents";
import { AzarragaAgent, type Env } from "./AzarragaAgent";

export { AzarragaAgent };
export type { Env };

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    // /agents/azarraga-agent/:room  → WebSocket + HTTP routed to the Durable Object
    return (
      (await routeAgentRequest(request, env, { cors: true })) ??
      env.ASSETS.fetch(request) ??
      new Response("Not found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
