"""Schemas for Consumptions (Consumos)."""

from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from decimal import Decimal
from datetime import datetime


class ConsumoBase(BaseModel):
    producto_id: int
    cantidad: int = 1


class ConsumoCreate(ConsumoBase):
    pass


class Consumo(BaseModel):
    id: int
    cantidad: int
    valor_total: Decimal
    producto: 'ProductoBase'
    model_config = ConfigDict(from_attributes=True)


class CarritoItem(BaseModel):
    producto_id: int
    cantidad: int


class CarritoCreate(BaseModel):
    items: List[CarritoItem]


class ConsumoReciente(BaseModel):
    id: int
    cantidad: int
    valor_total: Decimal
    producto_nombre: str
    usuario_nick: str
    mesa_nombre: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ConsumoHistorial(BaseModel):
    id: int
    cantidad: int
    valor_total: Decimal
    created_at: datetime
    producto: 'ProductoBase'
    usuario: 'UsuarioBase'
    model_config = ConfigDict(from_attributes=True)


class ConsumoCantidadUpdate(BaseModel):
    cantidad: int


class ConsumoItemDetalle(BaseModel):
    id: Optional[int] = None
    producto_id: Optional[int] = None
    producto_nombre: str
    cantidad: int
    valor_total: Decimal
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# Deferred imports
from app.schemas.producto import ProductoBase  # noqa: E402
from app.schemas.usuario import UsuarioBase  # noqa: E402

Consumo.model_rebuild()
ConsumoHistorial.model_rebuild()
