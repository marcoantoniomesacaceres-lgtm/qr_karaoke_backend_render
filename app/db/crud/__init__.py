"""
app/db/crud — CRUD operations.

Re-exports all CRUD functions so existing code using
`from app.db.crud import get_mesa_by_qr, create_usuario, ...` continues to work.
Also importable as a module: `from app.db import crud; crud.get_usuario_by_id(db, id)`
"""

from app.db.crud.crud_usuarios import (
    get_usuario_by_id,
    get_usuario_by_nick,
    create_usuario,
    create_usuario_en_mesa,
    get_o_crear_usuario_admin_para_mesa,
    get_all_usuarios,
    update_usuario,
    add_puntos_a_usuario,
    delete_usuario,
    get_or_create_dj_user,
    get_ranking_usuarios,
    ban_usuario,
    unban_nick,
    get_banned_nicks,
    set_usuario_silenciado,
    get_usuarios_por_nivel,
    get_usuarios_sin_canciones_cantadas,
    get_ranking_puntos_usuarios,
    get_consumo_por_mesa,
    get_consumos_por_usuario,
)

from app.db.crud.crud_productos import (
    get_producto_by_id,
    get_producto_by_nombre_and_local,
    get_all_productos,
    get_productos,
    create_producto,
    update_producto,
    delete_producto,
    update_producto_valor,
    update_producto_active_status,
    registrar_compra,
    get_compras_by_local,
)

from app.db.crud.crud_pagos import (
    create_pago,
    get_pagos,
    get_pagos_mesa,
    create_admin_api_key,
    get_admin_api_key,
    get_all_admin_api_keys,
    deactivate_admin_api_key,
    delete_admin_api_key,
)

from app.db.crud.crud_mesas import (
    get_mesa_by_qr,
    get_mesas,
    create_mesa,
    get_mesa_by_id,
    set_mesa_active_status,
    delete_mesa,
)

from app.db.crud.crud_canciones import (
    get_canciones_por_usuario,
    get_cancion_by_id,
    get_cancion_reproduciendo,
    get_all_canciones,
    get_canciones_pendientes,
    get_cola_lazy,
    get_available_song_credits,
    get_user_credits_detail,
    check_if_song_in_user_list,
    create_cancion_para_usuario,
    consume_song_credit,
    update_cancion_estado,
    get_duracion_total_cola_aprobada,
    check_and_approve_next_lazy_song,
    aprobar_siguiente_cancion_lazy,
    move_lazy_song_up,
    move_lazy_song_down,
    enriquecer_cancion,
    get_cola_completa,
    get_cola_completa_con_lazy,
    avanzar_cola_automaticamente,
)

from app.db.crud.crud_consumos import (
    get_total_consumido_por_usuario,
    get_consumos_mesa,
    create_consumo_para_usuario,
    create_pedido_from_carrito,
    get_table_payment_status,
    get_all_tables_payment_status,
    get_recent_consumos,
    delete_consumo,
    update_consumo_cantidad,
    set_consumo_cantidad,
)

from app.db.crud.crud_admin import (
    get_resumen_noche,
    reset_database_for_new_night,
    get_ganancias_totales,
    limpiar_datos_prueba,
    get_ventas_turno,
    get_canciones_mas_cantadas,
    get_productos_mas_consumidos,
    get_usuarios_sin_consumo,
    get_canciones_cantadas_por_usuario,
    get_ingresos_promedio_por_usuario,
    get_usuarios_una_cancion,
    get_mesas_vacias,
    get_ingresos_promedio_por_usuario_por_mesa,
    get_tiempo_promedio_espera,
    get_actividad_por_hora,
    get_canciones_cantadas_por_mesa,
    get_canciones_mas_rechazadas,
    get_usuarios_mas_rechazados,
    get_ingresos_por_categoria,
    get_total_ingresos,
    get_ingresos_por_mesa,
    get_productos_menos_consumidos,
    get_top_consumers_one_song,
    get_categorias_mas_consumidas_por_mesa,
    get_canciones_mas_pedidas_por_mesa,
    get_productos_mas_consumidos_por_mesa,
    get_productos_no_consumidos,
    get_usuarios_inactivos_consumo,
    get_usuarios_consumen_pero_no_cantan,
    get_resumen_mesa,
    close_table_session,
    create_new_active_cuenta,
    get_previous_cuentas,
    get_cuenta_payment_status,
    start_next_song_if_autoplay_and_idle,
    get_estado_mesas,
)


