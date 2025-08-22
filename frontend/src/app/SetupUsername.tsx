import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { auth, db } from "../lib/firebaseClient";

export default function SetupUsername() {
  const [uid, setUid] = useState<string>("");
  const [username, setUsername] = useState("");
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUid("");
        return;
      }
      setUid(u.uid);
      // If already set, skip this screen
      const snap = await getDoc(doc(db, "users", u.uid));
      if (snap.exists() && snap.data()?.username) setDone(true);
    });
  }, []);

  // normalize to @-less, lowercase, no spaces
  function normalize(raw: string) {
    return raw.replace(/^@+/, "").replace(/\s+/g, "").toLowerCase();
  }

  const uname = useMemo(() => normalize(username), [username]);
  const isValid = /^[a-z0-9_]{3,20}$/.test(uname);

  if (done) return <Navigate to="/chats" replace />;

  const claim = async () => {
    setErr("");
    if (!uid || !isValid) return;
    setBusy(true);
    try {
      await runTransaction(db, async (tx) => {
        const unameRef = doc(db, "usernames", uname);
        const unameSnap = await tx.get(unameRef);
        if (unameSnap.exists())
          throw new Error("That username is already taken.");
        tx.set(unameRef, { uid });
        tx.set(
          doc(db, "users", uid),
          { username: uname, createdAt: serverTimestamp() },
          { merge: true }
        );
      });
      setDone(true);
    } catch (e: any) {
      setErr(e?.message || "Could not set username. Try a different one.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 overflow-auto bg-neutral-50 text-neutral-900 dark:bg-black dark:text-neutral-100">
      <div className="min-h-dvh w-screen grid md:grid-cols-2">
        {/* Left hero (hidden on mobile) */}
        <section className="hidden md:flex flex-col justify-center px-12 lg:px-20 bg-gradient-to-b from-neutral-100 to-neutral-50 dark:from-neutral-900 dark:to-black">
          <h1 className="text-5xl font-semibold tracking-tight leading-tight">
            Pick a username.
            <br />
            Make it <span className="whitespace-nowrap">uniquely yours.</span>
          </h1>
          <p className="mt-6 text-lg text-neutral-600 dark:text-neutral-400 max-w-md">
            Your username lets friends find you. You can use letters, numbers,
            and underscores.
          </p>
        </section>

        {/* Right content */}
        <section className="flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-md">
            <div className="rounded-3xl border border-neutral-200/70 dark:border-neutral-800/70 bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl shadow-sm p-8">
              <header className="mb-1">
                <h2 className="text-2xl font-semibold tracking-tight">
                  Choose your username
                </h2>
                <p className="mt-1.5 text-sm text-neutral-600 dark:text-neutral-400">
                  This will be visible to others. You can change it later.
                </p>
              </header>

              {/* Username input */}
              <div className="mt-6">
                <label className="mb-2 block text-sm text-neutral-600 dark:text-neutral-300">
                  Username
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500">
                    @
                  </span>
                  <input
                    className="w-full rounded-xl border border-neutral-300/80 dark:border-neutral-700/80 bg-white dark:bg-neutral-900 pl-8 pr-3.5 py-3 text-sm placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:border-neutral-400 dark:focus:border-neutral-600 focus:ring-2 focus:ring-neutral-900/10 dark:focus:ring-white/10 outline-none"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="yourname"
                    autoFocus
                    maxLength={24}
                    spellCheck={false}
                  />
                </div>

                {/* Live preview + rules */}
                <div className="mt-3 flex items-center justify-between text-xs">
                  <div
                    className={
                      isValid
                        ? "text-green-600 dark:text-green-400"
                        : "text-neutral-500 dark:text-neutral-400"
                    }
                  >
                    preview:{" "}
                    <span className="font-medium">@{uname || "yourname"}</span>
                  </div>
                  <div className="text-neutral-500 dark:text-neutral-400">
                    3–20 chars · a–z 0–9 _
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 flex gap-3">
                <button
                  onClick={claim}
                  disabled={!uid || !isValid || busy}
                  className="flex-1 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-black px-4 py-3 text-sm font-medium hover:opacity-95 active:scale-[.99] transition disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 dark:focus:ring-white/20"
                >
                  {busy ? "Saving…" : "Save"}
                </button>
                <Link
                  to="/chats"
                  className="flex-1 rounded-xl border border-neutral-300/80 dark:border-neutral-700/80 bg-white dark:bg-neutral-900 px-4 py-3 text-sm font-medium text-center hover:shadow-sm active:scale-[.99] transition focus:outline-none focus:ring-2 focus:ring-neutral-900/10 dark:focus:ring-white/10"
                >
                  Skip for now
                </Link>
              </div>

              {/* Alerts */}
              {err && (
                <div
                  role="alert"
                  className="mt-4 rounded-lg border border-red-200/70 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-300"
                >
                  {err}
                </div>
              )}
              {!uid && (
                <div className="mt-4 text-xs text-neutral-500">
                  Waiting for authentication…
                </div>
              )}

              {/* Help text */}
              <div className="mt-6 text-xs text-neutral-500">
                <p>Need to switch account?</p>
                <Link
                  to="/login"
                  className="mt-1 inline-block text-neutral-700 hover:text-black dark:text-neutral-300 dark:hover:text-white underline underline-offset-4"
                >
                  Back to sign in
                </Link>
              </div>
            </div>

            {/* Tiny legal */}
            <p className="mt-6 text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-400 text-center">
              By continuing, you agree to our Terms and acknowledge our Privacy
              Policy.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
