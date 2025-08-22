import base64, os, requests

def qrng_bytes(n: int = 32) -> bytes:
    url = os.getenv("QRNG_URL")
    header = os.getenv("QRNG_HEADER")
    if url:
        try:
            headers = {}
            if header and ":" in header:
                k,v = header.split(":",1)
                headers[k.strip()] = v.strip()
            r = requests.get(f"{url}{n}", headers=headers, timeout=4)
            r.raise_for_status()
            try:
                j = r.json()
                if "base64" in j:
                    return base64.b64decode(j["base64"])
                if "bytes" in j:
                    return bytes(j["bytes"])
                return r.content
            except Exception:
                return r.content
        except Exception:
            pass
    return os.urandom(n)
