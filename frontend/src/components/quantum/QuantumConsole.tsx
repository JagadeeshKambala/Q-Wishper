import { useState } from "react";
import { qrng, simulateBB84, bytesToBase64 } from "../../lib/api";

export default function QuantumConsole() {
  const [seedB64, setSeedB64] = useState<string>("");
  const [out, setOut] = useState<any>(null);

  const genSeed = async () => {
    const s = await qrng(32);
    setSeedB64(bytesToBase64(s));
  };
  const run = async () => {
    if (!seedB64) await genSeed();
    const res = await simulateBB84(seedB64, 2048);
    setOut(res);
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">Quantum Console</h1>
      <div className="flex gap-2">
        <button className="border px-3 py-2 rounded" onClick={genSeed}>Get QRNG Seed</button>
        <button className="border px-3 py-2 rounded" onClick={run}>Run BB84</button>
      </div>
      <div className="text-xs break-all opacity-70">seed (b64): {seedB64}</div>
      {out && (
        <div className="text-sm space-y-1">
          <div>QBER: {out.qber.toFixed(3)} | kept: {out.kept} | discarded: {out.discarded}</div>
          <div>Key (first 64 b64 chars): {out.base64_key.slice(0,64)}…</div>
        </div>
      )}
    </div>
  );
}
