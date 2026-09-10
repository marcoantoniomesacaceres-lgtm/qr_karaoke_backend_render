"""CRUD operations for Consumptions/Orders (in JSON cache + database)."""

import datetime
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.models import Pago as PagoModel
from app.schemas import ConsumoCreate, CarritoCreate
from app.utils.cache_manager import cache_manager as cache
from app.utils.timezone_utils import now_bogota


def get_total_consumido_por_usuario(db: Session, usuario_id: int):
    """Calcula el total consumido por un usuario (CACHE)."""
    consumos = cache.get_consumos_by_usuario(usuario_id)
    if not consumos:
        return Decimal('0.00')
    return sum(Decimal(str(c.get("valor_total", 0))) for c in consumos)


def get_consumos_mesa(db: Session, mesa_id: int):
    """Obtiene todos los consumos de una mesa (CACHE)."""
    return cache.get_consumos_by_mesa(mesa_id)


def create_consumo_para_usuario(db: Session, consumo: ConsumoCreate, usuario_id: int):
    """Registra un consumo para un usuario (CACHE)."""
    from app.db.crud.crud_usuarios import get_usuario_by_id, add_puntos_a_usuario
    from app.db.crud.crud_productos import get_producto_by_id

    usuario = get_usuario_by_id(db, usuario_id=usuario_id)
    if not usuario:
        return None, "Usuario no encontrado"

    db_producto = get_producto_by_id(db, producto_id=consumo.producto_id)
    if not db_producto:
        return None, "Producto no encontrado"

    if db_producto.stock < consumo.cantidad:
        return None, f"Stock insuficiente. Disponible: {db_producto.stock}"

    valor_total = float(db_producto.valor * consumo.cantidad)

    consumo_obj = {
        "cantidad": consumo.cantidad,
        "valor_total": valor_total,
        "mesa_id": usuario.mesa_id,
        "usuario_id": usuario_id,
        "producto_id": consumo.producto_id,
        "created_at": now_bogota().isoformat(),
        "is_dispatched": False,
        "is_cancelled": False
    }

    consumo_id = cache.create_consumo_in_cache(consumo_obj)
    consumo_obj["id"] = consumo_id

    from app.services.settings_storage import load_settings
    settings = load_settings()
    credit_multiplier = settings.get("lazy_queue_credit_multiplier", 1.0)

    creditos_ganados = int(valor_total * credit_multiplier)
    if creditos_ganados > 0:
        new_credits = (usuario.song_credits or 0) + creditos_ganados
        new_puntos = (usuario.puntos or 0) + creditos_ganados
        
        # Recalcular nivel del usuario por puntos
        nivel = "bronce"
        if new_puntos >= 5000:
            nivel = "oro"
        elif new_puntos >= 1000:
            nivel = "plata"
            
        cache.update_usuario_en_cache(usuario.id, {
            "song_credits": new_credits,
            "puntos": new_puntos,
            "nivel": nivel
        })
        usuario.song_credits = new_credits
        usuario.puntos = new_puntos
        usuario.nivel = nivel

    db_producto.stock -= consumo.cantidad
    db.add(db_producto)
    db.commit()
    db.refresh(db_producto)

    from types import SimpleNamespace
    db_consumo = SimpleNamespace(**consumo_obj)
    db_consumo.usuario = usuario
    db_consumo.producto = db_producto
    db_consumo.valor_total = Decimal(str(valor_total))
    db_consumo.created_at = datetime.datetime.fromisoformat(consumo_obj["created_at"])

    return db_consumo, None


def create_pedido_from_carrito(db: Session, carrito: CarritoCreate, usuario_id: int):
    """Crea múltiples consumos desde un carrito."""
    from app.db.crud.crud_usuarios import get_usuario_by_id
    usuario = get_usuario_by_id(db, usuario_id)
    if not usuario or not usuario.mesa_id:
        return None, "Usuario o mesa no encontrados."

    consumos_creados = []
    for item in carrito.items:
        consumo_data = ConsumoCreate(producto_id=item.producto_id, cantidad=item.cantidad)
        db_consumo, error = create_consumo_para_usuario(db, consumo_data, usuario_id)
        if error:
            return None, error
        consumos_creados.append(db_consumo)

    return consumos_creados, None


