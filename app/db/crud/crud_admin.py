"""CRUD operations for Admin reporting and night-reset operations."""

import datetime
from collections import Counter
from sqlalchemy.orm import Session

from app.db.models import Producto, Pago
from app.utils.cache_manager import cache_manager as cache


from typing import Optional, List, Dict, Any
from app.db.models.local import Local
from app.utils.timezone_utils import now_bogota

# ---------------------------------------------------------------------------
# Helper — resolve users and entities by local from cache
# ---------------------------------------------------------------------------

def _get_local_mesa_ids(local_id: Optional[int] = None) -> Optional[set]:
    """Returns set of mesa IDs belonging to local_id, or None if no local_id filter."""
    if local_id is None:
        return None
    mesas = cache.get_all_mesas()
    return {m["id"] for m in mesas if m.get("local_id") == local_id or (local_id == 1 and not m.get("local_id"))}


def _get_local_user_ids(local_id: Optional[int] = None) -> Optional[set]:
    """Returns set of user IDs belonging to local_id, or None if no filter."""
    if local_id is None:
        return None
    mesa_ids = _get_local_mesa_ids(local_id)
    users = cache.get_all_usuarios_from_cache()
    return {
        u.get("id") for u in users
        if u.get("local_id") == local_id or (mesa_ids is not None and u.get("mesa_id") in mesa_ids)
    }


def _all_usuarios(local_id: Optional[int] = None):
    users = cache.get_all_usuarios_from_cache()
    if local_id is None:
        return users
    user_ids = _get_local_user_ids(local_id)
    return [u for u in users if u.get("id") in user_ids]


def _usuario_map(local_id: Optional[int] = None):
    """Returns {usuario_id: nick} mapping from cache."""
    return {u.get("id"): u.get("nick", f"Usuario #{u.get('id')}") for u in _all_usuarios(local_id=local_id)}


def _user_to_mesa_map(local_id: Optional[int] = None):
    """Returns {usuario_id: mesa_id} mapping from cache."""
    return {u.get("id"): u.get("mesa_id") for u in _all_usuarios(local_id=local_id) if u.get("mesa_id")}


def _filter_consumos(local_id: Optional[int] = None, start_dt: Optional[datetime.datetime] = None, end_dt: Optional[datetime.datetime] = None):
    """Filters consumos from cache by local_id and datetime range."""
    consumos = cache.get_all_consumos()
    mesa_ids = _get_local_mesa_ids(local_id)
    user_ids = _get_local_user_ids(local_id)

    filtered = []
    for c in consumos:
        if local_id is not None:
            c_local = c.get("local_id")
            c_mesa = c.get("mesa_id")
            c_user = c.get("usuario_id")
            if c_local is not None:
                if c_local != local_id:
                    continue
            elif c_mesa is not None and mesa_ids is not None:
                if c_mesa not in mesa_ids:
                    continue
            elif c_user is not None and user_ids is not None:
                if c_user not in user_ids:
                    continue
            elif local_id != 1:
                continue

        if start_dt is not None or end_dt is not None:
            created_str = c.get("created_at")
            if not created_str:
                continue
            try:
                dt = datetime.datetime.fromisoformat(created_str.replace("Z", "+00:00"))
                if start_dt and start_dt.tzinfo and dt.tzinfo is None:
                    dt = dt.replace(tzinfo=start_dt.tzinfo)
                elif start_dt and start_dt.tzinfo is None and dt.tzinfo is not None:
                    dt = dt.replace(tzinfo=None)

                if start_dt and dt < start_dt:
                    continue
                if end_dt and dt > end_dt:
                    continue
            except Exception:
                continue

        filtered.append(c)
    return filtered


def _filter_pagos(db: Session, local_id: Optional[int] = None, start_dt: Optional[datetime.datetime] = None, end_dt: Optional[datetime.datetime] = None):
    """Filters pagos from DB by local_id and datetime range."""
    query = db.query(Pago)
    mesa_ids = _get_local_mesa_ids(local_id)
    if mesa_ids is not None:
        query = query.filter(Pago.mesa_id.in_(mesa_ids))
    if start_dt is not None:
        query = query.filter(Pago.created_at >= start_dt)
    if end_dt is not None:
        query = query.filter(Pago.created_at <= end_dt)
    return query.all()


