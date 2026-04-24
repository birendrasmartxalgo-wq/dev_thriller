// Full-featured chat view.
//
// - Virtualized message list via react-virtuoso (target: 5k messages, <200ms keypress-to-paint).
// - Infinite scroll upward via cursor pagination (`direction=before`).
// - Live WebSocket updates for created/updated/deleted/reacted, plus offline replay on reconnect.
// - Mention highlight (@name → ember-50 chip), mention autocomplete popover in composer.
// - Attachment chips with signed download.
// - Thread panel opens right rail on click; media panel toggles from header.
// - Pinned strip under header; jump-to-message via `?m=<id>` query param.
// - Chat settings dialog (rename / topic / archive / delete) via header gear.
// - Presence dots on avatars everywhere we show them.

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useParams, useLocation, navigate } from "@/router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { chatApi, fileApi, messageApi, workspaceApi } from "@/api/endpoints";
import { tokenStore } from "@/api/client";
import type { ChatDetail, MessagePublic, PinnedMessage, PresenceStatus, WorkspaceMember } from "@/api/types";
import { useSession } from "@/store/session";
import { useUploads, formatBytes } from "@/lib/upload";
import { toast } from "@/store/toast";
import { Icon } from "@/components/Icons";
import { PresenceDot } from "@/components/PresenceDot";
import { MediaView } from "@/modules/chat/MediaView";
import { MentionPopover, getMentionContext, applyMention, type MentionState } from "@/modules/chat/MentionPopover";
import { ChatSettingsDialog } from "@/modules/chat/ChatSettingsDialog";

const PAGE = 50;
const REPLAY_CURSOR_KEY = (chatId: string) => `dt.replay.${chatId}`;

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

function getJumpMessageId(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("m");
}

