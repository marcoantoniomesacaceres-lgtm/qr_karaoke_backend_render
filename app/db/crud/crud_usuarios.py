"""CRUD operations for Users — session users live in JSON cache, not in the DB."""

import datetime
from sqlalchemy.orm import Session
from types import SimpleNamespace

from app.schemas import UsuarioCreate
from app.utils.cache_manager import cache_manager as cache
from app.utils.timezone_utils import now_bogota


# ---------------------------------------------------------------------------
# Helper: dict → SimpleNamespace (attribute-access compatible object)
# ---------------------------------------------------------------------------

def _to_obj(u: dict) -> SimpleNamespace:
    """Convert a usuario cache dict to an attribute-accessible SimpleNamespace."""
    if u is None:
        return None

    def _parse_dt(val):
        if isinstance(val, str):
            try:
                return datetime.datetime.fromisoformat(val)
            except Exception:
                return now_bogota()
        if val is None:
            return now_bogota()
        return val

    return SimpleNamespace(
        id=int(u.get("id") or 0),
        nick=u.get("nick", ""),
        mesa_id=u.get("mesa_id"),
        local_id=u.get("local_id", 1),
        puntos=u.get("puntos", 0),
        nivel=u.get("nivel", "bronce"),
        is_active=u.get("is_active", True),
        is_silenced=u.get("is_silenced", False),
        is_banned=u.get("is_banned", False),
        song_credits=u.get("song_credits", 1),
        last_active=_parse_dt(u.get("last_active")),
        credits_added_at=_parse_dt(u.get("credits_added_at")),
        last_song_added_at=_parse_dt(u.get("last_song_added_at")) if u.get("last_song_added_at") else None,
        canciones=[],  # lazy — loaded separately from song cache if needed
    )


# ---------------------------------------------------------------------------
# Public CRUD functions
# ---------------------------------------------------------------------------

def get_usuario_by_id(db: Session, usuario_id: int):
    """Busca un usuario por su ID (desde CACHE)."""
    u = cache.get_usuario_by_id_from_cache(usuario_id)
    return _to_obj(u)


def get_usuario_by_nick(db: Session, nick: str):
    """Busca un usuario por su nick (case-insensitive, desde CACHE)."""
    u = cache.get_usuario_by_nick_from_cache(nick)
    return _to_obj(u)


def create_usuario(db: Session, usuario: UsuarioCreate, local_id: int = 1):
    """Crea un nuevo usuario de sesión en el CACHE."""
    usuario_data = {
        "nick": usuario.nick,
        "puntos": 0,
        "nivel": "bronce",
        "is_active": True,
        "is_silenced": False,
        "is_banned": False,
        "song_credits": 1,
        "mesa_id": None,
        "local_id": local_id,
        "last_active": now_bogota().isoformat(),
        "credits_added_at": now_bogota().isoformat(),
        "last_song_added_at": None,
    }
    uid = cache.create_usuario_en_cache(usuario_data)
    return _to_obj(cache.get_usuario_by_id_from_cache(uid))


def create_usuario_en_mesa(db: Session, usuario: UsuarioCreate, mesa_id: int, local_id: int = None):
    """Crea un nuevo usuario y lo asocia a una mesa y local (en CACHE)."""
    if local_id is None:
        try:
            mesa = cache.get_mesa_by_id(mesa_id)
            if mesa and mesa.get("local_id"):
                local_id = mesa.get("local_id")
        except Exception:
            pass
    if local_id is None:
        local_id = 1

    usuario_data = {
        "nick": usuario.nick,
        "puntos": 0,
        "nivel": "bronce",
        "is_active": True,
        "is_silenced": False,
        "is_banned": False,
        "song_credits": 1,
        "mesa_id": mesa_id,
        "local_id": local_id,
        "last_active": now_bogota().isoformat(),
        "credits_added_at": now_bogota().isoformat(),
        "last_song_added_at": None,
    }
    uid = cache.create_usuario_en_cache(usuario_data)
    return _to_obj(cache.get_usuario_by_id_from_cache(uid))