def get_table_payment_status(db: Session, mesa_id: int):
    """Obtiene el estado de cuenta detallado de una mesa (desde CACHE y BD)."""
    from app.db.crud.crud_mesas import get_mesa_by_id
    from app.db.crud.crud_productos import get_producto_by_id

    mesa = get_mesa_by_id(db, mesa_id)
    if not mesa:
        return None

    consumos_raw = cache.get_consumos_by_mesa(mesa_id)
    total_consumido = sum(Decimal(str(c.get("valor_total", 0))) for c in consumos_raw)

    mesa_created_at_str = mesa.get("created_at")
    pagos_query = db.query(PagoModel).filter(PagoModel.mesa_id == mesa_id)
    if mesa_created_at_str:
        try:
            mesa_created_dt = datetime.datetime.fromisoformat(mesa_created_at_str)
            if mesa_created_dt.tzinfo is not None:
                mesa_created_dt = mesa_created_dt.replace(tzinfo=None)
            mesa_created_dt = mesa_created_dt.replace(microsecond=0)
            pagos_query = pagos_query.filter(PagoModel.created_at >= mesa_created_dt)
        except Exception:
            pass

    total_pagado = pagos_query.with_entities(func.sum(PagoModel.monto)).scalar() or Decimal('0.00')

    saldo_pendiente = total_consumido - Decimal(str(total_pagado))

    consumos_items = []
    for c in consumos_raw:
        producto = get_producto_by_id(db, c.get("producto_id"))
        try:
            created_at = datetime.datetime.fromisoformat(c.get("created_at", ""))
        except Exception:
            created_at = now_bogota()
        consumos_items.append({
            "id": c.get("id"),
            "producto_id": c.get("producto_id"),
            "producto_nombre": producto.nombre if producto else "Producto Eliminado",
            "cantidad": c.get("cantidad", 1),
            "valor_total": Decimal(str(c.get("valor_total", 0))),
            "created_at": created_at,
        })

    pagos_detalle = pagos_query.order_by(PagoModel.created_at.asc()).all()

    return {
        "mesa_id": mesa_id,
        "mesa_nombre": mesa.get("nombre", f"Mesa {mesa_id}"),
        "qr_code": mesa.get("qr_code"),
        "is_active": mesa.get("is_active", True),
        "total_consumido": total_consumido,
        "total_pagado": Decimal(str(total_pagado)),
        "saldo_pendiente": saldo_pendiente,
        "consumos": consumos_items,
        "pagos": pagos_detalle,
    }


def get_all_tables_payment_status(db: Session):
    """Devuelve el estado de cuenta para todas las mesas activas."""
    mesas = cache.get_all_mesas() or []
    result = []
    for m in mesas:
        if not m.get("is_active", True):
            continue
        mesa_id = m.get("id")
        if mesa_id is None:
            continue
        status = get_table_payment_status(db, mesa_id)
        if status:
            result.append(status)
    return result


def get_recent_consumos(db: Session, limit: int = 10):
    """Obtiene los consumos más recientes desde el cache e hidrata con nombres de BD."""
    consumos = cache.get_all_consumos()
    if not consumos:
        return []

    consumos_pendientes = [c for c in consumos if not c.get("is_dispatched", False)]
    sorted_consumos = sorted(
        consumos_pendientes,
        key=lambda x: x.get("created_at", ""),
        reverse=True
    )
    recent = sorted_consumos[:limit]

    if not recent:
        return []

    prod_ids = {c.get("producto_id") for c in recent if c.get("producto_id")}

    from app.db.models import Producto
    productos = db.query(Producto).filter(Producto.id.in_(prod_ids)).all() if prod_ids else []

    prod_map = {p.id: p.nombre for p in productos}
    mesa_map = {m.get("id"): m.get("nombre") for m in cache.get_all_mesas()}

    enriched = []
    for c in recent:
        c_copy = dict(c)
        # Look up user from cache instead of DB
        usuario_id = c.get("usuario_id")
        if usuario_id:
            u = cache.get_usuario_by_id_from_cache(usuario_id)
            c_copy["usuario_nick"] = u.get("nick", "Desconocido") if u else "Desconocido"
        else:
            c_copy["usuario_nick"] = "Desconocido"
        c_copy["producto_nombre"] = prod_map.get(c.get("producto_id"), "Desconocido")
        if c.get("mesa_id") is not None:
            c_copy["mesa_nombre"] = mesa_map.get(int(c.get("mesa_id")))
        enriched.append(c_copy)

    return enriched


