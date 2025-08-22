import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles/index.css";
import ErrorBoundary from "./components/misc/ErrorBoundary";

// quick sanity log so we know env loaded (remove later)
console.log("[env]", {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  backend: import.meta.env.VITE_BACKEND_URL,
  apiKeyPrefix: String(import.meta.env.VITE_FIREBASE_API_KEY || "").slice(0, 6) + "…",
});

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing #root element in index.html");
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
