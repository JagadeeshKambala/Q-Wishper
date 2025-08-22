from pydantic import BaseModel, Field
from typing import Optional, List

class BB84Out(BaseModel):
    base64_key: str
    qber: float
    kept: int
    discarded: int

class WrapRequest(BaseModel):
    wrap_key_b64: str = Field(..., description="AES-256-GCM key material (raw) in base64")
    plaintext_b64: str = Field(..., description="plaintext to wrap (base64)")
    iv_b64: Optional[str] = None  # optional IV; if missing, server generates

class WrapResponse(BaseModel):
    iv_b64: str
    ct_b64: str
    tag_included: bool = True

class MessageIn(BaseModel):
    chat_id: str
    sender_uid: str
    iv_b64: str
    ct_b64: str

class MessageOut(MessageIn):
    message_id: str

class ChatCreate(BaseModel):
    members: List[str]
    q_seed_b64: str