def _get_table_horario(consumos_mesa: list, pagos_mesa: list = None, fallback_created_at: str = None) -> str:
    """Calculates table activity interval 'HH:MM - HH:MM' from first to last event."""
    timestamps = []
    for c in consumos_mesa:
        ts_str = c.get("created_at")
        if ts_str:
            try:
                timestamps.append(datetime.datetime.fromisoformat(ts_str.replace("Z", "+00:00")))
            except Exception:
                pass
    if pagos_mesa:
        for p in pagos_mesa:
            if hasattr(p, "created_at") and p.created_at:
                timestamps.append(p.created_at if isinstance(p.created_at, datetime.datetime) else datetime.datetime.fromisoformat(str(p.created_at)))
            elif isinstance(p, dict) and p.get("created_at"):
                try:
                    timestamps.append(datetime.datetime.fromisoformat(p["created_at"].replace("Z", "+00:00")))
                except Exception:
                    pass

    if not timestamps and fallback_created_at:
        try:
            timestamps.append(datetime.datetime.fromisoformat(fallback_created_at.replace("Z", "+00:00")))
        except Exception:
            pass

    if not timestamps:
        return "Sin actividad"

    min_dt = min(timestamps)
    max_dt = max(timestamps)
    min_str = min_dt.strftime("%H:%M")
    max_str = max_dt.strftime("%H:%M")
    if min_str == max_str:
        return min_str
    return f"{min_str} - {max_str}"


# ---------------------------------------------------------------------------
# Summary / reset
# ---------------------------------------------------------------------------

def get_resumen_noche(db: Session, local_id: Optional[int] = None):
    """Obtiene un resumen de la noche desde datos en cache y BD."""
    consumos = _filter_consumos(local_id=local_id)
    pagos = _filter_pagos(db, local_id=local_id)
    usuarios_activos = [u for u in _all_usuarios(local_id=local_id) if u.get("is_active") and u.get("mesa_id")]
    all_songs = cache.get_all_songs(local_id=local_id)
    mesas = cache.get_all_mesas()
    if local_id is not None:
        mesas = [m for m in mesas if m.get("local_id") == local_id or (local_id == 1 and not m.get("local_id"))]

    total_consumido = sum(float(c.get("valor_total", 0)) for c in consumos)
    total_pagado = sum(float(p.monto) for p in pagos)
    saldo = total_consumido - total_pagado

    return {
        "total_consumido": float(total_consumido),
        "total_pagado": float(total_pagado),
        "saldo": float(saldo),
        "num_consumos": len(consumos),
        "num_pagos": len(pagos),
        "num_usuarios": len(usuarios_activos),
        "num_canciones": len(all_songs),
        "mesas_activas": len(mesas),
        "ingresos_totales": float(total_consumido),
        "canciones_cantadas": len([s for s in all_songs if s.get("estado") == "cantada"]),
        "usuarios_activos": len(usuarios_activos),
    }


def reset_database_for_new_night(db: Session):
    """
    Reinicia el sistema para una nueva noche.
    Limpia todo el caché (canciones, consumos, mesas, usuarios de sesión)
    y elimina los pagos de la BD.
    """
    cache.clear_all()
    db.query(Pago).delete()
    db.commit()
    return True


def get_ganancias_totales(db: Session, local_id: Optional[int] = None):
    """Obtiene las ganancias reales (ventas - costo de productos vendidos)."""
    consumos = _filter_consumos(local_id=local_id)
    productos = db.query(Producto).all()
    costo_map = {p.id: float(p.costo or 0) for p in productos}
    ganancia_real = 0.0
    for c in consumos:
        prod_id = c.get("producto_id")
        cantidad = int(c.get("cantidad", 1))
        venta_total = float(c.get("valor_total", 0))
        costo_unitario = costo_map.get(prod_id, 0.0)
        costo_total = costo_unitario * cantidad
        ganancia_real += (venta_total - costo_total)
    return ganancia_real


def limpiar_datos_prueba(db: Session):
    """Limpia todos los datos (solo para desarrollo/pruebas)."""
    db.query(Pago).delete()
    db.query(Producto).delete()
    db.commit()
    cache.clear_all()


# ---------------------------------------------------------------------------
# Reportes
# ---------------------------------------------------------------------------

