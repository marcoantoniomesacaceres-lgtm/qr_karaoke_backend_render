import os
import json
import base64
import hashlib
import logging
from typing import Optional, Dict, Any
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

logger = logging.getLogger(__name__)

QR_SECRET_KEY = os.getenv("QR_SECRET_KEY", os.getenv("SECRET_KEY", "qrmusic_super_secret_qr_key_2026_aesgcm"))
_KEY_BYTES = hashlib.sha256(QR_SECRET_KEY.encode()).digest()


def generate_qr_token(local_id: int, mesa_id: int, user_num: int = 1, session_id: str = "") -> str:
    """
    Genera un token encriptado y autenticado URL-Safe para el QR de la mesa.
    Contiene: local_id, mesa_id, usuario_numero y session_id.
    """
    try:
        aesgcm = AESGCM(_KEY_BYTES)
        nonce = os.urandom(12)
        payload = json.dumps({
            "lid": int(local_id or 1),
            "mid": int(mesa_id),
            "u": int(user_num or 1),
            "sid": str(session_id or "")
        }).encode("utf-8")
        
        ciphertext = aesgcm.encrypt(nonce, payload, None)
        token = base64.urlsafe_b64encode(nonce + ciphertext).decode("utf-8").rstrip("=")
        return token
    except Exception as e:
        logger.error(f"Error generando token QR: {e}", exc_info=True)
        raise e


def decrypt_qr_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Desencripta y valida un token QR encriptado con AES-GCM.
    Retorna un diccionario con: local_id, mesa_id, usuario_numero, session_id.
    Si el token es inválido o alterado, retorna None.
    """
    if not token or not isinstance(token, str):
        return None
    
    clean_token = token.strip()
    try:
        padded = clean_token + "=" * (-len(clean_token) % 4)
        raw = base64.urlsafe_b64decode(padded)
        if len(raw) < 13:
            return None
        
        nonce = raw[:12]
        ciphertext = raw[12:]
        
        aesgcm = AESGCM(_KEY_BYTES)
        decrypted_bytes = aesgcm.decrypt(nonce, ciphertext, None)
        data = json.loads(decrypted_bytes.decode("utf-8"))
        
        return {
            "local_id": int(data.get("lid", 1)),
            "mesa_id": int(data.get("mid", 0)),
            "usuario_numero": int(data.get("u", 1)),
            "session_id": str(data.get("sid", ""))
        }
    except Exception as e:
        logger.warning(f"Error al desencriptar token QR '{clean_token[:15]}...': {e}")
        return None
