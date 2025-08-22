import argparse
import base64
import os

from bb84sim import simulate_bb84, simulate_bb84_decoy, simulate_mdi_bb84, simulate_qkd


def b64seed(n=32):
    return os.urandom(n)

def run(mode, n_bits, **kwargs):
    seed = b64seed(32)
    key, stats = (
        simulate_bb84(seed, n_bits=n_bits, **kwargs)
        if mode == "bb84" else
        simulate_bb84_decoy(seed, n_bits=n_bits, **kwargs)
        if mode == "decoy" else
        simulate_mdi_bb84(seed, n_bits=n_bits, **kwargs)
        if mode == "mdi" else
        simulate_qkd(seed, n_bits=n_bits, mode=mode, **kwargs)
    )
    print(f"Mode: {stats.get('mode')}")
    print(f"Key (base64): {base64.b64encode(key).decode()}")
    print(f"Kept: {stats.get('kept')} / {stats.get('n_bits')}  |  Discarded: {stats.get('discarded')}")
    qber = stats.get('qber')
    print(f"QBER: {qber*100:.2f}%")
    if 'decoy' in stats:
        d = stats['decoy']
        print(f"[Decoy] μ_signal={d['mu_signal']} μ_decoy={d['mu_decoy']} p_signal={d['p_signal']}")
        print(f"[Decoy] Detected(signal)={d['detected_signal']}  Detected(decoy)={d['detected_decoy']}")
        print(f"[Decoy] Toy secure key rate={d['secure_key_rate_toy']}")
    if 'mdi' in stats:
        m = stats['mdi']
        print(f"[MDI] BSM success={m['bsm_success']}  Kept fraction={m['kept_fraction']}")

if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Run quantum sims (educational).")
    ap.add_argument("--mode", choices=["bb84","decoy","mdi"], default="bb84")
    ap.add_argument("--n-bits", type=int, default=2048)
    # Decoy params
    ap.add_argument("--mu-signal", type=float, default=0.5)
    ap.add_argument("--mu-decoy", type=float, default=0.1)
    ap.add_argument("--p-signal", type=float, default=0.7)
    ap.add_argument("--channel-loss", type=float, default=0.10)
    ap.add_argument("--flip-prob", type=float, default=0.02)
    # MDI params
    ap.add_argument("--bsm-success", type=float, default=0.25)
    args = ap.parse_args()

    if args.mode == "bb84":
        run("bb84", args.n_bits, flip_prob=args.flip_prob)
    elif args.mode == "decoy":
        run("decoy", args.n_bits,
            mu_signal=args.mu_signal, mu_decoy=args.mu_decoy,
            p_signal=args.p_signal, channel_loss=args.channel_loss,
            flip_prob=args.flip_prob)
    else:
        run("mdi", args.n_bits, bsm_success=args.bsm_success, flip_prob=args.flip_prob)
