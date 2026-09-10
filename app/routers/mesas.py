from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List
from app import crud, schemas
import re
import datetime
import logging
from app.database import SessionLocal
from app.auth import verify_token, log_admin_action
from app.utils.cache_manager import cache_manager as cache
from app.utils.timezone_utils import now_bogota

logger = logging.getLogger(__name__)
router = APIRouter()

# Lista de palabras inapropiadas (puedes expandirla según sea necesario)
PROFANITY_LIST = {
    "puta","pene","vagina","parolo", "pendejo", "cabron", "mierda", "coño", "gilipollas", "joder",
    "culero", "chinga", "verga", "mamón", "idiota", "imbecil", "zorra",
    "maricon", "puto", "fuck", "shit", "asshole", "bitch", "cunt", "dick",
    "bastard", "whore", "faggot", "perra", "cagon", "caca", "culo", "lameculo","teta"
}

def contains_profanity(text: str) -> bool:
    """Verifica si el texto contiene palabras inapropiadas (case-insensitive y por palabra)."""
    normalized_text = re.sub(r'[_\-.]', ' ', text.lower()) # Reemplazar separadores comunes con espacios
    words = normalized_text.split()
    return any(word in PROFANITY_LIST for word in words)

# Dependencia para obtener la sesión de la base de datos en cada request
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_mesa_in_mysql(db: Session, mesa_id: int, mesa_nombre: str, qr_code: str):
    """
    Asegura que la mesa exista en la tabla MySQL `mesas` para satisfacer
    la FK constraint de `usuarios.mesa_id`.
    Las mesas viven en el cache JSON, pero MySQL necesita el registro
    para que el INSERT de usuarios no falle por FK.
    """
    try:
        # Realizamos la consulta y la inserción dentro de un bloque try-except global
        result = db.execute(
            text("SELECT id FROM mesas WHERE id = :id"), {"id": mesa_id}
        )
        if not result.fetchone():
            db.execute(
                text(
                    "INSERT INTO mesas (id, nombre, qr_code, is_active) "
                    "VALUES (:id, :nombre, :qr_code, :is_active)"
                ),
                {
                    "id": mesa_id,
                    "nombre": mesa_nombre,
                    "qr_code": qr_code,
                    "is_active": True,
                },
            )
            db.commit()
            logger.info(f"Mesa {mesa_id} ('{mesa_nombre}') sincronizada a MySQL para FK.")
    except Exception as e:
        db.rollback()
        logger.warning(f"No se pudo sincronizar mesa {mesa_id} a MySQL (posible tabla inexistente): {e}")


from fastapi import Request
from typing import Optional

def get_mesa_local_id(request: Request, admin: Optional[dict] = None) -> Optional[int]:
    local_id_str = request.query_params.get("local_id") or request.headers.get("X-Local-ID")
    if local_id_str:
        try:
            return int(local_id_str)
        except Exception:
            pass
    if admin and admin.get("role") != "owner":
        return admin.get("local_id")
    return None

@router.get("/", response_model=List[schemas.Mesa], summary="Listar todas las mesas")
def get_mesas(request: Request, db: Session = Depends(get_db), admin: dict = Depends(verify_token)):
    """
    **[Admin]** Devuelve una lista de todas las mesas creadas en el sistema para el local activo.
    """
    active_local_id = get_mesa_local_id(request, admin)
    mesas = crud.get_mesas(db, local_id=active_local_id)
    return mesas

