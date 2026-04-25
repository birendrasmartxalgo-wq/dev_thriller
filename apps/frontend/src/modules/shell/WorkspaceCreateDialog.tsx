// Workspace-create modal. Replaces the window.prompt flow in Shell.tsx so
// users get inline validation (slug pattern + length) and a proper case-file
// case-creation surface — no native dialogs.
//
// Schema mirrors the backend POST /v1/workspaces: { name, slug? }. Visibility
// is set per-project, not per-workspace, so we don't expose it here.

import { useEffect, useState, type FormEvent } from "react";
import { workspaceApi } from "@/api/endpoints";
import { Icon } from "@/components/Icons";
import { toast } from "@/store/toast";

const SLUG_RE = /^[a-z0-9-]+$/;
const SLUG_MIN = 3;
const SLUG_MAX = 32;

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX);
}

interface Props {
  onClose: () => void;
  onCreated: (ws: { id: string; slug: string; name: string }) => void;
}

export function WorkspaceCreateDialog({ onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverErr, setServerErr] = useState<string | null>(null);

  // Auto-derive slug from name until the user manually edits the field.
  useEffect(() => {
    if (slugTouched) return;
    setSlug(slugify(name));
  }, [name, slugTouched]);

  // Esc to close.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const nameTrimmed = name.trim();
  const nameErr = nameTrimmed.length === 0 ? "Name is required." : nameTrimmed.length > 80 ? "Keep it under 80 characters." : null;
  const slugErr =
    slug.length < SLUG_MIN
      ? `At least ${SLUG_MIN} characters.`
      : slug.length > SLUG_MAX
      ? `Keep it under ${SLUG_MAX} characters.`
      : !SLUG_RE.test(slug)
      ? "Lowercase letters, digits, and dashes only."
      : null;
  const canSubmit = !busy && !nameErr && !slugErr;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setServerErr(null);
    try {
      const r = await workspaceApi.create({ name: nameTrimmed, slug });
      toast(`Case "${r.name}" opened`);
      onCreated(r);
    } catch (err) {
      setServerErr((err as Error).message || "Couldn't open the case.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onClick={onClose}
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(14, 17, 48, 0.35)",
        zIndex: 120,
        display: "grid",
        placeItems: "center",
      }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={onSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ws-create-title"
        style={{
          width: 460,
          maxWidth: "calc(100vw - 32px)",
          background: "var(--paper-0)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          boxShadow: "var(--sh-3)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--border-soft)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Icon.plus size={16} />
          <strong id="ws-create-title" style={{ font: "600 14px/1 var(--font-sans)" }}>
            Open a new case
          </strong>
          <span className="caseno">CASE · NEW</span>
          <div style={{ flex: 1 }} />
          <button type="button" className="tb-btn" onClick={onClose} aria-label="Close">
            <Icon.x size={14} />
          </button>
        </div>

        <div style={{ padding: 16, display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 4 }}>
            <span className="caseno">NAME</span>
            <input
              autoFocus
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Studio"
              maxLength={80}
              required
              data-testid="workspace-name"
              aria-invalid={Boolean(name && nameErr)}
            />
            {name && nameErr && (
              <span className="hint" style={{ color: "var(--blood-500)" }}>
                {nameErr}
              </span>
            )}
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            <span className="caseno">SLUG</span>
            <input
              className="input"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              placeholder="acme-studio"
              maxLength={SLUG_MAX}
              required
              data-testid="workspace-slug"
              aria-invalid={Boolean(slug && slugErr)}
            />
            {slug && slugErr ? (
              <span className="hint" style={{ color: "var(--blood-500)" }}>
                {slugErr}
              </span>
            ) : (
              <span className="hint">Used in URLs and DM mentions. Lowercase, dashes, 3–{SLUG_MAX} chars.</span>
            )}
          </label>

          {serverErr && (
            <div
              role="alert"
              className="hint"
              style={{ color: "var(--blood-500)", border: "1px solid var(--border-soft)", padding: 8, borderRadius: 8 }}
            >
              {serverErr}
            </div>
          )}
        </div>

        <div
          style={{
            padding: "10px 16px",
            borderTop: "1px solid var(--border-soft)",
            background: "var(--bg-sunken)",
            display: "flex",
            gap: 8,
            alignItems: "center",
            justifyContent: "flex-end",
          }}
        >
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!canSubmit}
            data-testid="workspace-create-submit"
          >
            {busy ? <span className="spinner" /> : <><Icon.check size={14} /> Open case</>}
          </button>
        </div>
      </form>
    </div>
  );
}
