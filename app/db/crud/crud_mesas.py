"""CRUD operations for Tables (in JSON cache)."""

import datetime
from sqlalchemy.orm import Session

from app.schemas import MesaCreate
from app.utils.cache_manager import cache_manager as cache
from app.utils.timezone_utils import now_bogota


from typing import Optional

def get_mesa_by_qr(db: Session, qr_code: str):
    """Busca una mesa por su código QR (desde CACHE)."""
    return cache.get_mesa_by_qr(qr_code)


def get_mesas(db: Session, local_id: Optional[int] = None):
    """Devuelve todas las mesas (desde CACHE), opcionalmente filtradas por local_id."""
    mesas = cache.get_all_mesas()
    if not mesas:
        return []
    if local_id is not None:
        return [m for m in mesas if m.get("local_id") == local_id or m.get("local_id") is None]
    return mesas


def create_mesa(db: Session, mesa: MesaCreate):
    """Crea una nueva mesa en el CACHE con un session_id único."""
    import uuid
    session_id = uuid.uuid4().hex[:8]
    mesa_data = {
        "nombre": mesa.nombre,
        "qr_code": mesa.qr_code,
        "local_id": mesa.local_id,
        "session_id": session_id,
        "is_active": True,
        "created_at": now_bogota().isoformat(),
        "usuarios": []
    }
    mesa_id = cache.create_mesa(mesa_data)
    mesa_data["id"] = mesa_id
    return mesa_data


def get_mesa_by_id(db: Session, mesa_id: int):
    """Obtiene una mesa por ID (desde CACHE)."""
    return cache.get_mesa_by_id(mesa_id)


def set_mesa_active_status(db: Session, mesa_id: int, is_active: bool):
    """Actualiza el estado de activación de una mesa (CACHE)."""
    mesa = cache.get_mesa_by_id(mesa_id)
    if mesa:
        mesa["is_active"] = is_active
        cache.update_mesa(mesa_id, mesa)
    return mesa


def delete_mesa(db: Session, mesa_id: int):
    """Elimina una mesa (CACHE)."""
    return cache.delete_mesa_from_cache(mesa_id)
