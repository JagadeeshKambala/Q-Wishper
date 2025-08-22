from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

from app.api.qrng import router as qrng_router
from app.api.qkd import router as qkd_router
from app.api.wrap import router as wrap_router
from app.api.messages import router as messages_router

load_dotenv()  # loads backend/.env if present

app = FastAPI(title="Quantum Chat Backend", version="1.0.0")

# CORS
frontend_origin = os.getenv("FRONTEND_ORIGIN", "*")
allow_origins = [o.strip() for o in frontend_origin.split(",")] if frontend_origin else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"ok": True}

@app.get("/health")
def health():
    return {"status": "ok"}

app.include_router(qrng_router)
app.include_router(qkd_router)
app.include_router(wrap_router)      # optional envelope encryption
app.include_router(messages_router)  # optional server-side messages
