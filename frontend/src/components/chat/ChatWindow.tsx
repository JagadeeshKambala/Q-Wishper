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
  const taRef = useRef<HTMLTextAreaElement | null>(null);

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
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
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
      // reset textarea height after send
      if (taRef.current) {
        taRef.current.style.height = "40px";
      }
    } finally {
      setBusy(false);
    }
  };

  // Auto-grow the textarea for multi-line, capped for mobile comfort
  const autoGrow = () => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    const max = 140; // px cap to avoid covering too much screen
    el.style.height = Math.min(el.scrollHeight, max) + "px";
  };

  return (
    <div
      className="min-h-[100dvh] flex flex-col bg-neutral-50"
      style={{
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* Header (sticky) */}
      <div className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">
        {/* Accent bar */}
        <div className="h-0.5 w-full bg-gradient-to-r from-[rgb(10,132,255)] via-[rgba(10,132,255,0.35)] to-transparent" />
        <div className="px-3 sm:px-5">
          <div className="flex items-center gap-2 py-2.5 sm:py-3">
            {/* Back on mobile */}
            {onBack && (
              <button
                onClick={onBack}
                className="md:hidden inline-flex items-center justify-center rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:shadow-sm active:scale-[.99] transition"
              >
                ←
              </button>
            )}

            {/* Avatar + Title */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div
                className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-gradient-to-br from-[rgb(120,190,255)] to-[rgb(10,132,255)] text-white grid place-items-center text-xs sm:text-sm font-semibold shadow-sm"
                aria-hidden="true"
                title={peerName}
              >
                {initials(peerName)}
              </div>
              <div className="min-w-0">
                <div className="text-[15px] sm:text-[17px] font-semibold leading-tight truncate text-gray-900">
                  {peerName}
                </div>
                <div className="mt-0.5 hidden xs:flex flex-wrap items-center gap-x-2 text-[11px] sm:text-xs text-neutral-500">
                  <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 border border-neutral-200">
                    Secure
                  </span>
                  <span>QBER {qber?.toFixed(3) ?? "—"}</span>
                  <span className="text-neutral-400">·</span>
                  <span>#{chatId.slice(0, 6)}</span>
                </div>
              </div>
            </div>

            {/* Seed snippet on wide screens */}
            <div className="ml-auto hidden sm:block text-[11px] text-neutral-400">
              seed {seedB64 ? seedB64.slice(0, 10) + "…" : "—"}
            </div>
          </div>
        </div>
      </div>

      {/* Messages (extra bottom padding so sticky composer doesn’t overlap) */}
      <div className="flex-1 overflow-y-auto px-2 sm:px-4 pt-2 sm:pt-4 pb-28 sm:pb-32">
        <div className="mx-auto w-full max-w-3xl space-y-1.5 sm:space-y-2.5">
          {msgs.map((m) => (
            <MessageRow key={m.id} me={m.senderUid === uid}>
              <MessageBubble
                me={m.senderUid === uid}
                msg={m}
                keyObj={derived}
              />
            </MessageRow>
          ))}
          <div ref={endRef} />
        </div>
      </div>

      {/* Composer (sticky, with safe area) */}
      <div
        className="sticky bottom-0 z-10 border-t border-neutral-200 bg-white px-2 sm:px-4"
        style={{
          paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))",
          paddingTop: "0.5rem",
        }}
      >
        <div className="mx-auto w-full max-w-3xl flex items-end gap-2 sm:gap-3">
          <div className="flex-1">
            <div className="rounded-full border border-neutral-300 bg-white px-3.5 py-2 focus-within:ring-2 focus-within:ring-neutral-900/10">
              <textarea
                ref={taRef}
                rows={1}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onInput={autoGrow}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={`Message @${peerName}`}
                className="block w-full resize-none bg-white text-gray-900 text-[15px] outline-none placeholder:text-neutral-400 leading-6"
                style={{ height: 40 }}
              />
            </div>
          </div>
          <button
            onClick={send}
            disabled={!derived || !text.trim() || busy}
            className="h-11 sm:h-11 rounded-full bg-[rgb(10,132,255)] text-white px-4 sm:px-5 text-sm font-semibold shadow-sm hover:brightness-110 active:scale-[.99] transition disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[rgb(10,132,255)]/30"
          >
            {busy ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** One line per message; left for others / right for me */
function MessageRow({
  me,
  children,
}: {
  me: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`w-full flex ${
        me ? "justify-end" : "justify-start"
      } px-1 sm:px-0`}
    >
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
    <div className="max-w-[85%] sm:max-w-[70%] md:max-w-[60%]">
      <div
        className={[
          "relative inline-block px-3.5 py-2.5 rounded-2xl text-[15px] leading-relaxed break-words shadow-sm",
          me ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-900",
        ].join(" ")}
      >
        {pt}
        {/* Tiny tail */}
        <span
          className={[
            "absolute bottom-0 translate-y-[55%] w-3 h-3 rotate-45",
            me ? "right-1 bg-blue-500" : "left-1 bg-gray-200",
          ].join(" ")}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */
function initials(name: string) {
  const parts = (name || "").trim().split(/\s+/);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