@router.post("/", response_model=schemas.Mesa, status_code=201, summary="Crear una nueva mesa")
def create_mesa_endpoint(
    request: Request,
    mesa: schemas.MesaCreate, 
    db: Session = Depends(get_db),
    admin: dict = Depends(verify_token)
):
    """
    Crea una nueva mesa en el sistema con un nombre y un código QR único.
    El código QR debe ser único en todo el sistema.
    """
    active_local_id = get_mesa_local_id(request, admin)
    if not mesa.local_id and active_local_id:
        mesa.local_id = active_local_id
    log_admin_action(admin.get("sub"), "create_mesa", f"Mesa: {mesa.nombre}, QR: {mesa.qr_code}, Local: {mesa.local_id}")
    db_mesa = crud.get_mesa_by_qr(db, qr_code=mesa.qr_code)
    if db_mesa:
        # db_mesa es un dict si viene del cache
        is_active = db_mesa.get('is_active', True)
        mesa_nombre = db_mesa.get('nombre')
        mesa_id = db_mesa.get('id')
        
        if not is_active:
            import uuid
            # Reactivar mesa como nueva sesión limpia desde 0
            crud.set_mesa_active_status(db, mesa_id=mesa_id, is_active=True)
            db_mesa['session_id'] = uuid.uuid4().hex[:8]
            db_mesa['created_at'] = now_bogota().isoformat()
            if mesa.nombre and mesa_nombre != mesa.nombre:
                db_mesa['nombre'] = mesa.nombre
            cache.update_mesa(mesa_id, db_mesa)
            cache.clear_mesa_cache(mesa_id)
            cache.clear_usuarios_de_mesa(mesa_id)
            cache.clear_consumos_de_mesa(mesa_id)
            return db_mesa
        else:
            raise HTTPException(
                status_code=400, 
                detail=f"El código QR '{mesa.qr_code}' ya está registrado para la mesa '{mesa_nombre}'. Por favor, usa un código QR diferente."
            )
    try:
        return crud.create_mesa(db=db, mesa=mesa)
    except Exception as e:
        # Manejar colisiones de unique constraint en caso de condiciones de carrera
        try:
            from sqlalchemy.exc import IntegrityError
            if isinstance(e, IntegrityError):
                raise HTTPException(
                    status_code=400, 
                    detail=f"El código QR '{mesa.qr_code}' ya está registrado (conflicto de concurrencia). Intenta nuevamente."
                )
        except Exception:
            # si sqlalchemy no está disponible por alguna razón, continuar con manejo genérico
            pass
        # Si no es un IntegrityError, relanzamos como 500 para no ocultar errores inesperados
        raise HTTPException(status_code=500, detail=str(e))


# ========================================================================
# ENDPOINTS DE CÓDIGOS QR ENCRIPTADOS (key=encrypt)
# ========================================================================
from app.utils.qr_crypto import generate_qr_token, decrypt_qr_token

@router.get("/generate-qr-key", summary="Generar clave encriptada para el código QR de una mesa y usuario")
def generar_qr_key(
    mesa_id: int,
    local_id: int = None,
    user_num: int = 1,
    db: Session = Depends(get_db)
):
    """
    Genera un token encriptado URL-Safe que encapsula (local_id, mesa_id, user_num, session_id).
    """
    db_mesa = crud.get_mesa_by_id(db, mesa_id=mesa_id)
    if not db_mesa:
        raise HTTPException(status_code=404, detail="La mesa no existe.")

    if local_id is None:
        if db_mesa.get("local_id"):
            local_id = db_mesa.get("local_id")
        else:
            local_id = 1

    session_id = db_mesa.get("session_id")
    if not session_id:
        import uuid
        session_id = uuid.uuid4().hex[:8]
        db_mesa["session_id"] = session_id
        cache.update_mesa(mesa_id, db_mesa)

    token = generate_qr_token(local_id=local_id, mesa_id=mesa_id, user_num=user_num, session_id=session_id)
    return {
        "key": token,
        "local_id": local_id,
        "mesa_id": mesa_id,
        "usuario_numero": user_num,
        "session_id": session_id
    }


