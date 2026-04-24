// Tiny status dot rendered over avatars.
// green = connected · amber = idle · gray = offline. Pulls color tokens from colors_and_type.css.

import type { PresenceStatus } from "@/api/types";

const COLORS: Record<PresenceStatus, string> = {
  green: "var(--mint-500)",
  amber: "var(--tape-500)",
  gray: "var(--fg4)",
};

export function PresenceDot({ status, size = 8 }: { status: PresenceStatus | null | undefined; size?: number }) {
  const s = status ?? "gray";
  return (
    <span
      aria-label={`presence ${s}`}
      title={s === "green" ? "Online" : s === "amber" ? "Idle" : "Offline"}
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "50%",
        background: COLORS[s],
        border: "1.5px solid var(--paper-0)",
        boxShadow: s === "green" ? "0 0 0 1px rgba(46,189,130,0.2)" : undefined,
      }}
    />
  );
}
