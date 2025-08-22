import { useEffect, useState } from "react";
import { auth, db } from "../lib/firebaseClient";
import { doc, getDoc, runTransaction, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Navigate } from "react-router-dom";

export default function SetupUsername() {
  const [uid, setUid] = useState<string>("");
  const [username, setUsername] = useState("");
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u) { setUid(""); return; }
      setUid(u.uid);
      // If already set, skip this screen
      const snap = await getDoc(doc(db, "users", u.uid));
      if (snap.exists() && snap.data()?.username) setDone(true);
    });
  }, []);

  if (done) return <Navigate to="/chats" replace />;

  const claim = async () => {
    setErr("");
    const uname = username.trim().toLowerCase();
    if (!uid || !uname) return;
    try {
      await runTransaction(db, async (tx) => {
        const unameRef = doc(db, "usernames", uname);
        const unameSnap = await tx.get(unameRef);
        if (unameSnap.exists()) throw new Error("That username is already taken.");
        tx.set(unameRef, { uid });
        tx.set(doc(db, "users", uid), { username: uname, createdAt: serverTimestamp() }, { merge: true });
      });
      setDone(true);
    } catch (e: any) {
      setErr(e?.message || "Could not set username. Try a different one.");
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 space-y-3">
      <h1 className="text-xl font-semibold">Choose your username</h1>
      <input
        className="w-full border px-3 py-2 rounded"
        value={username}
        onChange={e=>setUsername(e.target.value)}
        placeholder="@name"
      />
      <button
        className="border px-3 py-2 rounded disabled:opacity-50"
        onClick={claim}
        disabled={!uid || !username.trim()}
      >
        Save
      </button>
      {err && <p className="text-sm text-red-500">{err}</p>}
      {!uid && <p className="text-xs opacity-70">Waiting for authentication…</p>}
    </div>
  );
}
