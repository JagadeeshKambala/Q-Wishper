import hashlib
import hmac
import math
import random
from typing import Any, Dict, List, Tuple

# =========================
# Utilities (deterministic)
# =========================

def _rng_from_seed(seed_bytes: bytes) -> random.Random:
    """Deterministic RNG from shared seed."""
    return random.Random(int.from_bytes(seed_bytes, "big", signed=False))

def _hkdf_from_bits(bits: List[int], salt: bytes, length: int = 32) -> bytes:
    """
    HKDF(Extract+Expand) over packed bitstring using HMAC-SHA256.
    Returns 'length' bytes (default 32 for AES-256 key).
    """
    # pack bits -> bytes
    by = bytearray()
    acc = 0
    n = 0
    for b in bits:
        acc = (acc << 1) | (1 if b else 0)
        n += 1
        if n == 8:
            by.append(acc & 0xFF)
            acc = 0
            n = 0
    if n:
        by.append((acc << (8 - n)) & 0xFF)

    # HKDF-Extract
    prk = hmac.new(salt, bytes(by), hashlib.sha256).digest()
    # HKDF-Expand
    okm = b""
    t = b""
    i = 1
    while len(okm) < length:
        t = hmac.new(prk, t + b"" + bytes([i]), hashlib.sha256).digest()
        okm += t
        i += 1
    return okm[:length]

def _h2(x: float) -> float:
    """Binary entropy (base-2)."""
    if x <= 0.0 or x >= 1.0:
        return 0.0
    return -x * math.log2(x) - (1 - x) * math.log2(1 - x)

def _poisson(rng: random.Random, mu: float) -> int:
    """Knuth Poisson sampler (deterministic via rng)."""
    if mu <= 0:
        return 0
    L = math.exp(-mu)
    k = 0
    p = 1.0
    while p > L:
        k += 1
        p *= rng.random()
    return k - 1


# ======================================
# 1) Improved baseline: (toy) BB84 flow
# ======================================

def simulate_bb84(
    seed_bytes: bytes,
    n_bits: int = 2048,
    eavesdrop: bool = False,
    flip_prob: float = 0.02,
) -> Tuple[bytes, Dict[str, Any]]:
    """
    Deterministic BB84-like simulation driven by a shared seed.
    - Adds parameterized noise (flip_prob) and optional eavesdropping disturbance.
    - Derives a 32-byte session key via HKDF(HMAC-SHA256) from the kept bits.

    RETURNS:
      (key_bytes, stats_dict)
        key_bytes: 32 bytes (e.g., for AES-256-GCM)
        stats_dict: {mode, kept, discarded, qber, n_bits}
    NOTE: Pedagogical only; not physical QKD.
    """
    r = _rng_from_seed(seed_bytes)

    photon_bits = [r.getrandbits(1) for _ in range(n_bits)]
    alice_bases = [r.getrandbits(1) for _ in range(n_bits)]  # 0=Z, 1=X
    bob_bases   = [r.getrandbits(1) for _ in range(n_bits)]

    measured = []
    for i in range(n_bits):
        bit = photon_bits[i]
        if alice_bases[i] == bob_bases[i]:
            # channel noise / eavesdropping disturbance
            if eavesdrop and r.random() < 0.10:  # simple disturbance model
                bit ^= 1
            if r.random() < flip_prob:
                bit ^= 1
        else:
            # mismatched bases -> random outcome
            bit = r.getrandbits(1)
        measured.append(bit)

    kept_idx   = [i for i in range(n_bits) if alice_bases[i] == bob_bases[i]]
    alice_kept = [photon_bits[i] for i in kept_idx]
    bob_kept   = [measured[i]     for i in kept_idx]

    mismatches = sum(1 for a, b in zip(alice_kept, bob_kept) if a != b)
    kept = len(kept_idx)
    qber = (mismatches / kept) if kept else 0.0

    # Sift: only matching bits become raw key material
    key_bits = [b for a, b in zip(alice_kept, bob_kept) if a == b]

    # Derive stable 32-byte session key via HKDF over kept bits
    if key_bits:
        key_bytes = _hkdf_from_bits(key_bits, salt=b"bb84-edu-v2")
    else:
        # No kept bits; derive from seed so it's still deterministic
        key_bytes = hmac.new(b"bb84-edu-v2", seed_bytes, hashlib.sha256).digest()

    stats = {
        "mode": "bb84",
        "kept": kept,
        "discarded": n_bits - kept,
        "qber": qber,          # fraction in [0,1]
        "n_bits": n_bits,
    }
    return key_bytes, stats