def get_ventas_turno(db: Session, local_id: Optional[int] = None, fecha_str: Optional[str] = None):
    """
    Genera el reporte de Ventas Turno desde las 5:00 AM del día seleccionado
    hasta la hora de cierre configurada para la sede (al día siguiente si es de madrugada).
    """
    now = now_bogota()
    active_local_id = local_id or 1

    # Obtener configuración del local
    local_obj = db.query(Local).filter(Local.id == active_local_id).first()
    local_nombre = local_obj.nombre if local_obj else f"Sede #{active_local_id}"
    hora_cierre_str = local_obj.hora_cierre if (local_obj and local_obj.hora_cierre) else "03:00"

    # Parsear hora de cierre
    try:
        parts = hora_cierre_str.strip().split(":")
        cierre_h = int(parts[0])
        cierre_m = int(parts[1]) if len(parts) > 1 else 0
    except Exception:
        cierre_h = 3
        cierre_m = 0

    # Determinar fecha base del turno
    if fecha_str:
        try:
            base_date = datetime.date.fromisoformat(fecha_str)
        except Exception:
            base_date = now.date()
    else:
        # Si la hora actual es antes de las 5:00 AM, pertenecemos al turno de ayer
        if now.hour < 5:
            base_date = (now - datetime.timedelta(days=1)).date()
        else:
            base_date = now.date()

    # Inicio del turno: 05:00:00 del día base
    start_dt = datetime.datetime.combine(base_date, datetime.time(5, 0, 0))
    if now.tzinfo:
        start_dt = start_dt.replace(tzinfo=now.tzinfo)

    # Fin del turno: si cierre_h < 5 (ej: 03:00 AM), es al día siguiente
    if cierre_h < 5:
        end_date = base_date + datetime.timedelta(days=1)
    else:
        end_date = base_date
    end_dt = datetime.datetime.combine(end_date, datetime.time(cierre_h, cierre_m, 59))
    if now.tzinfo:
        end_dt = end_dt.replace(tzinfo=now.tzinfo)

    # Filtrar consumos, pagos y canciones en la ventana del turno
    consumos_turno = _filter_consumos(local_id=active_local_id, start_dt=start_dt, end_dt=end_dt)
    pagos_turno = _filter_pagos(db, local_id=active_local_id, start_dt=start_dt, end_dt=end_dt)

    all_songs = cache.get_all_songs(local_id=active_local_id)
    songs_turno = []
    user_ids = _get_local_user_ids(active_local_id)
    for s in all_songs:
        if s.get("local_id") is not None and s.get("local_id") != active_local_id:
            continue
        if s.get("usuario_id") and user_ids is not None and s.get("usuario_id") not in user_ids:
            continue
        s_date_str = s.get("created_at") or s.get("started_at")
        if s_date_str:
            try:
                s_dt = datetime.datetime.fromisoformat(s_date_str.replace("Z", "+00:00"))
                if start_dt.tzinfo and s_dt.tzinfo is None:
                    s_dt = s_dt.replace(tzinfo=start_dt.tzinfo)
                elif not start_dt.tzinfo and s_dt.tzinfo:
                    s_dt = s_dt.replace(tzinfo=None)
                if start_dt <= s_dt <= end_dt:
                    songs_turno.append(s)
            except Exception:
                pass

    total_ventas = sum(float(c.get("valor_total", 0)) for c in consumos_turno)
    total_pagado = sum(float(p.monto) for p in pagos_turno)
    saldo_pendiente = total_ventas - total_pagado

    # Desglose de métodos de pago
    metodos_counter = Counter()
    metodos_trans = Counter()
    for p in pagos_turno:
        metodo = p.metodo_pago or "Efectivo"
        metodos_counter[metodo] += float(p.monto)
        metodos_trans[metodo] += 1
    metodos_pago_list = [
        {"metodo": m, "total": float(tot), "transacciones": metodos_trans[m]}
        for m, tot in metodos_counter.items()
    ]

    # Desglose de mesas con ventana horaria HH:MM - HH:MM
    mesas_list = cache.get_all_mesas()
    if active_local_id:
        mesas_list = [m for m in mesas_list if m.get("local_id") == active_local_id or (active_local_id == 1 and not m.get("local_id"))]

    mesas_dict = {m["id"]: m for m in mesas_list}
    mesa_consumos = {}
    for c in consumos_turno:
        mid = c.get("mesa_id")
        if mid:
            mesa_consumos.setdefault(mid, []).append(c)

    mesa_pagos = {}
    for p in pagos_turno:
        mid = p.mesa_id
        if mid:
            mesa_pagos.setdefault(mid, []).append(p)

    all_active_mesa_ids = set(mesa_consumos.keys()).union(set(mesa_pagos.keys())).union(set(mesas_dict.keys()))
    mesas_report = []
    for mid in all_active_mesa_ids:
        m_info = mesas_dict.get(mid, {})
        m_nombre = m_info.get("nombre", f"Mesa {mid}")
        m_cons = mesa_consumos.get(mid, [])
        m_pags = mesa_pagos.get(mid, [])

        m_total_cons = sum(float(c.get("valor_total", 0)) for c in m_cons)
        m_total_pag = sum(float(p.monto) for p in m_pags)
        m_saldo = m_total_cons - m_total_pag
        m_horario = _get_table_horario(m_cons, m_pags, fallback_created_at=m_info.get("created_at"))

        if m_total_cons > 0 or m_total_pag > 0 or len(m_cons) > 0:
            mesas_report.append({
                "mesa_id": mid,
                "mesa_nombre": m_nombre,
                "total_consumido": float(m_total_cons),
                "total_pagado": float(m_total_pag),
                "saldo": float(m_saldo),
                "horario": m_horario,
                "num_consumos": len(m_cons)
            })

    mesas_report.sort(key=lambda x: x["total_consumido"], reverse=True)

    # Top productos vendidos en el turno
    prod_counts = Counter()
    prod_revenue = Counter()
    for c in consumos_turno:
        pid = c.get("producto_id")
        if pid:
            cant = int(c.get("cantidad", 1))
            val = float(c.get("valor_total", 0))
            prod_counts[pid] += cant
            prod_revenue[pid] += val

    if prod_counts:
        db_prods = db.query(Producto).filter(Producto.id.in_(list(prod_counts.keys()))).all()
        prod_names = {p.id: p.nombre for p in db_prods}
    else:
        prod_names = {}

    top_productos_list = [
        {
            "producto_id": pid,
            "nombre": prod_names.get(pid, f"Producto #{pid}"),
            "cantidad": count,
            "total_recaudado": float(prod_revenue.get(pid, 0))
        }
        for pid, count in prod_counts.most_common(15)
    ]

    return {
        "local_id": active_local_id,
        "local_nombre": local_nombre,
        "fecha": str(base_date),
        "hora_inicio_turno": start_dt.strftime("%Y-%m-%d %H:%M"),
        "hora_fin_turno": end_dt.strftime("%Y-%m-%d %H:%M"),
        "total_ventas": float(total_ventas),
        "total_pagado": float(total_pagado),
        "saldo_pendiente": float(saldo_pendiente),
        "total_pedidos": len(consumos_turno),
        "total_canciones": len(songs_turno),
        "metodos_pago": metodos_pago_list,
        "mesas": mesas_report,
        "top_productos": top_productos_list
    }


