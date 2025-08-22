import { ReactNode, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../lib/firebaseClient";
import { Navigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";

export default function AuthGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<"checking"|"needsLogin"|"needsUsername"|"ok">("checking");

  useEffect(() => {
    // Watch login state, then check if user has a username document
    return onAuthStateChanged(auth, async (u) => {
      if (!u) { setStatus("needsLogin"); return; }
      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        const hasUsername = snap.exists() && !!snap.data()?.username;
        setStatus(hasUsername ? "ok" : "needsUsername");
      } catch (e) {
        console.error("AuthGate user doc check failed:", e);
        // Fail open to username setup so the user can complete it
        setStatus("needsUsername");
      }
    });
  }, []);

  if (status === "checking") return <div className="p-6">Loading…</div>;
  if (status === "needsLogin") return <Navigate to="/login" replace />;
  if (status === "needsUsername") return <Navigate to="/setup-username" replace />;
  return <>{children}</>;
}