__all__ = [
    # Usuarios
    "get_usuario_by_id", "get_usuario_by_nick", "create_usuario",
    "create_usuario_en_mesa", "get_o_crear_usuario_admin_para_mesa",
    "get_all_usuarios", "update_usuario", "add_puntos_a_usuario", "delete_usuario",
    "get_or_create_dj_user", "get_ranking_usuarios",
    "ban_usuario", "unban_nick", "get_banned_nicks", "set_usuario_silenciado",
    "get_usuarios_por_nivel", "get_usuarios_sin_canciones_cantadas",
    "get_ranking_puntos_usuarios", "get_consumo_por_mesa", "get_consumos_por_usuario",
    # Productos
    "get_producto_by_id", "get_producto_by_nombre_and_local", "get_all_productos",
    "get_productos", "create_producto", "update_producto", "delete_producto",
    "update_producto_valor", "update_producto_active_status", "registrar_compra",
    "get_compras_by_local",
    # Pagos y API Keys
    "create_pago", "get_pagos", "get_pagos_mesa",
    "create_admin_api_key", "get_admin_api_key", "get_all_admin_api_keys",
    "deactivate_admin_api_key", "delete_admin_api_key",
    # Mesas
    "get_mesa_by_qr", "get_mesas", "create_mesa", "get_mesa_by_id",
    "set_mesa_active_status", "delete_mesa",
    # Canciones
    "get_canciones_por_usuario", "get_cancion_by_id", "get_cancion_reproduciendo",
    "get_all_canciones", "get_canciones_pendientes", "get_cola_lazy",
    "get_available_song_credits", "get_user_credits_detail",
    "check_if_song_in_user_list", "create_cancion_para_usuario",
    "consume_song_credit", "update_cancion_estado", "get_duracion_total_cola_aprobada",
    "check_and_approve_next_lazy_song", "aprobar_siguiente_cancion_lazy",
    "move_lazy_song_up", "move_lazy_song_down", "enriquecer_cancion",
    "get_cola_completa", "get_cola_completa_con_lazy", "avanzar_cola_automaticamente",
    # Consumos
    "get_total_consumido_por_usuario", "get_consumos_mesa",
    "create_consumo_para_usuario", "create_pedido_from_carrito",
    "get_table_payment_status", "get_all_tables_payment_status",
    "get_recent_consumos", "delete_consumo", "update_consumo_cantidad", "set_consumo_cantidad",
    # Admin / Reportes
    "get_resumen_noche", "reset_database_for_new_night", "get_ganancias_totales",
    "limpiar_datos_prueba", "get_ventas_turno", "get_canciones_mas_cantadas",
    "get_productos_mas_consumidos", "get_usuarios_sin_consumo",

    "get_canciones_cantadas_por_usuario", "get_ingresos_promedio_por_usuario",
    "get_usuarios_una_cancion", "get_mesas_vacias",
    "get_ingresos_promedio_por_usuario_por_mesa", "get_tiempo_promedio_espera",
    "get_actividad_por_hora", "get_canciones_cantadas_por_mesa",
    "get_canciones_mas_rechazadas", "get_usuarios_mas_rechazados",
    "get_ingresos_por_categoria", "get_total_ingresos", "get_ingresos_por_mesa",
    "get_productos_menos_consumidos", "get_top_consumers_one_song",
    "get_categorias_mas_consumidas_por_mesa", "get_canciones_mas_pedidas_por_mesa",
    "get_productos_mas_consumidos_por_mesa", "get_productos_no_consumidos",
    "get_usuarios_inactivos_consumo", "get_usuarios_consumen_pero_no_cantan",
    "get_resumen_mesa", "close_table_session", "create_new_active_cuenta",
    "get_previous_cuentas", "get_cuenta_payment_status",
    "start_next_song_if_autoplay_and_idle", "get_estado_mesas",
]