# ======================================
# 2) Advanced: Decoy-state BB84 (toy)
# ======================================

def simulate_bb84_decoy(
    seed_bytes: bytes,
    n_bits: int = 2048,
    mu_signal: float = 0.5,
    mu_decoy: float = 0.1,
    p_signal: float = 0.7,
    channel_loss: float = 0.10,
    flip_prob: float = 0.02,
) -> Tuple[bytes, Dict[str, Any]]:
    """
    Educational Decoy-state BB84:
    - Each pulse is tagged as signal (prob p_signal) or decoy (prob 1 - p_signal).
    - Photon numbers ~ Poisson(mu_signal/decoy).
    - Detection requires >=1 photon AND survival through channel loss.
    - Sift on basis match; add flip noise; estimate toy secure key rate.

    RETURNS: (key_bytes (32), stats)
      stats includes a 'decoy' subdict with per-class info.
    NOTE: Pedagogical only; not security-proof calculations.
    """
    r = _rng_from_seed(seed_bytes)

    # Bit & basis choices
    a_bits  = [r.getrandbits(1) for _ in range(n_bits)]
    a_bases = [r.getrandbits(1) for _ in range(n_bits)]
    b_bases = [r.getrandbits(1) for _ in range(n_bits)]

    # Class (signal/decoy) assignment
    cls = ["signal" if r.random() < p_signal else "decoy" for _ in range(n_bits)]

    # Photon numbers and simple detection model
    detections = []
    for i in range(n_bits):
        mu = mu_signal if cls[i] == "signal" else mu_decoy
        photons = _poisson(r, mu)
        detected = photons > 0 and (r.random() > channel_loss)
        detections.append(detected)

    # Sifting
    kept_positions: List[int] = []
    bob_kept_bits: List[int] = []
    for i in range(n_bits):
        if not detections[i]:
            continue
        if a_bases[i] != b_bases[i]:
            continue
        bit = a_bits[i]
        if r.random() < flip_prob:
            bit ^= 1
        kept_positions.append(i)
        bob_kept_bits.append(bit)

    alice_kept_bits = [a_bits[i] for i in kept_positions]
    mismatches = sum(1 for a, b in zip(alice_kept_bits, bob_kept_bits) if a != b)
    kept = len(kept_positions)
    qber = (mismatches / kept) if kept else 0.0

    # Per-class detection stats
    det_sig = sum(1 for i, d in enumerate(detections) if d and cls[i] == "signal")
    det_dec = sum(1 for i, d in enumerate(detections) if d and cls[i] == "decoy")

    # Toy secure key rate preview: R ≈ s * (1 − H2(q))
    kept_frac = kept / n_bits if n_bits else 0.0
    secure_key_rate = max(0.0, kept_frac * (1.0 - _h2(min(qber, 0.49))))

    # Derive 32-byte session key
    if kept:
        key_bytes = _hkdf_from_bits(bob_kept_bits, salt=b"decoy-bb84-edu-v1")
    else:
        key_bytes = hmac.new(b"decoy-bb84-edu-v1", seed_bytes, hashlib.sha256).digest()

    stats = {
        "mode": "decoy-bb84",
        "kept": kept,
        "discarded": n_bits - kept,
        "qber": qber,  # fraction
        "n_bits": n_bits,
        "decoy": {
            "mu_signal": mu_signal,
            "mu_decoy": mu_decoy,
            "p_signal": p_signal,
            "detected_signal": det_sig,
            "detected_decoy": det_dec,
            "channel_loss": channel_loss,
            "flip_prob": flip_prob,
            "secure_key_rate_toy": secure_key_rate,
        },
    }
    return key_bytes, stats


