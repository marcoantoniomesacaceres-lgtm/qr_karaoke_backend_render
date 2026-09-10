from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app import crud, schemas
from app.database import SessionLocal
from app.auth import verify_token, log_admin_action
from app.services import websocket_manager
import asyncio
import datetime
from app.utils.cache_manager import cache_manager  # NUEVO: Importar cache manager
from app.utils.timezone_utils import now_bogota
from fastapi.encoders import jsonable_encoder  # Para serializar datos

router = APIRouter()

# Dependencia para obtener la sesión de la base de datos
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/{usuario_id}", response_model=schemas.Consumo, status_code=201, summary="Registrar un consumo para un usuario")
async def registrar_consumo_endpoint(
    usuario_id: int, consumo: schemas.ConsumoCreate, db: Session = Depends(get_db), admin: dict = Depends(verify_token)
):
    log_admin_action(admin.get("sub"), "registrar_consumo", f"Usuario: {usuario_id}, Producto ID: {consumo.producto_id}")
    """
    **[Admin/Staff]** Añade un producto al registro de consumo de un usuario.
    Esto afectará directamente la prioridad del usuario en la cola de canciones.
    OPTIMIZACIÓN: Se agrega al caché de la mesa.
    """
    db_consumo, error_detail = crud.create_consumo_para_usuario(db=db, consumo=consumo, usuario_id=usuario_id)
    if error_detail:
        raise HTTPException(status_code=400, detail=error_detail)
    

    # Notificamos la actualización de la cola
    asyncio.create_task(websocket_manager.manager.broadcast_queue_update())

    # También programamos una notificación específica de "consumo creado" en background.
    try:
        # db_consumo es un SimpleNamespace que envuelve un dict del cache
        # Pero enriquecido con .usuario y .producto (objetos BD)
        mesa_id = getattr(db_consumo, 'mesa_id', None)
        mesa_nombre = "Mesa"
        if mesa_id:
            mesa_data = cache_manager.get_mesa_by_id(mesa_id)
            if mesa_data:
                mesa_nombre = mesa_data.get("nombre", f"Mesa {mesa_id}")

        consumo_payload = { # This is for single consumptions
            'type': 'single_consumo',
            'id': getattr(db_consumo, 'id', None),
            'cantidad': getattr(db_consumo, 'cantidad', 1),
            'valor_total': float(getattr(db_consumo, 'valor_total', 0)),
            'producto_nombre': db_consumo.producto.nombre if hasattr(db_consumo, 'producto') and db_consumo.producto else "Producto",
            'usuario_nick': db_consumo.usuario.nick if hasattr(db_consumo, 'usuario') and db_consumo.usuario else "Usuario",
            'mesa_nombre': mesa_nombre,
            'created_at': getattr(db_consumo, 'created_at', now_bogota()).isoformat() if hasattr(getattr(db_consumo, 'created_at', None), 'isoformat') else str(getattr(db_consumo, 'created_at', ''))
        } 
        # Fire-and-forget the notification to avoid affecting the HTTP response
        asyncio.create_task(websocket_manager.manager.broadcast_consumo_created(consumo_payload))
    except Exception as e:
        import logging
        logging.error(f"Error enviando notificación de consumo: {e}", exc_info=True)
        # Nunca permitir que la notificación rompa la respuesta principal
        pass
    return db_consumo

