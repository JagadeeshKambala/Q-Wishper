import os
from typing import Dict, Any, List, Optional
from google.cloud import firestore

_db = None

def enabled() -> bool:
    return os.getenv("FIREBASE_SERVER_WRITES", "false").lower() == "true"

def get_db():
    global _db
    if _db is None:
        _db = firestore.Client(project=os.getenv("GCP_PROJECT_ID") or None)
    return _db

def add_message(chat_id: str, data: Dict[str, Any]) -> str:
    ref = get_db().collection("chats").document(chat_id).collection("messages").document()
    ref.set(data)
    return ref.id

def list_messages(chat_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    q = (get_db()
         .collection("chats").document(chat_id)
         .collection("messages").order_by("createdAt").limit(limit))
    docs = q.stream()
    out = []
    for d in docs:
        x = d.to_dict()
        x["message_id"] = d.id
        out.append(x)
    return out

def create_chat(members: List[str], q_seed_b64: str) -> str:
    ref = get_db().collection("chats").document()
    ref.set({"members": members, "q_seed_b64": q_seed_b64, "createdAt": firestore.SERVER_TIMESTAMP})
    return ref.id
