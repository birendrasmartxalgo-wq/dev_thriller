// Full-page search: live query, tabs, operator hints, jump-to-message.

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { searchApi } from "@/api/endpoints";
import { savedSearchApi } from "@/api/adminApi";
import { useSession } from "@/store/session";
import { navigate, useLocation } from "@/router";
import { Icon } from "@/components/Icons";
import { toast } from "@/store/toast";
import { RowSkeleton } from "@/components/Skeletons";

type TypeFilter = "all" | "message" | "file";

function useQueryParam(name: string) {
  const loc = useLocation();
  const sp = new URLSearchParams(loc.split("?")[1] ?? "");
  return sp.get(name) ?? "";
}

export function SearchView() {
  const activeWs = useSession((s) => s.activeWorkspaceId);
  const initialQ = useQueryParam("q");
  const [q, setQ] = useState(initialQ);
  const [type, setType] = useState<TypeFilter>("all");

  // Keep URL in sync so deep-links work (⌘K palette creates /search?q=...).
  useEffect(() => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    const qs = sp.toString();
    const target = qs ? `/search?${qs}` : "/search";
    const current = window.location.pathname + window.location.search;
    if (target !== current) navigate(target, true);
  }, [q]);

  const res = useQuery({
    queryKey: ["search", activeWs, q, type],
    queryFn: () => searchApi.query({ q, workspaceId: activeWs!, type, limit: 40 }),
    enabled: Boolean(activeWs && q.trim().length >= 2),
  });

  const saved = useQuery({
    queryKey: ["saved-search", activeWs],
    queryFn: () => savedSearchApi.list(activeWs!),
    enabled: Boolean(activeWs),
  });
  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: (name: string) => savedSearchApi.create({ workspaceId: activeWs!, name, query: q }),
    onSuccess: () => {
      toast("Search saved");
      qc.invalidateQueries({ queryKey: ["saved-search", activeWs] });
    },
    onError: (e) => toast((e as Error).message, "error"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => savedSearchApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-search", activeWs] }),
  });

  const parsed = res.data?.parsed;

  return (
    <div className="page">
      <div className="page-head">
        <div className="title-block">
          <div className="caseno">CASE · SEARCH</div>
          <h1>Search</h1>
          <div className="sub">
            Operators: <code>from:@name</code> · <code>has:file</code> · <code>has:image</code> · <code>before:YYYY-MM-DD</code> · <code>after:YYYY-MM-DD</code> ·{" "}
            <code>in:&lt;chatId&gt;</code>
          </div>
        </div>
      </div>

      <div style={{ padding: "16px 24px 0", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <Icon.search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--fg3)" }} />
          <input
            className="input"
            autoFocus
            placeholder='Try "from:@mia has:file deploy"'
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ paddingLeft: 30, height: 36 }}
          />
        </div>
        <div className="seg">
          {(
            [
              ["all", "All"],
              ["message", "Messages"],
              ["file", "Files"],
            ] as [TypeFilter, string][]
          ).map(([k, l]) => (
            <button key={k} className={type === k ? "on" : ""} onClick={() => setType(k)}>
              {l}
            </button>
          ))}
        </div>
        <button
          className="btn btn-secondary"
          onClick={() => {
            const name = window.prompt("Save this query as")?.trim();
            if (name) create.mutate(name);
          }}
          disabled={!q.trim() || create.isPending}
        >
          <Icon.pin size={14} /> Save
        </button>
      </div>

      {saved.data && saved.data.items.length > 0 && (
        <div style={{ padding: "10px 24px 0", display: "flex", flexWrap: "wrap", gap: 6 }}>
          {saved.data.items.map((s) => (
            <span key={s.id} className="chip" style={{ cursor: "pointer", paddingRight: 4 }} onClick={() => setQ(s.query)}>
              <span className="dot" />
              {s.name.toUpperCase()}
              <button
                className="tb-btn"
                style={{ width: 18, height: 18, padding: 0, marginLeft: 6 }}
                onClick={(e) => {
                  e.stopPropagation();
                  remove.mutate(s.id);
                }}
              >
                <Icon.x size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {parsed && (parsed.from || parsed.has || parsed.before || parsed.after || parsed.inChat) && (
        <div style={{ padding: "10px 24px 0", display: "flex", flexWrap: "wrap", gap: 6 }}>
          {parsed.from && (
            <span className="chip">
              <span className="dot" />
              FROM · {parsed.from}
            </span>
          )}
          {parsed.has && (
            <span className="chip">
              <span className="dot" />
              HAS · {parsed.has}
            </span>
          )}
          {parsed.before && (
            <span className="chip">
              <span className="dot" />
              BEFORE · {parsed.before.slice(0, 10)}
            </span>
          )}
          {parsed.after && (
            <span className="chip">
              <span className="dot" />
              AFTER · {parsed.after.slice(0, 10)}
            </span>
          )}
          {parsed.inChat && (
            <span className="chip">
              <span className="dot" />
              IN · {parsed.inChat.slice(-6)}
            </span>
          )}
        </div>
      )}

      <div className="page-body" style={{ display: "grid", gap: 20 }}>
        {res.isLoading && q.length >= 2 && (
          <div style={{ display: "grid", gap: 6 }} aria-hidden="true">
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
          </div>
        )}
        {(type === "all" || type === "message") && (
          <div>
            <div className="caseno" style={{ marginBottom: 8 }}>
              MESSAGES · {res.data?.messages.length ?? 0}
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              {res.data?.messages.map((m) => (
                <div
                  key={m.id}
                  onClick={() => navigate(`/c/${m.chatId}`)}
                  style={{ padding: "10px 12px", border: "1px solid var(--border-soft)", borderRadius: 8, cursor: "pointer", background: "var(--paper-0)" }}
                >
                  <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                    <span style={{ font: "600 13px/1 var(--font-sans)" }}>#{m.chatId.slice(-6)}</span>
                    <span className="caseno">{new Date(m.createdAt).toLocaleString()}</span>
                    {m.hasAttachments && (
                      <span className="chip">
                        <span className="dot" />
                        FILE
                      </span>
                    )}
                  </div>
                  <div style={{ marginTop: 4, font: "400 13px/1.5 var(--font-sans)" }}>{m.body}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(type === "all" || type === "file") && (
          <div>
            <div className="caseno" style={{ marginBottom: 8 }}>
              FILES · {res.data?.files.length ?? 0}
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              {res.data?.files.map((f) => (
                <div
                  key={f.id}
                  style={{
                    padding: "10px 12px",
                    border: "1px solid var(--border-soft)",
                    borderRadius: 8,
                    background: "var(--paper-0)",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <div style={{ width: 30, height: 30, borderRadius: 5, background: "var(--ember-500)", color: "#fff", font: "700 9px/30px var(--font-mono)", textAlign: "center" }}>
                    {(f.mime.split("/")[1] ?? "BIN").slice(0, 3).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: "500 13px/1.2 var(--font-sans)" }}>{f.name}</div>
                    <div className="caseno" style={{ marginTop: 3, textTransform: "none", letterSpacing: 0 }}>
                      {f.mime} · {new Date(f.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {q.length >= 2 && !res.isLoading && (res.data?.messages.length ?? 0) === 0 && (res.data?.files.length ?? 0) === 0 && (
          <div className="empty">
            <div className="title">Cold trail.</div>
            <div className="sub">Nothing matched. Try weaker operators or a shorter query.</div>
          </div>
        )}
        {q.length < 2 && (
          <div className="empty">
            <div className="title">Follow a lead.</div>
            <div className="sub">Type at least 2 characters to search across messages and files.</div>
          </div>
        )}
      </div>
    </div>
  );
}