def get_canciones_mas_cantadas(db: Session, limit: int = 10, local_id: Optional[int] = None):
    all_songs = cache.get_all_songs(local_id=local_id)
    cantadas = [s for s in all_songs if s.get("estado") == "cantada"]
    counts = Counter((s.get("titulo"), s.get("youtube_id")) for s in cantadas)
    items = sorted(counts.items(), key=lambda x: x[1], reverse=True)[:limit]
    return [(titulo, y_id, count) for (titulo, y_id), count in items]


def get_productos_mas_consumidos(db: Session, limit: int = 10, local_id: Optional[int] = None):
    consumos = _filter_consumos(local_id=local_id)
    product_counts = Counter()
    for c in consumos:
        product_counts[c.get("producto_id")] += c.get("cantidad", 0)
    product_ids = [p_id for p_id, _ in product_counts.most_common(limit)]
    productos = db.query(Producto).filter(Producto.id.in_(product_ids)).all() if product_ids else []
    prod_map = {p.id: p.nombre for p in productos}
    return [(prod_map.get(p_id, f"Producto #{p_id}"), count) for p_id, count in product_counts.most_common(limit)]


def get_usuarios_sin_consumo(db: Session, local_id: Optional[int] = None):
    """Usuarios que no han realizado consumos (desde CACHE)."""
    consumos = _filter_consumos(local_id=local_id)
    usuarios_con_consumo = {c.get("usuario_id") for c in consumos}
    from app.db.crud.crud_usuarios import _to_obj
    return [_to_obj(u) for u in _all_usuarios(local_id=local_id) if u.get("id") not in usuarios_con_consumo]


def get_canciones_cantadas_por_usuario(db: Session, local_id: Optional[int] = None):
    all_songs = cache.get_all_songs(local_id=local_id)
    cantadas = [s for s in all_songs if s.get("estado") == "cantada"]
    user_counts = Counter(s.get("usuario_id") for s in cantadas)
    user_map = _usuario_map(local_id=local_id)
    results = [(user_map.get(u_id, f"Usuario #{u_id}"), count) for u_id, count in user_counts.items()]
    return sorted(results, key=lambda x: x[1], reverse=True)


def get_ingresos_promedio_por_usuario(db: Session, local_id: Optional[int] = None):
    consumos = _filter_consumos(local_id=local_id)
    if not consumos:
        return 0
    total_ingresos = sum(float(c.get("valor_total", 0)) for c in consumos)
    num_usuarios = len({c.get("usuario_id") for c in consumos if c.get("usuario_id")})
    return total_ingresos / num_usuarios if num_usuarios > 0 else 0


def get_usuarios_una_cancion(db: Session, local_id: Optional[int] = None):
    all_songs = cache.get_all_songs(local_id=local_id)
    cantadas = [s for s in all_songs if s.get("estado") == "cantada"]
    user_counts = Counter(s.get("usuario_id") for s in cantadas)
    one_hit_ids = {u_id for u_id, count in user_counts.items() if count == 1}
    from app.db.crud.crud_usuarios import _to_obj
    return [_to_obj(u) for u in _all_usuarios(local_id=local_id) if u.get("id") in one_hit_ids]