@router.get("/resolve-key", summary="Desencriptar y resolver datos de un token QR")
def resolver_qr_key(key: str, db: Session = Depends(get_db)):
    """
    Desencripta la clave QR y devuelve la información de la sede, mesa y usuario.
    Valida que la sesión de la mesa siga activa y coincida con el session_id del token.
    """
    decrypted = decrypt_qr_token(key)
    if not decrypted:
        raise HTTPException(
            status_code=400,
            detail="Código QR o clave inválida o manipulada."
        )

    local_id = decrypted["local_id"]
    mesa_id = decrypted["mesa_id"]
    usuario_numero = decrypted["usuario_numero"]
    token_session_id = decrypted.get("session_id", "")

    db_mesa = crud.get_mesa_by_id(db, mesa_id=mesa_id)
    if not db_mesa or not db_mesa.get("is_active", True):
        raise HTTPException(
            status_code=403,
            detail="Esta sesión de mesa ya ha finalizado. Por favor escanea el código QR actual de la mesa."
        )

    mesa_session_id = db_mesa.get("session_id", "")
    if token_session_id and mesa_session_id and token_session_id != mesa_session_id:
        raise HTTPException(
            status_code=403,
            detail="Esta sesión de mesa ya ha finalizado. Por favor escanea el código QR actual de la mesa."
        )

    local_nombre = f"Sede {local_id}"
    try:
        from app.db.models.local import Local
        loc = db.query(Local).filter(Local.id == local_id).first()
        if loc and loc.nombre:
            local_nombre = loc.nombre
    except Exception:
        pass

    return {
        "key": key,
        "local_id": local_id,
        "local_nombre": local_nombre,
        "mesa_id": mesa_id,
        "mesa_nombre": db_mesa.get("nombre", f"Mesa {mesa_id}"),
        "usuario_numero": usuario_numero,
        "session_id": mesa_session_id or token_session_id,
        "is_active": db_mesa.get("is_active", True)
    }


@router.post("/conectar-key", response_model=schemas.Usuario, summary="Conectar usuario mediante clave QR encriptada")
def conectar_usuario_con_key(
    key: str,
    usuario: schemas.UsuarioCreate,
    db: Session = Depends(get_db)
):
    """
    Conecta al usuario a la mesa y local utilizando el token encriptado del QR.
    Valida que la sesión de la mesa no haya expirado o cambiado.
    """
    decrypted = decrypt_qr_token(key)
    if not decrypted:
        raise HTTPException(
            status_code=400,
            detail="Código QR inválido o no reconocido."
        )

    local_id = decrypted["local_id"]
    mesa_id = decrypted["mesa_id"]
    usuario_numero = decrypted["usuario_numero"]
    token_session_id = decrypted.get("session_id", "")

    db_mesa = crud.get_mesa_by_id(db, mesa_id=mesa_id)
    if not db_mesa or not db_mesa.get("is_active", True):
        raise HTTPException(
            status_code=403,
            detail="Esta sesión de mesa ya ha finalizado. Por favor escanea el código QR actual de la mesa."
        )

    mesa_session_id = db_mesa.get("session_id", "")
    if token_session_id and mesa_session_id and token_session_id != mesa_session_id:
        raise HTTPException(
            status_code=403,
            detail="Esta sesión de mesa ya ha finalizado. Por favor escanea el código QR actual de la mesa."
        )

    mesa_nombre = db_mesa.get("nombre", f"Mesa {mesa_id}")
    custom_nick = usuario.nick.strip() if usuario.nick else ""

    if not custom_nick or custom_nick.lower() == "usuario" or custom_nick.startswith(f"{mesa_nombre}-Usuario"):
        nick_final = f"{mesa_nombre}-Usuario{usuario_numero}"
    else:
        if custom_nick.startswith(f"{mesa_nombre}-"):
            nick_final = custom_nick
        else:
            nick_final = f"{mesa_nombre}-{custom_nick}"

    ensure_mesa_in_mysql(db, mesa_id, mesa_nombre, db_mesa.get("qr_code", f"mesa-{mesa_id}"))

    # Verificar si ya existe en caché
    db_usuario_existente = cache.get_usuario_by_nick_from_cache(nick_final)
    if db_usuario_existente:
        from app.db.crud.crud_usuarios import _to_obj
        if db_usuario_existente.get("is_active"):
            return _to_obj(db_usuario_existente)
        else:
            cache.update_usuario_en_cache(
                db_usuario_existente["id"],
                {
                    "is_active": True,
                    "local_id": local_id,
                    "last_active": datetime.datetime.utcnow().isoformat()
                }
            )
            return _to_obj(cache.get_usuario_by_id_from_cache(db_usuario_existente["id"]))

    try:
        usuario_data = schemas.UsuarioCreate(nick=nick_final)
        return crud.create_usuario_en_mesa(db=db, usuario=usuario_data, mesa_id=mesa_id, local_id=local_id)
    except Exception as e:
        logger.error(f"Error al crear usuario '{nick_final}' en mesa {mesa_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error al crear usuario: {e}")