def get_o_crear_usuario_admin_para_mesa(db: Session, mesa_id: int):
    """Obtiene o crea un usuario admin/DJ para una mesa específica (CACHE)."""
    nick = f"MESA_{mesa_id}_ADMIN"
    existing = cache.get_usuario_by_nick_from_cache(nick)
    if existing:
        if not existing.get("mesa_id"):
            cache.update_usuario_en_cache(existing["id"], {"mesa_id": mesa_id})
            existing["mesa_id"] = mesa_id
        return _to_obj(existing)
    return create_usuario_en_mesa(db, UsuarioCreate(nick=nick), mesa_id=mesa_id)


def get_all_usuarios(db: Session):
    """Obtiene todos los usuarios activos (desde CACHE)."""
    return [_to_obj(u) for u in cache.get_all_usuarios_from_cache()]


def update_usuario(db: Session, usuario_id: int, usuario_data: dict):
    """Actualiza un usuario en CACHE."""
    cache.update_usuario_en_cache(usuario_id, usuario_data)
    u = cache.get_usuario_by_id_from_cache(usuario_id)
    return _to_obj(u)


def add_puntos_a_usuario(db: Session, usuario_id: int, puntos_a_anadir: int):
    """Añade puntos y créditos a un usuario en CACHE (y actualiza el nivel)."""
    u = cache.get_usuario_by_id_from_cache(usuario_id)
    if not u:
        return None
    
    puntos_actuales = u.get("puntos", 0)
    creditos_actuales = u.get("song_credits", 0)
    
    nuevos_puntos = puntos_actuales + puntos_a_anadir
    nuevos_creditos = creditos_actuales + puntos_a_anadir
    
    # Recalcular nivel
    nivel = "bronce"
    if nuevos_puntos >= 5000:
        nivel = "oro"
    elif nuevos_puntos >= 1000:
        nivel = "plata"
        
    cache.update_usuario_en_cache(usuario_id, {
        "puntos": nuevos_puntos,
        "song_credits": nuevos_creditos,
        "nivel": nivel
    })
    
    u_updated = cache.get_usuario_by_id_from_cache(usuario_id)
    return _to_obj(u_updated)


def delete_usuario(db: Session, usuario_id: int):
    """Elimina un usuario del CACHE."""
    u = cache.delete_usuario_from_cache(usuario_id)
    return _to_obj(u) if u else None


def get_or_create_dj_user(db: Session):
    """Obtiene o crea el usuario DJ para reproducir canciones (CACHE)."""
    existing = cache.get_usuario_by_nick_from_cache("DJ_KARAOKE")
    if existing:
        return _to_obj(existing)
    return create_usuario(db, UsuarioCreate(nick="DJ_KARAOKE"))


def get_ranking_usuarios(db: Session):
    """Obtiene el ranking de usuarios ordenado por puntos (desde CACHE)."""
    usuarios = cache.get_all_usuarios_from_cache()
    sorted_users = sorted(usuarios, key=lambda u: u.get("puntos", 0), reverse=True)
    return [
        {
            "usuario_id": u.get("id"),
            "nick": u.get("nick"),
            "puntos": u.get("puntos", 0),
            "nivel": u.get("nivel", "bronce"),
            "last_active": u.get("last_active"),
        }
        for u in sorted_users
    ]


def ban_usuario(db: Session, usuario_id: int):
    """Banea a un usuario: lo elimina del caché y guarda su nick en la lista de baneados."""
    u = cache.get_usuario_by_id_from_cache(usuario_id)
    if not u:
        return None
    nick = u.get("nick", "")
    # Persist ban in a simple JSON ban list
    _add_to_ban_list(nick)
    cache.delete_usuario_from_cache(usuario_id)
    return _to_obj(u)


def unban_nick(db: Session, nick: str):
    """Elimina un nick de la lista de baneados."""
    return _remove_from_ban_list(nick)


def get_banned_nicks(db: Session):
    """Devuelve la lista de nicks baneados."""
    return _load_ban_list()