def get_mesas_vacias(db: Session, local_id: Optional[int] = None):
    """Mesas sin usuarios conectados (desde CACHE)."""
    mesas = cache.get_all_mesas()
    if local_id is not None:
        mesas = [m for m in mesas if m.get("local_id") == local_id or (local_id == 1 and not m.get("local_id"))]
    mesas_con_usuarios = {u.get("mesa_id") for u in _all_usuarios(local_id=local_id) if u.get("mesa_id")}
    return [m for m in mesas if m.get("id") not in mesas_con_usuarios]


def get_ingresos_promedio_por_usuario_por_mesa(db: Session, local_id: Optional[int] = None):
    mesas = cache.get_all_mesas()
    if local_id is not None:
        mesas = [m for m in mesas if m.get("local_id") == local_id or (local_id == 1 and not m.get("local_id"))]
    consumos = _filter_consumos(local_id=local_id)
    user_to_mesa = _user_to_mesa_map(local_id=local_id)

    mesa_income = Counter()
    mesa_users: dict = {m.get("id"): set() for m in mesas}

    for c in consumos:
        u_id = c.get("usuario_id")
        m_id = user_to_mesa.get(u_id) or c.get("mesa_id")
        if m_id:
            mesa_income[m_id] += float(c.get("valor_total", 0))
            if m_id in mesa_users and u_id:
                mesa_users[m_id].add(u_id)

    report = []
    for m in mesas:
        m_id = m.get("id")
        m_name = m.get("nombre", f"Mesa {m_id}")
        num_users = len([u for u in _all_usuarios(local_id=local_id) if u.get("mesa_id") == m_id])
        total = mesa_income[m_id]
        promedio = total / num_users if num_users > 0 else 0
        report.append((m_name, promedio))
    return sorted(report, key=lambda x: x[1], reverse=True)


def get_tiempo_promedio_espera(db: Session, local_id: Optional[int] = None):
    all_songs = cache.get_all_songs(local_id=local_id)
    cantadas = [s for s in all_songs if s.get("estado") == "cantada" and s.get("finished_at") and s.get("created_at")]
    if not cantadas:
        return 0
    total_seconds = 0
    for s in cantadas:
        try:
            start = datetime.datetime.fromisoformat(s.get("created_at"))
            end = datetime.datetime.fromisoformat(s.get("finished_at"))
            total_seconds += (end - start).total_seconds()
        except Exception:
            continue
    return total_seconds / len(cantadas)


def get_actividad_por_hora(db: Session, local_id: Optional[int] = None):
    all_songs = cache.get_all_songs(local_id=local_id)
    cantadas = [s for s in all_songs if s.get("estado") == "cantada" and s.get("started_at")]
    hora_counts = Counter()
    for s in cantadas:
        try:
            dt = datetime.datetime.fromisoformat(s.get("started_at"))
            hora_counts[dt.hour] += 1
        except Exception:
            continue
    return sorted(hora_counts.items(), key=lambda x: x[1], reverse=True)


def get_canciones_cantadas_por_mesa(db: Session, local_id: Optional[int] = None):
    all_songs = cache.get_all_songs(local_id=local_id)
    cantadas = [s for s in all_songs if s.get("estado") == "cantada"]
    user_to_mesa = _user_to_mesa_map(local_id=local_id)
    mesa_counts = Counter()
    for s in cantadas:
        m_id = user_to_mesa.get(s.get("usuario_id"))
        if m_id:
            mesa_counts[m_id] += 1
    mesas_list = cache.get_all_mesas()
    if local_id is not None:
        mesas_list = [m for m in mesas_list if m.get("local_id") == local_id or (local_id == 1 and not m.get("local_id"))]
    mesas = {m.get("id"): m.get("nombre") for m in mesas_list}
    results = [(mesas.get(m_id, f"Mesa #{m_id}"), count) for m_id, count in mesa_counts.items() if m_id in mesas]
    return sorted(results, key=lambda x: x[1], reverse=True)


def get_canciones_mas_rechazadas(db: Session, limit: int = 10, local_id: Optional[int] = None):
    all_songs = cache.get_all_songs(local_id=local_id)
    rechazadas = [s for s in all_songs if s.get("estado") == "rechazada"]
    counts = Counter((s.get("titulo"), s.get("youtube_id")) for s in rechazadas)
    items = sorted(counts.items(), key=lambda x: x[1], reverse=True)[:limit]
    return [(titulo, y_id, count) for (titulo, y_id), count in items]


