import random
from typing import Tuple, Dict

def simulate_bb84(seed_bytes: bytes, n_bits: int = 2048, eavesdrop: bool = False) -> Tuple[bytes, Dict]:
    """
    Deterministic BB84-like simulation driven by a shared seed.
    NOTE: Pedagogical only; not physical QKD.
    """
    r = random.Random(int.from_bytes(seed_bytes, "big"))

    photon_bits = [r.getrandbits(1) for _ in range(n_bits)]
    alice_bases = [r.getrandbits(1) for _ in range(n_bits)]  # 0=Z, 1=X
    bob_bases   = [r.getrandbits(1) for _ in range(n_bits)]

    measured = []
    for i in range(n_bits):
        bit = photon_bits[i]
        if alice_bases[i] == bob_bases[i]:
            if eavesdrop and r.random() < 0.1:
                bit ^= 1
        else:
            bit = r.getrandbits(1)
        measured.append(bit)

    kept_idx = [i for i in range(n_bits) if alice_bases[i] == bob_bases[i]]
    alice_kept = [photon_bits[i] for i in kept_idx]
    bob_kept   = [measured[i]     for i in kept_idx]

    mismatches = sum(1 for a,b in zip(alice_kept, bob_kept) if a != b)
    kept = len(kept_idx)
    qber = (mismatches / kept) if kept else 0.0

    key_bits = [b for a,b in zip(alice_kept, bob_kept) if a == b]
    out_bytes = bytearray()
    for i in range(0, len(key_bits), 8):
        chunk = key_bits[i:i+8]
        val = 0
        for b in chunk:
            val = (val << 1) | b
        out_bytes.append(val & 0xFF)

    stats = {"kept": kept, "discarded": n_bits - kept, "qber": qber}
    return bytes(out_bytes), stats
