import json
import os
from .crypto import encrypt, decrypt

DB_FILE = "vault.db"

def save_encrypted(key: bytes, data: dict):
    raw = json.dumps(data).encode()
    nonce, ciphertext = encrypt(key, raw)
    with open(DB_FILE, "wb") as f:
        f.write(nonce + ciphertext)

def load_encrypted(key: bytes) -> dict:
    if not os.path.exists(DB_FILE):
        return {}
    blob = open(DB_FILE, "rb").read()
    nonce = blob[:12]
    ciphertext = blob[12:]
    raw = decrypt(key, nonce, ciphertext)
    return json.loads(raw.decode())
