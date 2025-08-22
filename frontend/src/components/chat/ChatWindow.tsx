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
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { base64ToBytes, simulateBB84 } from "../../lib/api";
import { aesGcmDecrypt, aesGcmEncrypt, hkdfKey } from "../../lib/crypto";
import { auth, db } from "../../lib/firebaseClient";

/** Props **/
export type ChatWindowProps = {
  chatId: string;
  /** Optional back button handler (used in mobile “separate pages” mode) */
  onBack?: () => void;
};

type Msg = {
  id: string;
  senderUid: string;
  iv_b64: string;
  ct_b64: string;
  createdAt?: any;
};

export default function ChatWindow({ chatId, onBack }: ChatWindowProps) {
  const [uid, setUid] = useState<string>("");
  const [seedB64, setSeedB64] = useState<string>("");
  const [peerUid, setPeerUid] = useState<string>("");
  const [peerName, setPeerName] = useState<string>("user");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [derived, setDerived] = useState<CryptoKey | null>(null);
  const [qber, setQber] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => onAuthStateChanged(auth, (u) => setUid(u?.uid || "")), []);

  // Load chat metadata (seed + members) and derive key + peer username
  useEffect(() => {
    (async () => {
      const cdoc = await getDoc(doc(db, "chats", chatId));
      const data = cdoc.data() as any;
      if (!data) return;

      const s = (data.q_seed_b64 as string) || "";
      setSeedB64(s);

      const members: string[] = data.members || [];
      const other = members.find((m) => m !== uid) || "";
      setPeerUid(other);

      // Resolve peer username
      if (other) {
        const udoc = await getDoc(doc(db, "users", other));
        const uname =
          (udoc.exists() && (udoc.data() as any)?.username) || "user";
        setPeerName(uname);
      }

      // Derive session key
      const bb = await simulateBB84(s, 2048);
      setQber(bb.qber);
      const sifted = base64ToBytes(bb.base64_key);
      const salt = base64ToBytes(s);
      const k = await hkdfKey(sifted, salt);
      setDerived(k);
    })();
  }, [chatId, uid]);

  // Messages stream
  useEffect(() => {
    const qref = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("createdAt", "asc")
    );
    return onSnapshot(qref, (snap) =>
      setMsgs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })))
    );
  }, [chatId]);

  // Auto scroll
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [msgs.length]);

  const send = async () => {
    if (!derived || !text.trim()) return;
    setBusy(true);
    try {
      const { iv_b64, ct_b64 } = await aesGcmEncrypt(derived, text.trim());
      await addDoc(collection(db, "chats", chatId, "messages"), {
        senderUid: uid,
        iv_b64,
        ct_b64,
        createdAt: serverTimestamp(),
      });
      setText("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-neutral-50/40 dark:bg-black">
      {/* Header */}
      <div className="px-3 sm:px-5 py-3 border-b border-neutral-200/70 dark:border-neutral-800/70 bg-white/50 dark:bg-white/[0.02] backdrop-blur-xl">
        <div className="flex items-center gap-2">
          {/* Back only on mobile */}
          {onBack && (
            <button
              onClick={onBack}
              className="md:hidden inline-flex items-center justify-center rounded-xl border border-neutral-300/70 dark:border-neutral-700/70 bg-white dark:bg-neutral-900 px-3 py-2 text-xs font-medium hover:shadow-sm active:scale-[.99] transition"
            >
              ← Back
            </button>
          )}
          <div className="flex-1 flex items-center justify-between min-w-0">
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">@{peerName}</div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                #{chatId.slice(0, 6)} · QBER {qber?.toFixed(3) ?? "—"}
              </div>
            </div>
            <div className="hidden sm:block text-[10px] text-neutral-500 dark:text-neutral-400">
              seed {seedB64 ? seedB64.slice(0, 10) + "…" : "—"}
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 space-y-2">
        {msgs.map((m) => (
          <MessageRow key={m.id} me={m.senderUid === uid}>
            <MessageBubble me={m.senderUid === uid} msg={m} keyObj={derived} />
          </MessageRow>
        ))}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-neutral-200/70 dark:border-neutral-800/70 bg-white/60 dark:bg-white/[0.03] backdrop-blur-xl px-3 sm:px-5 py-3">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <div className="rounded-2xl border border-neutral-300/80 dark:border-neutral-700/80 bg-white dark:bg-neutral-900 px-3.5 py-2.5 focus-within:ring-2 focus-within:ring-neutral-900/10 dark:focus-within:ring-white/10">
              <textarea
                rows={1}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={`Message @${peerName}…`}
                className="block w-full resize-none bg-transparent text-sm outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
              />
            </div>
          </div>
          <button
            onClick={send}
            disabled={!derived || !text.trim() || busy}
            className="rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-black px-4 py-2.5 text-sm font-medium hover:opacity-95 active:scale-[.99] transition disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 dark:focus:ring-white/20"
          >
            {busy ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Forces each message onto its own line; aligns left for others, right for me */
function MessageRow({
  me,
  children,
}: {
  me: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`w-full flex ${me ? "justify-end" : "justify-start"}`}>
      {children}
    </div>
  );
}

function MessageBubble({
  me,
  msg,
  keyObj,
}: {
  me: boolean;
  msg: { iv_b64: string; ct_b64: string };
  keyObj: CryptoKey | null;
}) {
  const [pt, setPt] = useState<string>("…");

  useEffect(() => {
    (async () => {
      if (!keyObj) {
        setPt("…");
        return;
      }
      try {
        const plain = await aesGcmDecrypt(keyObj, msg.iv_b64, msg.ct_b64);
        setPt(plain);
      } catch {
        setPt("[decrypt error]");
      }
    })();
  }, [keyObj, msg.iv_b64, msg.ct_b64]);

  return (
    <div
      className={[
        "inline-block px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed",
        "break-words align-top",
        me
          ? "bg-[rgb(42,145,255)] text-white"
          : "bg-neutral-100 dark:bg-white/10 text-neutral-900 dark:text-neutral-100",
      ].join(" ")}
      style={{ maxWidth: "75%" }}
    >
      {pt}
    </div>
  );
}
