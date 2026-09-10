"""Schemas for Tables (Mesas)."""

from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from decimal import Decimal


class MesaBase(BaseModel):
    nombre: str
    qr_code: str
    local_id: Optional[int] = None
    session_id: Optional[str] = None


class MesaCreate(MesaBase):
    pass


class Mesa(MesaBase):
    id: int
    session_id: Optional[str] = None
    is_active: bool
    usuarios: List['Usuario'] = []
    model_config = ConfigDict(from_attributes=True)


class MesaSimple(MesaBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


class MesaInfo(BaseModel):
    id: int
    nombre: str
    model_config = ConfigDict(from_attributes=True)


class MesaEstado(MesaBase):
    id: int
    estado: str
    numero_usuarios: int
    consumo_total: Decimal


class MesaEstadoPago(BaseModel):
    mesa_id: int
    cuenta_id: Optional[int] = None
    mesa_nombre: str
    qr_code: Optional[str] = None
    is_active: bool = True
    total_consumido: Decimal
    total_pagado: Decimal
    saldo_pendiente: Decimal
    consumos: List['ConsumoItemDetalle'] = []
    pagos: List['PagoView'] = []
    nivel: str = "bronce"
    model_config = ConfigDict(from_attributes=True, arbitrary_types_allowed=True)


class ResumenMesa(BaseModel):
    mesa_nombre: str
    usuarios: List['UsuarioPublico']
    consumo_total_mesa: Decimal
    canciones_pendientes_mesa: List['CancionAdminView']
    canciones_reproduciendo_mesa: Optional['CancionAdminView'] = None


class MesaConsumoResumen(BaseModel):
    mesa_id: int
    mesa_nombre: str
    total_consumido: Decimal
    consumos: List['ConsumoItemDetalle']
    model_config = ConfigDict(from_attributes=True)


# Deferred imports
from app.schemas.usuario import Usuario, UsuarioPublico  # noqa: E402
from app.schemas.consumo import ConsumoItemDetalle  # noqa: E402
from app.schemas.pago import PagoView  # noqa: E402
from app.schemas.cancion import CancionAdminView  # noqa: E402

Mesa.model_rebuild()
MesaEstadoPago.model_rebuild()
ResumenMesa.model_rebuild()
MesaConsumoResumen.model_rebuild()
