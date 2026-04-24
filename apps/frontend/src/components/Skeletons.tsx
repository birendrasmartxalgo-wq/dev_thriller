// Skeleton primitives — case-file tape motif.
// Styling lives in /styles/skeletons.css (imported from main.tsx).
// Use silently in place of "Loading…" plain text.

import type { CSSProperties } from "react";

type Props = { style?: CSSProperties; className?: string };

// ----- leaf shapes -----------------------------------------------------------

export function SkLine({ width = "100%", height = 10, style, className }: Props & { width?: number | string; height?: number }) {
  return <span className={`sk sk-line ${className ?? ""}`} style={{ width, height, display: "block", ...style }} aria-hidden="true" />;
}

export function SkCircle({ size = 28, style, className }: Props & { size?: number }) {
  return <span className={`sk sk-circle ${className ?? ""}`} style={{ width: size, height: size, display: "block", ...style }} aria-hidden="true" />;
}

export function SkBlock({ width = "100%", height = 80, style, className }: Props & { width?: number | string; height?: number | string }) {
  return <span className={`sk sk-block ${className ?? ""}`} style={{ width, height, display: "block", ...style }} aria-hidden="true" />;
}

// ----- composites ------------------------------------------------------------

// Dashboard / inbox-list row skeleton — avatar + two lines + meta.
export function RowSkeleton() {
  return (
    <div className="sk-row" role="presentation" aria-hidden="true">
      <SkCircle size={28} />
      <div style={{ display: "grid", gap: 6 }}>
        <SkLine width="40%" height={10} />
        <SkLine width="70%" height={8} />
      </div>
      <SkLine width={60} height={8} />
    </div>
  );
}

// Dashboard card skeleton — header + body lines.
export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="sk-card" role="presentation" aria-hidden="true">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <SkLine width={140} height={12} />
        <SkLine width={48} height={8} />
      </div>
      {Array.from({ length: lines }).map((_, i) => (
        <SkLine key={i} width={i === 0 ? "86%" : i === lines - 1 ? "60%" : "74%"} height={10} />
      ))}
    </div>
  );
}

// Chat message skeleton — avatar + author line + body lines.
export function MessageSkeleton({ bodyLines = 2 }: { bodyLines?: number }) {
  return (
    <div className="sk-msg" role="presentation" aria-hidden="true">
      <SkCircle size={32} />
      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <SkLine width={90} height={10} />
          <SkLine width={40} height={8} />
        </div>
        {Array.from({ length: bodyLines }).map((_, i) => (
          <SkLine key={i} width={i === bodyLines - 1 ? "50%" : "90%"} height={10} />
        ))}
      </div>
    </div>
  );
}

// Files gallery tile skeleton — thumb + name + meta.
export function FileTileSkeleton() {
  return (
    <div className="sk-tile" role="presentation" aria-hidden="true">
      <SkBlock height={96} />
      <SkLine width="70%" height={10} />
      <SkLine width="40%" height={8} />
    </div>
  );
}

// Table row skeleton — matches Files table columns (name / size / status / modified / action).
export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <tr aria-hidden="true">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} style={{ padding: 10, borderBottom: "1px solid var(--border-soft)" }}>
          <SkLine width={i === 0 ? "70%" : i === columns - 1 ? 30 : "50%"} height={10} />
        </td>
      ))}
    </tr>
  );
}
