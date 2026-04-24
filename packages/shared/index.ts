// Shared types between backend and frontend.
// Re-exports the Elysia `App` type so the frontend can drive Eden Treaty inference
// without pulling the backend's runtime bundle into the Vite build.

export type { App } from "../../apps/backend/src/index";

// Common WS envelope shape. Kept intentionally narrow — Phase 6 only wires this
// as a type hint; the WS client in apps/frontend/src/modules/chat/ChatView.tsx
// parses raw JSON and will pick it up when it tightens its message handling.
export type WsMessage =
  | { type: "ready"; userId: string }
  | { type: "pong" }
  | { type: "subscribed"; topic: string }
  | { type: "error"; code: string }
  | { type: "presence.join"; userId: string }
  | { type: "presence.leave"; userId: string }
  | { type: "message.created"; message: unknown }
  | { type: "message.updated"; message: unknown }
  | { type: "message.deleted"; id: string }
  | { type: "message.reacted"; message: unknown };
