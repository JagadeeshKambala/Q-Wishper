import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
} from "firebase/auth";
import { auth, googleProvider } from "../lib/firebaseClient";
import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    // If a Google redirect just happened, surface any errors
    getRedirectResult(auth).catch((e) => setErr(normalizeAuthError(e)));
    return onAuthStateChanged(auth, (u) => setLoggedIn(!!u));
  }, []);

  if (loggedIn) return <Navigate to="/chats" replace />;

  async function signInGoogle() {
    setBusy(true); setErr("");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e: any) {
      // Fallback to redirect if popup is blocked (Safari/extension/etc.)
      if (e?.code === "auth/popup-blocked" || e?.code === "auth/cancelled-popup-request") {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (e2: any) {
          setErr(normalizeAuthError(e2));
        }
      } else {
        setErr(normalizeAuthError(e));
      }
    } finally {
      setBusy(false);
    }
  }

  async function emailSignIn() {
    setBusy(true); setErr("");
    try {
      await signInWithEmailAndPassword(auth, email, pw);
    } catch (e: any) {
      setErr(normalizeAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  async function emailCreate() {
    setBusy(true); setErr("");
    try {
      await createUserWithEmailAndPassword(auth, email, pw);
    } catch (e: any) {
      setErr(normalizeAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-6 space-y-3">
      <h1 className="text-2xl font-semibold">Sign in</h1>

      <button
        type="button"
        className="border px-3 py-2 rounded w-full disabled:opacity-60"
        onClick={signInGoogle}
        disabled={busy}
      >
        Continue with Google
      </button>

      <input
        className="w-full border px-3 py-2 rounded"
        placeholder="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className="w-full border px-3 py-2 rounded"
        placeholder="password"
        type="password"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
      />
      <div className="flex gap-2">
        <button type="button" className="border px-3 py-2 rounded flex-1 disabled:opacity-60" onClick={emailSignIn} disabled={busy}>
          Sign in
        </button>
        <button type="button" className="border px-3 py-2 rounded flex-1 disabled:opacity-60" onClick={emailCreate} disabled={busy}>
          Create account
        </button>
      </div>

      {err && <p className="text-sm text-red-500">{err}</p>}

      <p className="text-sm">After login you’ll set a unique username.</p>
      <Link to="/setup-username" className="text-blue-500 text-sm">Go to username setup</Link>
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
