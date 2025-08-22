import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { auth, googleProvider } from "../lib/firebaseClient";

export default function Login() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    getRedirectResult(auth).catch((e: any) => setErr(normalizeAuthError(e)));
    return onAuthStateChanged(auth, (u: any) => setLoggedIn(!!u));
  }, []);

  if (loggedIn) return <Navigate to="/chats" replace />;

  async function signInGoogle() {
    setBusy(true);
    setErr("");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e: any) {
      if (
        e?.code === "auth/popup-blocked" ||
        e?.code === "auth/cancelled-popup-request"
      ) {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (e2: any) {
          setErr(normalizeAuthError(e2));
        }
      } else setErr(normalizeAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  async function emailSignIn() {
    setBusy(true);
    setErr("");
    try {
      await signInWithEmailAndPassword(auth, email, pw);
    } catch (e: any) {
      setErr(normalizeAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  async function emailCreate() {
    setBusy(true);
    setErr("");
    try {
      await createUserWithEmailAndPassword(auth, email, pw);
    } catch (e: any) {
      setErr(normalizeAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 overflow-auto bg-neutral-50 text-neutral-900 dark:bg-black dark:text-neutral-100">
      <div className="min-h-dvh w-screen grid md:grid-cols-2">
        {/* Left panel */}
        <section className="hidden md:flex flex-col justify-center px-12 lg:px-20 bg-gradient-to-b from-neutral-100 to-neutral-50 dark:from-neutral-900 dark:to-black">
          <h1 className="text-5xl font-semibold tracking-tight leading-tight">
            Sign in.
            <br />
            Simple. Private. Secure.
          </h1>
          <p className="mt-6 text-lg text-neutral-600 dark:text-neutral-400 max-w-md">
            Access your messages across devices with a privacy-first experience.
          </p>
        </section>

        {/* Right panel (auth) */}
        <section className="flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-md">
            <div className="rounded-3xl border border-neutral-200/70 dark:border-neutral-800/70 bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl shadow-sm p-8">
              <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
              <p className="mt-1.5 text-sm text-neutral-600 dark:text-neutral-400">
                Use your Google account or email.
              </p>

              <button
                type="button"
                onClick={signInGoogle}
                disabled={busy}
                className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-xl border border-neutral-300/80 dark:border-neutral-700/80 bg-white dark:bg-neutral-900 px-4 py-3 text-sm font-medium hover:shadow-sm active:scale-[.99] transition disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 dark:focus:ring-white/20"
              >
                <GoogleMark />
                {busy ? "Working…" : "Continue with Google"}
              </button>

              <div className="my-6 flex items-center gap-3 text-xs text-neutral-500">
                <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
                or
                <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
              </div>

              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  emailSignIn();
                }}
              >
                <input
                  className="w-full rounded-xl border border-neutral-300/80 dark:border-neutral-700/80 bg-white dark:bg-neutral-900 px-3.5 py-3 text-sm placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:border-neutral-400 dark:focus:border-neutral-600 focus:ring-2 focus:ring-neutral-900/10 dark:focus:ring-white/10 outline-none"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  autoComplete="email"
                  required
                />
                <input
                  className="w-full rounded-xl border border-neutral-300/80 dark:border-neutral-700/80 bg-white dark:bg-neutral-900 px-3.5 py-3 text-sm placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:border-neutral-400 dark:focus:border-neutral-600 focus:ring-2 focus:ring-neutral-900/10 dark:focus:ring-white/10 outline-none"
                  placeholder="••••••••"
                  type="password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  autoComplete="current-password"
                  required
                  minLength={6}
                />
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={busy}
                    className="flex-1 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-black px-4 py-3 text-sm font-medium hover:opacity-95 active:scale-[.99] transition disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 dark:focus:ring-white/20"
                  >
                    {busy ? "Signing in…" : "Sign in"}
                  </button>
                  <button
                    type="button"
                    onClick={emailCreate}
                    disabled={busy}
                    className="flex-1 rounded-xl border border-neutral-300/80 dark:border-neutral-700/80 bg-white dark:bg-neutral-900 px-4 py-3 text-sm font-medium hover:shadow-sm active:scale-[.99] transition disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 dark:focus:ring-white/10"
                  >
                    {busy ? "Creating…" : "Create account"}
                  </button>
                </div>
              </form>

              {err && (
                <div
                  role="alert"
                  className="mt-4 rounded-lg border border-red-200/70 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-300"
                >
                  {err}
                </div>
              )}

              <div className="mt-6 text-xs text-neutral-500">
                <p>After login you’ll set a unique username.</p>
                <Link
                  to="/setup-username"
                  className="mt-2 inline-block text-neutral-700 hover:text-black dark:text-neutral-300 dark:hover:text-white underline underline-offset-4"
                >
                  Go to username setup
                </Link>
              </div>
            </div>

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

function normalizeAuthError(e: any): string {
  const code = e?.code || "";
  switch (code) {
    case "auth/operation-not-allowed":
      return "Enable this provider in Firebase Auth → Sign-in method.";
    case "auth/popup-blocked":
      return "Popup was blocked. Retrying with redirect… If it still fails, allow popups for this site.";
    case "auth/invalid-api-key":
      return "Invalid Firebase API key. Check frontend/.env values.";
    case "auth/invalid-email":
      return "Invalid email address.";
    case "auth/missing-password":
      return "Please enter a password.";
    case "auth/wrong-password":
      return "Wrong password.";
    case "auth/user-not-found":
      return "No user with that email.";
    default:
      return e?.message || String(e);
  }
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.9 32.9 29.4 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.6 6.4 29.6 4 24 4 16 4 9.2 8.3 6.3 14.7z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.6 16.1 18.9 12 24 12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.6 6.4 29.6 4 24 4 16 4 9.2 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.3 0 10.1-2 13.7-5.2l-6.3-5.2C29.4 36 26.9 37 24 37c-5.4 0-9.9-3.1-11.7-7.4l-6.6 5.1C8.6 40 15.7 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.4-3.6 6.1-6.9 7.6l.1.1 6.3 5.2c-.4.4 7.2-4.5 7.2-16.9 0-1.3-.1-2.5-.4-3.5z"
      />
    </svg>
  );
}