def set_usuario_silenciado(db: Session, usuario_id: int, silenciar: bool):
    """Silencia o reactiva a un usuario."""
    cache.update_usuario_en_cache(usuario_id, {"is_silenced": silenciar})
    u = cache.get_usuario_by_id_from_cache(usuario_id)
    return _to_obj(u)


def get_usuarios_por_nivel(db: Session, nivel: str):
    """Obtiene usuarios de un nivel determinado."""
    usuarios = cache.get_all_usuarios_from_cache()
    return [_to_obj(u) for u in usuarios if u.get("nivel", "bronce") == nivel]


def get_usuarios_sin_canciones_cantadas(db: Session):
    """Usuarios que no han cantado ninguna canción."""
    all_songs = cache.get_all_songs()
    cantores = {s.get("usuario_id") for s in all_songs if s.get("estado") == "cantada"}
    usuarios = cache.get_all_usuarios_from_cache()
    return [_to_obj(u) for u in usuarios if u.get("id") not in cantores]


def get_ranking_puntos_usuarios(db: Session, limit: int = 10):
    """Ranking de usuarios por puntos."""
    usuarios = cache.get_all_usuarios_from_cache()
    sorted_users = sorted(usuarios, key=lambda u: u.get("puntos", 0), reverse=True)
    return [_to_obj(u) for u in sorted_users[:limit]]


def get_consumo_por_mesa(db: Session, mesa_id: int):
    """Historial de consumos de una mesa (desde CACHE)."""
    from app.utils.cache_manager import cache_manager as cache
    return cache.get_consumos_by_mesa(mesa_id)


def get_consumos_por_usuario(db: Session, usuario_id: int):
    """Historial de consumos de un usuario (desde CACHE con productos hidratados)."""
    from app.db.crud.crud_productos import get_producto_by_id
    import decimal
    consumos_raw = cache.get_consumos_by_usuario(usuario_id)
    result = []
    usuario = get_usuario_by_id(db, usuario_id)
    for c in consumos_raw:
        producto = get_producto_by_id(db, c.get("producto_id"))
        try:
            created_at = datetime.datetime.fromisoformat(c.get("created_at", ""))
        except Exception:
            created_at = now_bogota()
        result.append(SimpleNamespace(
            id=c.get("id"),
            cantidad=c.get("cantidad", 1),
            valor_total=decimal.Decimal(str(c.get("valor_total", 0))),
            created_at=created_at,
            producto=producto,
            usuario=usuario,
        ))
    return result


# ---------------------------------------------------------------------------
# Ban-list helpers (persist to cache/bans.json)
# ---------------------------------------------------------------------------

def _get_ban_file():
    from pathlib import Path
    return Path("cache") / "bans.json"


def _load_ban_list():
    f = _get_ban_file()
    if f.exists():
        import json
        try:
            with open(f, 'r', encoding='utf-8') as fp:
                data = json.load(fp)
            return [{"nick": n} for n in data.get("nicks", [])]
        except Exception:
            return []
    return []


def _add_to_ban_list(nick: str):
    import json
    f = _get_ban_file()
    data = {"nicks": []}
    if f.exists():
        try:
            with open(f, 'r', encoding='utf-8') as fp:
                data = json.load(fp)
        except Exception:
            pass
    if nick not in data["nicks"]:
        data["nicks"].append(nick)
    with open(f, 'w', encoding='utf-8') as fp:
        json.dump(data, fp, indent=2)


def _remove_from_ban_list(nick: str):
    import json
    f = _get_ban_file()
    if not f.exists():
        return None
    try:
        with open(f, 'r', encoding='utf-8') as fp:
            data = json.load(fp)
        if nick in data["nicks"]:
            data["nicks"].remove(nick)
            with open(f, 'w', encoding='utf-8') as fp:
                json.dump(data, fp, indent=2)
            return {"nick": nick}
    except Exception:
        pass
    return None


def _is_banned(nick: str) -> bool:
    ban_list = _load_ban_list()
    return any(b.get("nick", "").lower() == nick.lower() for b in ban_list)
