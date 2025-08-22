import { base64ToBytes, bytesToBase64 } from "./api";

async function importRawKey(raw: Uint8Array) {
  return crypto.subtle.importKey("raw", raw, "HKDF", false, ["deriveBits", "deriveKey"]);
}

export async function hkdfKey(rawKey: Uint8Array, salt: Uint8Array) {
  const ikm = await importRawKey(rawKey);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt, info: new Uint8Array([]) },
    ikm,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function aesGcmEncrypt(key: CryptoKey, plaintext: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext));
  return { iv_b64: bytesToBase64(iv), ct_b64: bytesToBase64(new Uint8Array(ct)) };
}

export async function aesGcmDecrypt(key: CryptoKey, iv_b64: string, ct_b64: string) {
  const iv = base64ToBytes(iv_b64);
  const ct = base64ToBytes(ct_b64);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(pt);
}
