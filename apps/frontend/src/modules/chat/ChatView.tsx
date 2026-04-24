// Full-featured chat view.
//
// - Virtualized message list via react-virtuoso (target: 5k messages, <200ms keypress-to-paint).
// - Infinite scroll upward via cursor pagination (`direction=before`).
// - Live WebSocket updates for created/updated/deleted/reacted.
// - Mention highlight (@name → ember-50 chip), attachment chips with signed download.
// - Thread panel opens right rail on click; media panel toggles from header.
// - Jump-to-date via /v1/chats/:id/jump?at=YYYY-MM-DD.

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useParams } from "@/router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { chatApi, fileApi, messageApi, workspaceApi } from "@/api/endpoints";
import { tokenStore } from "@/api/client";
import type { MessagePublic } from "@/api/types";
import { useSession } from "@/store/session";
import { useUploads, formatBytes } from "@/lib/upload";
import { toast } from "@/store/toast";
import { Icon } from "@/components/Icons";
import { MediaView } from "@/modules/chat/MediaView";
import { MessageSkeleton } from "@/components/Skeletons";

const PAGE = 50;

function renderBodyWithMentions(body: string, memberMap: Map<string, string>) {
  // Split on @id (hex) and @name tokens — render any capture as a chip.
  const parts = body.split(/(@\w+)/g);
  return parts.map((p, i) => {
    if (!p.startsWith("@")) return <span key={i}>{p}</span>;
    const token = p.slice(1);
    const display = memberMap.get(token) ?? token;
    return (
      <span
        key={i}
        style={{ color: "var(--ember-700)", background: "var(--ember-50)", padding: "1px 4px", borderRadius: 3 }}
      >
        @{display}
      </span>
    );
  });
}

