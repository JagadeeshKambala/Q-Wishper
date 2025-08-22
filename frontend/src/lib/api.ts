export type BB84Response = {
  base64_key: string;
  qber: number;
  kept: number;
  discarded: number;
};

const BASE = import.meta.env.VITE_BACKEND_URL;

export async function qrng(nBytes = 32): Promise<Uint8Array> {
  const r = await fetch(`${BASE}/qrng?n=${nBytes}`);
  const j = await r.json();
  return base64ToBytes(j.base64);
}

export async function simulateBB84(seedB64: string, nBits = 2048): Promise<BB84Response> {
  const r = await fetch(`${BASE}/simulate_bb84?n_bits=${nBits}&seed_b64=${encodeURIComponent(seedB64)}`);
  return r.json();
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