# ================================
# 3) Advanced: MDI-BB84 (toy)
# ================================

def simulate_mdi_bb84(
    seed_bytes: bytes,
    n_bits: int = 2048,
    bsm_success: float = 0.25,
    flip_prob: float = 0.02,
) -> Tuple[bytes, Dict[str, Any]]:
    """
    Educational MDI-BB84:
    - Alice and Bob send states to an *untrusted* relay (Charlie).
    - Only successful Bell-state measurements (BSM) contribute.
    - Sift on matched bases; add flip noise.

    RETURNS: (key_bytes (32), stats)
      stats includes an 'mdi' subdict with BSM parameters.
    NOTE: Pedagogical only; not physical implementation.
    """
    r = _rng_from_seed(seed_bytes)

    a_bits, a_bases = ([r.getrandbits(1) for _ in range(n_bits)],
                       [r.getrandbits(1) for _ in range(n_bits)])
    b_bits, b_bases = ([r.getrandbits(1) for _ in range(n_bits)],
                       [r.getrandbits(1) for _ in range(n_bits)])

    # Which time slots yield a successful BSM at the relay
    bsm_ok = [r.random() < bsm_success for _ in range(n_bits)]

    kept_positions: List[int] = []
    bob_kept_bits: List[int] = []
    for i in range(n_bits):
        if not bsm_ok[i]:
            continue
        if a_bases[i] != b_bases[i]:
            continue
        # Simple correlation model: start with Alice's bit, add noise
        bit = a_bits[i]
        if r.random() < flip_prob:
            bit ^= 1
        kept_positions.append(i)
        bob_kept_bits.append(bit)

    alice_kept_bits = [a_bits[i] for i in kept_positions]
    mismatches = sum(1 for a, b in zip(alice_kept_bits, bob_kept_bits) if a != b)
    kept = len(kept_positions)
    qber = (mismatches / kept) if kept else 0.0

    # Derive 32-byte session key
    if kept:
        key_bytes = _hkdf_from_bits(bob_kept_bits, salt=b"mdi-bb84-edu-v1")
    else:
        key_bytes = hmac.new(b"mdi-bb84-edu-v1", seed_bytes, hashlib.sha256).digest()

    stats = {
        "mode": "mdi-bb84",
        "kept": kept,
        "discarded": n_bits - kept,
        "qber": qber,  # fraction
        "n_bits": n_bits,
        "mdi": {
            "bsm_success": bsm_success,
            "flip_prob": flip_prob,
            "kept_fraction": (kept / n_bits) if n_bits else 0.0,
        },
    }
    return key_bytes, stats


# =========================================
# (Optional) One wrapper for convenience
# =========================================

def simulate_qkd(
    seed_bytes: bytes,
    n_bits: int = 2048,
    mode: str = "bb84",
    **kwargs,
) -> Tuple[bytes, Dict[str, Any]]:
    """
    Convenience wrapper:
      mode ∈ {"bb84", "decoy", "mdi"}
    """
    mode = mode.lower()
    if mode == "bb84":
        return simulate_bb84(seed_bytes, n_bits=n_bits, **kwargs)
    if mode == "decoy":
        return simulate_bb84_decoy(seed_bytes, n_bits=n_bits, **kwargs)
    if mode == "mdi":
        return simulate_mdi_bb84(seed_bytes, n_bits=n_bits, **kwargs)
    raise ValueError(f"Unknown mode: {mode!r}")