@router.post("/pedir/{usuario_id}", response_model=schemas.Consumo, summary="Un usuario pide un producto para sí mismo")
async def usuario_pide_producto(
    usuario_id: int, consumo: schemas.ConsumoCreate, db: Session = Depends(get_db)
):
    """
    **[Público]** Permite que un usuario registrado en una mesa pida un producto.
    No requiere clave de API de administrador.
    OPTIMIZACIÓN: Se agrega al caché de la mesa.
    """
    # La lógica es la misma que para el admin, solo que sin la autenticación de admin
    db_consumo, error_detail = crud.create_consumo_para_usuario(db=db, consumo=consumo, usuario_id=usuario_id)
    if error_detail:
        raise HTTPException(status_code=400, detail=error_detail)
    

    # Notificamos a todos para que la cola se actualice (por si cambia la prioridad)
    asyncio.create_task(websocket_manager.manager.broadcast_queue_update())

    # Notificamos en background que se creó un consumo (para la UI del admin)
    try:
        mesa_id = getattr(db_consumo, 'mesa_id', None)
        mesa_nombre = "Mesa"
        if mesa_id:
            mesa_data = cache_manager.get_mesa_by_id(mesa_id)
            if mesa_data:
                mesa_nombre = mesa_data.get("nombre", f"Mesa {mesa_id}")

        consumo_payload = { # This is for single consumptions from public endpoint
            'type': 'single_consumo',
            'id': getattr(db_consumo, 'id', None),
            'cantidad': getattr(db_consumo, 'cantidad', 1),
            'valor_total': float(getattr(db_consumo, 'valor_total', 0)),
            'producto_nombre': db_consumo.producto.nombre if hasattr(db_consumo, 'producto') and db_consumo.producto else "Producto",
            'usuario_nick': db_consumo.usuario.nick if hasattr(db_consumo, 'usuario') and db_consumo.usuario else "Usuario",
            'mesa_nombre': mesa_nombre,
            'created_at': getattr(db_consumo, 'created_at', now_bogota()).isoformat() if hasattr(getattr(db_consumo, 'created_at', None), 'isoformat') else str(getattr(db_consumo, 'created_at', ''))
        } 
        asyncio.create_task(websocket_manager.manager.broadcast_consumo_created(consumo_payload))
    except Exception:
        pass
    return db_consumo

@router.post("/pedir/carrito/{usuario_id}", response_model=List[schemas.Consumo], summary="Un usuario pide un carrito de compras completo")
async def usuario_pide_carrito(
    usuario_id: int, carrito: schemas.CarritoCreate, db: Session = Depends(get_db)
):
    """
    **[Público]** Permite que un usuario envíe un pedido consolidado (carrito).
    Si algún producto falla (stock, etc.), todo el pedido es rechazado.
    OPTIMIZACIÓN: Los consumos se agregan al caché de la mesa.
    """
    if not carrito.items:
        raise HTTPException(status_code=400, detail="El carrito no puede estar vacío.")

    # La nueva función crud maneja la transacción completa
    consumos_creados, error_detail = crud.create_pedido_from_carrito(db=db, carrito=carrito, usuario_id=usuario_id)

    if error_detail:
        raise HTTPException(status_code=400, detail=error_detail)

    # Notificamos a todos para que la cola se actualice (por si cambia la prioridad)
    asyncio.create_task(websocket_manager.manager.broadcast_queue_update())

    # Notificamos al admin sobre el NUEVO PEDIDO CONSOLIDADO en un solo evento
    try:
        if consumos_creados:
            primer_consumo = consumos_creados[0]
            # primer_consumo es un SimpleNamespace
            mesa_id = getattr(primer_consumo, 'mesa_id', None)
            mesa_nombre = "Mesa"
            if mesa_id:
                mesa_data = cache_manager.get_mesa_by_id(mesa_id)
                if mesa_data:
                    mesa_nombre = mesa_data.get("nombre", f"Mesa {mesa_id}")
            
            pedido_payload = {
                'type': 'consolidated_pedido',
                'id': f"pedido-{now_bogota().timestamp()}-{usuario_id}", 
                'consumo_ids': [getattr(c, 'id', None) for c in consumos_creados],
                'usuario_nick': primer_consumo.usuario.nick if hasattr(primer_consumo, 'usuario') and primer_consumo.usuario else 'Desconocido',
                'mesa_nombre': mesa_nombre,
                'created_at': getattr(primer_consumo, 'created_at', now_bogota()).isoformat() if hasattr(getattr(primer_consumo, 'created_at', None), 'isoformat') else str(getattr(primer_consumo, 'created_at', '')),
                'items': [
                    {'producto_nombre': c.producto.nombre if hasattr(c, 'producto') and c.producto else "Producto", 'cantidad': getattr(c, 'cantidad', 1)} for c in consumos_creados
                ]
            } 
            asyncio.create_task(websocket_manager.manager.broadcast_pedido_created(pedido_payload))
    except Exception as e:
        import logging
        logging.error(f"Error en broadcast_pedido_created: {e}", exc_info=True)
        pass # No dejar que la notificación rompa la respuesta

    return consumos_creados