export function ChatView() {
  const params = useParams();
  const chatId = params.id!;
  const user = useSession((s) => s.user);
  const activeWs = useSession((s) => s.activeWorkspaceId);
  const enqueue = useUploads((s) => s.enqueue);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<MessagePublic[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [openThreadFor, setOpenThreadFor] = useState<string | null>(null);
  const [showMedia, setShowMedia] = useState(false);
  const [jumpAt, setJumpAt] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<string[]>([]);
  const virtuoso = useRef<VirtuosoHandle>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const chatQuery = useQuery({
    queryKey: ["chat", chatId],
    queryFn: () => chatApi.get(chatId),
    enabled: Boolean(chatId),
  });

  const membersQuery = useQuery({
    queryKey: ["members", activeWs],
    queryFn: () => workspaceApi.members(activeWs!),
    enabled: Boolean(activeWs),
    staleTime: 60_000,
  });

  const memberById = useMemo(() => {
    const m = new Map<string, { name: string; color: string; initials: string }>();
    const palette = ["var(--ember-500)", "var(--lav-500)", "var(--mint-500)", "var(--blood-500)", "var(--ink-500)"];
    (membersQuery.data?.items ?? []).forEach((u, i) => {
      const name = u.name ?? u.email ?? u.userId.slice(-6);
      const initials = name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
      m.set(u.userId, { name, color: palette[i % palette.length]!, initials });
    });
    return m;
  }, [membersQuery.data]);

  const memberNameById = useMemo(() => {
    const m = new Map<string, string>();
    memberById.forEach((v, k) => m.set(k, v.name));
    return m;
  }, [memberById]);

  // Initial page load.
  useEffect(() => {
    let cancelled = false;
    setMessages([]);
    setNextCursor(null);
    setHasMore(false);
    (async () => {
      const page = await messageApi.page(chatId, { limit: PAGE });
      if (cancelled) return;
      setMessages(page.items);
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
      // Scroll to bottom.
      setTimeout(() => virtuoso.current?.scrollToIndex({ index: page.items.length - 1, align: "end" }), 40);
    })();
    return () => {
      cancelled = true;
    };
  }, [chatId]);

  // WebSocket: subscribe to this chat topic.
  useEffect(() => {
    if (!chatId) return;
    const access = tokenStore.access;
    if (!access) return;
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${window.location.host}/v1/ws?token=${encodeURIComponent(access)}`);
    let closed = false;
    ws.addEventListener("open", () => ws.send(JSON.stringify({ type: "subscribe", topic: `chat:${chatId}` })));
    ws.addEventListener("message", (ev) => {
      try {
        const p = JSON.parse(String(ev.data));
        if (p?.type === "message.created" && p.message?.chatId === chatId) {
          setMessages((prev) => (prev.some((m) => m.id === p.message.id) ? prev : [...prev, p.message]));
        } else if (p?.type === "message.updated" && p.message?.chatId === chatId) {
          setMessages((prev) => prev.map((m) => (m.id === p.message.id ? p.message : m)));
        } else if (p?.type === "message.deleted") {
          setMessages((prev) => prev.filter((m) => m.id !== p.id));
        } else if (p?.type === "message.reacted" && p.message?.chatId === chatId) {
          setMessages((prev) => prev.map((m) => (m.id === p.message.id ? p.message : m)));
        }
      } catch {
        /* ignore */
      }
    });
    ws.addEventListener("close", () => {
      closed = true;
    });
    return () => {
      if (!closed) ws.close();
    };
  }, [chatId]);

  async function loadMore() {
    if (!hasMore || !nextCursor) return;
    const page = await messageApi.page(chatId, { limit: PAGE, cursor: nextCursor, direction: "before" });
    setMessages((prev) => [...page.items, ...prev]);
    setNextCursor(page.nextCursor);
    setHasMore(page.hasMore);
  }

  const sendMutation = useMutation({
    mutationFn: (body: string) =>
      messageApi.send(chatId, {
        body,
        attachments: pendingAttachments.map((fileId) => ({ fileId })),
      }),
    onSuccess: (m) => {
      setDraft("");
      setPendingAttachments([]);
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      setTimeout(() => virtuoso.current?.scrollToIndex({ index: messages.length, align: "end" }), 30);
    },
    onError: (e) => toast((e as Error).message, "error"),
    onSettled: () => setSending(false),
  });

  async function send(e: FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    sendMutation.mutate(body);
  }

  const deleteMut = useMutation({
    mutationFn: (id: string) => messageApi.remove(id),
    onError: (e) => toast((e as Error).message, "error"),
  });
  const reactMut = useMutation({
    mutationFn: ({ id, emoji, action }: { id: string; emoji: string; action: "add" | "remove" }) => messageApi.react(id, { emoji, action }),
    onError: (e) => toast((e as Error).message, "error"),
  });

  async function jumpToDate() {
    if (!jumpAt) return;
    const r = await chatApi.jump(chatId, new Date(jumpAt).toISOString());
    if (!r.cursor) {
      toast("No messages at that date", "error");
      return;
    }
    const page = await messageApi.page(chatId, { cursor: r.cursor, direction: "after", limit: PAGE });
    setMessages(page.items);
    setNextCursor(page.nextCursor);
    setHasMore(page.hasMore);
    setTimeout(() => virtuoso.current?.scrollToIndex({ index: 0, align: "start" }), 30);
  }

  // Inline file upload → auto-attach once complete.
  const jobs = useUploads((s) => s.jobs);
  useEffect(() => {
    // When a tracked upload for this workspace completes, add its fileId to pending attachments.
    for (const j of Object.values(jobs)) {
      if (j.workspaceId === activeWs && j.status === "complete" && j.fileId && !pendingAttachments.includes(j.fileId)) {
        setPendingAttachments((prev) => [...prev, j.fileId!]);
      }
    }
  }, [jobs, activeWs, pendingAttachments]);

  function onPickFiles(list: FileList | null) {
    if (!list || !activeWs) return;
    for (const f of Array.from(list)) enqueue(f, activeWs);
  }

  const threadMessage = openThreadFor ? messages.find((m) => m.id === openThreadFor) ?? null : null;
  const threadReplies = openThreadFor ? messages.filter((m) => m.parentId === openThreadFor) : [];

  function renderRow(index: number) {
    const m = messages[index];
    if (!m) return null;
    const author = memberById.get(m.authorId);
    const mine = m.authorId === user?.id;
    const replies = messages.filter((r) => r.parentId === m.id).length;
    return (
      <div style={{ display: "grid", gridTemplateColumns: "32px 1fr", gap: 10, padding: "6px 20px" }}>
        <div className="av" style={{ background: author?.color ?? "var(--ember-500)", marginTop: 2 }}>
          {author?.initials ?? m.authorId.slice(-2).toUpperCase()}
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
            <span style={{ font: "600 13px/1 var(--font-sans)" }}>{author?.name ?? (mine ? user?.name : m.authorId.slice(-6))}</span>
            <span style={{ font: "400 11px/1 var(--font-mono)", color: "var(--fg3)" }}>
              {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
            {m.editedAt && <span className="caseno">EDITED</span>}
            {m.deletedAt && (
              <span className="chip">
                <span className="dot" /> DELETED
              </span>
            )}
          </div>
          <div style={{ font: "400 13px/1.5 var(--font-sans)", color: "var(--fg1)" }}>
            {m.deletedAt ? <em style={{ color: "var(--fg3)" }}>Message removed.</em> : renderBodyWithMentions(m.body, memberNameById)}
          </div>

          {m.attachments.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
              {m.attachments.map((a) => (
                <button
                  key={a.fileId}
                  className="btn btn-secondary"
                  style={{ padding: "4px 10px", gap: 8 }}
                  onClick={async () => {
                    try {
                      const f = await fileApi.get(a.fileId);
                      window.open(f.url, "_blank", "noreferrer");
                    } catch (e) {
                      toast((e as Error).message, "error");
                    }
                  }}
                >
                  <Icon.paperclip size={12} />
                  <span style={{ font: "500 12px/1 var(--font-sans)" }}>{a.name}</span>
                  <span className="caseno" style={{ textTransform: "none", letterSpacing: 0 }}>
                    {formatBytes(a.sizeBytes)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {Object.entries(m.reactions).length > 0 && (
            <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
              {Object.entries(m.reactions).map(([emoji, users]) => (
                <button
                  key={emoji}
                  onClick={() => reactMut.mutate({ id: m.id, emoji, action: users.includes(user?.id ?? "") ? "remove" : "add" })}
                  style={{
                    padding: "2px 8px",
                    borderRadius: 999,
                    border: "1px solid var(--border-soft)",
                    background: users.includes(user?.id ?? "") ? "var(--ember-50)" : "var(--paper-0)",
                    font: "400 12px/1 var(--font-sans)",
                    cursor: "pointer",
                  }}
                >
                  {emoji} {users.length}
                </button>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 4, fontSize: 11, color: "var(--fg3)" }}>
            {replies > 0 && (
              <button
                className="btn btn-ghost"
                style={{ padding: "2px 6px", fontSize: 11 }}
                onClick={() => setOpenThreadFor(m.id)}
              >
                {replies} repl{replies === 1 ? "y" : "ies"} · View thread →
              </button>
            )}
            {!m.deletedAt && (
              <>
                <button className="btn btn-ghost" style={{ padding: "2px 6px", fontSize: 11 }} onClick={() => setOpenThreadFor(m.id)}>
                  Reply
                </button>
                <button
                  className="btn btn-ghost"
                  style={{ padding: "2px 6px", fontSize: 11 }}
                  onClick={() => reactMut.mutate({ id: m.id, emoji: "👍", action: "add" })}
                >
                  👍
                </button>
                {mine && (
                  <button
                    className="btn btn-ghost"
                    style={{ padding: "2px 6px", fontSize: 11, color: "var(--blood-700)" }}
                    onClick={() => {
                      if (confirm("Delete this message?")) deleteMut.mutate(m.id);
                    }}
                  >
                    Delete
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dt-chat-split" style={{ flex: 1, display: "grid", gridTemplateColumns: openThreadFor ? "1fr 360px" : showMedia ? "1fr 340px" : "1fr", minWidth: 0 }}>
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0, background: "var(--bg)" }}>
        <div className="dt-chat-header" style={{ padding: "10px 20px", borderBottom: "1px solid var(--border-soft)", display: "flex", alignItems: "center", gap: 12, background: "var(--paper-0)" }}>
          <div style={{ font: "700 15px/1 var(--font-sans)", display: "flex", alignItems: "center", gap: 6 }}>
            {chatQuery.data?.type === "dm" ? <Icon.user size={16} /> : <Icon.hash size={16} />}
            {chatQuery.data?.name}
          </div>
          <span className="caseno">CASE · {chatQuery.data?.type?.toUpperCase() ?? "—"}</span>

          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <input
              type="date"
              aria-label="Jump to date"
              value={jumpAt}
              onChange={(e) => setJumpAt(e.target.value)}
              className="input"
              style={{ width: 150, padding: "4px 8px", fontSize: 12 }}
            />
            <button className="btn btn-ghost" style={{ padding: "4px 8px" }} onClick={jumpToDate} disabled={!jumpAt}>
              Jump
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            {[...memberById.values()].slice(0, 4).map((a, i) => (
              <div key={i} className="av" style={{ marginLeft: i === 0 ? 0 : -6, border: "2px solid var(--paper-0)", background: a.color }}>
                {a.initials}
              </div>
            ))}
            {memberById.size > 4 && (
              <div className="av" style={{ marginLeft: -6, border: "2px solid var(--paper-0)", background: "var(--paper-200)", color: "var(--fg2)" }}>
                +{memberById.size - 4}
              </div>
            )}
          </div>

          <button className={`btn btn-ghost${showMedia ? " on" : ""}`} onClick={() => setShowMedia((v) => !v)}>
            <Icon.image size={14} /> Media
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0 }}>
          {chatQuery.isLoading && messages.length === 0 && (
            <div style={{ padding: "14px 0" }} aria-hidden="true">
              {Array.from({ length: 6 }).map((_, i) => (
                <MessageSkeleton key={i} bodyLines={(i % 2) + 1} />
              ))}
            </div>
          )}
          <Virtuoso
            ref={virtuoso}
            data={messages}
            itemContent={(idx) => renderRow(idx)}
            followOutput="smooth"
            startReached={loadMore}
            components={{
              Header: () =>
                hasMore ? (
                  <div style={{ textAlign: "center", padding: "10px 0", color: "var(--fg3)", font: "400 11px/1 var(--font-mono)" }}>
                    …scroll up for earlier messages…
                  </div>
                ) : messages.length > 0 ? (
                  <div style={{ textAlign: "center", padding: "10px 0", color: "var(--fg3)", font: "400 11px/1 var(--font-mono)" }}>
                    TOP OF CHAT · CHAIN STARTS HERE
                  </div>
                ) : null,
            }}
          />
          {messages.length === 0 && (
            <div className="empty">
              <div className="title">Silence.</div>
              <div className="sub">Be the first to say something. Every message joins the chain.</div>
            </div>
          )}
        </div>

        <div style={{ padding: "10px 20px", borderTop: "1px solid var(--border-soft)", background: "var(--paper-0)" }}>
          {pendingAttachments.length > 0 && (
            <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
              {pendingAttachments.map((fid) => (
                <span key={fid} className="chip">
                  <Icon.paperclip size={10} /> {fid.slice(-6)}
                  <button
                    type="button"
                    className="tb-btn"
                    aria-label="Remove attachment"
                    style={{ width: 18, height: 18, padding: 0, marginLeft: 4 }}
                    onClick={() => setPendingAttachments((prev) => prev.filter((x) => x !== fid))}
                  >
                    <Icon.x size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <form onSubmit={send} style={{ border: "1px solid var(--border)", borderRadius: 10, background: "var(--paper-0)" }}>
            <textarea
              value={draft}
              aria-label="Message draft"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(e as unknown as FormEvent);
                }
              }}
              placeholder={`Message ${chatQuery.data?.name ? "#" + chatQuery.data.name : "…"}`}
              rows={1}
              style={{
                width: "100%",
                padding: "10px 12px",
                border: 0,
                outline: "none",
                background: "transparent",
                resize: "none",
                font: "400 13px/1.5 var(--font-sans)",
                color: "var(--fg1)",
                boxSizing: "border-box",
              }}
            />
            <input ref={fileInput} type="file" multiple hidden aria-label="Attach files" onChange={(e) => onPickFiles(e.target.files)} />
            <div className="dt-composer-toolbar" style={{ display: "flex", alignItems: "center", gap: 2, padding: "4px 6px", borderTop: "1px solid var(--border-soft)" }}>
              <button type="button" className="tb-btn" onClick={() => fileInput.current?.click()} title="Attach file" aria-label="Attach file">
                <Icon.paperclip size={14} />
              </button>
              <button type="button" className="tb-btn" title="Mention" aria-label="Mention someone">
                <Icon.at size={14} />
              </button>
              <div style={{ flex: 1 }} />
              <button type="submit" className="btn btn-primary" style={{ padding: "5px 10px" }} disabled={sending || !draft.trim()} aria-label="Send message">
                <Icon.send size={14} /> Send
              </button>
            </div>
          </form>
        </div>
      </div>

      {openThreadFor && threadMessage && (
        <div style={{ borderLeft: "1px solid var(--border-soft)", background: "var(--paper-0)", display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-soft)", display: "flex", alignItems: "center", gap: 8 }}>
            <strong style={{ fontSize: 13 }}>Thread</strong>
            <span className="caseno">{threadReplies.length} REPLIES</span>
            <div style={{ flex: 1 }} />
            <button type="button" className="tb-btn" aria-label="Close thread" onClick={() => setOpenThreadFor(null)}>
              <Icon.x size={14} />
            </button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "14px" }}>
            <ThreadRow m={threadMessage} memberById={memberById} pinned />
            {threadReplies.map((r) => (
              <ThreadRow key={r.id} m={r} memberById={memberById} />
            ))}
          </div>
          <ThreadComposer chatId={chatId} parentId={openThreadFor} onSent={() => qc.invalidateQueries({ queryKey: ["messages", chatId] })} />
        </div>
      )}

      {!openThreadFor && showMedia && <MediaView chatId={chatId} onClose={() => setShowMedia(false)} />}
    </div>
  );
}

function ThreadRow({ m, memberById, pinned }: { m: MessagePublic; memberById: Map<string, { name: string; color: string; initials: string }>; pinned?: boolean }) {
  const a = memberById.get(m.authorId);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "28px 1fr", gap: 8, padding: "6px 0", borderBottom: pinned ? "1px solid var(--border-soft)" : 0, marginBottom: pinned ? 8 : 0 }}>
      <div className="av" style={{ background: a?.color ?? "var(--ember-500)", width: 24, height: 24, fontSize: 10 }}>
        {a?.initials ?? m.authorId.slice(-2).toUpperCase()}
      </div>
      <div>
        <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
          <span style={{ font: "600 12px/1 var(--font-sans)" }}>{a?.name ?? m.authorId.slice(-6)}</span>
          <span style={{ font: "400 10px/1 var(--font-mono)", color: "var(--fg3)" }}>
            {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        <div style={{ font: "400 13px/1.5 var(--font-sans)", marginTop: 2 }}>{m.body}</div>
      </div>
    </div>
  );
}

function ThreadComposer({ chatId, parentId, onSent }: { chatId: string; parentId: string; onSent: () => void }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await messageApi.send(chatId, { body: text, parentId });
      setText("");
      onSent();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSending(false);
    }
  }
  return (
    <form onSubmit={submit} style={{ padding: 10, borderTop: "1px solid var(--border-soft)" }}>
      <label className="dt-sr-only" htmlFor="dt-thread-reply">Reply to thread</label>
      <input id="dt-thread-reply" className="input" placeholder="Reply to thread" value={text} onChange={(e) => setText(e.target.value)} />
    </form>
  );
}