def get_usuarios_mas_rechazados(db: Session, limit: int = 10, local_id: Optional[int] = None):
    all_songs = cache.get_all_songs(local_id=local_id)
    rechazadas = [s for s in all_songs if s.get("estado") == "rechazada"]
    user_counts = Counter(s.get("usuario_id") for s in rechazadas)
    user_map = _usuario_map(local_id=local_id)
    return [(user_map.get(u_id, f"Usuario #{u_id}"), count) for u_id, count in user_counts.most_common(limit)]


def get_ingresos_por_categoria(db: Session, local_id: Optional[int] = None):
    consumos = _filter_consumos(local_id=local_id)
    if not consumos:
        return []
    product_ids = {c.get("producto_id") for c in consumos if c.get("producto_id")}
    productos = db.query(Producto).filter(Producto.id.in_(product_ids)).all() if product_ids else []
    prod_cat_map = {p.id: p.categoria for p in productos}
    cat_income = Counter()
    for c in consumos:
        cat = prod_cat_map.get(c.get("producto_id"), "Sin Categoría")
        cat_income[cat] += float(c.get("valor_total", 0))
    return sorted(cat_income.items(), key=lambda x: x[1], reverse=True)


def get_total_ingresos(db: Session, local_id: Optional[int] = None):
    consumos = _filter_consumos(local_id=local_id)
    return sum(float(c.get("valor_total", 0)) for c in consumos)


def get_ingresos_por_mesa(db: Session, local_id: Optional[int] = None):
    """Obtiene ingresos por mesa con ventana horaria HH:MM - HH:MM."""
    consumos = _filter_consumos(local_id=local_id)
    mesas_list = cache.get_all_mesas()
    if local_id is not None:
        mesas_list = [m for m in mesas_list if m.get("local_id") == local_id or (local_id == 1 and not m.get("local_id"))]
    mesas = {m["id"]: m for m in mesas_list}

    mesa_consumos = {}
    for c in consumos:
        mesa_id = c.get("mesa_id")
        if not mesa_id:
            continue
        mesa_consumos.setdefault(mesa_id, []).append(c)

    pagos = _filter_pagos(db, local_id=local_id)
    mesa_pagos = {}
    for p in pagos:
        if p.mesa_id:
            mesa_pagos.setdefault(p.mesa_id, []).append(p)

    result = []
    for mid, m_info in mesas.items():
        m_cons = mesa_consumos.get(mid, [])
        m_pags = mesa_pagos.get(mid, [])
        total = sum(float(c.get("valor_total", 0)) for c in m_cons)
        if total > 0 or len(m_cons) > 0 or len(m_pags) > 0:
            horario = _get_table_horario(m_cons, m_pags, fallback_created_at=m_info.get("created_at"))
            result.append((m_info.get("nombre", f"Mesa {mid}"), total, horario))

    result.sort(key=lambda x: x[1], reverse=True)
    return result


def get_productos_menos_consumidos(db: Session, limit: int = 5, local_id: Optional[int] = None):
    consumos = _filter_consumos(local_id=local_id)
    productos = db.query(Producto).all()
    cantidades = {p.id: 0 for p in productos}
    for c in consumos:
        pid = c.get("producto_id")
        if pid in cantidades:
            cantidades[pid] += c.get("cantidad", 1)
    prod_map = {p.id: p.nombre for p in productos}
    result = [(prod_map[pid], cant) for pid, cant in cantidades.items()]
    result.sort(key=lambda x: x[1])
    return result[:limit]


def get_top_consumers_one_song(db: Session, limit: int = 10, local_id: Optional[int] = None):
    canciones = cache.get_all_songs(local_id=local_id)
    consumos = _filter_consumos(local_id=local_id)
    user_map = _usuario_map(local_id=local_id)

    canciones_por_user: dict = {}
    for c in canciones:
        uid = c.get("usuario_id")
        if uid:
            canciones_por_user[uid] = canciones_por_user.get(uid, 0) + 1

    users_one_song = {uid for uid, count in canciones_por_user.items() if count == 1}
    gastos: dict = {}
    for c in consumos:
        uid = c.get("usuario_id")
        if uid in users_one_song:
            gastos[uid] = gastos.get(uid, 0) + float(c.get("valor_total", 0))

    result = [(user_map.get(uid, f"User {uid}"), total) for uid, total in gastos.items()]
    result.sort(key=lambda x: x[1], reverse=True)
    return result[:limit]


