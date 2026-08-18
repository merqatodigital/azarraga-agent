import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LocalAzarragaAgent, uid } from "./runtime";
import type { AzarragaState, RpcResponse, ServerMessage } from "./types";

export type ConnectionStatus = "connecting" | "connected" | "reconnecting";

/**
 * Client hook for the AzarragaAgent Durable Object.
 *
 * With VITE_AGENT_URL → speaks the Agents SDK wire protocol over WebSocket
 * (cf_agent_state broadcasts + JSON-RPC calls).
 *
 * Without it → drives LocalAzarragaAgent (same reducer as the DO) in-browser
 * so the workspace is fully interactive before deploying the Worker.
 */
export function useAzarragaAgent(room = "main") {
  // Stable ref to the local agent — survives re-renders and StrictMode double-mount.
  const agentRef = useRef<LocalAzarragaAgent | null>(null);
  if (agentRef.current === null) {
    agentRef.current = new LocalAzarragaAgent();
  }
  const agent = agentRef.current;

  const [state, setState] = useState<AzarragaState>(() => agent.state);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const socketRef = useRef<WebSocket | null>(null);
  const pendingRef = useRef(
    new Map<string, { resolve: (value: unknown) => void; reject: (reason?: unknown) => void }>(),
  );

  // Subscribe to local agent state changes — this is the core reactivity bridge.
  // The agent calls `setState(newState)` which fires all listeners including
  // React's setState, causing a re-render with the latest state.
  useEffect(() => {
    const unsubscribe = agent.subscribe((nextState) => {
      setState(nextState);
    });
    return unsubscribe;
  }, [agent]);

  // WebSocket connection to deployed Worker (optional)
  useEffect(() => {
    const base = import.meta.env.VITE_AGENT_URL as string | undefined;
    if (!base) {
      // No Worker URL — use local agent, mark connected after brief delay
      const timer = window.setTimeout(() => setStatus("connected"), 350);
      return () => window.clearTimeout(timer);
    }

    const wsUrl = `${base.replace(/^http/, "ws").replace(/\/$/, "")}/agents/azarraga-agent/${room}`;
    let socket: WebSocket;
    try {
      socket = new WebSocket(wsUrl);
    } catch {
      setStatus("connected"); // Fallback to local
      return;
    }
    socketRef.current = socket;

    socket.onopen = () => setStatus("connected");
    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data)) as ServerMessage;
        if (msg.type === "cf_agent_state") {
          setState(msg.state);
          return;
        }
        if (msg.type === "rpc") {
          const response = msg as RpcResponse;
          const pending = pendingRef.current.get(response.id);
          if (!pending) return;
          pendingRef.current.delete(response.id);
          if (response.success) pending.resolve(response.result);
          else pending.reject(new Error(response.error ?? "Agent RPC failed"));
        }
      } catch {
        // Ignore non-JSON frames
      }
    };
    socket.onerror = () => setStatus("connected"); // Fallback to local
    socket.onclose = () => {
      socketRef.current = null;
      setStatus("connected");
    };

    return () => {
      socket.close();
      socketRef.current = null;
      pendingRef.current.forEach((pending) => pending.reject(new Error("Agent socket closed")));
      pendingRef.current.clear();
    };
  }, [room]);

  // RPC caller — routes to WebSocket if connected, otherwise to local agent.
  const call = useCallback(
    (method: string, ...args: unknown[]) => {
      const socket = socketRef.current;
      if (socket && socket.readyState === WebSocket.OPEN) {
        const id = uid("rpc");
        const promise = new Promise<unknown>((resolve, reject) => {
          pendingRef.current.set(id, { resolve, reject });
          window.setTimeout(() => {
            const pending = pendingRef.current.get(id);
            if (!pending) return;
            pendingRef.current.delete(id);
            reject(new Error("Agent RPC timed out"));
          }, 45_000);
        });
        socket.send(JSON.stringify({ type: "rpc", id, method, args }));
        return promise;
      }
      // Local agent fallback — call synchronously
      return agent.call(method, args);
    },
    [agent],
  );

  // Derived metrics
  const metrics = useMemo(() => {
    const pipeline = state.quotes.reduce((s, q) => s + q.subtotal, 0);
    const receivables = state.invoices.reduce((s, i) => s + i.balance, 0);
    return {
      activeLeads: state.leads.filter((l) => l.stage !== "won" && l.stage !== "lost").length,
      pipeline,
      quoteCount: state.quotes.length,
      receivables,
      invoiceCount: state.invoices.length,
      documents: state.documents.length,
    };
  }, [state]);

  return { state, status, call, metrics };
}
