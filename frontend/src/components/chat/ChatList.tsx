import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
} from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import { qrng } from "../../lib/api";
import { auth, db } from "../../lib/firebaseClient";

type ChatDoc = {
  id: string;
  members: string[]; // [uidA, uidB]
  q_seed_b64?: string;
  createdAt?: any;
};

export default function ChatList({
  onOpen,
  activeId,
}: {
  onOpen: (id: string) => void;
  activeId: string | null;
}) {
  const [uid, setUid] = useState<string>("");
  const [chats, setChats] = useState<ChatDoc[]>([]);
  const [friendUname, setFriendUname] = useState("");
  const [busy, setBusy] = useState(false);
  const [nameCache, setNameCache] = useState<Record<string, string>>({}); // uid -> username

  // Unread counts per chat (computed client-side using lastSeen + new messages)
  const [unread, setUnread] = useState<Record<string, number>>({});
  const perChatUnsub = useRef<Record<string, () => void>>({});

  useEffect(() => onAuthStateChanged(auth, (u) => setUid(u?.uid || "")), []);

  // Load chats and resolve counterpart usernames
  useEffect(() => {
    if (!uid) return;
    const qref = query(
      collection(db, "chats"),
      where("members", "array-contains", uid),
      orderBy("createdAt", "desc")
    );

    return onSnapshot(qref, async (snap) => {
      const rows: ChatDoc[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }));
      setChats(rows);

      // Resolve usernames for counterparts we don't have yet
      const unknownUids = new Set<string>();
      for (const c of rows) {
        const other = (c.members || []).find((m) => m !== uid);
        if (other && !nameCache[other]) unknownUids.add(other);
      }
      if (unknownUids.size > 0) {
        const entries: [string, string][] = [];
        await Promise.all(
          Array.from(unknownUids).map(async (otherUid) => {
            const udoc = await getDoc(doc(db, "users", otherUid));
            const uname =
              (udoc.exists() && (udoc.data() as any)?.username) || "user";
            entries.push([otherUid, uname]);
          })
        );
        setNameCache((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
      }

      // (Re)wire per-chat unread listeners
      wireUnreadListeners(rows, uid);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const canStart = useMemo(
    () => !!uid && !!friendUname.trim(),
    [uid, friendUname]
  );

  const startChat = async () => {
    const uname = friendUname.trim().toLowerCase();
    if (!uname || !uid) return;
    setBusy(true);
    try {
      // usernames/<uname> -> { uid }
      const uref = doc(db, "usernames", uname);
      const umap = await getDoc(uref);
      if (!umap.exists()) {
        alert("User not found");
        return;
      }
      const other = (umap.data() as any).uid as string;
      const members = [uid, other].sort();

      const qSeed = await qrng(32);
      const q_seed_b64 = btoa(String.fromCharCode(...qSeed));

      const chat = await addDoc(collection(db, "chats"), {
        members,
        q_seed_b64,
        createdAt: serverTimestamp(),
      });

      // Mark as seen (empty) right away so it starts at 0
      setLastSeen(chat.id, Date.now());
      setUnread((u) => ({ ...u, [chat.id]: 0 }));

      setFriendUname("");
      onOpen(chat.id);
    } finally {
      setBusy(false);
    }
  };

  const labelFor = (c: ChatDoc) => {
    const other = (c.members || []).find((m) => m !== uid);
    return other ? nameCache[other] || "user" : "user";
  };

  // --- Unread helpers (localStorage + per-chat message snapshots) ---

  function lsKey(id: string) {
    return `lastSeen_chat_${id}`;
  }
  function getLastSeen(id: string): number {
    const raw = localStorage.getItem(lsKey(id));
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  }
  function setLastSeen(id: string, ms: number) {
    localStorage.setItem(lsKey(id), String(ms));
  }

  function wireUnreadListeners(rows: ChatDoc[], myUid: string) {
    // Clean up removed chats
    const currentIds = new Set(rows.map((r) => r.id));
    for (const id of Object.keys(perChatUnsub.current)) {
      if (!currentIds.has(id)) {
        perChatUnsub.current[id]?.();
        delete perChatUnsub.current[id];
      }
    }

    // Add listeners for each chat (createdAt > lastSeen)
    rows.forEach((c) => {
      if (perChatUnsub.current[c.id]) return; // already wired

      const lastSeenMs = getLastSeen(c.id);
      const since = lastSeenMs ? new Date(lastSeenMs) : new Date(0);

      const qref = query(
        collection(db, "chats", c.id, "messages"),
        where("createdAt", ">", Timestamp.fromDate(since)),
        orderBy("createdAt", "asc")
      );

      const unsub = onSnapshot(qref, (snap) => {
        let count = 0;
        snap.forEach((d) => {
          const m = d.data() as any;
          // Count only peer messages as "unread"
          if (m?.senderUid && m.senderUid !== myUid) count += 1;
        });
        setUnread((prev) =>
          prev[c.id] === count ? prev : { ...prev, [c.id]: count }
        );
      });

      perChatUnsub.current[c.id] = unsub;
    });
  }

  // When user opens a chat, mark it seen FIRST (so UI resets), then bubble up.
  const openChat = (id: string) => {
    setLastSeen(id, Date.now());
    setUnread((u) => ({ ...u, [id]: 0 }));
    onOpen(id);
  };

  // Tidy up all unread listeners on unmount
  useEffect(() => {
    return () => {
      Object.values(perChatUnsub.current).forEach((fn) => fn?.());
      perChatUnsub.current = {};
    };
  }, []);

  return (
    <div
      className="min-h-[100dvh] flex flex-col bg-slate-100 text-slate-900 md:border-r md:border-slate-300/20"
      style={{
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* Top bar (sticky, iOS-style) */}
      <div className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">
        {/* Subtle indigo accent */}
        <div className="h-0.5 w-full bg-gradient-to-r from-indigo-500 via-indigo-300 to-transparent" />
        <div className="px-3 sm:px-4 pt-3 pb-3 sm:pt-5 sm:pb-4">
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight">
            Messages
          </h1>

          {/* Start new chat (rounded, mobile-friendly) */}
          <div className="mt-3 sm:mt-4 flex gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400">
                @
              </span>
              <input
                className="w-full rounded-full border border-neutral-300 bg-white pl-8 pr-3.5 py-2.5 text-sm placeholder:text-neutral-400 focus:border-neutral-400 focus:ring-2 focus:ring-neutral-900/10 outline-none"
                placeholder="friend username"
                value={friendUname}
                onChange={(e) => setFriendUname(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canStart && !busy) startChat();
                }}
                aria-label="Friend username"
              />
            </div>
            <button
              onClick={startChat}
              disabled={!canStart || busy}
              className="h-11 rounded-full bg-neutral-900 text-white px-4 text-sm font-medium hover:opacity-95 active:scale-[.99] transition disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-neutral-900/20"
            >
              {busy ? "Starting…" : "Start"}
            </button>
          </div>
        </div>
      </div>

      {/* Conversation list (larger touch targets, inset cards) */}
      <div className="flex-1 overflow-y-auto">
        {chats.length === 0 ? (
          <div className="p-6 text-sm text-slate-600">
            No conversations yet.
          </div>
        ) : (
          <ul className="divide-y divide-slate-200/70">
            {chats.map((c) => {
              const uname = labelFor(c);
              const active = activeId === c.id;
              const unreadCount = unread[c.id] || 0;
              const hasUnread = unreadCount > 0;

              // Base row styles
              const baseRow =
                "flex items-center gap-3 px-3 py-3.5 rounded-2xl bg-white transition shadow-[0_0.5px_0_0_rgba(0,0,0,0.03)] hover:bg-white";

              // Highlight for active or unread
              const rowState = hasUnread
                ? "ring-1 ring-amber-300 bg-amber-50"
                : active
                ? "ring-1 ring-indigo-200 bg-indigo-50"
                : "";

              return (
                <li
                  key={c.id}
                  onClick={() => openChat(c.id)}
                  className="cursor-pointer select-none"
                >
                  <div className="px-2 py-1">
                    <div className={[baseRow, rowState].join(" ").trim()}>
                      {/* Avatar */}
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-200 to-indigo-500 text-white text-sm font-semibold shadow-sm"
                        aria-hidden="true"
                        title={`@${uname}`}
                      >
                        {initials(uname)}
                      </div>

                      {/* Title + meta */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="text-[15px] sm:text-sm font-medium truncate">
                            @{uname}
                          </div>

                          {/* Chat id chip (desktop only) */}
                          <span className="hidden sm:inline text-[10px] rounded-full px-2 py-0.5 border border-slate-300 text-slate-600">
                            {c.id.slice(0, 6)}
                          </span>

                          {/* Unread badge */}
                          {hasUnread && (
                            <span className="ml-1 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-amber-50 text-white text-[11px] font-semibold">
                              {unreadCount > 99 ? "99+" : unreadCount}
                            </span>
                          )}
                        </div>

                        <div className="mt-0.5 hidden xs:block text-xs text-slate-600 truncate">
                          seed: {c.q_seed_b64?.slice(0, 16) || "—"}…
                        </div>
                      </div>

                      {/* Chevron */}
                      <div className="shrink-0 pr-0.5 text-slate-300 text-lg leading-none">
                        ›
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */
function initials(name: string) {
  const clean = (name || "").replace(/^@/, "").trim();
  if (!clean) return "U";
  const parts = clean.split(/\s+|[_\-\.]/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