def get_categorias_mas_consumidas_por_mesa(db: Session, mesa_id: int, limit: int = 5):
    consumos = [c for c in cache.get_all_consumos() if c.get("mesa_id") == mesa_id]
    productos = db.query(Producto).all()
    prod_cat_map = {p.id: p.categoria for p in productos}
    cat_counts: dict = {}
    for c in consumos:
        pid = c.get("producto_id")
        cat = prod_cat_map.get(pid, "Desconocida")
        cat_counts[cat] = cat_counts.get(cat, 0) + c.get("cantidad", 1)
    result = list(cat_counts.items())
    result.sort(key=lambda x: x[1], reverse=True)
    return result[:limit]


def get_canciones_mas_pedidas_por_mesa(db: Session, mesa_id: int, limit: int = 5):
    usuarios_mesa_ids = {u.get("id") for u in _all_usuarios() if u.get("mesa_id") == mesa_id}
    canciones = [c for c in cache.get_all_songs() if c.get("usuario_id") in usuarios_mesa_ids]
    counts: dict = {}
    for c in canciones:
        key = (c.get("titulo", "Desconocido"), c.get("youtube_id", ""))
        counts[key] = counts.get(key, 0) + 1
    result = [(titulo, yid, count) for (titulo, yid), count in counts.items()]
    result.sort(key=lambda x: x[2], reverse=True)
    return result[:limit]


def get_productos_mas_consumidos_por_mesa(db: Session, mesa_id: int, limit: int = 5):
    consumos = [c for c in cache.get_all_consumos() if c.get("mesa_id") == mesa_id]
    productos = db.query(Producto).all()
    prod_map = {p.id: p.nombre for p in productos}
    counts: dict = {}
    for c in consumos:
        pid = c.get("producto_id")
        counts[pid] = counts.get(pid, 0) + c.get("cantidad", 1)
    result = [(prod_map.get(pid, "Desconocido"), count) for pid, count in counts.items()]
    result.sort(key=lambda x: x[1], reverse=True)
    return result[:limit]


def get_productos_no_consumidos(db: Session, local_id: Optional[int] = None):
    consumos = _filter_consumos(local_id=local_id)
    productos = db.query(Producto).all()
    consumidos_ids = {c.get("producto_id") for c in consumos}
    return [p for p in productos if p.id not in consumidos_ids]


def get_usuarios_inactivos_consumo(db: Session, horas: int = 2, local_id: Optional[int] = None):
    consumos = _filter_consumos(local_id=local_id)
    usuarios = _all_usuarios(local_id=local_id)
    last_consumo: dict = {}

    from datetime import datetime as dt, timedelta
    for c in consumos:
        uid = c.get("usuario_id")
        created = c.get("created_at")
        if uid and created:
            try:
                created = created.replace("Z", "+00:00")
                d = dt.fromisoformat(created)
                if uid not in last_consumo or d > last_consumo[uid]:
                    last_consumo[uid] = d
            except ValueError:
                pass

    from app.utils.timezone_utils import now_bogota
    now = now_bogota()

    for uid in last_consumo:
        if last_consumo[uid].tzinfo is None:
            last_consumo[uid] = last_consumo[uid].replace(tzinfo=now.tzinfo)

    from app.db.crud.crud_usuarios import _to_obj
    inactivos = []
    for u in usuarios:
        uid = u.get("id")
        if uid not in last_consumo:
            inactivos.append(_to_obj(u))
        else:
            diff = now - last_consumo[uid]
            if diff > timedelta(hours=horas):
                inactivos.append(_to_obj(u))
    return inactivos


def get_usuarios_consumen_pero_no_cantan(db: Session, umbral_consumo: float = 100.0, local_id: Optional[int] = None):
    canciones = cache.get_all_songs(local_id=local_id)
    consumos = _filter_consumos(local_id=local_id)
    cantores = {c.get("usuario_id") for c in canciones if c.get("usuario_id")}
    gastos: dict = {}
    for c in consumos:
        uid = c.get("usuario_id")
        if uid:
            gastos[uid] = gastos.get(uid, 0) + float(c.get("valor_total", 0))
    from app.db.crud.crud_usuarios import _to_obj
    return [
        _to_obj(u) for u in _all_usuarios(local_id=local_id)
        if u.get("id") not in cantores and gastos.get(u.get("id"), 0) > umbral_consumo
    ]



# ---------------------------------------------------------------------------
# Mesa summary / session management
# ---------------------------------------------------------------------------

