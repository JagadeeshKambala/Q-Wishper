from fastapi import APIRouter
import os, base64, requests

router = APIRouter()

@router.get("/qrng")
def get_qrng(n: int = 32):
    """
    Returns n random bytes from a QRNG provider if configured, else OS CSPRNG.
    Env (optional):
      QRNG_URL    e.g., https://provider.example/api/bytes?length=
      QRNG_HEADER e.g., Authorization:Bearer YOUR_TOKEN
    """
    data = None
    url = os.getenv("QRNG_URL")
    header = os.getenv("QRNG_HEADER")

    if url:
        try:
            headers = {}
            if header and ":" in header:
                k,v = header.split(":",1)
                headers[k.strip()] = v.strip()
            resp = requests.get(f"{url}{n}", headers=headers, timeout=4)
            resp.raise_for_status()
            # Try JSON with base64; fallback to raw content
            try:
                j = resp.json()
                if "base64" in j:
                    import base64 as b64
                    data = b64.b64decode(j["base64"])
                elif "bytes" in j and isinstance(j["bytes"], list):
                    data = bytes(j["bytes"])
                else:
                    data = resp.content
            except Exception:
                data = resp.content
        except Exception:
            data = None

    if data is None:
        data = os.urandom(n)

    return {"base64": base64.b64encode(data).decode()}
