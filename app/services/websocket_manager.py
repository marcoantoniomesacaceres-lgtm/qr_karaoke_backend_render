import json
from typing import List, Optional, Dict
from fastapi import WebSocket
from app import models
from fastapi.encoders import jsonable_encoder
import logging

logger = logging.getLogger(__name__)

from app import schemas, crud
from app.database import SessionLocal

class ConnectionManager:
    def __init__(self):
        # Mapeo: WebSocket -> Optional[int] (local_id)
        self.connection_locals: Dict[WebSocket, Optional[int]] = {}

    @property
    def active_connections(self) -> List[WebSocket]:
        return list(self.connection_locals.keys())

    async def connect(self, websocket: WebSocket, local_id: Optional[int] = None):
        await websocket.accept()
        self.connection_locals[websocket] = local_id
        logger.info(f"WebSocket conectado (local_id={local_id}). Total conexiones: {len(self.connection_locals)}")

    def disconnect(self, websocket: WebSocket):
        self.connection_locals.pop(websocket, None)

    def get_connections_for_local(self, local_id: Optional[int] = None) -> List[WebSocket]:
        if local_id is None:
            return list(self.connection_locals.keys())
        # Si local_id viene definido, enviar a los que coincidan con local_id o a los que no tienen local_id definido (globales)
        return [ws for ws, lid in self.connection_locals.items() if lid == local_id or lid is None]

    async def _broadcast(self, message: str, local_id: Optional[int] = None):
        """Método auxiliar para enviar un mensaje a las conexiones correspondientes al local_id."""
        dead_connections = []
        targets = self.get_connections_for_local(local_id)
        for connection in targets:
            try:
                await connection.send_text(message)
            except Exception:
                dead_connections.append(connection)

        for connection in dead_connections:
            self.disconnect(connection)

    async def broadcast_queue_update(self, queue_state: dict = None, local_id: Optional[int] = None):
        """
        Obtiene el ESTADO DEFINITIVO de la cola (filtrado por local_id) y lo envía a los clientes.
        """
        if queue_state:
            payload = {
                "type": "queue_update",
                "payload": queue_state,
                "local_id": local_id
            }
            await self._broadcast(json.dumps(payload, default=str), local_id=local_id)
            return

        db = SessionLocal()
        try:
            from app.db import crud
            # Usar el CRUD basado en cache filtrando por local_id
            queue_state = crud.get_cola_completa_con_lazy(db, local_id=local_id)
            
            payload = {
                "type": "queue_update",
                "payload": queue_state,
                "local_id": local_id
            }
            await self._broadcast(json.dumps(payload, default=str), local_id=local_id)
        except Exception as e:
            logger.error(f"Error broadcasting queue update: {e}", exc_info=True)
            print(f"Error broadcasting queue update: {e}")
        finally:
            db.close()

    async def broadcast_product_update(self, local_id: Optional[int] = None):
        """Envía una notificación para que los clientes recarguen el catálogo de productos."""
        payload = {"type": "product_update", "local_id": local_id}
        await self._broadcast(json.dumps(payload), local_id=local_id)

    async def broadcast_points_decay(self):
        """Notifica a todos los clientes que los puntos/créditos decayeron para que refresquen su perfil."""
        payload = {"type": "points_decayed"}
        await self._broadcast(json.dumps(payload))

    async def broadcast_consumo_created(self, consumo_payload: dict, local_id: Optional[int] = None):
        """
        Envía un evento indicando que se creó un nuevo consumo.
        """
        payload = {"type": "consumo_created", "payload": consumo_payload, "local_id": local_id}
        await self._broadcast(json.dumps(payload, default=str), local_id=local_id)

    async def broadcast_pedido_created(self, pedido_payload: dict, local_id: Optional[int] = None):
        """
        Envía un evento indicando que se creó un nuevo pedido consolidado.
        """
        payload = {"type": "pedido_created", "payload": pedido_payload, "local_id": local_id}
        await self._broadcast(json.dumps(payload, default=str), local_id=local_id)

    async def broadcast_consumo_deleted(self, consumo_payload: dict, local_id: Optional[int] = None):
        """
        Envía un evento indicando que un consumo fue eliminado.
        """
        payload = {"type": "consumo_deleted", "payload": consumo_payload, "local_id": local_id}
        await self._broadcast(json.dumps(payload), local_id=local_id)

    async def broadcast_reaction(self, reaction_payload: dict, local_id: Optional[int] = None):
        """
        Envía una reacción (emoticono) a los clientes del local_id.
        """
        payload = {"type": "reaction", "payload": reaction_payload, "local_id": local_id}
        await self._broadcast(json.dumps(payload), local_id=local_id)

    async def broadcast_song_finished(self, cancion: dict, local_id: Optional[int] = None):
        """
        Envía un evento indicando que una canción ha terminado y su puntuación.
        """
        titulo = cancion.get("titulo", "Desconocida")
        usuario_nick = cancion.get("usuario_nick", "N/A")
        puntuacion_ia = cancion.get("puntuacion_ia")
        is_karaoke = cancion.get("is_karaoke", False)
        
        payload = {
            "type": "song_finished",
            "payload": {
                "titulo": titulo,
                "usuario_nick": usuario_nick,
                "puntuacion_ia": puntuacion_ia,
                "is_karaoke": is_karaoke
            },
            "local_id": local_id
        }
        await self._broadcast(json.dumps(payload), local_id=local_id)

    async def broadcast_play_song(self, youtube_id: str, duration_seconds: int = 0, local_id: Optional[int] = None):
        """
        Envía un evento para reproducir una canción en el reproductor de esa sede.
        """
        try:
            logger.info(f"Emitiendo play_song (local_id={local_id}) -> youtube_id={youtube_id}, duration_seconds={duration_seconds}")
        except Exception:
            print(f"Emitiendo play_song (local_id={local_id}) -> youtube_id={youtube_id}, duration_seconds={duration_seconds}")

        payload = {
            "type": "play_song", 
            "payload": {
                "youtube_id": youtube_id,
                "duracion_seconds": duration_seconds
            },
            "local_id": local_id
        }
        await self._broadcast(json.dumps(payload), local_id=local_id)

    async def broadcast_restart_song(self, local_id: Optional[int] = None):
        """
        Envía un evento para reiniciar la canción actual en el reproductor.
        """
        payload = {"type": "restart_song", "local_id": local_id}
        await self._broadcast(json.dumps(payload), local_id=local_id)

    async def broadcast_pause(self, local_id: Optional[int] = None):
        """
        Envía un evento para pausar la reproducción actual.
        """
        payload = {"type": "pause_playback", "local_id": local_id}
        await self._broadcast(json.dumps(payload), local_id=local_id)

    async def broadcast_resume(self, local_id: Optional[int] = None):
        """
        Envía un evento para reanudar la reproducción.
        """
        payload = {"type": "resume_playback", "local_id": local_id}
        await self._broadcast(json.dumps(payload), local_id=local_id)

    async def broadcast_table_session_closed(self, mesa_id: int, mensaje: str = "Muchas gracias por acompañarnos, este QR ya no funciona.", local_id: Optional[int] = None):
        """
        Envía un evento de cierre de sesión de mesa para desconectar los dispositivos de esa mesa.
        """
        payload = {
            "type": "table_session_closed",
            "mesa_id": mesa_id,
            "mensaje": mensaje,
            "local_id": local_id
        }
        await self._broadcast(json.dumps(payload), local_id=local_id)

    async def broadcast_consumo_updated(self, consumo_data: dict, local_id: Optional[int] = None):
        """
        Notifica que un consumo fue actualizado en cantidad o valor.
        """
        payload = {
            "type": "consumo_updated",
            "payload": consumo_data,
            "local_id": local_id
        }
        await self._broadcast(json.dumps(payload), local_id=local_id)

    async def broadcast_notification(self, mensaje: str, local_id: Optional[int] = None):
        """
        Envía un mensaje de notificación a las pantallas conectadas.
        """
        payload = {
            "type": "notification",
            "payload": {
                "mensaje": mensaje
            },
            "local_id": local_id
        }
        await self._broadcast(json.dumps(payload), local_id=local_id)

manager = ConnectionManager()