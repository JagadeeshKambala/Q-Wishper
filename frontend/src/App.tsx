import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./app/Login";
import SetupUsername from "./app/SetupUsername";
import Chats from "./app/Chats";
import QuantumConsole from "./components/quantum/QuantumConsole";
import AuthGate from "./components/auth/AuthGate";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/chats" replace />} />
      <Route path="/login" element={<Login />} />
      {/* <- IMPORTANT: setup-username is OUTSIDE AuthGate */}
      <Route path="/setup-username" element={<SetupUsername />} />
      {/* Protected routes */}
      <Route path="/chats" element={<AuthGate><Chats/></AuthGate>} />
      <Route path="/quantum" element={<AuthGate><QuantumConsole/></AuthGate>} />
      <Route path="*" element={<Navigate to="/chats" replace />} />
    </Routes>
  );
}
