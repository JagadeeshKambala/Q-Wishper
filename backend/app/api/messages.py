from fastapi import APIRouter, HTTPException, Query
from app.models.schemas import MessageIn, MessageOut, ChatCreate
from app.services import firestore as fs

router = APIRouter()

@router.post("/messages", response_model=MessageOut)
def add_message(msg: MessageIn):
    if not fs.enabled():
        raise HTTPException(status_code=503, detail="Server-side writes disabled")
    mid = fs.add_message(msg.chat_id, {
        "senderUid": msg.sender_uid,
        "iv_b64": msg.iv_b64,
        "ct_b64": msg.ct_b64,
        "createdAt": None  # server timestamp set via rules OR use SERVER_TIMESTAMP here
    })
    return {**msg.dict(), "message_id": mid}

@router.get("/messages")
def list_messages(chat_id: str = Query(...), limit: int = 50):
    if not fs.enabled():
        raise HTTPException(status_code=503, detail="Server-side reads disabled")
    return fs.list_messages(chat_id, limit)

@router.post("/chats")
def create_chat(body: ChatCreate):
    if not fs.enabled():
        raise HTTPException(status_code=503, detail="Server-side writes disabled")
    chat_id = fs.create_chat(body.members, body.q_seed_b64)
    return {"chat_id": chat_id}
