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
  where,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
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
    });
  }, [uid]); // eslint-disable-line react-hooks/exhaustive-deps

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
      setFriendUname("");
      onOpen(chat.id);
    } finally {
      setBusy(false);
    }
  };

  const labelFor = (c: ChatDoc) => {
    const other = (c.members || []).find((m) => m !== uid);
    return other ? nameCache[other] || "user" : "user";
    // You could also show group logic here if members.length > 2
  };

  return (
    <div className="h-full flex flex-col bg-neutral-50/40 dark:bg-black">
      {/* Header / start box */}
      <div className="px-4 pt-5 pb-4 border-b border-neutral-200/70 dark:border-neutral-800/70 bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">Chats</h1>
        </div>

        <div className="mt-4 flex gap-2">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500">
              @
            </span>
            <input
              className="w-full rounded-xl border border-neutral-300/80 dark:border-neutral-700/80 bg-white dark:bg-neutral-900 pl-8 pr-3.5 py-2.5 text-sm placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:border-neutral-400 dark:focus:border-neutral-600 focus:ring-2 focus:ring-neutral-900/10 dark:focus:ring-white/10 outline-none"
              placeholder="friend username"
              value={friendUname}
              onChange={(e) => setFriendUname(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canStart && !busy) startChat();
              }}
            />
          </div>
          <button
            onClick={startChat}
            disabled={!canStart || busy}
            className="rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-black px-4 py-2.5 text-sm font-medium hover:opacity-95 active:scale-[.99] transition disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 dark:focus:ring-white/20"
          >
            {busy ? "Starting…" : "Start"}
          </button>
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {chats.length === 0 ? (
          <div className="p-6 text-sm text-neutral-600 dark:text-neutral-400">
            No conversations yet.
          </div>
        ) : (
          <ul className="divide-y divide-neutral-200/70 dark:divide-neutral-800/70">
            {chats.map((c) => (
              <li
                key={c.id}
                onClick={() => onOpen(c.id)}
                className={[
                  "cursor-pointer px-4 py-3 select-none",
                  "hover:bg-neutral-100/70 dark:hover:bg-white/5 transition",
                  activeId === c.id ? "bg-neutral-100/70 dark:bg-white/5" : "",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {labelFor(c)}
                    </div>
                    <div className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400 truncate">
                      seed: {c.q_seed_b64?.slice(0, 16) || "—"}…
                    </div>
                  </div>
                  <div className="shrink-0 text-[10px] rounded-full px-2 py-0.5 border border-neutral-300/70 dark:border-neutral-700/70 text-neutral-600 dark:text-neutral-300">
                    {c.id.slice(0, 6)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