export function ChatView() {
  const params = useParams();
  const loc = useLocation();
  const chatId = params.id!;
  const user = useSession((s) => s.user);
  const activeWs = useSession((s) => s.activeWorkspaceId);
  const enqueue = useUploads((s) => s.enqueue);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<MessagePublic[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [openThreadFor, setOpenThreadFor] = useState<string | null>(null);
  const [showMedia, setShowMedia] = useState(false);
  const [jumpAt, setJumpAt] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<string[]>([]);
  const [mentionState, setMentionState] = useState<MentionState>({ open: false, prefix: "", start: -1, end: 0 });
  const [pinned, setPinned] = useState<PinnedMessage[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [presence, setPresence] = useState<Record<string, PresenceStatus>>({});
  const virtuoso = useRef<VirtuosoHandle>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
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

  // Poll presence every 30s while the view is mounted.
  useEffect(() => {
    if (!activeWs) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const p = await workspaceApi.presence(activeWs);
        if (!cancelled) setPresence(p);
      } catch {
        /* ignore */
      }
    };
    void tick();
    const t = window.setInterval(tick, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [activeWs]);

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
      // Remember the latest createdAt as the replay cursor.
      const last = page.items[page.items.length - 1];
      if (last) sessionStorage.setItem(REPLAY_CURSOR_KEY(chatId), last.createdAt);
      // Scroll to bottom.
      setTimeout(() => virtuoso.current?.scrollToIndex({ index: page.items.length - 1, align: "end" }), 40);
    })();
    return () => {
      cancelled = true;
    };
  }, [chatId]);

  // Pinned strip.
  const pinnedQuery = useQuery({
    queryKey: ["chat-pinned", chatId],
    queryFn: () => chatApi.pinned(chatId),
    enabled: Boolean(chatId),
    staleTime: 30_000,
  });
  useEffect(() => {
    if (pinnedQuery.data) setPinned(pinnedQuery.data.items);
  }, [pinnedQuery.data]);

  // WebSocket: subscribe to this chat topic, request replay on open.
  useEffect(() => {
    if (!chatId) return;
    const access = tokenStore.access;
    if (!access) return;
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${window.location.host}/v1/ws?token=${encodeURIComponent(access)}`);
    wsRef.current = ws;
    let closed = false;
    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ type: "subscribe", topic: `chat:${chatId}` }));
      // Offline replay: ask the server for anything newer than our last known cursor.
      const since = sessionStorage.getItem(REPLAY_CURSOR_KEY(chatId));
      if (since) ws.send(JSON.stringify({ type: "replay", chat: chatId, since }));
    });
    ws.addEventListener("message", (ev) => {
      try {
        const p = JSON.parse(String(ev.data));
        if ((p?.type === "message.created" || p?.type === "msg:new") && p.message?.chatId === chatId) {
          setMessages((prev) => (prev.some((m) => m.id === p.message.id) ? prev : [...prev, p.message]));
          if (p.message.createdAt) sessionStorage.setItem(REPLAY_CURSOR_KEY(chatId), p.message.createdAt);
        } else if (p?.type === "message.updated" && p.message?.chatId === chatId) {
          setMessages((prev) => prev.map((m) => (m.id === p.message.id ? p.message : m)));
        } else if (p?.type === "message.deleted") {
          setMessages((prev) => prev.filter((m) => m.id !== p.id));
        } else if (p?.type === "message.reacted" && p.message?.chatId === chatId) {
          setMessages((prev) => prev.map((m) => (m.id === p.message.id ? p.message : m)));
        } else if ((p?.type === "message.pinned" || p?.type === "message.unpinned") && p.message?.chatId === chatId) {
          setMessages((prev) => prev.map((m) => (m.id === p.message.id ? p.message : m)));
          void qc.invalidateQueries({ queryKey: ["chat-pinned", chatId] });
        } else if (p?.type === "chat.updated" && p.id === chatId) {
          void qc.invalidateQueries({ queryKey: ["chat", chatId] });
        } else if (p?.type === "chat.deleted" && p.id === chatId) {
          toast("This chat was deleted");
          navigate("/");
        }
      } catch {
        /* ignore */
      }
    });
    ws.addEventListener("close", () => {
      closed = true;
    });

    // Heartbeat + idle ping.
    const heartbeat = window.setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) return;
      if (document.visibilityState === "hidden") {
        ws.send(JSON.stringify({ type: "idle" }));
      } else {
        ws.send(JSON.stringify({ type: "ping" }));
      }
    }, 30_000);

    return () => {
      window.clearInterval(heartbeat);
      if (!closed) ws.close();
      wsRef.current = null;
    };
  }, [chatId, qc]);

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
      sessionStorage.setItem(REPLAY_CURSOR_KEY(chatId), m.createdAt);
      setTimeout(() => virtuoso.current?.scrollToIndex({ index: messages.length, align: "end" }), 30);
    },
    onError: (e) => toast((e as Error).message, "error"),
    onSettled: () => setSending(false),
  });

  async function send(e: FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    if (mentionState.open) return; // let the popover handle Enter
    setSending(true);
    sendMutation.mutate(body);
  }

  const deleteMut = useMutation({
    mutationFn: (id: string) => messageApi.remove(id),
    onError: (e) => toast((e as Error).message, "error"),
  });
  const editMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => messageApi.edit(id, { body }),
    onSuccess: (m) => {
      setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x)));
      setEditingId(null);
      setEditDraft("");
    },
    onError: (e) => toast((e as Error).message, "error"),
  });
  const reactMut = useMutation({
    mutationFn: ({ id, emoji, action }: { id: string; emoji: string; action: "add" | "remove" }) => messageApi.react(id, { emoji, action }),
    onError: (e) => toast((e as Error).message, "error"),
  });
  const pinMut = useMutation({
    mutationFn: ({ id, pinned: doPin }: { id: string; pinned: boolean }) =>
      doPin ? messageApi.pin(id) : messageApi.unpin(id),
    onError: (e) => toast((e as Error).message, "error"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat-pinned", chatId] }),
  });

  const jumpToCursor = useCallback(
    async (cursor: string, messageId?: string) => {
      const page = await messageApi.page(chatId, { cursor, direction: "after", limit: PAGE });
      // The cursor points to the message itself when direction=after & createdAt matches exactly.
      // Server's jump returns an encoded cursor for the first message >= target, so fetch around it.
      const beforePage = await messageApi.page(chatId, { cursor, direction: "before", limit: PAGE / 2 });
      const combined = [...beforePage.items, ...page.items];
      // Dedupe by id preserving order.
      const byId = new Set<string>();
      const items: MessagePublic[] = [];
      for (const m of combined) {
        if (byId.has(m.id)) continue;
        byId.add(m.id);
        items.push(m);
      }
      setMessages(items);
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
      if (messageId) {
        const idx = items.findIndex((m) => m.id === messageId);
        if (idx >= 0) {
          setTimeout(() => virtuoso.current?.scrollToIndex({ index: idx, align: "center" }), 40);
          setHighlightId(messageId);
          setTimeout(() => setHighlightId((cur) => (cur === messageId ? null : cur)), 2000);
        }
      } else {
        setTimeout(() => virtuoso.current?.scrollToIndex({ index: 0, align: "start" }), 30);
      }
    },
    [chatId]
  );

  // React to ?m=<messageId> in the URL — jump and highlight.
  useEffect(() => {
    const mid = getJumpMessageId();
    if (!mid || !chatId) return;
    (async () => {
      try {
        const r = await chatApi.jump(chatId, { messageId: mid });
        if (!r.cursor) return;
        await jumpToCursor(r.cursor, mid);
      } catch {
        /* ignore */
      }
    })();
  }, [chatId, loc, jumpToCursor]);

  async function jumpToDate() {
    if (!jumpAt) return;
    const r = await chatApi.jump(chatId, { at: new Date(jumpAt).toISOString() });
    if (!r.cursor) {
      toast("No messages at that date", "error");
      return;
    }
    await jumpToCursor(r.cursor);
  }

  async function jumpToMessage(messageId: string) {
    // Update the URL first — the useEffect above will pick it up (but we also act directly).
    const href = `/c/${chatId}?m=${encodeURIComponent(messageId)}`;
    navigate(href);
    try {
      const r = await chatApi.jump(chatId, { messageId });
      if (!r.cursor) return;
      await jumpToCursor(r.cursor, messageId);
    } catch (e) {
      toast((e as Error).message, "error");
    }
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

  function updateMentionFromCaret() {
    const el = composerRef.current;
    if (!el) return;
    const caret = el.selectionStart ?? el.value.length;
    const st = getMentionContext(el.value, caret);
    setMentionState(st);
  }

  function pickMention(m: WorkspaceMember) {
    const { body: nextBody, caret } = applyMention(draft, mentionState, m);
    setDraft(nextBody);
    setMentionState({ open: false, prefix: "", start: -1, end: caret });
    // Restore focus + caret.
    requestAnimationFrame(() => {
      const el = composerRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  }

  const composerRect = composerRef.current?.getBoundingClientRect() ?? null;

  const threadMessage = openThreadFor ? messages.find((m) => m.id === openThreadFor) ?? null : null;
  const threadReplies = openThreadFor ? messages.filter((m) => m.parentId === openThreadFor) : [];

  const chat = chatQuery.data;
  const workspaces = useSession((s) => s.workspaces);
  const activeWsRole = useMemo(() => workspaces.find((w) => w.id === activeWs)?.role, [workspaces, activeWs]);
  const canManage =
    Boolean(chat && user && chat.createdBy === user.id) ||
    activeWsRole === "owner" ||
    activeWsRole === "admin";

  function renderRow(index: number) {
    const m = messages[index];
    if (!m) return null;
    const author = memberById.get(m.authorId);
    const mine = m.authorId === user?.id;
    const replies = messages.filter((r) => r.parentId === m.id).length;
    const isHighlighted = highlightId === m.id;
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "32px 1fr",
          gap: 10,
          padding: "6px 20px",
          background: isHighlighted ? "var(--ember-50)" : "transparent",
          outline: isHighlighted ? "2px solid var(--ember-500)" : "none",
          outlineOffset: -2,
          transition: "background 400ms var(--ease-out), outline-color 400ms var(--ease-out)",
        }}
      >
        <div style={{ position: "relative", marginTop: 2 }}>
          <div className="av" style={{ background: author?.color ?? "var(--ember-500)" }}>
            {author?.initials ?? m.authorId.slice(-2).toUpperCase()}
          </div>
          <div style={{ position: "absolute", right: -2, bottom: -2 }}>
            <PresenceDot status={presence[m.authorId]} size={8} />
          </div>
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
            <span style={{ font: "600 13px/1 var(--font-sans)" }}>{author?.name ?? (mine ? user?.name : m.authorId.slice(-6))}</span>
            <span style={{ font: "400 11px/1 var(--font-mono)", color: "var(--fg3)" }}>
              {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
            {m.editedAt && <span className="caseno">EDITED</span>}
            {m.pinnedAt && (
              <span className="caseno" style={{ color: "var(--ember-700)" }}>
                <Icon.pin size={10} /> PINNED
              </span>
            )}
            {m.deletedAt && (
              <span className="chip">
                <span className="dot" /> DELETED
              </span>
            )}
          </div>
          {editingId === m.id ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (editDraft.trim()) editMut.mutate({ id: m.id, body: editDraft.trim() });
              }}
              style={{ marginTop: 4 }}
            >
              <textarea
                autoFocus
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setEditingId(null);
                    setEditDraft("");
                  } else if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (editDraft.trim()) editMut.mutate({ id: m.id, body: editDraft.trim() });
                  }
                }}
                className="input"
                rows={2}
                style={{ resize: "vertical" }}
              />
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <button type="submit" className="btn btn-primary" style={{ padding: "4px 10px" }}>
                  Save
                </button>
                <button type="button" className="btn btn-ghost" style={{ padding: "4px 10px" }} onClick={() => { setEditingId(null); setEditDraft(""); }}>
                  Cancel
                </button>
                <span className="caseno" style={{ marginLeft: "auto" }}>⏎ save · esc cancel</span>
              </div>
            </form>
          ) : (
            <div style={{ font: "400 13px/1.5 var(--font-sans)", color: "var(--fg1)" }}>
              {m.deletedAt ? <em style={{ color: "var(--fg3)" }}>Message removed.</em> : renderBodyWithMentions(m.body, memberNameById)}
            </div>
          )}

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
                <button
                  className="btn btn-ghost"
                  style={{ padding: "2px 6px", fontSize: 11 }}
                  onClick={() => pinMut.mutate({ id: m.id, pinned: !m.pinnedAt })}
                  title={m.pinnedAt ? "Unpin" : "Pin"}
                >
                  <Icon.pin size={11} /> {m.pinnedAt ? "Unpin" : "Pin"}
                </button>
                {mine && (
                  <>
                    <button
                      className="btn btn-ghost"
                      style={{ padding: "2px 6px", fontSize: 11 }}
                      onClick={() => {
                        setEditingId(m.id);
                        setEditDraft(m.body);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-ghost"
                      style={{ padding: "2px 6px", fontSize: 11, color: "var(--blood-700)" }}
                      onClick={() => {
                        if (confirm("Delete this message?")) deleteMut.mutate(m.id);
                      }}
                    >
                      Delete
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "grid", gridTemplateColumns: openThreadFor ? "1fr 360px" : showMedia ? "1fr 340px" : "1fr", minWidth: 0 }}>
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0, background: "var(--bg)" }}>
        <div style={{ padding: "10px 20px", borderBottom: "1px solid var(--border-soft)", display: "flex", alignItems: "center", gap: 12, background: "var(--paper-0)" }}>
          <div style={{ font: "700 15px/1 var(--font-sans)", display: "flex", alignItems: "center", gap: 6 }}>
            {chat?.type === "dm" ? <Icon.user size={16} /> : <Icon.hash size={16} />}
            {chat?.name}
          </div>
          <span className="caseno">CASE · {chat?.type?.toUpperCase() ?? "—"}</span>
          {chat?.archivedAt && (
            <span className="chip" style={{ background: "var(--warning-bg)" }}>
              <span className="dot" /> ARCHIVED
            </span>
          )}

          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <input type="date" value={jumpAt} onChange={(e) => setJumpAt(e.target.value)} className="input" style={{ width: 150, padding: "4px 8px", fontSize: 12 }} />
            <button className="btn btn-ghost" style={{ padding: "4px 8px" }} onClick={jumpToDate} disabled={!jumpAt}>
              Jump
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            {[...memberById.entries()].slice(0, 4).map(([uid, a], i) => (
              <div key={uid} style={{ position: "relative", marginLeft: i === 0 ? 0 : -6 }}>
                <div className="av" style={{ border: "2px solid var(--paper-0)", background: a.color }}>
                  {a.initials}
                </div>
                <div style={{ position: "absolute", right: -1, bottom: -1 }}>
                  <PresenceDot status={presence[uid]} size={7} />
                </div>
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
          <button className="btn btn-ghost" onClick={() => setSettingsOpen(true)} title="Chat settings">
            <Icon.settings size={14} />
          </button>
        </div>

        {pinned.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              padding: "6px 20px",
              borderBottom: "1px solid var(--border-soft)",
              background: "var(--paper-100)",
              overflowX: "auto",
            }}
          >
            <span className="caseno" style={{ color: "var(--ember-700)", display: "flex", alignItems: "center", gap: 4 }}>
              <Icon.pin size={10} /> PINNED · {pinned.length}
            </span>
            {pinned.map((p) => (
              <button
                key={p.id}
                className="chip"
                style={{ cursor: "pointer", whiteSpace: "nowrap", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis" }}
                onClick={() => jumpToMessage(p.id)}
                title={p.body}
              >
                <span style={{ font: "500 12px/1 var(--font-sans)", color: "var(--fg2)" }}>
                  {(memberNameById.get(p.authorId) ?? p.authorId.slice(-4))}: {p.body.slice(0, 60)}
                </span>
              </button>
            ))}
          </div>
        )}

        <div style={{ flex: 1, minHeight: 0 }}>
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

        <div style={{ padding: "10px 20px", borderTop: "1px solid var(--border-soft)", background: "var(--paper-0)", position: "relative" }}>
          {pendingAttachments.length > 0 && (
            <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
              {pendingAttachments.map((fid) => (
                <span key={fid} className="chip">
                  <Icon.paperclip size={10} /> {fid.slice(-6)}
                  <button
                    className="tb-btn"
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
              ref={composerRef}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                // Defer to next tick so selectionStart reflects the new value.
                requestAnimationFrame(updateMentionFromCaret);
              }}
              onKeyUp={updateMentionFromCaret}
              onClick={updateMentionFromCaret}
              onKeyDown={(e) => {
                // When the popover is open, let it consume navigation / commit keys.
                if (mentionState.open && ["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(e.key)) {
                  return;
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(e as unknown as FormEvent);
                }
              }}
              placeholder={`Message ${chat?.name ? "#" + chat.name : "…"}`}
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
            <input ref={fileInput} type="file" multiple hidden onChange={(e) => onPickFiles(e.target.files)} />
            <div style={{ display: "flex", alignItems: "center", gap: 2, padding: "4px 6px", borderTop: "1px solid var(--border-soft)" }}>
              <button type="button" className="tb-btn" onClick={() => fileInput.current?.click()} title="Attach file">
                <Icon.paperclip size={14} />
              </button>
              <button
                type="button"
                className="tb-btn"
                title="Mention"
                onClick={() => {
                  const el = composerRef.current;
                  if (!el) return;
                  const caret = el.selectionStart ?? el.value.length;
                  const insert = "@";
                  setDraft((d) => d.slice(0, caret) + insert + d.slice(caret));
                  requestAnimationFrame(() => {
                    el.focus();
                    el.setSelectionRange(caret + 1, caret + 1);
                    updateMentionFromCaret();
                  });
                }}
              >
                <Icon.at size={14} />
              </button>
              <div style={{ flex: 1 }} />
              <button type="submit" className="btn btn-primary" style={{ padding: "5px 10px" }} disabled={sending || !draft.trim()}>
                <Icon.send size={14} /> Send
              </button>
            </div>
          </form>
          {activeWs && (
            <MentionPopover
              workspaceId={activeWs}
              state={mentionState}
              anchorRect={composerRect}
              onPick={pickMention}
              onDismiss={() => setMentionState({ open: false, prefix: "", start: -1, end: 0 })}
            />
          )}
        </div>
      </div>

      {openThreadFor && threadMessage && (
        <div style={{ borderLeft: "1px solid var(--border-soft)", background: "var(--paper-0)", display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-soft)", display: "flex", alignItems: "center", gap: 8 }}>
            <strong style={{ fontSize: 13 }}>Thread</strong>
            <span className="caseno">{threadReplies.length} REPLIES</span>
            <div style={{ flex: 1 }} />
            <button className="tb-btn" onClick={() => setOpenThreadFor(null)}>
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

      {settingsOpen && chat && (
        <ChatSettingsDialog
          chat={chat as ChatDetail}
          canManage={canManage}
          onClose={() => setSettingsOpen(false)}
          onChanged={() => {
            void qc.invalidateQueries({ queryKey: ["chat", chatId] });
            void qc.invalidateQueries({ queryKey: ["chats", activeWs] });
          }}
          onDeleted={() => {
            void qc.invalidateQueries({ queryKey: ["chats", activeWs] });
            navigate("/");
          }}
        />
      )}
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
      <input className="input" placeholder="Reply to thread" value={text} onChange={(e) => setText(e.target.value)} />
    </form>
  );
}
