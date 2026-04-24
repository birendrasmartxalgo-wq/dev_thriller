// Migrated from app/auth.jsx — Onboarding.
// 4 steps: Profile confirm → Workspace create → (integrations skipped per PRD) → First upload.

import { useRef, useState } from "react";
import { useSession } from "@/store/session";
import { workspaceApi } from "@/api/endpoints";
import { useUploads, formatBytes } from "@/lib/upload";
import { Icon } from "@/components/Icons";
import { navigate } from "@/router";
import { toast } from "@/store/toast";

export function Onboarding() {
  const user = useSession((s) => s.user);
  const setActive = useSession((s) => s.setActiveWorkspace);
  const setWorkspaces = useSession((s) => s.setWorkspaces);
  const [step, setStep] = useState(0);
  const [wsName, setWsName] = useState(user ? `${user.name.split(" ")[0]}'s workspace` : "My workspace");
  const [wsId, setWsId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const enqueue = useUploads((s) => s.enqueue);
  const jobs = useUploads((s) => s.jobs);
  const fileInput = useRef<HTMLInputElement>(null);

  const steps = [
    { title: "Profile", sub: "Who are you on the credits?" },
    { title: "Workspace", sub: "Open your studio." },
    { title: "First upload", sub: "Drop a file to test the chain." },
    { title: "Ready", sub: "Enter the workspace." },
  ];

  async function createWorkspace() {
    if (!wsName.trim() || creating) return;
    setCreating(true);
    try {
      const r = await workspaceApi.create({ name: wsName.trim() });
      setWsId(r.id);
      const list = await workspaceApi.list();
      setWorkspaces(list.items);
      setActive(r.id);
      toast(`Case “${r.name}” opened`);
      setStep(2);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setCreating(false);
    }
  }

  function onFiles(list: FileList | null) {
    if (!list || !wsId) return;
    for (const f of Array.from(list)) {
      if (f.size > 1024 * 1024 * 1024) {
        toast(`${f.name} is over the 1 GB cap`, "error");
        continue;
      }
      enqueue(f, wsId);
    }
  }

  const myJobs = Object.values(jobs).filter((j) => j.workspaceId === wsId);

  function finish() {
    navigate("/");
  }

  return (
    <div style={{ height: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "18px 28px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid var(--border-soft)" }}>
        <img src="/assets/logo-monogram.svg" height={24} alt="" />
        <span style={{ font: "700 14px/1 var(--font-sans)" }}>Dev Thriller</span>
        <div style={{ flex: 1, display: "flex", gap: 8, justifyContent: "center", maxWidth: 520, margin: "0 auto" }}>
          {steps.map((_, i) => (
            <div key={i} style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: i <= step ? "var(--ember-500)" : "var(--paper-100)",
                  color: i <= step ? "#fff" : "var(--fg3)",
                  font: "600 11px/1 var(--font-mono)",
                  border: i === step ? "2px solid var(--ember-200)" : "0",
                }}
              >
                {i < step ? "✓" : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div style={{ flex: 1, height: 2, background: i < step ? "var(--ember-500)" : "var(--border-soft)" }} />
              )}
            </div>
          ))}
        </div>
        <button className="btn btn-ghost" onClick={finish}>
          Skip setup
        </button>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "40px 28px" }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <div className="caseno" style={{ marginBottom: 6 }}>
            STEP {step + 1} / {steps.length} · {steps[step]!.title.toUpperCase()}
          </div>
          <h1 style={{ font: "400 40px/1.1 var(--font-display)", letterSpacing: "-.01em", margin: "0 0 8px" }}>{steps[step]!.sub}</h1>

          {step === 0 && user && (
            <div style={{ marginTop: 28, display: "grid", gap: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div className="av av-xl" style={{ background: "var(--ember-500)" }}>
                  {user.name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("")}
                </div>
                <div>
                  <div style={{ font: "600 15px/1 var(--font-sans)" }}>{user.name}</div>
                  <div className="caseno" style={{ marginTop: 4, textTransform: "none", letterSpacing: 0 }}>
                    {user.email}
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div style={{ marginTop: 28, display: "grid", gap: 18 }}>
              <div className="field">
                <label>Workspace name</label>
                <input className="input" value={wsName} onChange={(e) => setWsName(e.target.value)} autoFocus />
                <div className="hint">You can invite teammates later from Settings → Workspace.</div>
              </div>
            </div>
          )}

          {step === 2 && wsId && (
            <div style={{ marginTop: 28 }}>
              <input ref={fileInput} type="file" multiple hidden onChange={(e) => onFiles(e.target.files)} />
              <div
                onClick={() => fileInput.current?.click()}
                style={{
                  border: "2px dashed var(--border)",
                  borderRadius: 12,
                  padding: 40,
                  textAlign: "center",
                  background: "var(--paper-50)",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    margin: "0 auto 14px",
                    borderRadius: 14,
                    background: "var(--ember-500)",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon.upload size={22} />
                </div>
                <div style={{ font: "600 16px/1.2 var(--font-sans)" }}>
                  Drop a file here, or <a href="#" onClick={(e) => e.preventDefault()}>browse</a>
                </div>
                <div className="caseno" style={{ marginTop: 8 }}>
                  CHUNKED · RESUMABLE · SHA256 VERIFIED
                </div>
              </div>

              {myJobs.map((j) => (
                <div key={j.id} className="card" style={{ marginTop: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 6,
                        background: "var(--blood-500)",
                        color: "#fff",
                        font: "700 10px/1 var(--font-mono)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {(j.mime.split("/")[1] ?? "BIN").slice(0, 3).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ font: "600 14px/1.2 var(--font-sans)" }}>{j.fileName}</div>
                      <div className="caseno" style={{ marginTop: 3, textTransform: "none", letterSpacing: 0, fontFamily: "var(--font-mono)" }}>
                        {formatBytes(j.uploadedBytes)} / {formatBytes(j.size)} · {Math.floor(j.progress * 100)}%
                      </div>
                    </div>
                    {j.status === "complete" ? (
                      <span className="chip success">
                        <span className="dot" />
                        VERIFIED
                      </span>
                    ) : j.status === "error" ? (
                      <span className="chip danger">
                        <span className="dot" />
                        ERROR
                      </span>
                    ) : (
                      <span className="chip warn">
                        <span className="dot" />
                        {j.status.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div style={{ height: 4, background: "var(--paper-200)", borderRadius: 999, marginTop: 10, overflow: "hidden" }}>
                    <div style={{ width: `${Math.floor(j.progress * 100)}%`, height: "100%", background: "var(--ember-500)" }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === 3 && (
            <div style={{ marginTop: 28 }}>
              <p style={{ color: "var(--fg2)" }}>
                The case file is open. Your workspace is live. Every write is logged to the hash chain, every upload is chunk-verified.
              </p>
              <p style={{ color: "var(--fg2)", marginTop: 12 }}>Press ⌘K to jump anywhere. Press ? for the keyboard map.</p>
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: "14px 28px", display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border-soft)" }}>
        <button className="btn btn-ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} style={{ visibility: step === 0 ? "hidden" : "visible" }}>
          ← Back
        </button>
        <button
          className="btn btn-primary"
          onClick={() => {
            if (step === 1) {
              void createWorkspace();
              return;
            }
            if (step === steps.length - 1) {
              finish();
              return;
            }
            setStep((s) => s + 1);
          }}
          disabled={(step === 1 && creating) || (step === 1 && !wsName.trim())}
        >
          {step === steps.length - 1 ? "Enter workspace →" : step === 1 ? (creating ? "Opening case…" : "Create workspace →") : "Continue →"}
        </button>
      </div>
    </div>
  );
}
