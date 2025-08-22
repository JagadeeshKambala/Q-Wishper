from fastapi import APIRouter, Query
from app.core.bb84_sim import simulate_bb84
from app.models.schemas import BB84Out
import base64

router = APIRouter()

@router.get("/simulate_bb84", response_model=BB84Out)
def simulate_bb84_api(
    n_bits: int = Query(2048, ge=128, le=65536),
    seed_b64: str = Query(...),
    eavesdrop: bool = False
):
    seed = base64.b64decode(seed_b64)
    key_bytes, stats = simulate_bb84(seed, n_bits=n_bits, eavesdrop=eavesdrop)
    return {
        "base64_key": base64.b64encode(key_bytes).decode(),
        "qber": stats["qber"],
        "kept": stats["kept"],
        "discarded": stats["discarded"],
    }