@router.post("/{qr_code}/conectar", response_model=schemas.Usuario, summary="Conectar un usuario a una mesa")
def conectar_usuario_a_mesa(
    qr_code: str, usuario: schemas.UsuarioCreate, db: Session = Depends(get_db)
):
    """
    Busca una mesa por su clave QR encriptada y crea o conecta al usuario.
    """
    # 1. Intentar desencriptar como token encriptado
    decrypted = decrypt_qr_token(qr_code)
    if decrypted:
        return conectar_usuario_con_key(key=qr_code, usuario=usuario, db=db)

    # 2. Si no es token encriptado válido, rechazar
    raise HTTPException(
        status_code=400,
        detail="Código QR no válido. Por favor escanea el código QR oficial de tu mesa."
    )

@router.get("/{mesa_id}/usuarios-conectados", response_model=List[schemas.UsuarioConectado], summary="Ver usuarios conectados a una mesa")
def get_usuarios_conectados(mesa_id: int, db: Session = Depends(get_db)):
    """
    Devuelve la lista de usuarios conectados actualmente a una mesa específica (máximo 10).
    Incluye nick, puntos, nivel y si están activos.
    """
    mesa = crud.get_mesa_by_id(db, mesa_id=mesa_id)
    if not mesa:
        raise HTTPException(status_code=404, detail="Mesa no encontrada.")
    
    from app.db.crud.crud_usuarios import _to_obj
    usuarios_activos = [
        _to_obj(u) for u in cache.get_usuarios_by_mesa_from_cache(mesa_id)
        if u.get("is_active")
    ]
    return usuarios_activos

@router.get("/{mesa_id}/payment-status", response_model=schemas.MesaEstadoPago, summary="Obtener estado de cuenta de una mesa")
def get_mesa_payment_status(mesa_id: int, db: Session = Depends(get_db)):
    """
    Endpoint público que devuelve el estado de cuenta de una mesa específica.
    Incluye total consumido, total pagado, saldo pendiente, y listas de consumos y pagos.
    Este endpoint es accesible desde la dashboard de usuarios para ver "Mi Cuenta".
    """
    status = crud.get_table_payment_status(db, mesa_id=mesa_id)
    if not status:
        raise HTTPException(status_code=404, detail="Mesa no encontrada.")
    return status

@router.get("/{qr_code}", response_model=schemas.Mesa, summary="Obtener información de una mesa por su QR")
def get_mesa_info(qr_code: str, db: Session = Depends(get_db)):
    """
    Devuelve la información pública de una mesa basada en su código QR.
    Soporta formato base ('karaoke-mesa-XX') y formato específico de usuario ('karaoke-mesa-XX-usuarioN').
    Este endpoint resuelve el error 404 al intentar cargar el dashboard con un QR de usuario.
    """
    # Intentar extraer el número de mesa si viene con formato de usuario
    match_nuevo = re.match(r'karaoke-mesa-(\d+)-usuario\d+', qr_code)
    if match_nuevo:
        mesa_numero = match_nuevo.group(1)
        qr_code_mesa_base = f"karaoke-mesa-{mesa_numero}"
    else:
        match_antiguo = re.match(r'karaoke-mesa-(\d+)$', qr_code)
        if match_antiguo:
            mesa_numero = match_antiguo.group(1)
            qr_code_mesa_base = f"karaoke-mesa-{mesa_numero}"
        else:
            # Si no hace match con nada, intentamos buscarlo tal cual por si acaso
            qr_code_mesa_base = qr_code

    db_mesa = crud.get_mesa_by_qr(db, qr_code=qr_code_mesa_base)
    
    if not db_mesa and (match_nuevo or match_antiguo):
        # Probar formato sin ceros
        qr_code_mesa_base_int = f"karaoke-mesa-{int(mesa_numero)}"
        db_mesa = crud.get_mesa_by_qr(db, qr_code=qr_code_mesa_base_int)
        
        # Probar formato con ceros (02) si aún no se encuentra
        if not db_mesa:
            qr_code_mesa_base_pad = f"karaoke-mesa-{int(mesa_numero):02d}"
            db_mesa = crud.get_mesa_by_qr(db, qr_code=qr_code_mesa_base_pad)
        
    if not db_mesa:
        raise HTTPException(
            status_code=404, 
            detail=f"La mesa '{qr_code}' no existe. Por favor, verifica el código QR."
        )
        
    return db_mesa