def get_resumen_mesa(db: Session, mesa_id: int):
    """Resumen detallado de una mesa: usuarios, consumo y canciones."""
    from app.db.crud.crud_mesas import get_mesa_by_id
    from app.db.crud.crud_consumos import get_consumos_mesa
    from decimal import Decimal
    from app.db.crud.crud_usuarios import _to_obj

    mesa = get_mesa_by_id(db, mesa_id)
    if not mesa:
        return None

    usuarios_cache = [_to_obj(u) for u in _all_usuarios() if u.get("mesa_id") == mesa_id and u.get("is_active")]
    consumos = get_consumos_mesa(db, mesa_id)
    consumo_total = sum(Decimal(str(c.get("valor_total", 0))) for c in consumos)

    all_songs = cache.get_all_songs()
    user_ids = {u.id for u in usuarios_cache}
    canciones_pendientes = [s for s in all_songs if s.get("usuario_id") in user_ids and s.get("estado") in ("pendiente", "aprobado")]
    canciones_reproduciendo = next((s for s in all_songs if s.get("estado") == "reproduciendo" and s.get("usuario_id") in user_ids), None)

    return {
        "mesa_nombre": mesa.get("nombre", f"Mesa {mesa_id}"),
        "usuarios": usuarios_cache,
        "consumo_total_mesa": consumo_total,
        "canciones_pendientes_mesa": canciones_pendientes,
        "canciones_reproduciendo_mesa": canciones_reproduciendo,
    }


def close_table_session(db: Session, mesa_id: int):
    """
    Cierra la sesión de una mesa:
    - Verifica saldo a paz y salvo
    - Limpia canciones pendientes de la mesa
    - Desactiva usuarios de la mesa en caché
    - Desactiva la mesa en caché
    """
    from app.db.crud.crud_consumos import get_table_payment_status

    status = get_table_payment_status(db, mesa_id)
    if status and float(status.get("saldo_pendiente", 0)) > 0:
        return {"success": False, "message": f"Saldo pendiente de ${float(status.get('saldo_pendiente', 0)):,.0f}. Debe pagarse antes de cerrar."}

    # Clear canciones pendientes of users in this mesa
    user_ids = {u.get("id") for u in _all_usuarios() if u.get("mesa_id") == mesa_id}
    for song in cache.get_all_songs():
        if song.get("usuario_id") in user_ids and song.get("estado") in ("pendiente", "aprobado", "pendiente_lazy"):
            cache.update_song_in_cache(song["id"], {"estado": "rechazada"})

    # Clear users from this mesa in cache
    cache.clear_usuarios_de_mesa(mesa_id)

    # Deactivate mesa in cache
    mesa = cache.get_mesa_by_id(mesa_id)
    if mesa:
        cache.update_mesa_in_cache(mesa_id, {"is_active": False})

    return {"success": True, "message": f"Sesión de mesa {mesa_id} cerrada correctamente."}


def create_new_active_cuenta(db: Session, mesa_id: int):
    """Limpia consumos y abre una nueva cuenta para la mesa (stub usando caché)."""
    # Clear only the mesa_cuenta cache so the balance resets for the new session
    cache.clear_mesa_cache(mesa_id)
    from types import SimpleNamespace
    return SimpleNamespace(id=mesa_id)


def get_previous_cuentas(db: Session, mesa_id: int):
    """Lista de cuentas previas cerradas (simplificado — siempre vacío en caché puro)."""
    return []


def get_cuenta_payment_status(db: Session, cuenta_id: int):
    """Estado de pago de una cuenta por su ID (simplificado: cuenta_id == mesa_id)."""
    from app.db.crud.crud_consumos import get_table_payment_status
    return get_table_payment_status(db, cuenta_id)


def get_estado_mesas(db: Session):
    """Estado de todas las mesas: (mesa_dict, num_usuarios, consumo_total)."""
    from decimal import Decimal
    mesas = cache.get_all_mesas()
    consumos = cache.get_all_consumos()
    usuarios = _all_usuarios()

    result = []
    for m in mesas:
        m_id = m.get("id")
        num_usuarios = len([u for u in usuarios if u.get("mesa_id") == m_id and u.get("is_active")])
        consumo_total = sum(Decimal(str(c.get("valor_total", 0))) for c in consumos if c.get("mesa_id") == m_id)
        result.append((m, num_usuarios, consumo_total))
    return result


async def start_next_song_if_autoplay_and_idle(db: Session):
    """Inicia la siguiente canción si el autoplay está activo y no hay nada reproduciendo."""
    try:
        from app.services.settings_storage import load_settings
        settings = load_settings()
        if not settings.get("autoplay_enabled", False):
            return
        all_songs = cache.get_all_songs()
        reproduciendo = [s for s in all_songs if s.get("estado") == "reproduciendo"]
        if reproduciendo:
            return
        aprobadas = sorted(
            [s for s in all_songs if s.get("estado") == "aprobado"],
            key=lambda x: (x.get("orden_manual", 999999) or 999999, x.get("approved_at", ""))
        )
        if aprobadas:
            next_song = aprobadas[0]
            cache.update_song_in_cache(next_song["id"], {
                "estado": "reproduciendo",
                "started_at": datetime.datetime.now().isoformat(),
            })
    except Exception:
        pass


