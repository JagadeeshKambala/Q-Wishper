from fastapi import APIRouter
from app.models.schemas import WrapRequest, WrapResponse
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os, base64

router = APIRouter()

@router.post("/wrap_key", response_model=WrapResponse)
def wrap_key(req: WrapRequest):
    key = base64.b64decode(req.wrap_key_b64)
    pt  = base64.b64decode(req.plaintext_b64)
    aes = AESGCM(key)
    iv = base64.b64decode(req.iv_b64) if req.iv_b64 else os.urandom(12)
    ct = aes.encrypt(iv, pt, None)
    return {
        "iv_b64": base64.b64encode(iv).decode(),
        "ct_b64": base64.b64encode(ct).decode(),
        "tag_included": True
    }
