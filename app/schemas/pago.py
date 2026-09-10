"""Schemas for Payments (Pagos)."""

from pydantic import BaseModel, ConfigDict
from typing import Optional
from decimal import Decimal
from datetime import datetime


class PagoBase(BaseModel):
    monto: Decimal
    metodo_pago: Optional[str] = "Efectivo"


class PagoCreate(PagoBase):
    mesa_id: int


class PagoView(PagoBase):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ReporteIngresos(BaseModel):
    ingresos_totales: Decimal
    model_config = ConfigDict(from_attributes=True)


class ReporteIngresosPorMesa(BaseModel):
    mesa_nombre: str
    ingresos_totales: Decimal
    horario: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class ReporteIngresosPromedio(BaseModel):
    ingresos_promedio_por_usuario: Decimal


class ReporteIngresosPromedioPorMesa(BaseModel):
    mesa_nombre: str
    ingresos_promedio_por_usuario: Decimal


class ResumenNoche(BaseModel):
    ingresos_totales: Decimal
    ganancias_totales: Decimal
    canciones_cantadas: int
    usuarios_activos: int


class CuentaInfo(BaseModel):
    id: int
    mesa_id: int
    is_active: bool
    created_at: datetime
    closed_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class MesaVentaTurno(BaseModel):
    mesa_id: int
    mesa_nombre: str
    total_consumido: float
    total_pagado: float
    saldo: float
    horario: str
    num_consumos: int
    model_config = ConfigDict(from_attributes=True)


class MetodoPagoTurno(BaseModel):
    metodo: str
    total: float
    transacciones: int
    model_config = ConfigDict(from_attributes=True)


class ProductoVendidoTurno(BaseModel):
    producto_id: int
    nombre: str
    cantidad: int
    total_recaudado: float
    model_config = ConfigDict(from_attributes=True)


class ReporteVentasTurno(BaseModel):
    local_id: int
    local_nombre: str
    fecha: str
    hora_inicio_turno: str
    hora_fin_turno: str
    total_ventas: float
    total_pagado: float
    total_consumo_interno: Optional[float] = 0.0
    saldo_pendiente: float
    total_pedidos: int
    total_canciones: int
    metodos_pago: list[MetodoPagoTurno]
    mesas: list[MesaVentaTurno]
    top_productos: list[ProductoVendidoTurno]
    model_config = ConfigDict(from_attributes=True)