def delete_consumo(db: Session, consumo_id: int):
    """Elimina un consumo del caché, restaura el stock del producto y recalcula créditos."""
    from app.db.crud.crud_usuarios import get_usuario_by_id
    from app.db.crud.crud_productos import get_producto_by_id

    consumo = cache.get_consumo_by_id(consumo_id)
    if not consumo:
        return False

    db_producto = get_producto_by_id(db, consumo["producto_id"])
    if db_producto:
        db_producto.stock += consumo["cantidad"]
        db.add(db_producto)

    usuario = get_usuario_by_id(db, consumo["usuario_id"])
    if usuario:
        from app.services.settings_storage import load_settings
        settings = load_settings()
        credit_multiplier = settings.get("lazy_queue_credit_multiplier", 1.0)
        creditos_a_restar = int(consumo["valor_total"] * credit_multiplier)
        if creditos_a_restar > 0:
            new_credits = max(0, (usuario.song_credits or 0) - creditos_a_restar)
            cache.update_usuario_en_cache(usuario.id, {"song_credits": new_credits})

    db.commit()
    return cache.delete_consumo_from_cache(consumo_id)


def update_consumo_cantidad(db: Session, consumo_id: int, delta: int):
    """Incrementa o decrementa la cantidad de un consumo."""
    from app.db.crud.crud_usuarios import get_usuario_by_id
    from app.db.crud.crud_productos import get_producto_by_id

    consumo = cache.get_consumo_by_id(consumo_id)
    if not consumo:
        return None, "Consumo no encontrado"

    nueva_cantidad = consumo["cantidad"] + delta
    if nueva_cantidad < 1:
        return None, "La cantidad mínima es 1. Para eliminar use el botón cancelar."

    db_producto = get_producto_by_id(db, consumo["producto_id"])
    if not db_producto:
        return None, "Producto no encontrado"

    if delta > 0 and db_producto.stock < delta:
        return None, f"Stock insuficiente. Disponible: {db_producto.stock}"

    db_producto.stock -= delta
    db.add(db_producto)

    valor_unitario = float(db_producto.valor)
    valor_delta = valor_unitario * delta
    nuevo_valor_total = float(consumo["valor_total"]) + valor_delta

    usuario = get_usuario_by_id(db, consumo["usuario_id"])
    if usuario:
        from app.services.settings_storage import load_settings
        settings = load_settings()
        credit_multiplier = settings.get("lazy_queue_credit_multiplier", 1.0)
        creditos_delta = int(valor_delta * credit_multiplier)
        if creditos_delta != 0:
            new_credits = max(0, (usuario.song_credits or 0) + creditos_delta)
            cache.update_usuario_en_cache(usuario.id, {"song_credits": new_credits})

    db.commit()

    updates = {
        "cantidad": nueva_cantidad,
        "valor_total": nuevo_valor_total
    }
    cache.update_consumo_in_cache(consumo_id, updates)

    consumo.update(updates)
    return consumo, None


def set_consumo_cantidad(db: Session, consumo_id: int, nueva_cantidad: int):
    """Establece directamente la cantidad de un consumo calculando el delta."""
    consumo = cache.get_consumo_by_id(consumo_id)
    if not consumo:
        return None, "Consumo no encontrado"

    if nueva_cantidad < 1:
        return None, "La cantidad mínima es 1. Para eliminar use el botón eliminar."

    delta = nueva_cantidad - int(consumo.get("cantidad", 1))
    if delta == 0:
        return consumo, None

    return update_consumo_cantidad(db, consumo_id, delta)
